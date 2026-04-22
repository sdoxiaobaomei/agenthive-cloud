/**
 * LLMService Unit Tests - Cache & Key Generation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LLMService } from '../../src/services/llm/LLMService.js'

// Hoisted mock for OllamaProvider so all instances share the same mock functions
const mockOllamaProvider = vi.hoisted(() => ({
  complete: vi.fn(),
  stream: vi.fn()
}))

vi.mock('../../src/services/llm/providers/ollama.js', () => ({
  OllamaProvider: vi.fn().mockImplementation(() => mockOllamaProvider)
}))

describe('LLMService', () => {
  beforeEach(() => {
    mockOllamaProvider.complete.mockReset()
    mockOllamaProvider.stream.mockReset()
  })

  describe('generateCacheKey', () => {
    it('should generate same key for identical input', () => {
      const service = new LLMService({
        defaultProvider: { provider: 'ollama', model: 'test' },
        enableCache: true
      })
      const messages = [{ role: 'user' as const, content: 'hello' }]
      const options = { model: 'test-model' }

      const key1 = (service as any).generateCacheKey(messages, options)
      const key2 = (service as any).generateCacheKey(messages, options)

      expect(key1).toBe(key2)
      expect(key1).toHaveLength(64) // SHA-256 hex = 64 chars
    })

    it('should generate different keys for different messages', () => {
      const service = new LLMService({
        defaultProvider: { provider: 'ollama', model: 'test' },
        enableCache: true
      })

      const key1 = (service as any).generateCacheKey([{ role: 'user' as const, content: 'hello' }])
      const key2 = (service as any).generateCacheKey([{ role: 'user' as const, content: 'world' }])

      expect(key1).not.toBe(key2)
    })

    it('should generate different keys for different options', () => {
      const service = new LLMService({
        defaultProvider: { provider: 'ollama', model: 'test' },
        enableCache: true
      })
      const messages = [{ role: 'user' as const, content: 'hello' }]

      const key1 = (service as any).generateCacheKey(messages, { model: 'model-a' })
      const key2 = (service as any).generateCacheKey(messages, { model: 'model-b' })

      expect(key1).not.toBe(key2)
    })
  })

  describe('cache hit / miss', () => {
    it('should return cached result on second identical call', async () => {
      mockOllamaProvider.complete.mockResolvedValue({
        content: 'Cached response',
        usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 }
      })

      const service = new LLMService({
        defaultProvider: { provider: 'ollama', model: 'test' },
        enableCache: true
      })

      const messages = [{ role: 'user' as const, content: 'hello' }]

      const result1 = await service.complete(messages)
      const result2 = await service.complete(messages)

      expect(result1.content).toBe('Cached response')
      expect(result2.content).toBe('Cached response')
      expect(mockOllamaProvider.complete).toHaveBeenCalledTimes(1)
    })

    it('should not cache when skipCache is true', async () => {
      mockOllamaProvider.complete.mockResolvedValue({
        content: 'Fresh response',
        usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 }
      })

      const service = new LLMService({
        defaultProvider: { provider: 'ollama', model: 'test' },
        enableCache: true
      })

      const messages = [{ role: 'user' as const, content: 'hello' }]

      await service.complete(messages, { skipCache: true })
      await service.complete(messages, { skipCache: true })

      expect(mockOllamaProvider.complete).toHaveBeenCalledTimes(2)
    })

    it('should not cache when enableCache is false', async () => {
      mockOllamaProvider.complete.mockResolvedValue({
        content: 'No cache',
        usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 }
      })

      const service = new LLMService({
        defaultProvider: { provider: 'ollama', model: 'test' },
        enableCache: false
      })

      const messages = [{ role: 'user' as const, content: 'hello' }]

      await service.complete(messages)
      await service.complete(messages)

      expect(mockOllamaProvider.complete).toHaveBeenCalledTimes(2)
    })
  })

  describe('cache expiration', () => {
    it('should expire cache after TTL', async () => {
      mockOllamaProvider.complete.mockResolvedValue({
        content: 'Expired',
        usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 }
      })

      const service = new LLMService({
        defaultProvider: { provider: 'ollama', model: 'test' },
        enableCache: true,
        cacheTTL: 0.01 // 10ms TTL
      })

      const messages = [{ role: 'user' as const, content: 'hello' }]

      await service.complete(messages)
      // wait longer than TTL to ensure expiration
      await new Promise((r) => setTimeout(r, 30))
      await service.complete(messages)

      expect(mockOllamaProvider.complete).toHaveBeenCalledTimes(2)
    })
  })

  describe('clearCache', () => {
    it('should clear all cached entries', async () => {
      mockOllamaProvider.complete.mockResolvedValue({
        content: 'Test',
        usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 }
      })

      const service = new LLMService({
        defaultProvider: { provider: 'ollama', model: 'test' },
        enableCache: true
      })

      await service.complete([{ role: 'user' as const, content: 'a' }])
      await service.complete([{ role: 'user' as const, content: 'b' }])

      expect(service.getCacheStats().size).toBe(2)

      service.clearCache()

      expect(service.getCacheStats().size).toBe(0)
    })
  })

  describe('getCacheStats', () => {
    it('should report correct cache size', async () => {
      mockOllamaProvider.complete.mockResolvedValue({
        content: 'Test',
        usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 }
      })

      const service = new LLMService({
        defaultProvider: { provider: 'ollama', model: 'test' },
        enableCache: true
      })

      expect(service.getCacheStats().size).toBe(0)
      expect(service.getCacheStats().maxSize).toBe(1000)

      await service.complete([{ role: 'user' as const, content: 'msg1' }])
      expect(service.getCacheStats().size).toBe(1)
    })
  })
})

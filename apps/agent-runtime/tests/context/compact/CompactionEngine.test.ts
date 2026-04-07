/**
 * Compaction Engine Tests - 上下文压缩引擎测试
 */

import { describe, it, expect, vi } from 'vitest'
import {
  CompactionEngine,
  SnipCompactionStrategy,
  CompactConversationStrategy,
  ContextCollapseStrategy,
  SimpleTokenEstimator,
  type CompactionConfig
} from '../../../src/context/compact/CompactionEngine.js'
import type { LLMMessage } from '../../../src/services/llm/types.js'
import type { LLMService } from '../../../src/services/llm/LLMService.js'

describe('Compaction Engine', () => {
  // Mock LLM Service
  const createMockLLMService = (): LLMService => ({
    complete: vi.fn(),
    stream: vi.fn(),
    isAvailable: vi.fn().mockReturnValue(true)
  } as any)

  // Test data
  const createMessages = (count: number): LLMMessage[] => {
    const messages: LLMMessage[] = [
      { role: 'system', content: 'You are a helpful assistant.' }
    ]
    
    for (let i = 0; i < count; i++) {
      messages.push(
        { role: 'user', content: `User message ${i + 1}: ${'a'.repeat(100)}` },
        { role: 'assistant', content: `Assistant response ${i + 1}: ${'b'.repeat(150)}` }
      )
    }
    
    return messages
  }

  describe('SimpleTokenEstimator', () => {
    it('should estimate tokens for messages', () => {
      const estimator = new SimpleTokenEstimator()
      const messages: LLMMessage[] = [
        { role: 'system', content: 'System prompt' },
        { role: 'user', content: 'Hello world' },
        { role: 'assistant', content: 'Hi there!' }
      ]

      const tokens = estimator.estimate(messages)
      
      expect(tokens).toBeGreaterThan(0)
      expect(tokens).toBe(
        estimator.estimateSingle(messages[0]) +
        estimator.estimateSingle(messages[1]) +
        estimator.estimateSingle(messages[2])
      )
    })

    it('should estimate single message', () => {
      const estimator = new SimpleTokenEstimator()
      const message: LLMMessage = { role: 'user', content: 'Hello world' }

      const tokens = estimator.estimateSingle(message)
      
      // 11 chars * 0.25 + 4 = ~7 tokens
      expect(tokens).toBeGreaterThanOrEqual(7)
    })

    it('should handle empty content', () => {
      const estimator = new SimpleTokenEstimator()
      const message: LLMMessage = { role: 'user', content: '' }

      const tokens = estimator.estimateSingle(message)
      
      // Just the base overhead
      expect(tokens).toBe(4)
    })
  })

  describe('SnipCompactionStrategy', () => {
    it('should remove middle messages', async () => {
      const strategy = new SnipCompactionStrategy()
      const messages = createMessages(5) // 11 messages total

      const result = await strategy.compact(messages, {
        ratio: 0.5,
        keepFirstN: 1,
        keepLastN: 2
      })

      expect(result.strategy).toBe('snip')
      expect(result.originalMessages).toBe(11)
      expect(result.messages.length).toBeLessThan(result.originalMessages)
      expect(result.tokensSaved).toBeGreaterThan(0)
      expect(result.compactionRatio).toBeGreaterThan(0)
    })

    it('should preserve system messages by default', async () => {
      const strategy = new SnipCompactionStrategy()
      const messages: LLMMessage[] = [
        { role: 'system', content: 'System prompt' },
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi' }
      ]

      const result = await strategy.compact(messages, {
        ratio: 0.5,
        keepFirstN: 1,
        keepLastN: 1
      })

      const systemMessages = result.messages.filter(m => m.role === 'system')
      expect(systemMessages.length).toBe(1)
      expect(systemMessages[0].content).toBe('System prompt')
    })

    it('should handle messages smaller than keep counts', async () => {
      const strategy = new SnipCompactionStrategy()
      const messages: LLMMessage[] = [
        { role: 'system', content: 'System' },
        { role: 'user', content: 'Hello' }
      ]

      const result = await strategy.compact(messages, {
        ratio: 0.5,
        keepFirstN: 1,
        keepLastN: 1
      })

      // When messages are too few, should return original
      expect(result.messages.length).toBe(messages.length)
      expect(result.tokensSaved).toBe(0)
      expect(result.summary).toBe('No messages to remove')
    })

    it('should respect keepSystem: false', async () => {
      const strategy = new SnipCompactionStrategy()
      const messages: LLMMessage[] = [
        { role: 'system', content: 'System prompt' },
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi' }
      ]

      const result = await strategy.compact(messages, {
        ratio: 0.5,
        keepSystem: false,
        keepFirstN: 1,
        keepLastN: 1
      })

      const systemMessages = result.messages.filter(m => m.role === 'system')
      expect(systemMessages.length).toBe(0)
    })
  })

  describe('CompactConversationStrategy', () => {
    it('should summarize older messages', async () => {
      const mockLLM = createMockLLMService()
      vi.mocked(mockLLM.complete).mockResolvedValue({
        content: 'Summary of conversation',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 }
      } as any)

      const strategy = new CompactConversationStrategy(mockLLM)
      const messages = createMessages(5)

      const result = await strategy.compact(messages, {
        keepRecent: 2,
        keepSystem: true
      })

      expect(result.strategy).toBe('compact')
      expect(result.summary).toBe('Summary of conversation')
      expect(mockLLM.complete).toHaveBeenCalled()
      
      // Should have: system + summary + 4 recent messages (2 pairs)
      expect(result.messages.length).toBeLessThan(messages.length)
    })

    it('should skip compression if no old messages', async () => {
      const mockLLM = createMockLLMService()
      const strategy = new CompactConversationStrategy(mockLLM)
      
      const messages: LLMMessage[] = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi' }
      ]

      const result = await strategy.compact(messages, {
        keepRecent: 4,
        keepSystem: false
      })

      // No messages to compress
      expect(result.messages.length).toBe(messages.length)
      expect(result.tokensSaved).toBe(0)
      expect(mockLLM.complete).not.toHaveBeenCalled()
    })

    it('should handle summary generation failure', async () => {
      const mockLLM = createMockLLMService()
      vi.mocked(mockLLM.complete).mockRejectedValue(new Error('LLM error'))

      const strategy = new CompactConversationStrategy(mockLLM)
      const messages = createMessages(5)

      const result = await strategy.compact(messages, {
        keepRecent: 2
      })

      expect(result.summary).toBe('Summary generation failed')
    })

    it('should handle empty summary response', async () => {
      const mockLLM = createMockLLMService()
      vi.mocked(mockLLM.complete).mockResolvedValue({
        content: '',
        usage: { promptTokens: 100, completionTokens: 0, totalTokens: 100 }
      } as any)

      const strategy = new CompactConversationStrategy(mockLLM)
      const messages = createMessages(3)

      const result = await strategy.compact(messages, {
        keepRecent: 2
      })

      expect(result.summary).toBe('No summary available')
    })
  })

  describe('ContextCollapseStrategy', () => {
    it('should collapse all conversation to summary', async () => {
      const mockLLM = createMockLLMService()
      vi.mocked(mockLLM.complete).mockResolvedValue({
        content: 'Full conversation summary with all key points',
        usage: { promptTokens: 200, completionTokens: 100, totalTokens: 300 }
      } as any)

      const strategy = new ContextCollapseStrategy(mockLLM)
      const messages = createMessages(5)

      const result = await strategy.compact(messages, {
        keepSystem: true,
        preserveTask: true
      })

      expect(result.strategy).toBe('collapse')
      expect(result.summary).toBe('Full conversation summary with all key points')
      
      // Should have: system + summary (with task context)
      expect(result.messages.length).toBe(2)
      
      // Check that task context is included
      const summaryMsg = result.messages.find(m => m.role !== 'system')
      expect(summaryMsg?.content).toContain('Complete context summary')
    })

    it('should preserve task context when enabled', async () => {
      const mockLLM = createMockLLMService()
      vi.mocked(mockLLM.complete).mockResolvedValue({
        content: 'Summary',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 }
      } as any)

      const strategy = new ContextCollapseStrategy(mockLLM)
      const messages: LLMMessage[] = [
        { role: 'system', content: 'System' },
        { role: 'user', content: 'Do something important' },
        { role: 'assistant', content: 'Working on it' }
      ]

      const result = await strategy.compact(messages, {
        keepSystem: false,
        preserveTask: true
      })

      const summaryMsg = result.messages[0]
      expect(summaryMsg.content).toContain('Current task:')
      expect(summaryMsg.content).toContain('Do something important')
    })

    it('should handle collapse without task preservation', async () => {
      const mockLLM = createMockLLMService()
      vi.mocked(mockLLM.complete).mockResolvedValue({
        content: 'Summary',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 }
      } as any)

      const strategy = new ContextCollapseStrategy(mockLLM)
      const messages = createMessages(3)

      const result = await strategy.compact(messages, {
        keepSystem: true,
        preserveTask: false
      })

      const summaryMsg = result.messages.find(m => m.role !== 'system')
      expect(summaryMsg?.content).not.toContain('Current task:')
    })
  })

  describe('CompactionEngine', () => {
    it('should auto-select strategy based on token count', async () => {
      const mockLLM = createMockLLMService()
      vi.mocked(mockLLM.complete).mockResolvedValue({
        content: 'Summary',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 }
      } as any)

      const config: CompactionConfig = {
        llmService: mockLLM,
        snipThreshold: 50,
        compactThreshold: 300,
        collapseThreshold: 1000
      }

      const engine = new CompactionEngine(config)

      // Test snip threshold (token count ~108 < compactThreshold 300)
      const snipMessages = createMessages(3)
      const snipResult = await engine.compact(snipMessages)
      expect(snipResult.strategy).toBe('snip')

      // Test no compaction needed
      const smallMessages: LLMMessage[] = [
        { role: 'user', content: 'Hi' }
      ]
      const noCompactResult = await engine.compact(smallMessages)
      expect(noCompactResult.tokensSaved).toBe(0)
    })

    it('should use specified strategy', async () => {
      const mockLLM = createMockLLMService()
      vi.mocked(mockLLM.complete).mockResolvedValue({
        content: 'Summary',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 }
      } as any)

      const config: CompactionConfig = { llmService: mockLLM }
      const engine = new CompactionEngine(config)
      const messages = createMessages(5)

      const result = await engine.compactWithStrategy(messages, 'snip', {
        ratio: 0.3,
        keepFirstN: 1,
        keepLastN: 2
      })

      expect(result.strategy).toBe('snip')
    })

    it('should throw on unknown strategy', async () => {
      const mockLLM = createMockLLMService()
      const config: CompactionConfig = { llmService: mockLLM }
      const engine = new CompactionEngine(config)

      await expect(
        engine.compactWithStrategy([], 'unknown' as any, {})
      ).rejects.toThrow('Unknown compaction strategy')
    })

    it('should estimate tokens correctly', () => {
      const mockLLM = createMockLLMService()
      const config: CompactionConfig = { llmService: mockLLM }
      const engine = new CompactionEngine(config)
      const messages = createMessages(2)

      const tokens = engine.estimateTokens(messages)
      expect(tokens).toBeGreaterThan(0)
    })

    it('should allow custom strategy', async () => {
      const mockLLM = createMockLLMService()
      const config: CompactionConfig = { llmService: mockLLM }
      const engine = new CompactionEngine(config)

      const customStrategy = {
        name: 'snip' as const,
        compact: vi.fn().mockResolvedValue({
          strategy: 'snip',
          messages: [],
          originalMessages: 10,
          compressedTokens: 100,
          originalTokens: 500,
          tokensSaved: 400,
          compactionRatio: 0.8
        })
      }

      engine.setStrategy('snip', customStrategy)

      const messages = createMessages(5)
      await engine.compactWithStrategy(messages, 'snip', {})

      expect(customStrategy.compact).toHaveBeenCalled()
    })

    it('should update configuration', () => {
      const mockLLM = createMockLLMService()
      const config: CompactionConfig = {
        llmService: mockLLM,
        snipThreshold: 1000
      }
      const engine = new CompactionEngine(config)

      engine.updateConfig({ snipThreshold: 500, compactThreshold: 2000 })

      // Config is updated (no direct way to verify, but should not throw)
      expect(() => engine.updateConfig({})).not.toThrow()
    })
  })
})

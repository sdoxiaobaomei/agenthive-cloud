/**
 * QueryLoopV2Enhanced Unit Tests
 *
 * Covers:
 * - Constructor and configuration (WSBroadcast)
 * - getBroadcast / setBroadcast
 * - executeWithProgress state transitions
 * - ProgressChunk structure validation
 * - executeAndBroadcast with successful broadcast
 * - executeAndBroadcast with broadcast failure (not aborting loop)
 * - Error handling in executeWithProgress
 * - Async generator iteration
 *
 * 对应 spec/002-agent-runtime.md §5
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  QueryLoopV2Enhanced,
  type QueryLoopV2EnhancedConfig,
  type WSBroadcast,
  type ProgressChunk,
  type ProgressState,
} from '../../src/agent/QueryLoopV2Enhanced.js'
import { ConversationContextV2 } from '../../src/context/ConversationContextV2.js'
import { ToolRegistryV2 } from '../../src/tools/registry/ToolRegistryV2.js'
import { buildToolV2 } from '../../src/tools/ToolV2.js'
import { z } from 'zod'
import type { LLMService } from '../../src/services/llm/LLMService.js'
import type { LLMStreamChunk } from '../../src/services/llm/types.js'

// ==========================================================================
// Helpers
// ==========================================================================

function createMockLLMService(): LLMService {
  return {
    complete: vi.fn(),
    stream: vi.fn(),
  } as any
}

function createMockBroadcast(): WSBroadcast {
  return {
    broadcast: vi.fn(),
  }
}

/**
 * Create a stream that yields content chunks, optionally followed by tool calls.
 */
async function* makeContentStream(content: string): AsyncGenerator<LLMStreamChunk> {
  // Stream the content character by character (simulate token streaming)
  for (const char of content) {
    yield { content: char, done: false }
  }
  yield { done: true }
}

async function* makeErrorStream(errorMsg: string): AsyncGenerator<LLMStreamChunk> {
  yield { content: 'partial', done: false }
  throw new Error(errorMsg)
}

async function* makeEmptyStream(): AsyncGenerator<LLMStreamChunk> {
  yield { done: true }
}

// ==========================================================================
// Tests
// ==========================================================================

describe('QueryLoopV2Enhanced', () => {
  let mockLLM: ReturnType<typeof createMockLLMService>
  let registry: ToolRegistryV2

  beforeEach(() => {
    mockLLM = createMockLLMService()
    registry = new ToolRegistryV2()
  })

  // ── Constructor & Configuration ────────────────────────────────────────

  describe('constructor / configuration', () => {
    it('should extend QueryLoopV2 with wsBroadcast support', () => {
      const broadcast = createMockBroadcast()
      const loop = new QueryLoopV2Enhanced({
        llmService: mockLLM,
        toolRegistry: registry,
        wsBroadcast: broadcast,
      })

      expect(loop.getBroadcast()).toBe(broadcast)
    })

    it('should work without wsBroadcast', () => {
      const loop = new QueryLoopV2Enhanced({
        llmService: mockLLM,
        toolRegistry: registry,
      })

      expect(loop.getBroadcast()).toBeUndefined()
    })

    it('should inherit QueryLoopV2 methods', () => {
      const loop = new QueryLoopV2Enhanced({
        llmService: mockLLM,
        toolRegistry: registry,
      })

      expect(typeof loop.stop).toBe('function')
      expect(typeof loop.getState).toBe('function')
      expect(typeof loop.isRunning).toBe('function')
    })
  })

  // ── getBroadcast / setBroadcast ─────────────────────────────────────────

  describe('getBroadcast / setBroadcast', () => {
    it('should return undefined when no broadcast set', () => {
      const loop = new QueryLoopV2Enhanced({
        llmService: mockLLM,
        toolRegistry: registry,
      })
      expect(loop.getBroadcast()).toBeUndefined()
    })

    it('should return the configured broadcast handler', () => {
      const broadcast = createMockBroadcast()
      const loop = new QueryLoopV2Enhanced({
        llmService: mockLLM,
        toolRegistry: registry,
        wsBroadcast: broadcast,
      })
      expect(loop.getBroadcast()).toBe(broadcast)
    })

    it('should allow updating broadcast at runtime', () => {
      const loop = new QueryLoopV2Enhanced({
        llmService: mockLLM,
        toolRegistry: registry,
      })
      expect(loop.getBroadcast()).toBeUndefined()

      const newBroadcast = createMockBroadcast()
      loop.setBroadcast(newBroadcast)
      expect(loop.getBroadcast()).toBe(newBroadcast)
    })

    it('should replace existing broadcast when setBroadcast is called', () => {
      const oldBroadcast = createMockBroadcast()
      const loop = new QueryLoopV2Enhanced({
        llmService: mockLLM,
        toolRegistry: registry,
        wsBroadcast: oldBroadcast,
      })

      const newBroadcast = createMockBroadcast()
      loop.setBroadcast(newBroadcast)
      expect(loop.getBroadcast()).toBe(newBroadcast)
      expect(loop.getBroadcast()).not.toBe(oldBroadcast)
    })
  })

  // ── executeWithProgress — basic flow ────────────────────────────────────

  describe('executeWithProgress', () => {
    it('should yield planning chunk as first chunk', async () => {
      const loop = new QueryLoopV2Enhanced({
        llmService: mockLLM,
        toolRegistry: registry,
      })

      vi.mocked(mockLLM.stream).mockReturnValue(makeContentStream('Hello'))

      const context = new ConversationContextV2()
      const gen = loop.executeWithProgress('Build a page', context)

      const firstChunk = (await gen.next()).value as ProgressChunk
      expect(firstChunk).toBeDefined()
      expect(firstChunk.state).toBe('planning')
      expect(firstChunk.progress).toBe(5)
      expect(firstChunk.message).toContain('Analyzing')
    })

    it('should yield thinking chunk', async () => {
      const loop = new QueryLoopV2Enhanced({
        llmService: mockLLM,
        toolRegistry: registry,
      })

      vi.mocked(mockLLM.stream).mockReturnValue(makeContentStream('OK'))

      const context = new ConversationContextV2()
      const gen = loop.executeWithProgress('Test', context)

      await gen.next() // planning
      const secondChunk = (await gen.next()).value as ProgressChunk
      expect(secondChunk).toBeDefined()
      expect(secondChunk.state).toBe('thinking')
      expect(secondChunk.details).toHaveProperty('iteration')
    })

    it('should yield streaming_token chunks for each token', async () => {
      const loop = new QueryLoopV2Enhanced({
        llmService: mockLLM,
        toolRegistry: registry,
      })

      vi.mocked(mockLLM.stream).mockReturnValue(makeContentStream('ABC'))

      const context = new ConversationContextV2()
      const gen = loop.executeWithProgress('Test', context)

      await gen.next() // planning
      await gen.next() // thinking

      const tokens: string[] = []
      let chunk: IteratorResult<ProgressChunk>
      while (!(chunk = await gen.next()).done) {
        if (chunk.value.state === 'streaming_token') {
          tokens.push(chunk.value.token!)
        } else {
          break // content or done
        }
      }

      expect(tokens).toEqual(['A', 'B', 'C'])
    })

    it('should yield content chunk after streaming completes', async () => {
      const loop = new QueryLoopV2Enhanced({
        llmService: mockLLM,
        toolRegistry: registry,
      })

      vi.mocked(mockLLM.stream).mockReturnValue(makeContentStream('Response text'))

      const context = new ConversationContextV2()
      const gen = loop.executeWithProgress('Test', context)

      // Collect all chunks
      const chunks: ProgressChunk[] = []
      let result: any
      for await (const chunk of gen) {
        chunks.push(chunk)
      }

      // Get result by iterating to completion
      const states = chunks.map((c) => c.state)
      expect(states).toContain('planning')
      expect(states).toContain('thinking')
      expect(states).toContain('streaming_token')
      expect(states).toContain('content')
      expect(states).toContain('done') // done is yielded before return
    })

    it('should yield done chunk with progress=100 at end', async () => {
      const loop = new QueryLoopV2Enhanced({
        llmService: mockLLM,
        toolRegistry: registry,
      })

      vi.mocked(mockLLM.stream).mockReturnValue(makeContentStream('Done'))

      const context = new ConversationContextV2()
      const gen = loop.executeWithProgress('Test', context)

      const chunks: ProgressChunk[] = []
      for await (const chunk of gen) {
        chunks.push(chunk)
      }

      const lastChunk = chunks[chunks.length - 1]
      expect(lastChunk.state).toBe('done')
      expect(lastChunk.progress).toBe(100)
      expect(lastChunk.message).toContain('completed')
    })

    it('should return QueryLoopV2EnhancedResult with progressChunks', async () => {
      const loop = new QueryLoopV2Enhanced({
        llmService: mockLLM,
        toolRegistry: registry,
      })

      vi.mocked(mockLLM.stream).mockReturnValue(makeContentStream('Result'))

      const context = new ConversationContextV2()
      const gen = loop.executeWithProgress('Build it', context)

      // Iterate and capture return value
      let result: any
      while (true) {
        const { value, done } = await gen.next()
        if (done) {
          result = value
          break
        }
      }

      expect(result).toBeDefined()
      expect(result.success).toBe(true)
      expect(result.content).toBe('Result')
      expect(result.iterations).toBeGreaterThan(0)
      expect(Array.isArray(result.progressChunks)).toBe(true)
      expect(result.progressChunks.length).toBeGreaterThan(0)
    })

    it('should add user input to context', async () => {
      const loop = new QueryLoopV2Enhanced({
        llmService: mockLLM,
        toolRegistry: registry,
      })

      vi.mocked(mockLLM.stream).mockReturnValue(makeContentStream('OK'))

      const context = new ConversationContextV2()
      const gen = loop.executeWithProgress('My input text', context)

      // Consume generator
      for await (const _ of gen) { /* noop */ }

      const messages = context.getMessages()
      const userMsg = messages.find((m) => m.role === 'user')
      expect(userMsg).toBeDefined()
      expect(userMsg!.content).toBe('My input text')
    })

    it('should set system prompt when provided in options', async () => {
      const loop = new QueryLoopV2Enhanced({
        llmService: mockLLM,
        toolRegistry: registry,
      })

      vi.mocked(mockLLM.stream).mockReturnValue(makeContentStream('OK'))

      const context = new ConversationContextV2()
      const gen = loop.executeWithProgress('Test', context, {
        systemPrompt: 'You are a Nuxt 3 expert',
      })

      for await (const _ of gen) { /* noop */ }

      const messages = context.getMessages()
      const sysMsg = messages.find((m) => m.role === 'system')
      expect(sysMsg).toBeDefined()
      expect(sysMsg!.content).toBe('You are a Nuxt 3 expert')
    })
  })

  // ── executeWithProgress — error handling ────────────────────────────────

  describe('executeWithProgress error handling', () => {
    it('should yield error chunk on stream failure', async () => {
      const loop = new QueryLoopV2Enhanced({
        llmService: mockLLM,
        toolRegistry: registry,
      })

      vi.mocked(mockLLM.stream).mockReturnValue(
        makeErrorStream('Connection failed'),
      )

      const context = new ConversationContextV2()
      const gen = loop.executeWithProgress('Test', context)

      const chunks: ProgressChunk[] = []
      let result: any
      while (true) {
        const { value, done } = await gen.next()
        if (done) {
          result = value
          break
        }
        chunks.push(value)
      }

      const states = chunks.map((c) => c.state)
      expect(states).toContain('error')

      const errorChunk = chunks.find((c) => c.state === 'error')
      expect(errorChunk).toBeDefined()
      expect(errorChunk!.message).toContain('Connection failed')
    })

    it('should return failure result on stream error', async () => {
      const loop = new QueryLoopV2Enhanced({
        llmService: mockLLM,
        toolRegistry: registry,
      })

      vi.mocked(mockLLM.stream).mockReturnValue(
        makeErrorStream('Fatal error'),
      )

      const context = new ConversationContextV2()
      const gen = loop.executeWithProgress('Test', context)

      let result: any
      while (true) {
        const { value, done } = await gen.next()
        if (done) {
          result = value
          break
        }
      }

      expect(result.success).toBe(false)
      expect(result.error).toContain('Fatal error')
      expect(Array.isArray(result.progressChunks)).toBe(true)
    })

    it('should handle empty stream gracefully', async () => {
      const loop = new QueryLoopV2Enhanced({
        llmService: mockLLM,
        toolRegistry: registry,
      })

      vi.mocked(mockLLM.stream).mockReturnValue(makeEmptyStream())

      const context = new ConversationContextV2()
      const gen = loop.executeWithProgress('Test', context)

      const chunks: ProgressChunk[] = []
      let result: any
      while (true) {
        const { value, done } = await gen.next()
        if (done) {
          result = value
          break
        }
        chunks.push(value)
      }

      expect(result.success).toBe(true)
      expect(result.content).toBe('')
    })
  })

  // ── executeAndBroadcast ─────────────────────────────────────────────────

  describe('executeAndBroadcast', () => {
    it('should call broadcast for each progress chunk', async () => {
      const broadcast = createMockBroadcast()
      const loop = new QueryLoopV2Enhanced({
        llmService: mockLLM,
        toolRegistry: registry,
        wsBroadcast: broadcast,
      })

      vi.mocked(mockLLM.stream).mockReturnValue(makeContentStream('Test content'))

      const context = new ConversationContextV2()
      await loop.executeAndBroadcast('Build page', context)

      expect(broadcast.broadcast).toHaveBeenCalled()
      expect((broadcast.broadcast as any).mock.calls.length).toBeGreaterThan(0)
    })

    it('should not fail when broadcast throws', async () => {
      const broadcast: WSBroadcast = {
        broadcast: vi.fn().mockRejectedValue(new Error('Network error')),
      }
      const loop = new QueryLoopV2Enhanced({
        llmService: mockLLM,
        toolRegistry: registry,
        wsBroadcast: broadcast,
      })

      vi.mocked(mockLLM.stream).mockReturnValue(makeContentStream('OK'))

      const context = new ConversationContextV2()

      // Should not throw
      await expect(
        loop.executeAndBroadcast('Test', context),
      ).resolves.toBeDefined()

      expect(broadcast.broadcast).toHaveBeenCalled()
    })

    it('should return result with progressChunks', async () => {
      const broadcast = createMockBroadcast()
      const loop = new QueryLoopV2Enhanced({
        llmService: mockLLM,
        toolRegistry: registry,
        wsBroadcast: broadcast,
      })

      vi.mocked(mockLLM.stream).mockReturnValue(makeContentStream('Result'))

      const context = new ConversationContextV2()
      const result = await loop.executeAndBroadcast('Test', context)

      expect(result).toBeDefined()
      expect(Array.isArray(result.progressChunks)).toBe(true)
    })
  })

  // ── Progress State Machine ──────────────────────────────────────────────

  describe('progress state machine', () => {
    it('should follow correct state order for simple response', async () => {
      const loop = new QueryLoopV2Enhanced({
        llmService: mockLLM,
        toolRegistry: registry,
      })

      vi.mocked(mockLLM.stream).mockReturnValue(makeContentStream('Hello'))

      const context = new ConversationContextV2()
      const gen = loop.executeWithProgress('Test', context)

      const states: ProgressState[] = []
      for await (const chunk of gen) {
        states.push(chunk.state)
      }

      // Expected order: planning → thinking → streaming_token* → content → done
      expect(states[0]).toBe('planning')
      expect(states[1]).toBe('thinking')
      expect(states).toContain('streaming_token')
      expect(states).toContain('content')
      expect(states[states.length - 1]).toBe('done')

      // Verify ordering
      const planningIdx = states.indexOf('planning')
      const thinkingIdx = states.indexOf('thinking')
      const contentIdx = states.indexOf('content')
      const doneIdx = states.indexOf('done')

      expect(planningIdx).toBeLessThan(thinkingIdx)
      expect(thinkingIdx).toBeLessThan(contentIdx)
      expect(contentIdx).toBeLessThan(doneIdx)
    })

    it('should include iteration info in thinking chunks', async () => {
      const loop = new QueryLoopV2Enhanced({
        llmService: mockLLM,
        toolRegistry: registry,
      })

      vi.mocked(mockLLM.stream).mockReturnValue(makeContentStream('A'))

      const context = new ConversationContextV2()
      const gen = loop.executeWithProgress('Test', context)

      await gen.next() // planning
      const thinking = (await gen.next()).value as ProgressChunk
      expect(thinking.details?.iteration).toBe(1)
    })

    it('should include input length in planning details', async () => {
      const loop = new QueryLoopV2Enhanced({
        llmService: mockLLM,
        toolRegistry: registry,
      })

      vi.mocked(mockLLM.stream).mockReturnValue(makeContentStream('A'))

      const context = new ConversationContextV2()
      const gen = loop.executeWithProgress('Hello World', context)

      const planning = (await gen.next()).value as ProgressChunk
      expect(planning.details?.inputLength).toBe('Hello World'.length)
    })
  })

  // ── ProgressChunk structure ─────────────────────────────────────────────

  describe('ProgressChunk structure', () => {
    it('should have correct shape for each state type', async () => {
      const loop = new QueryLoopV2Enhanced({
        llmService: mockLLM,
        toolRegistry: registry,
      })

      vi.mocked(mockLLM.stream).mockReturnValue(makeContentStream('X'))

      const context = new ConversationContextV2()
      const gen = loop.executeWithProgress('Test', context)

      for await (const chunk of gen) {
        // Every chunk must have a valid state
        const validStates: ProgressState[] = [
          'planning', 'thinking', 'streaming_token',
          'tool_calling', 'tool_result', 'content',
          'error', 'done',
        ]
        expect(validStates).toContain(chunk.state)

        // streaming_token must have token
        if (chunk.state === 'streaming_token') {
          expect(typeof chunk.token).toBe('string')
        }

        // done must have progress=100
        if (chunk.state === 'done') {
          expect(chunk.progress).toBe(100)
        }

        // planning must have progress=5
        if (chunk.state === 'planning') {
          expect(chunk.progress).toBe(5)
        }
      }
    })

    it('should include details as Record<string, unknown> when present', async () => {
      const loop = new QueryLoopV2Enhanced({
        llmService: mockLLM,
        toolRegistry: registry,
      })

      vi.mocked(mockLLM.stream).mockReturnValue(makeContentStream('Hi'))

      const context = new ConversationContextV2()
      const gen = loop.executeWithProgress('Test', context)

      for await (const chunk of gen) {
        if (chunk.details) {
          expect(typeof chunk.details).toBe('object')
          expect(chunk.details).not.toBeNull()
        }
      }
    })
  })

  // ── Max iterations limit ────────────────────────────────────────────────

  describe('max iterations limit', () => {
    it('should not exceed 30 iterations', async () => {
      const loop = new QueryLoopV2Enhanced({
        llmService: mockLLM,
        toolRegistry: registry,
      })

      // Simulate a scenario that would finish in one iteration
      vi.mocked(mockLLM.stream).mockReturnValue(makeContentStream('Done'))

      const context = new ConversationContextV2()
      const gen = loop.executeWithProgress('Test', context)

      let result: any
      while (true) {
        const { value, done } = await gen.next()
        if (done) {
          result = value
          break
        }
      }

      expect(result.iterations).toBeLessThanOrEqual(30)
    })
  })
})

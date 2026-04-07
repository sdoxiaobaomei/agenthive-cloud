/**
 * QueryLoopV2 Tests - 增强版查询循环测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryLoopV2 } from '../../src/agent/QueryLoopV2.js'
import { ConversationContextV2 } from '../../src/context/ConversationContextV2.js'
import { ToolRegistryV2 } from '../../src/tools/registry/ToolRegistryV2.js'
import { buildToolV2 } from '../../src/tools/ToolV2.js'
import { z } from 'zod'
import type { LLMService } from '../../src/services/llm/LLMService.js'
import type { CompactionEngine } from '../../src/context/compact/CompactionEngine.js'
import type { LLMCompletionResult } from '../../src/services/llm/types.js'

describe('QueryLoopV2', () => {
  // Mock LLM Service
  const createMockLLMService = (): LLMService => ({
    complete: vi.fn(),
    stream: vi.fn(),
    isAvailable: vi.fn().mockReturnValue(true)
  } as any)

  // Mock Compaction Engine
  const createMockCompactionEngine = (): CompactionEngine => ({
    compact: vi.fn(),
    compactWithStrategy: vi.fn(),
    estimateTokens: vi.fn().mockReturnValue(100),
    setStrategy: vi.fn(),
    updateConfig: vi.fn()
  } as any)

  let mockLLM: ReturnType<typeof createMockLLMService>
  let mockCompaction: ReturnType<typeof createMockCompactionEngine>
  let registry: ToolRegistryV2
  let context: ConversationContextV2

  beforeEach(() => {
    mockLLM = createMockLLMService()
    mockCompaction = createMockCompactionEngine()
    registry = new ToolRegistryV2()
    context = new ConversationContextV2()
  })

  describe('Basic Execution', () => {
    it('should execute simple query without tools', async () => {
      const loop = new QueryLoopV2({
        llmService: mockLLM,
        toolRegistry: registry,
        enableCompaction: false
      })

      vi.mocked(mockLLM.complete).mockResolvedValue({
        content: 'Hello! How can I help you?',
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 }
      } as LLMCompletionResult)

      const result = await loop.execute('Hello', context)

      expect(result.success).toBe(true)
      expect(result.content).toBe('Hello! How can I help you?')
      expect(result.iterations).toBe(1)
      expect(result.toolCalls).toHaveLength(0)
    })

    it('should handle tool calls', async () => {
      // Register a test tool
      const testTool = buildToolV2({
        name: 'test_tool',
        description: 'A test tool',
        inputSchema: z.object({ input: z.string() }),
        async call(input, ctx, canUse) {
          return { type: 'result', data: `Processed: ${input.input}`, resultForAssistant: `Processed: ${input.input}` }
        },
        isReadOnly: () => true
      })
      registry.register(testTool)

      const loop = new QueryLoopV2({
        llmService: mockLLM,
        toolRegistry: registry,
        enableCompaction: false
      })

      // First call: request tool
      vi.mocked(mockLLM.complete)
        .mockResolvedValueOnce({
          content: '',
          toolCalls: [{
            id: 'call_1',
            function: {
              name: 'test_tool',
              arguments: JSON.stringify({ input: 'hello' })
            },
            type: 'function'
          }],
          usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 }
        } as LLMCompletionResult)
        // Second call: final response
        .mockResolvedValueOnce({
          content: 'Done!',
          usage: { promptTokens: 20, completionTokens: 5, totalTokens: 25 }
        } as LLMCompletionResult)

      const result = await loop.execute('Do something', context)

      expect(result.success).toBe(true)
      expect(result.content).toBe('Done!')
      expect(result.iterations).toBe(2)
      expect(result.toolCalls).toHaveLength(1)
      expect(result.toolCalls[0].name).toBe('test_tool')
      expect(result.toolCalls[0].output).toBe('Processed: hello')
    })

    it('should throw if already running', async () => {
      const loop = new QueryLoopV2({
        llmService: mockLLM,
        toolRegistry: registry,
        enableCompaction: false
      })

      vi.mocked(mockLLM.complete).mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          content: 'Response',
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 }
        } as LLMCompletionResult), 100))
      )

      // Start first execution
      const exec1 = loop.execute('Hello', context)
      
      // Try to start second execution while first is running
      await expect(loop.execute('Hello again', context)).rejects.toThrow('already running')

      await exec1
    })

    it('should respect maxIterations', async () => {
      const loop = new QueryLoopV2({
        llmService: mockLLM,
        toolRegistry: registry,
        maxIterations: 2,
        enableCompaction: false
      })

      // Always request tool calls to force loop
      vi.mocked(mockLLM.complete).mockResolvedValue({
        content: '',
        toolCalls: [{
          id: 'call_1',
          function: {
            name: 'unknown_tool',
            arguments: '{}'
          },
          type: 'function'
        }],
        usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 }
      } as LLMCompletionResult)

      const result = await loop.execute('Test', context)

      // Should stop after maxIterations
      expect(result.iterations).toBe(2)
    })
  })

  describe('Error Handling', () => {
    it('should handle LLM errors', async () => {
      const loop = new QueryLoopV2({
        llmService: mockLLM,
        toolRegistry: registry,
        enableCompaction: false
      })

      // Add error handler to prevent unhandled error event
      loop.on('error', () => {})

      vi.mocked(mockLLM.complete).mockRejectedValue(new Error('LLM service unavailable'))

      const result = await loop.execute('Hello', context)

      expect(result.success).toBe(false)
      expect(result.error).toBe('LLM service unavailable')
    })

    it('should handle tool execution errors', async () => {
      const errorTool = buildToolV2({
        name: 'error_tool',
        description: 'A tool that errors',
        inputSchema: z.object({}),
        async call() {
          throw new Error('Tool failed!')
        },
        isReadOnly: () => true
      })
      registry.register(errorTool)

      const loop = new QueryLoopV2({
        llmService: mockLLM,
        toolRegistry: registry,
        enableCompaction: false
      })

      vi.mocked(mockLLM.complete)
        .mockResolvedValueOnce({
          content: '',
          toolCalls: [{
            id: 'call_1',
            function: {
              name: 'error_tool',
              arguments: '{}'
            },
            type: 'function'
          }],
          usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 }
        } as LLMCompletionResult)
        .mockResolvedValueOnce({
          content: 'I encountered an error',
          usage: { promptTokens: 20, completionTokens: 5, totalTokens: 25 }
        } as LLMCompletionResult)

      const result = await loop.execute('Test', context)

      expect(result.success).toBe(true)
      expect(result.toolCalls).toHaveLength(1)
      expect(result.toolCalls[0].error).toBe('Tool failed!')
    })

    it('should handle unknown tools gracefully', async () => {
      const loop = new QueryLoopV2({
        llmService: mockLLM,
        toolRegistry: registry,
        enableCompaction: false
      })

      vi.mocked(mockLLM.complete)
        .mockResolvedValueOnce({
          content: '',
          toolCalls: [{
            id: 'call_1',
            function: {
              name: 'nonexistent_tool',
              arguments: '{}'
            },
            type: 'function'
          }],
          usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 }
        } as LLMCompletionResult)
        .mockResolvedValueOnce({
          content: 'Tool not found',
          usage: { promptTokens: 20, completionTokens: 5, totalTokens: 25 }
        } as LLMCompletionResult)

      const result = await loop.execute('Test', context)

      expect(result.success).toBe(true)
      expect(result.toolCalls[0].error).toContain('not found')
    })
  })

  describe('Context Compaction', () => {
    it('should trigger compaction when threshold exceeded', async () => {
      // Create new context for this test
      const testContext = new ConversationContextV2()
      
      const loop = new QueryLoopV2({
        llmService: mockLLM,
        toolRegistry: registry,
        compactionEngine: mockCompaction,
        compactionThreshold: 50, // Low threshold
        enableCompaction: true
      })

      vi.mocked(mockCompaction.compact).mockResolvedValue({
        strategy: 'snip',
        messages: [],
        originalMessages: 10,
        compressedTokens: 500,
        originalTokens: 2000,
        tokensSaved: 1500,
        compactionRatio: 0.75,
        summary: 'Removed 5 messages'
      })

      vi.mocked(mockLLM.complete).mockResolvedValue({
        content: 'Response',
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 }
      } as LLMCompletionResult)

      // Add messages to context to exceed threshold
      for (let i = 0; i < 20; i++) {
        testContext.addUserMessage(`Message ${i} with some content to make it longer`)
      }

      const result = await loop.execute('Hello', testContext)

      expect(mockCompaction.compact).toHaveBeenCalled()
      expect(result.compactionCount).toBeGreaterThan(0)
      expect(result.tokensSaved).toBeGreaterThan(0)
    })

    it('should not compact when disabled', async () => {
      const loop = new QueryLoopV2({
        llmService: mockLLM,
        toolRegistry: registry,
        compactionEngine: mockCompaction,
        enableCompaction: false
      })

      vi.mocked(mockLLM.complete).mockResolvedValue({
        content: 'Response',
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 }
      } as LLMCompletionResult)

      await loop.execute('Hello', context)

      expect(mockCompaction.compact).not.toHaveBeenCalled()
    })

    it('should handle compaction errors gracefully', async () => {
      const loop = new QueryLoopV2({
        llmService: mockLLM,
        toolRegistry: registry,
        compactionEngine: mockCompaction,
        compactionThreshold: 100,
        enableCompaction: true
      })

      vi.mocked(mockCompaction.compact).mockRejectedValue(new Error('Compaction failed'))

      vi.mocked(mockLLM.complete).mockResolvedValue({
        content: 'Response',
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 }
      } as LLMCompletionResult)

      // Add messages to context
      for (let i = 0; i < 20; i++) {
        context.addUserMessage(`Message ${i}`)
      }

      // Should not throw
      const result = await loop.execute('Hello', context)

      expect(result.success).toBe(true)
    })
  })

  describe('State Management', () => {
    it('should track state correctly', async () => {
      const loop = new QueryLoopV2({
        llmService: mockLLM,
        toolRegistry: registry,
        enableCompaction: false
      })

      expect(loop.getState().status).toBe('idle')
      expect(loop.isRunning()).toBe(false)
      expect(loop.isActive()).toBe(false)

      vi.mocked(mockLLM.complete).mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          content: 'Response',
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 }
        } as LLMCompletionResult), 50))
      )

      const execPromise = loop.execute('Hello', context)
      
      expect(loop.getState().status).toBe('running')
      expect(loop.isRunning()).toBe(true)
      expect(loop.isActive()).toBe(true)

      await execPromise

      expect(loop.getState().status).toBe('completed')
      expect(loop.isRunning()).toBe(false)
    })

    it('should track iteration count', async () => {
      const loop = new QueryLoopV2({
        llmService: mockLLM,
        toolRegistry: registry,
        enableCompaction: false
      })

      vi.mocked(mockLLM.complete).mockResolvedValue({
        content: 'Response',
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 }
      } as LLMCompletionResult)

      await loop.execute('Hello', context)

      expect(loop.getState().iteration).toBe(1)
    })
  })

  describe('Stop Functionality', () => {
    it('should support stop functionality', async () => {
      const loop = new QueryLoopV2({
        llmService: mockLLM,
        toolRegistry: registry,
        enableCompaction: false
      })

      vi.mocked(mockLLM.complete).mockImplementation(() => 
        new Promise((resolve) => setTimeout(() => resolve({
          content: 'Response',
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 }
        } as LLMCompletionResult), 200))
      )

      const execPromise = loop.execute('Hello', context)

      // Stop after short delay
      setTimeout(() => loop.stop(), 50)

      const result = await execPromise

      // Should have stopped
      expect(loop.getState().status).toBe('completed')
    })
  })

  describe('Progress Callbacks', () => {
    it('should call onProgress for each event', async () => {
      const progressSpy = vi.fn()

      const loop = new QueryLoopV2({
        llmService: mockLLM,
        toolRegistry: registry,
        enableCompaction: false,
        onProgress: progressSpy
      })

      vi.mocked(mockLLM.complete).mockResolvedValue({
        content: 'Response',
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 }
      } as LLMCompletionResult)

      await loop.execute('Hello', context)

      expect(progressSpy).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'start' })
      )
      expect(progressSpy).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'thinking' })
      )
      expect(progressSpy).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'content' })
      )
    })

    it('should emit events', async () => {
      const loop = new QueryLoopV2({
        llmService: mockLLM,
        toolRegistry: registry,
        enableCompaction: false
      })

      const startSpy = vi.fn()
      const completeSpy = vi.fn()
      const contentSpy = vi.fn()

      loop.on('start', startSpy)
      loop.on('complete', completeSpy)
      loop.on('content', contentSpy)

      vi.mocked(mockLLM.complete).mockResolvedValue({
        content: 'Response',
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 }
      } as LLMCompletionResult)

      await loop.execute('Hello', context)

      expect(startSpy).toHaveBeenCalled()
      expect(completeSpy).toHaveBeenCalled()
      expect(contentSpy).toHaveBeenCalledWith(
        expect.objectContaining({ content: 'Response' })
      )
    })
  })

  describe('Streaming', () => {
    it('should support streaming execution', async () => {
      const loop = new QueryLoopV2({
        llmService: mockLLM,
        toolRegistry: registry,
        enableCompaction: false
      })

      async function* mockStream() {
        yield { content: 'Hello' }
        yield { content: ' world' }
        yield { content: '!', done: true }
      }

      vi.mocked(mockLLM.stream).mockReturnValue(mockStream() as any)

      const chunks: any[] = []
      for await (const chunk of loop.stream('Hello', context)) {
        chunks.push(chunk)
      }

      expect(chunks.length).toBeGreaterThan(0)
      expect(chunks.some(c => c.type === 'start')).toBe(true)
      expect(chunks.some(c => c.type === 'content')).toBe(true)
      expect(chunks.some(c => c.type === 'complete')).toBe(true)
    })

    it('should handle stream errors', async () => {
      const loop = new QueryLoopV2({
        llmService: mockLLM,
        toolRegistry: registry,
        enableCompaction: false
      })

      async function* mockStream() {
        yield { content: 'Hello' }
        throw new Error('Stream error')
      }

      vi.mocked(mockLLM.stream).mockReturnValue(mockStream() as any)

      const chunks: any[] = []
      for await (const chunk of loop.stream('Hello', context)) {
        chunks.push(chunk)
      }

      expect(chunks.some(c => c.type === 'error')).toBe(true)
    })
  })

  describe('System Prompt', () => {
    it('should set system prompt when provided', async () => {
      const loop = new QueryLoopV2({
        llmService: mockLLM,
        toolRegistry: registry,
        enableCompaction: false
      })

      vi.mocked(mockLLM.complete).mockResolvedValue({
        content: 'Response',
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 }
      } as LLMCompletionResult)

      await loop.execute('Hello', context, {
        systemPrompt: 'You are a helpful assistant.'
      })

      // System prompt should be set in context
      const messages = context.toLLMMessages()
      const systemMessage = messages.find(m => m.role === 'system')
      expect(systemMessage?.content).toBe('You are a helpful assistant.')
    })
  })
})

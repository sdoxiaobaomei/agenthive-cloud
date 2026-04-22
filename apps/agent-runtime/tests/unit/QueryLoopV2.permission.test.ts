/**
 * QueryLoopV2 + PermissionManager Integration Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryLoopV2 } from '../../src/agent/QueryLoopV2.js'
import { ConversationContextV2 } from '../../src/context/ConversationContextV2.js'
import { ToolRegistryV2 } from '../../src/tools/registry/ToolRegistryV2.js'
import { buildToolV2 } from '../../src/tools/ToolV2.js'
import { PermissionManager } from '../../src/permissions/PermissionManager.js'
import { z } from 'zod'
import type { LLMService } from '../../src/services/llm/LLMService.js'
import type { LLMCompletionResult } from '../../src/services/llm/types.js'

const createMockLLMService = (): LLMService =>
  ({
    complete: vi.fn(),
    stream: vi.fn()
  } as any)

describe('QueryLoopV2 + PermissionManager', () => {
  let mockLLM: ReturnType<typeof createMockLLMService>
  let registry: ToolRegistryV2
  let context: ConversationContextV2

  beforeEach(() => {
    mockLLM = createMockLLMService()
    registry = new ToolRegistryV2()
    context = new ConversationContextV2()
  })

  describe('with PermissionManager', () => {
    it('should call PermissionManager.checkPermission when tool is executed', async () => {
      const pm = new PermissionManager({ mode: 'allow' })
      const checkSpy = vi.spyOn(pm, 'checkPermission')

      const testTool = buildToolV2({
        name: 'test_tool',
        description: 'Test tool',
        inputSchema: z.object({ value: z.string() }),
        async call(input, _ctx, canUseTool) {
          const decision = await canUseTool('test_tool', input)
          return {
            type: 'result',
            data: { allowed: decision.behavior === 'allow' },
            resultForAssistant: `Allowed: ${decision.behavior === 'allow'}`
          }
        },
        isReadOnly: () => true
      })
      registry.register(testTool)

      const loop = new QueryLoopV2({
        llmService: mockLLM,
        toolRegistry: registry,
        permissionManager: pm,
        enableCompaction: false
      })

      vi.mocked(mockLLM.complete)
        .mockResolvedValueOnce({
          content: '',
          toolCalls: [
            {
              id: 'call_1',
              function: {
                name: 'test_tool',
                arguments: JSON.stringify({ value: 'hello' })
              },
              type: 'function'
            }
          ],
          usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 }
        } as LLMCompletionResult)
        .mockResolvedValueOnce({
          content: 'Done',
          usage: { promptTokens: 20, completionTokens: 5, totalTokens: 25 }
        } as LLMCompletionResult)

      const result = await loop.execute('Test', context)

      expect(checkSpy).toHaveBeenCalledWith(
        'test_tool',
        { value: 'hello' },
        expect.objectContaining({
          agentId: expect.stringContaining('query-loop'),
          isDestructive: false,
          isReadOnly: true
        })
      )
      expect(result.toolCalls[0].output.allowed).toBe(true)
    })

    it('should pass deny decision to ToolV2.call', async () => {
      const pm = new PermissionManager({ mode: 'deny' })

      const testTool = buildToolV2({
        name: 'test_tool',
        description: 'Test tool',
        inputSchema: z.object({}),
        async call(input, _ctx, canUseTool) {
          const decision = await canUseTool('test_tool', input)
          if (decision.behavior === 'deny') {
            throw new Error('Permission denied')
          }
          return { type: 'result', data: {} }
        },
        isReadOnly: () => false
      })
      registry.register(testTool)

      const loop = new QueryLoopV2({
        llmService: mockLLM,
        toolRegistry: registry,
        permissionManager: pm,
        enableCompaction: false
      })

      vi.mocked(mockLLM.complete)
        .mockResolvedValueOnce({
          content: '',
          toolCalls: [
            {
              id: 'call_1',
              function: {
                name: 'test_tool',
                arguments: '{}'
              },
              type: 'function'
            }
          ],
          usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 }
        } as LLMCompletionResult)
        .mockResolvedValueOnce({
          content: 'Done',
          usage: { promptTokens: 20, completionTokens: 5, totalTokens: 25 }
        } as LLMCompletionResult)

      const result = await loop.execute('Test', context)

      expect(result.toolCalls[0].error).toBe('Permission denied')
    })

    it('should propagate ask decision to the tool', async () => {
      const pm = new PermissionManager({ mode: 'ask' })

      const testTool = buildToolV2({
        name: 'test_tool',
        description: 'Test tool',
        inputSchema: z.object({}),
        async call(input, _ctx, canUseTool) {
          const decision = await canUseTool('test_tool', input)
          return {
            type: 'result',
            data: { behavior: decision.behavior },
            resultForAssistant: `Behavior: ${decision.behavior}`
          }
        },
        isReadOnly: () => false
      })
      registry.register(testTool)

      const loop = new QueryLoopV2({
        llmService: mockLLM,
        toolRegistry: registry,
        permissionManager: pm,
        enableCompaction: false
      })

      vi.mocked(mockLLM.complete)
        .mockResolvedValueOnce({
          content: '',
          toolCalls: [
            {
              id: 'call_1',
              function: {
                name: 'test_tool',
                arguments: '{}'
              },
              type: 'function'
            }
          ],
          usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 }
        } as LLMCompletionResult)
        .mockResolvedValueOnce({
          content: 'Done',
          usage: { promptTokens: 20, completionTokens: 5, totalTokens: 25 }
        } as LLMCompletionResult)

      const result = await loop.execute('Test', context)

      expect(result.toolCalls[0].output.behavior).toBe('ask')
    })
  })

  describe('without PermissionManager', () => {
    it('should default to allow when no PermissionManager is provided', async () => {
      const testTool = buildToolV2({
        name: 'test_tool',
        description: 'Test tool',
        inputSchema: z.object({}),
        async call(input, _ctx, canUseTool) {
          const decision = await canUseTool('test_tool', input)
          return {
            type: 'result',
            data: { behavior: decision.behavior },
            resultForAssistant: `Behavior: ${decision.behavior}`
          }
        },
        isReadOnly: () => true
      })
      registry.register(testTool)

      const loop = new QueryLoopV2({
        llmService: mockLLM,
        toolRegistry: registry,
        enableCompaction: false
      })

      vi.mocked(mockLLM.complete)
        .mockResolvedValueOnce({
          content: '',
          toolCalls: [
            {
              id: 'call_1',
              function: {
                name: 'test_tool',
                arguments: '{}'
              },
              type: 'function'
            }
          ],
          usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 }
        } as LLMCompletionResult)
        .mockResolvedValueOnce({
          content: 'Done',
          usage: { promptTokens: 20, completionTokens: 5, totalTokens: 25 }
        } as LLMCompletionResult)

      const result = await loop.execute('Test', context)

      expect(result.toolCalls[0].output.behavior).toBe('allow')
    })
  })
})

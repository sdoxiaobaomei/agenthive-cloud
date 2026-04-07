/**
 * ToolV2 单元测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { z } from 'zod'
import {
  buildToolV2,
  lazySchema,
  resolveSchema,
  createToolResult,
  createToolError,
  createToolCancelled,
  isToolV2,
  isToolResultError,
  isToolResultCancelled,
  type ToolV2,
  type ToolUseContext
} from '../../src/tools/ToolV2.js'

describe('ToolV2', () => {
  describe('buildToolV2', () => {
    it('should create a tool with defaults', () => {
      const tool = buildToolV2({
        name: 'test_tool',
        description: 'A test tool',
        inputSchema: z.object({ value: z.string() }),
        outputSchema: z.object({ result: z.string() }),
        call: async (input) => ({
          data: { result: input.value },
          type: 'result'
        })
      })

      expect(tool.name).toBe('test_tool')
      expect(tool.description).toBe('A test tool')
      expect(tool.aliases).toEqual([])
      expect(tool.category).toBe('execute')
      expect(tool.isMcp).toBe(false)
      expect(tool.shouldDefer).toBe(false)
    })

    it('should create a tool with custom properties', () => {
      const tool = buildToolV2({
        name: 'custom_tool',
        description: 'Custom tool',
        aliases: ['ct', 'custom'],
        category: 'read',
        searchHint: 'custom tool for testing',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        shouldDefer: true,
        alwaysLoad: false,
        call: async () => ({ data: {}, type: 'result' }),
        isReadOnly: () => true,
        isConcurrencySafe: () => true
      })

      expect(tool.aliases).toEqual(['ct', 'custom'])
      expect(tool.category).toBe('read')
      expect(tool.searchHint).toBe('custom tool for testing')
      expect(tool.shouldDefer).toBe(true)
      expect(tool.isReadOnly({})).toBe(true)
      expect(tool.isConcurrencySafe({})).toBe(true)
    })

    it('should execute call method correctly', async () => {
      const mockCanUseTool = vi.fn().mockResolvedValue({ behavior: 'allow' })
      const mockContext = createMockContext()

      const tool = buildToolV2({
        name: 'add_tool',
        description: 'Adds two numbers',
        inputSchema: z.object({ a: z.number(), b: z.number() }),
        outputSchema: z.object({ sum: z.number() }),
        call: async (input, context, canUseTool) => {
          // Tool implementation should call canUseTool
          const permission = await canUseTool('add_tool', input)
          if (permission.behavior === 'deny') {
            return { data: null, error: 'Denied', type: 'error' }
          }
          return {
            data: { sum: input.a + input.b },
            type: 'result'
          }
        }
      })

      const result = await tool.call(
        { a: 1, b: 2 },
        mockContext,
        mockCanUseTool,
        null
      )

      expect(result.data).toEqual({ sum: 3 })
      expect(result.type).toBe('result')
      expect(mockCanUseTool).toHaveBeenCalledWith('add_tool', { a: 1, b: 2 })
    })

    it('should handle permission denial', async () => {
      const mockCanUseTool = vi.fn().mockResolvedValue({
        behavior: 'deny',
        message: 'Access denied'
      })
      const mockContext = createMockContext()

      const tool = buildToolV2({
        name: 'sensitive_tool',
        description: 'Sensitive operation',
        inputSchema: z.object({}),
        call: async (input, context, canUseTool) => {
          // Tool implementation should check permission
          const permission = await canUseTool('sensitive_tool', input)
          if (permission.behavior === 'deny') {
            return { 
              data: null, 
              error: permission.message || 'Access denied', 
              type: 'error' 
            }
          }
          return { data: {}, type: 'result' }
        }
      })

      const result = await tool.call({}, mockContext, mockCanUseTool, null)

      expect(result.type).toBe('error')
      expect(result.error).toBe('Access denied')
    })
  })

  describe('lazySchema', () => {
    it('should defer schema creation', () => {
      let schemaCreated = false

      const lazy = lazySchema(() => {
        schemaCreated = true
        return z.object({ value: z.string() })
      })

      // 创建时不应该立即执行
      expect(schemaCreated).toBe(false)

      // 第一次 getSchema 时才执行
      const schema = lazy.getSchema()
      expect(schemaCreated).toBe(true)
      expect(schema).toBeDefined()

      // 第二次应该返回缓存的 schema
      const schema2 = lazy.getSchema()
      expect(schema2).toBe(schema)
    })
  })

  describe('resolveSchema', () => {
    it('should resolve regular zod schema', () => {
      const schema = z.object({ value: z.string() })
      const resolved = resolveSchema(schema)
      expect(resolved).toBe(schema)
    })

    it('should resolve lazy schema', () => {
      const innerSchema = z.object({ value: z.string() })
      const lazy = lazySchema(() => innerSchema)
      const resolved = resolveSchema(lazy)
      expect(resolved).toBe(innerSchema)
    })
  })

  describe('result helpers', () => {
    it('should create successful result', () => {
      const result = createToolResult({ value: 42 }, {
        resultForAssistant: 'The value is 42'
      })

      expect(result.data).toEqual({ value: 42 })
      expect(result.type).toBe('result')
      expect(result.resultForAssistant).toBe('The value is 42')
      expect(result.error).toBeUndefined()
    })

    it('should create error result', () => {
      const result = createToolError('Something went wrong')

      expect(result.data).toBeNull()
      expect(result.type).toBe('error')
      expect(result.error).toBe('Something went wrong')
    })

    it('should create cancelled result', () => {
      const result = createToolCancelled()

      expect(result.data).toBeNull()
      expect(result.type).toBe('cancelled')
      expect(result.error).toBeUndefined()
    })
  })

  describe('type guards', () => {
    it('should identify ToolV2 objects', () => {
      const validTool: any = {
        name: 'test',
        description: 'Test',
        call: async () => ({ data: {}, type: 'result' }),
        checkPermissions: async () => ({ behavior: 'allow' }),
        isReadOnly: () => false
      }

      expect(isToolV2(validTool)).toBe(true)
      expect(isToolV2(null)).toBe(false)
      expect(isToolV2({})).toBe(false)
      expect(isToolV2({ name: 'test' })).toBe(false)
    })

    it('should identify error results', () => {
      expect(isToolResultError({ data: null, type: 'error', error: 'Oops' })).toBe(true)
      expect(isToolResultError({ data: {}, type: 'result' })).toBe(false)
      expect(isToolResultError({ data: null, type: 'cancelled' })).toBe(false)
    })

    it('should identify cancelled results', () => {
      expect(isToolResultCancelled({ data: null, type: 'cancelled' })).toBe(true)
      expect(isToolResultCancelled({ data: {}, type: 'result' })).toBe(false)
      expect(isToolResultCancelled({ data: null, type: 'error' })).toBe(false)
    })
  })

  describe('MCP tool properties', () => {
    it('should support MCP tool properties', () => {
      const mcpTool = buildToolV2({
        name: 'mcp__server__tool',
        description: 'MCP tool',
        isMcp: true,
        mcpInfo: {
          serverName: 'test-server',
          toolName: 'test-tool'
        },
        inputSchema: z.object({}),
        call: async () => ({ data: {}, type: 'result' })
      })

      expect(mcpTool.isMcp).toBe(true)
      expect(mcpTool.mcpInfo).toEqual({
        serverName: 'test-server',
        toolName: 'test-tool'
      })
    })
  })

  describe('render methods', () => {
    it('should support custom render methods', () => {
      const tool = buildToolV2({
        name: 'file_read',
        description: 'Read file',
        inputSchema: z.object({ path: z.string() }),
        call: async () => ({ data: 'content', type: 'result' }),
        renderToolUseMessage: (input) => `Reading ${input.path}`,
        renderToolResultMessage: (output) => `Read ${output.length} chars`,
        userFacingName: (input) => `Read ${input?.path || 'file'}`
      })

      expect(tool.renderToolUseMessage?.({ path: '/test.txt' })).toBe('Reading /test.txt')
      expect(tool.renderToolResultMessage?.('content')).toBe('Read 7 chars')
      expect(tool.userFacingName({ path: '/test.txt' })).toBe('Read /test.txt')
    })
  })
})

// 辅助函数：创建模拟上下文
function createMockContext(): ToolUseContext {
  return {
    agentId: 'test-agent',
    workspacePath: '/test',
    sendLog: () => {},
    abortController: new AbortController(),
    getAppState: () => ({}),
    setAppState: () => {},
    messages: [],
    checkPermission: async () => ({ behavior: 'allow' }),
    llm: {
      complete: async () => ({ content: '' }),
      stream: async function* () {}
    }
  }
}

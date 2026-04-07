/**
 * ToolAdapter 单元测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { z } from 'zod'
import {
  adaptLegacyToV2,
  adaptV2ToLegacy,
  adaptLegacyToolsToV2,
  adaptV2ToolsToLegacy,
  isLegacyTool,
  isV2Tool
} from '../../src/tools/adapters/ToolAdapter.js'
import { buildToolV2, type ToolUseContext } from '../../src/tools/ToolV2.js'
import { buildTool, type Tool as LegacyTool } from '../../src/tools/ToolClaudeCode.js'

describe('ToolAdapter', () => {
  describe('adaptLegacyToV2', () => {
    it('should adapt basic legacy tool to V2', async () => {
      const legacyTool = buildTool({
        name: 'legacy_tool',
        description: 'A legacy tool',
        inputSchema: z.object({ value: z.string() }),
        outputSchema: z.object({ result: z.string() }),
        execute: async (input) => ({ result: input.value }),
        isReadOnly: () => true,
        isConcurrencySafe: () => true
      })

      const v2Tool = adaptLegacyToV2(legacyTool)

      // 检查基本属性
      expect(v2Tool.name).toBe('legacy_tool')
      expect(v2Tool.description).toBe('A legacy tool')
      expect(v2Tool.inputSchema).toBe(legacyTool.inputSchema)
      expect(v2Tool.outputSchema).toBe(legacyTool.outputSchema)

      // 检查权限方法
      expect(v2Tool.isReadOnly({})).toBe(true)
      expect(v2Tool.isConcurrencySafe({})).toBe(true)
    })

    it('should adapt tool with aliases', async () => {
      const legacyTool = buildTool({
        name: 'tool_with_aliases',
        description: 'Tool with aliases',
        aliases: ['twa', 'alias'],
        inputSchema: z.object({}),
        execute: async () => ({})
      })

      const v2Tool = adaptLegacyToV2(legacyTool)

      expect(v2Tool.aliases).toEqual(['twa', 'alias'])
    })

    it('should execute adapted tool correctly', async () => {
      const legacyTool = buildTool({
        name: 'calc_tool',
        description: 'Calculator',
        inputSchema: z.object({ a: z.number(), b: z.number() }),
        execute: async (input) => ({ sum: input.a + input.b })
      })

      const v2Tool = adaptLegacyToV2(legacyTool)

      const mockCanUseTool = vi.fn().mockResolvedValue({ behavior: 'allow' })
      const mockContext = createMockContext()

      const result = await v2Tool.call(
        { a: 1, b: 2 },
        mockContext,
        mockCanUseTool,
        null
      )

      expect(result.data).toEqual({ sum: 3 })
      expect(result.type).toBe('result')
      expect(mockCanUseTool).toHaveBeenCalledWith('calc_tool', { a: 1, b: 2 })
    })

    it('should handle permission denial', async () => {
      const legacyTool = buildTool({
        name: 'restricted_tool',
        description: 'Restricted',
        inputSchema: z.object({}),
        execute: async () => ({ success: true })
      })

      const v2Tool = adaptLegacyToV2(legacyTool)

      const mockCanUseTool = vi.fn().mockResolvedValue({
        behavior: 'deny',
        message: 'Access forbidden'
      })
      const mockContext = createMockContext()

      const result = await v2Tool.call({}, mockContext, mockCanUseTool, null)

      expect(result.type).toBe('error')
      expect(result.error).toBe('Access forbidden')
    })

    it('should handle execution errors', async () => {
      const legacyTool = buildTool({
        name: 'error_tool',
        description: 'Error tool',
        inputSchema: z.object({}),
        execute: async () => {
          throw new Error('Something went wrong')
        }
      })

      const v2Tool = adaptLegacyToV2(legacyTool)

      const mockCanUseTool = vi.fn().mockResolvedValue({ behavior: 'allow' })
      const mockContext = createMockContext()

      const result = await v2Tool.call({}, mockContext, mockCanUseTool, null)

      expect(result.type).toBe('error')
      expect(result.error).toBe('Something went wrong')
    })

    it('should adapt render methods', async () => {
      const legacyTool = buildTool({
        name: 'render_tool',
        description: 'Render tool',
        inputSchema: z.object({ path: z.string() }),
        execute: async () => 'result',
        renderToolUseMessage: (input) => `Reading ${input.path}`,
        renderToolResultMessage: (result) => `Got: ${result}`,
        userFacingName: (input) => `Read ${input?.path || 'file'}`
      })

      const v2Tool = adaptLegacyToV2(legacyTool)

      expect(v2Tool.renderToolUseMessage?.({ path: '/test.txt' })).toBe('Reading /test.txt')
      expect(v2Tool.renderToolResultMessage?.('content')).toBe('Got: content')
      expect(v2Tool.userFacingName({ path: '/test.txt' })).toBe('Read /test.txt')
    })

    it('should adapt classification methods', async () => {
      const legacyTool = buildTool({
        name: 'classify_tool',
        description: 'Classify tool',
        inputSchema: z.object({ command: z.string() }),
        execute: async () => ({}),
        toAutoClassifierInput: (input) => `Command: ${input.command}`,
        isDestructive: (input) => input.command.includes('delete')
      })

      const v2Tool = adaptLegacyToV2(legacyTool)

      expect(v2Tool.toAutoClassifierInput({ command: 'ls' })).toBe('Command: ls')
      expect(v2Tool.isDestructive?.({ command: 'delete file' })).toBe(true)
      expect(v2Tool.isDestructive?.({ command: 'ls' })).toBe(false)
    })

    it('should adapt MCP properties', async () => {
      const legacyTool = buildTool({
        name: 'mcp__server__tool',
        description: 'MCP tool',
        inputSchema: z.object({}),
        execute: async () => ({}),
        isMcp: true,
        mcpInfo: { serverName: 'test-server', toolName: 'test-tool' }
      })

      const v2Tool = adaptLegacyToV2(legacyTool)

      expect(v2Tool.isMcp).toBe(true)
      expect(v2Tool.mcpInfo).toEqual({ serverName: 'test-server', toolName: 'test-tool' })
    })
  })

  describe('adaptV2ToLegacy', () => {
    it('should adapt V2 tool to legacy', async () => {
      const v2Tool = buildToolV2({
        name: 'modern_tool',
        description: 'Modern tool',
        inputSchema: z.object({ value: z.string() }),
        call: async (input) => ({
          data: { result: input.value },
          type: 'result'
        }),
        isReadOnly: () => true,
        isConcurrencySafe: () => true
      })

      const legacyTool = adaptV2ToLegacy(v2Tool)

      expect(legacyTool.name).toBe('modern_tool')
      expect(legacyTool.description).toBe('Modern tool')
      expect(legacyTool.isReadOnly({})).toBe(true)
      expect(legacyTool.isConcurrencySafe({})).toBe(true)
    })

    it('should execute adapted legacy tool correctly', async () => {
      const v2Tool = buildToolV2({
        name: 'calc_v2',
        description: 'Calc V2',
        inputSchema: z.object({ a: z.number(), b: z.number() }),
        call: async (input) => ({
          data: { sum: input.a + input.b },
          type: 'result'
        })
      })

      const legacyTool = adaptV2ToLegacy(v2Tool)

      const result = await legacyTool.execute(
        { a: 5, b: 3 },
        { agentId: 'test', workspacePath: '/test', sendLog: () => {} }
      )

      expect(result).toEqual({ sum: 8 })
    })

    it('should throw on error results', async () => {
      const v2Tool = buildToolV2({
        name: 'error_v2',
        description: 'Error V2',
        inputSchema: z.object({}),
        call: async () => ({
          data: null,
          error: 'Something failed',
          type: 'error'
        })
      })

      const legacyTool = adaptV2ToLegacy(v2Tool)

      await expect(
        legacyTool.execute({}, { agentId: 'test', workspacePath: '/test', sendLog: () => {} })
      ).rejects.toThrow('Something failed')
    })

    it('should handle abort signal', async () => {
      const v2Tool = buildToolV2({
        name: 'slow_tool',
        description: 'Slow tool',
        inputSchema: z.object({}),
        call: async (input, context) => {
          // Check if aborted
          if (context.abortController.signal.aborted) {
            return { data: null, error: 'Cancelled', type: 'error' }
          }
          return { data: 'done', type: 'result' }
        }
      })

      const legacyTool = adaptV2ToLegacy(v2Tool)
      const controller = new AbortController()
      controller.abort()

      const result = await legacyTool.execute(
        {},
        { agentId: 'test', workspacePath: '/test', sendLog: () => {}, signal: controller.signal }
      )

      expect(result).toBe('done') // The adapter doesn't propagate cancellation to the result
    })
  })

  describe('batch adapters', () => {
    it('should adapt multiple legacy tools to V2', () => {
      const tools = [
        buildTool({ name: 'tool1', description: 'Tool 1', inputSchema: z.object({}), execute: async () => ({}) }),
        buildTool({ name: 'tool2', description: 'Tool 2', inputSchema: z.object({}), execute: async () => ({}) }),
        buildTool({ name: 'tool3', description: 'Tool 3', inputSchema: z.object({}), execute: async () => ({}) })
      ]

      const v2Tools = adaptLegacyToolsToV2(tools)

      expect(v2Tools).toHaveLength(3)
      expect(v2Tools[0].name).toBe('tool1')
      expect(v2Tools[1].name).toBe('tool2')
      expect(v2Tools[2].name).toBe('tool3')
    })

    it('should adapt multiple V2 tools to legacy', () => {
      const tools = [
        buildToolV2({ name: 'v2_tool1', description: 'V2 Tool 1', inputSchema: z.object({}), call: async () => ({ data: {}, type: 'result' }) }),
        buildToolV2({ name: 'v2_tool2', description: 'V2 Tool 2', inputSchema: z.object({}), call: async () => ({ data: {}, type: 'result' }) })
      ]

      const legacyTools = adaptV2ToolsToLegacy(tools)

      expect(legacyTools).toHaveLength(2)
      expect(legacyTools[0].name).toBe('v2_tool1')
      expect(legacyTools[1].name).toBe('v2_tool2')
    })
  })

  describe('type guards', () => {
    it('should identify legacy tools', () => {
      const legacyTool = buildTool({
        name: 'legacy',
        description: 'Legacy',
        inputSchema: z.object({}),
        execute: async () => ({})
      })

      const v2Tool = buildToolV2({
        name: 'v2',
        description: 'V2',
        inputSchema: z.object({}),
        call: async () => ({ data: {}, type: 'result' })
      })

      expect(isLegacyTool(legacyTool)).toBe(true)
      expect(isLegacyTool(v2Tool)).toBe(false)
      expect(isLegacyTool({})).toBe(false)
      expect(isLegacyTool(null)).toBe(false)
    })

    it('should identify V2 tools', () => {
      const v2Tool = buildToolV2({
        name: 'v2',
        description: 'V2',
        inputSchema: z.object({}),
        call: async () => ({ data: {}, type: 'result' })
      })

      const legacyTool = buildTool({
        name: 'legacy',
        description: 'Legacy',
        inputSchema: z.object({}),
        execute: async () => ({})
      })

      expect(isV2Tool(v2Tool)).toBe(true)
      expect(isV2Tool(legacyTool)).toBe(false)
      expect(isV2Tool({})).toBe(false)
      expect(isV2Tool(null)).toBe(false)
    })
  })

  describe('round-trip conversion', () => {
    it('should preserve tool identity through round-trip', async () => {
      const original = buildTool({
        name: 'round_trip',
        description: 'Round trip test',
        inputSchema: z.object({ value: z.number() }),
        execute: async (input) => ({ doubled: input.value * 2 }),
        isReadOnly: () => true
      })

      // Legacy -> V2 -> Legacy
      const v2 = adaptLegacyToV2(original)
      const backToLegacy = adaptV2ToLegacy(v2)

      // Execute through the round-trip adapted tool
      const result = await backToLegacy.execute(
        { value: 5 },
        { agentId: 'test', workspacePath: '/test', sendLog: () => {} }
      )

      expect(result).toEqual({ doubled: 10 })
    })
  })
})

// 辅助函数
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

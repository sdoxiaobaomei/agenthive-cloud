/**
 * ToolRegistryV2 单元测试
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { z } from 'zod'
import { ToolRegistryV2 } from '../../src/tools/registry/ToolRegistryV2.js'
import { buildToolV2 } from '../../src/tools/ToolV2.js'

describe('ToolRegistryV2', () => {
  let registry: ToolRegistryV2

  beforeEach(() => {
    registry = new ToolRegistryV2()
  })

  describe('register', () => {
    it('should register a tool', () => {
      const tool = buildToolV2({
        name: 'test_tool',
        description: 'A test tool',
        inputSchema: z.object({ value: z.string() }),
        call: async () => ({ data: {}, type: 'result' })
      })

      registry.register(tool)

      expect(registry.list()).toContain('test_tool')
      expect(registry.get('test_tool')).toBe(tool)
    })

    it('should register tool with aliases', () => {
      const tool = buildToolV2({
        name: 'test_tool',
        description: 'A test tool',
        aliases: ['tt', 'test'],
        inputSchema: z.object({}),
        call: async () => ({ data: {}, type: 'result' })
      })

      registry.register(tool)

      expect(registry.get('tt')).toBe(tool)
      expect(registry.get('test')).toBe(tool)
      expect(registry.has('tt')).toBe(true)
    })

    it('should register tool with category', () => {
      const tool = buildToolV2({
        name: 'file_reader',
        description: 'Read files',
        category: 'read',
        inputSchema: z.object({}),
        isReadOnly: () => true,
        isConcurrencySafe: () => true,
        call: async () => ({ data: {}, type: 'result' })
      })

      registry.register(tool)

      const readTools = registry.getByCategory('read')
      expect(readTools).toHaveLength(1)
      expect(readTools[0].name).toBe('file_reader')
    })

    it('should handle MCP tools', () => {
      const mcpTool = buildToolV2({
        name: 'mcp__github__create_issue',
        description: 'Create GitHub issue',
        isMcp: true,
        mcpInfo: { serverName: 'github', toolName: 'create_issue' },
        inputSchema: z.object({}),
        call: async () => ({ data: {}, type: 'result' })
      })

      registry.register(mcpTool)

      expect(registry.getMCPTools()).toHaveLength(1)
      expect(registry.getMCPClientNames()).toContain('github')
      expect(registry.getToolsByMCPClient('github')).toHaveLength(1)
    })
  })

  describe('get', () => {
    it('should return undefined for non-existent tool', () => {
      expect(registry.get('nonexistent')).toBeUndefined()
    })

    it('should get tool by name', () => {
      const tool = buildToolV2({
        name: 'my_tool',
        description: 'My tool',
        inputSchema: z.object({}),
        call: async () => ({ data: {}, type: 'result' })
      })

      registry.register(tool)

      expect(registry.get('my_tool')).toBe(tool)
    })

    it('should get tool by alias', () => {
      const tool = buildToolV2({
        name: 'my_tool',
        description: 'My tool',
        aliases: ['mt'],
        inputSchema: z.object({}),
        call: async () => ({ data: {}, type: 'result' })
      })

      registry.register(tool)

      expect(registry.get('mt')).toBe(tool)
    })
  })

  describe('filtering', () => {
    beforeEach(() => {
      registry.register(buildToolV2({
        name: 'read_tool',
        description: 'Read tool',
        category: 'read',
        inputSchema: z.object({}),
        isReadOnly: () => true,
        isConcurrencySafe: () => true,
        call: async () => ({ data: {}, type: 'result' })
      }))

      registry.register(buildToolV2({
        name: 'write_tool',
        description: 'Write tool',
        category: 'write',
        inputSchema: z.object({}),
        isReadOnly: () => false,
        isConcurrencySafe: () => false,
        isDestructive: () => true,
        call: async () => ({ data: {}, type: 'result' })
      }))

      registry.register(buildToolV2({
        name: 'search_tool',
        description: 'Search tool',
        category: 'search',
        inputSchema: z.object({}),
        isReadOnly: () => true,
        isConcurrencySafe: () => true,
        call: async () => ({ data: {}, type: 'result' })
      }))
    })

    it('should get read-only tools', () => {
      const readOnlyTools = registry.getReadOnlyTools()
      expect(readOnlyTools).toHaveLength(2)
      expect(readOnlyTools.map(t => t.name)).toContain('read_tool')
      expect(readOnlyTools.map(t => t.name)).toContain('search_tool')
    })

    it('should get concurrency-safe tools', () => {
      const safeTools = registry.getConcurrencySafeTools()
      expect(safeTools).toHaveLength(2)
    })

    it('should get destructive tools', () => {
      const destructiveTools = registry.getDestructiveTools()
      expect(destructiveTools).toHaveLength(1)
      expect(destructiveTools[0].name).toBe('write_tool')
    })

    it('should get tools by category', () => {
      const readTools = registry.getByCategory('read')
      const writeTools = registry.getByCategory('write')
      const searchTools = registry.getByCategory('search')

      expect(readTools).toHaveLength(1)
      expect(writeTools).toHaveLength(1)
      expect(searchTools).toHaveLength(1)
    })
  })

  describe('search', () => {
    beforeEach(() => {
      registry.register(buildToolV2({
        name: 'file_reader',
        description: 'Read file content',
        searchHint: 'read file content text',
        category: 'read',
        inputSchema: z.object({}),
        call: async () => ({ data: {}, type: 'result' })
      }))

      registry.register(buildToolV2({
        name: 'file_writer',
        description: 'Write file content',
        searchHint: 'write file content text',
        category: 'write',
        inputSchema: z.object({}),
        call: async () => ({ data: {}, type: 'result' })
      }))
    })

    it('should search by hint', () => {
      const results = registry.searchByHint('read')
      expect(results).toHaveLength(1)
      expect(results[0].name).toBe('file_reader')
    })

    it('should search by name', () => {
      const results = registry.searchByHint('file_reader')
      expect(results).toHaveLength(1)
      expect(results[0].name).toBe('file_reader')
    })

    it('should search by category', () => {
      const results = registry.searchByHint('write')
      expect(results.map(t => t.name)).toContain('file_writer')
    })

    it('should search for task', () => {
      const results = registry.searchForTask('I need to read a file')
      expect(results.map(t => t.name)).toContain('file_reader')
    })
  })

  describe('deferred loading', () => {
    it('should track deferred tools', () => {
      registry.register(buildToolV2({
        name: 'deferred_tool',
        description: 'Deferred tool',
        shouldDefer: true,
        alwaysLoad: false,
        inputSchema: z.object({}),
        call: async () => ({ data: {}, type: 'result' })
      }))

      registry.register(buildToolV2({
        name: 'always_load_tool',
        description: 'Always load tool',
        shouldDefer: false,
        alwaysLoad: true,
        inputSchema: z.object({}),
        call: async () => ({ data: {}, type: 'result' })
      }))

      expect(registry.getDeferredTools()).toHaveLength(1)
      expect(registry.getAlwaysLoadTools()).toHaveLength(1)
    })

    it('should load deferred tool', () => {
      const tool = buildToolV2({
        name: 'deferred_tool',
        description: 'Deferred tool',
        shouldDefer: true,
        inputSchema: z.object({}),
        call: async () => ({ data: {}, type: 'result' })
      })

      registry.register(tool)
      expect(registry.getDeferredTools()).toHaveLength(1)

      const loaded = registry.loadDeferredTool('deferred_tool')
      expect(loaded).toBe(tool)
      expect(registry.getDeferredTools()).toHaveLength(0)
    })

    it('should exclude deferred tools from tool definitions', () => {
      registry.register(buildToolV2({
        name: 'deferred_tool',
        description: 'Deferred tool',
        shouldDefer: true,
        alwaysLoad: false,
        inputSchema: z.object({}),
        call: async () => ({ data: {}, type: 'result' })
      }))

      registry.register(buildToolV2({
        name: 'regular_tool',
        description: 'Regular tool',
        inputSchema: z.object({}),
        call: async () => ({ data: {}, type: 'result' })
      }))

      const definitions = registry.getToolDefinitions()
      expect(definitions).toHaveLength(1)
      expect(definitions[0].function.name).toBe('regular_tool')
    })
  })

  describe('tool definitions', () => {
    it('should generate tool definitions for LLM', () => {
      registry.register(buildToolV2({
        name: 'greet',
        description: 'Greet someone',
        inputSchema: z.object({
          name: z.string().describe('Name to greet'),
          excited: z.boolean().optional().describe('Whether to be excited')
        }),
        call: async (input) => ({
          data: `Hello, ${input.name}${input.excited ? '!' : '.'}`,
          type: 'result'
        })
      }))

      const definitions = registry.getToolDefinitions()
      expect(definitions).toHaveLength(1)
      expect(definitions[0].type).toBe('function')
      expect(definitions[0].function.name).toBe('greet')
      expect(definitions[0].function.parameters).toBeDefined()
    })
  })

  describe('unregister', () => {
    it('should unregister a tool', () => {
      const tool = buildToolV2({
        name: 'temp_tool',
        description: 'Temp tool',
        aliases: ['tt'],
        category: 'read',
        inputSchema: z.object({}),
        call: async () => ({ data: {}, type: 'result' })
      })

      registry.register(tool)
      expect(registry.has('temp_tool')).toBe(true)
      expect(registry.has('tt')).toBe(true)

      const removed = registry.unregister('temp_tool')
      expect(removed).toBe(true)
      expect(registry.has('temp_tool')).toBe(false)
      expect(registry.has('tt')).toBe(false)
    })

    it('should return false for non-existent tool', () => {
      const removed = registry.unregister('nonexistent')
      expect(removed).toBe(false)
    })
  })

  describe('clear', () => {
    it('should clear all tools', () => {
      registry.register(buildToolV2({
        name: 'tool1',
        description: 'Tool 1',
        inputSchema: z.object({}),
        call: async () => ({ data: {}, type: 'result' })
      }))

      registry.register(buildToolV2({
        name: 'tool2',
        description: 'Tool 2',
        inputSchema: z.object({}),
        call: async () => ({ data: {}, type: 'result' })
      }))

      expect(registry.list()).toHaveLength(2)

      registry.clear()

      expect(registry.list()).toHaveLength(0)
      expect(registry.getCategories()).toHaveLength(0)
    })
  })

  describe('stats', () => {
    it('should return correct stats', () => {
      registry.register(buildToolV2({
        name: 'read_tool',
        description: 'Read tool',
        category: 'read',
        aliases: ['rt'],
        inputSchema: z.object({}),
        call: async () => ({ data: {}, type: 'result' })
      }))

      registry.register(buildToolV2({
        name: 'mcp_tool',
        description: 'MCP tool',
        isMcp: true,
        category: 'mcp',
        shouldDefer: true,
        inputSchema: z.object({}),
        call: async () => ({ data: {}, type: 'result' })
      }))

      const stats = registry.getStats()

      expect(stats.total).toBe(2)
      expect(stats.aliases).toBe(1)
      expect(stats.mcpTools).toBe(1)
      expect(stats.deferred).toBe(1)
      expect(stats.byCategory.read).toBe(1)
      expect(stats.byCategory.mcp).toBe(1)
    })
  })
})

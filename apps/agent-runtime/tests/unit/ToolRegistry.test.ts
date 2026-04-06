/**
 * ToolRegistry Unit Tests
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { 
  ToolRegistry, 
  buildTool, 
  type ToolCategory 
} from '../../src/tools/ToolClaudeCode.js'
import { z } from 'zod'

describe('ToolRegistry', () => {
  let registry: ToolRegistry

  beforeEach(() => {
    registry = new ToolRegistry()
  })

  describe('register', () => {
    it('should register a tool', () => {
      const tool = buildTool({
        name: 'test_tool',
        description: 'A test tool',
        inputSchema: z.object({ value: z.string() }),
        outputSchema: z.object({ result: z.string() }),
        execute: async (input) => ({ result: input.value })
      })

      registry.register(tool)

      expect(registry.list()).toContain('test_tool')
      expect(registry.get('test_tool')).toBe(tool)
    })

    it('should register tool with alias', () => {
      const tool = buildTool({
        name: 'test_tool',
        description: 'A test tool',
        aliases: ['tt', 'test'],
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        execute: async () => ({})
      })

      registry.register(tool)

      expect(registry.get('tt')).toBe(tool)
      expect(registry.get('test')).toBe(tool)
    })

    it('should register tool with category', () => {
      const tool = buildTool({
        name: 'test_tool',
        description: 'A test tool',
        category: 'read' as ToolCategory,
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        execute: async () => ({})
      })

      registry.register(tool)

      const readTools = registry.getByCategory('read')
      expect(readTools).toHaveLength(1)
      expect(readTools[0].name).toBe('test_tool')
    })
  })

  describe('get', () => {
    it('should return undefined for non-existent tool', () => {
      expect(registry.get('nonexistent')).toBeUndefined()
    })

    it('should get tool by name', () => {
      const tool = buildTool({
        name: 'my_tool',
        description: 'My tool',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        execute: async () => ({})
      })

      registry.register(tool)

      expect(registry.get('my_tool')).toBe(tool)
    })
  })

  describe('search', () => {
    it('should search by hint', () => {
      const tool1 = buildTool({
        name: 'file_reader',
        description: 'Read files',
        searchHint: 'read file content',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        execute: async () => ({})
      })

      const tool2 = buildTool({
        name: 'file_writer',
        description: 'Write files',
        searchHint: 'write file content',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        execute: async () => ({})
      })

      registry.register(tool1)
      registry.register(tool2)

      const results = registry.searchByHint('read')
      expect(results).toHaveLength(1)
      expect(results[0].name).toBe('file_reader')
    })

    it('should search for task', () => {
      const readTool = buildTool({
        name: 'file_read',
        description: 'Read file',
        category: 'read' as ToolCategory,
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        execute: async () => ({})
      })

      const writeTool = buildTool({
        name: 'file_write',
        description: 'Write file',
        category: 'write' as ToolCategory,
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        execute: async () => ({})
      })

      registry.register(readTool)
      registry.register(writeTool)

      const results = registry.searchForTask('I need to read a file')
      expect(results.map(t => t.name)).toContain('file_read')
    })
  })

  describe('filtering', () => {
    beforeEach(() => {
      registry.register(buildTool({
        name: 'read_tool',
        description: 'Read tool',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        execute: async () => ({}),
        isReadOnly: () => true,
        isConcurrencySafe: () => true
      }))

      registry.register(buildTool({
        name: 'write_tool',
        description: 'Write tool',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        execute: async () => ({}),
        isReadOnly: () => false,
        isConcurrencySafe: () => false,
        isDestructive: () => true
      }))
    })

    it('should get read-only tools', () => {
      const readOnlyTools = registry.getReadOnlyTools()
      expect(readOnlyTools).toHaveLength(1)
      expect(readOnlyTools[0].name).toBe('read_tool')
    })

    it('should get concurrency-safe tools', () => {
      const safeTools = registry.getConcurrencySafeTools()
      expect(safeTools).toHaveLength(1)
      expect(safeTools[0].name).toBe('read_tool')
    })

    it('should get destructive tools', () => {
      const destructiveTools = registry.getDestructiveTools()
      expect(destructiveTools).toHaveLength(1)
      expect(destructiveTools[0].name).toBe('write_tool')
    })
  })

  describe('unregister', () => {
    it('should unregister a tool', () => {
      const tool = buildTool({
        name: 'temp_tool',
        description: 'Temp tool',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        execute: async () => ({})
      })

      registry.register(tool)
      expect(registry.has('temp_tool')).toBe(true)

      const removed = registry.unregister('temp_tool')
      expect(removed).toBe(true)
      expect(registry.has('temp_tool')).toBe(false)
    })

    it('should return false for non-existent tool', () => {
      const removed = registry.unregister('nonexistent')
      expect(removed).toBe(false)
    })
  })

  describe('tool definitions', () => {
    it('should generate tool definitions for LLM', () => {
      const tool = buildTool({
        name: 'greet',
        description: 'Greet someone',
        inputSchema: z.object({
          name: z.string().describe('Name to greet'),
          excited: z.boolean().optional().describe('Whether to be excited')
        }),
        outputSchema: z.object({ message: z.string() }),
        execute: async (input) => ({ 
          message: `Hello, ${input.name}${input.excited ? '!' : '.'}` 
        })
      })

      registry.register(tool)

      const definitions = registry.getToolDefinitions()
      expect(definitions).toHaveLength(1)
      expect(definitions[0].type).toBe('function')
      expect(definitions[0].function.name).toBe('greet')
      expect(definitions[0].function.parameters).toBeDefined()
    })
  })
})

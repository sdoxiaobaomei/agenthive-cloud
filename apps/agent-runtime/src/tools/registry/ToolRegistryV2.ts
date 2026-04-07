/**
 * Tool Registry V2
 * 
 * 支持 Claude Code 风格的 ToolV2 接口
 * 特性：
 * - 别名映射
 * - 分类管理
 * - 延迟加载
 * - MCP 工具支持
 */

import { z } from 'zod'
import type {
  ToolV2,
  ToolCategory,
  ToolProgressData,
  LazySchema
} from '../ToolV2.js'
import { resolveSchema } from '../ToolV2.js'
import { Logger } from '../../utils/loggerEnhanced.js'

export class ToolRegistryV2 {
  private tools = new Map<string, ToolV2<any, any, any>>()
  private aliasMap = new Map<string, string>() // alias -> name
  private categoryMap = new Map<ToolCategory, Set<string>>()
  private deferredTools = new Set<string>()
  private alwaysLoadTools = new Set<string>()
  private logger = new Logger('ToolRegistryV2')

  // ========================================================================
  // 注册工具
  // ========================================================================

  register<TInput, TOutput, TProgress extends ToolProgressData>(
    tool: ToolV2<TInput, TOutput, TProgress>
  ): void {
    // 检查重复
    if (this.tools.has(tool.name)) {
      this.logger.warn(`Tool already registered, overwriting: ${tool.name}`)
    }

    // 注册主工具
    this.tools.set(tool.name, tool)

    // 注册别名
    if (tool.aliases) {
      for (const alias of tool.aliases) {
        if (this.aliasMap.has(alias)) {
          this.logger.warn(`Alias already registered: ${alias} -> ${this.aliasMap.get(alias)}, now -> ${tool.name}`)
        }
        this.aliasMap.set(alias, tool.name)
      }
    }

    // 注册分类
    if (tool.category) {
      if (!this.categoryMap.has(tool.category)) {
        this.categoryMap.set(tool.category, new Set())
      }
      this.categoryMap.get(tool.category)!.add(tool.name)
    }

    // 标记延迟加载
    if (tool.shouldDefer && !tool.alwaysLoad) {
      this.deferredTools.add(tool.name)
    }

    // 标记始终加载
    if (tool.alwaysLoad) {
      this.alwaysLoadTools.add(tool.name)
    }

    this.logger.debug(`Registered tool: ${tool.name}`, {
      category: tool.category,
      aliases: tool.aliases,
      isMcp: tool.isMcp
    })
  }

  // ========================================================================
  // 获取工具
  // ========================================================================

  get(name: string): ToolV2<any, any, any> | undefined {
    // 先查找主名
    const tool = this.tools.get(name)
    if (tool) return tool

    // 再查找别名
    const aliasedName = this.aliasMap.get(name)
    if (aliasedName) {
      return this.tools.get(aliasedName)
    }

    return undefined
  }

  has(name: string): boolean {
    return this.tools.has(name) || this.aliasMap.has(name)
  }

  // ========================================================================
  // 列出工具
  // ========================================================================

  list(): string[] {
    return Array.from(this.tools.keys())
  }

  listAll(): ToolV2<any, any, any>[] {
    return Array.from(this.tools.values())
  }

  // ========================================================================
  // 分类查询
  // ========================================================================

  getByCategory(category: ToolCategory): ToolV2<any, any, any>[] {
    const names = this.categoryMap.get(category)
    if (!names) return []

    return Array.from(names)
      .map(name => this.tools.get(name))
      .filter((tool): tool is ToolV2 => tool !== undefined)
  }

  getCategories(): ToolCategory[] {
    return Array.from(this.categoryMap.keys())
  }

  // ========================================================================
  // 安全特性查询
  // ========================================================================

  getReadOnlyTools(): ToolV2<any, any, any>[] {
    return this.listAll().filter(tool => {
      try {
        return tool.isReadOnly({})
      } catch {
        return false
      }
    })
  }

  getConcurrencySafeTools(): ToolV2<any, any, any>[] {
    return this.listAll().filter(tool => {
      try {
        return tool.isConcurrencySafe({})
      } catch {
        return false
      }
    })
  }

  getDestructiveTools(): ToolV2<any, any, any>[] {
    return this.listAll().filter(tool => {
      try {
        return tool.isDestructive?.({}) ?? false
      } catch {
        return false
      }
    })
  }

  // ========================================================================
  // 加载控制
  // ========================================================================

  getDeferredTools(): ToolV2<any, any, any>[] {
    return Array.from(this.deferredTools)
      .map(name => this.tools.get(name))
      .filter((tool): tool is ToolV2 => tool !== undefined)
  }

  getAlwaysLoadTools(): ToolV2<any, any, any>[] {
    return Array.from(this.alwaysLoadTools)
      .map(name => this.tools.get(name))
      .filter((tool): tool is ToolV2 => tool !== undefined)
  }

  loadDeferredTool(name: string): ToolV2<any, any, any> | undefined {
    const tool = this.tools.get(name)
    if (tool && this.deferredTools.has(name)) {
      this.deferredTools.delete(name)
      this.logger.debug(`Loaded deferred tool: ${name}`)
    }
    return tool
  }

  // ========================================================================
  // 搜索功能
  // ========================================================================

  searchByHint(keyword: string): ToolV2<any, any, any>[] {
    const lowerKeyword = keyword.toLowerCase()

    return this.listAll().filter(tool => {
      // 搜索 hint
      if (tool.searchHint?.toLowerCase().includes(lowerKeyword)) return true

      // 搜索名称
      if (tool.name.toLowerCase().includes(lowerKeyword)) return true

      // 搜索别名
      if (tool.aliases?.some(alias => alias.toLowerCase().includes(lowerKeyword))) return true

      // 搜索分类
      if (tool.category?.toLowerCase().includes(lowerKeyword)) return true

      // 搜索描述
      if (tool.description.toLowerCase().includes(lowerKeyword)) return true

      return false
    })
  }

  searchForTask(taskDescription: string): ToolV2<any, any, any>[] {
    const lowerTask = taskDescription.toLowerCase()

    // 关键词映射
    const keywordMap: Record<string, ToolCategory[]> = {
      'read': ['read'],
      'file': ['read', 'write', 'edit'],
      'write': ['write'],
      'edit': ['edit'],
      'search': ['search'],
      'find': ['search'],
      'grep': ['search'],
      'run': ['execute'],
      'execute': ['execute'],
      'bash': ['execute'],
      'command': ['execute'],
      'agent': ['agent'],
      'subagent': ['agent'],
      'delegate': ['agent'],
      'delete': ['destructive'],
      'remove': ['destructive'],
      'mcp': ['mcp']
    }

    const matchedCategories = new Set<ToolCategory>()
    for (const [keyword, categories] of Object.entries(keywordMap)) {
      if (lowerTask.includes(keyword)) {
        categories.forEach(c => matchedCategories.add(c))
      }
    }

    if (matchedCategories.size === 0) {
      return this.listAll()
    }

    const results: ToolV2[] = []
    for (const category of matchedCategories) {
      results.push(...this.getByCategory(category))
    }

    // 去重
    return [...new Map(results.map(t => [t.name, t])).values()]
  }

  // ========================================================================
  // MCP 工具支持
  // ========================================================================

  getMCPTools(): ToolV2<any, any, any>[] {
    return this.listAll().filter(tool => tool.isMcp)
  }

  getMCPClientNames(): string[] {
    const clientNames = new Set<string>()
    for (const tool of this.getMCPTools()) {
      if (tool.mcpInfo?.serverName) {
        clientNames.add(tool.mcpInfo.serverName)
      }
    }
    return Array.from(clientNames)
  }

  getToolsByMCPClient(clientName: string): ToolV2<any, any, any>[] {
    return this.listAll().filter(tool =>
      tool.isMcp && tool.mcpInfo?.serverName === clientName
    )
  }

  // ========================================================================
  // 工具定义生成（用于 LLM）
  // ========================================================================

  getToolDefinitions(): Array<{
    type: 'function'
    function: {
      name: string
      description: string
      parameters: object
    }
  }> {
    return this.listAll()
      .filter(tool => !tool.shouldDefer || tool.alwaysLoad)
      .map(tool => {
        const schema = resolveSchema(tool.inputSchema)
        return {
          type: 'function' as const,
          function: {
            name: tool.name,
            description: tool.description,
            parameters: zodToJsonSchema(schema)
          }
        }
      })
  }

  getToolDescriptions(): Array<{
    name: string
    description: string
    inputSchema: object
  }> {
    return this.listAll().map(tool => {
      const schema = resolveSchema(tool.inputSchema)
      return {
        name: tool.name,
        description: tool.description,
        inputSchema: zodToJsonSchema(schema)
      }
    })
  }

  // ========================================================================
  // 管理操作
  // ========================================================================

  unregister(name: string): boolean {
    const tool = this.tools.get(name)
    if (!tool) return false

    this.tools.delete(name)

    // 清理别名
    for (const [alias, target] of this.aliasMap.entries()) {
      if (target === name) {
        this.aliasMap.delete(alias)
      }
    }

    // 清理分类
    if (tool.category) {
      this.categoryMap.get(tool.category)?.delete(name)
    }

    // 清理加载控制
    this.deferredTools.delete(name)
    this.alwaysLoadTools.delete(name)

    this.logger.debug(`Unregistered tool: ${name}`)
    return true
  }

  clear(): void {
    this.tools.clear()
    this.aliasMap.clear()
    this.categoryMap.clear()
    this.deferredTools.clear()
    this.alwaysLoadTools.clear()

    this.logger.debug('Registry cleared')
  }

  // ========================================================================
  // 统计信息
  // ========================================================================

  getStats(): {
    total: number
    byCategory: Record<ToolCategory, number>
    aliases: number
    deferred: number
    alwaysLoad: number
    mcpTools: number
  } {
    const byCategory: Record<string, number> = {}
    for (const [category, names] of this.categoryMap) {
      byCategory[category] = names.size
    }

    return {
      total: this.tools.size,
      byCategory,
      aliases: this.aliasMap.size,
      deferred: this.deferredTools.size,
      alwaysLoad: this.alwaysLoadTools.size,
      mcpTools: this.getMCPTools().length
    }
  }
}

// ============================================================================
// Zod Schema 转 JSON Schema
// ============================================================================

function zodToJsonSchema(schema: z.ZodTypeAny): object {
  // 处理描述
  const description = schema.description

  let result: any

  if (schema instanceof z.ZodString) {
    result = { type: 'string' }
  } else if (schema instanceof z.ZodNumber) {
    result = { type: 'number' }
  } else if (schema instanceof z.ZodBoolean) {
    result = { type: 'boolean' }
  } else if (schema instanceof z.ZodArray) {
    result = {
      type: 'array',
      items: zodToJsonSchema(schema.element)
    }
  } else if (schema instanceof z.ZodObject) {
    const shape = schema.shape
    const properties: Record<string, any> = {}
    const required: string[] = []

    for (const [key, value] of Object.entries(shape)) {
      properties[key] = zodToJsonSchema(value as z.ZodTypeAny)
      if (!(value instanceof z.ZodOptional)) {
        required.push(key)
      }
    }

    result = {
      type: 'object',
      properties,
      required
    }
  } else if (schema instanceof z.ZodOptional) {
    result = zodToJsonSchema(schema.unwrap())
  } else if (schema instanceof z.ZodDefault) {
    result = zodToJsonSchema(schema._def.innerType)
    result.default = schema._def.defaultValue
  } else if (schema instanceof z.ZodEnum) {
    result = { type: 'string', enum: schema._def.values }
  } else if (schema instanceof z.ZodLiteral) {
    result = { type: 'string', const: schema._def.value }
  } else if (schema instanceof z.ZodUnion) {
    result = {
      anyOf: schema._def.options.map((opt: z.ZodTypeAny) => zodToJsonSchema(opt))
    }
  } else if (schema instanceof z.ZodRecord) {
    result = { type: 'object', additionalProperties: true }
  } else if (schema instanceof z.ZodAny) {
    result = {}
  } else {
    result = { type: 'object' }
  }

  if (description) {
    result.description = description
  }

  return result
}

// ============================================================================
// 全局实例
// ============================================================================

export const globalToolRegistryV2 = new ToolRegistryV2()

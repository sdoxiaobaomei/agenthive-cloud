/**
 * Tool System - Claude Code Inspired Enhancements
 * 
 * 从 Claude Code 借鉴的关键优化：
 * 1. lazySchema - 延迟加载 Schema，减少启动开销
 * 2. 增强的工具元数据 - 更好的工具发现和管理
 * 3. 工具分类器 - 自动识别工具类型
 * 4. 更强大的权限系统
 */
import { z } from 'zod'

// ============================================================================
// Lazy Schema - 延迟加载，减少启动开销
// ============================================================================

export type LazySchema<T> = {
  _type: 'lazy'
  getSchema: () => z.ZodSchema<T>
}

export function lazySchema<T>(schemaGetter: () => z.ZodSchema<T>): LazySchema<T> {
  let cachedSchema: z.ZodSchema<T> | null = null
  
  return {
    _type: 'lazy',
    getSchema: () => {
      if (!cachedSchema) {
        cachedSchema = schemaGetter()
      }
      return cachedSchema
    }
  }
}

export function isLazySchema<T>(schema: any): schema is LazySchema<T> {
  return schema && schema._type === 'lazy'
}

export function resolveSchema<T>(schema: z.ZodSchema<T> | LazySchema<T>): z.ZodSchema<T> {
  if (isLazySchema(schema)) {
    return schema.getSchema()
  }
  return schema
}

// ============================================================================
// 工具分类器类型 - 用于安全模式和自动工具选择
// ============================================================================

export type ToolCategory = 
  | 'read'      // 读取操作
  | 'write'     // 写入操作
  | 'edit'      // 编辑操作
  | 'search'    // 搜索操作
  | 'execute'   // 执行操作
  | 'agent'     // Agent 操作
  | 'mcp'       // MCP 工具
  | 'destructive' // 破坏性操作

export interface ToolClassifierResult {
  category: ToolCategory
  isSafe: boolean
  riskLevel: 'low' | 'medium' | 'high'
  suggestedConfirmation: boolean
}

// ============================================================================
// 增强权限系统
// ============================================================================

export type PermissionBehavior = 'allow' | 'deny' | 'ask' | 'defer'

export interface EnhancedPermissionDecision {
  behavior: PermissionBehavior
  message?: string
  prompt?: string
  updatedInput?: any
  // 临时权限 - 在特定时间内允许
  temporaryGrant?: {
    duration: number // 毫秒
    scope: string    // 权限范围
  }
}

// ============================================================================
// 工具使用上下文 - 增强版
// ============================================================================

export interface FileStateCache {
  get(path: string): { content: string; mtime: number } | undefined
  set(path: string, content: string, mtime: number): void
  has(path: string): boolean
  clear(): void
}

export function createFileStateCache(): FileStateCache {
  const cache = new Map<string, { content: string; mtime: number }>()
  return {
    get: (path) => cache.get(path),
    set: (path, content, mtime) => cache.set(path, { content, mtime }),
    has: (path) => cache.has(path),
    clear: () => cache.clear()
  }
}

// 保留旧版 ToolContext 别名以兼容
export type ToolContext = EnhancedToolContext

export interface EnhancedToolContext {
  agentId: string
  workspacePath: string
  sendLog: (message: string, isError?: boolean) => void
  signal?: AbortSignal
  checkPermission?: <T>(toolName: string, input: T) => Promise<EnhancedPermissionDecision>
  llm?: {
    complete: (prompt: string, options?: any) => Promise<string>
    chat: (messages: any[], options?: any) => Promise<string>
  }
  // Claude Code 特色：文件状态缓存
  fileState?: FileStateCache
  // 嵌套深度追踪（防止无限递归）
  queryTracking?: {
    chainId: string
    depth: number
  }
  // 父 Agent 上下文（用于子 Agent）
  parentContext?: EnhancedToolContext
}

// ============================================================================
// 工具进度回调
// ============================================================================

export interface ToolProgressData {
  type: string
  message?: string
  progress?: number
  data?: any
}

export type ToolCallProgress<T extends ToolProgressData = ToolProgressData> = 
  (progress: T) => void

// ============================================================================
// 增强工具结果
// ============================================================================

export interface ToolResult<T = any> {
  data: T
  error?: string
  // 新消息添加到对话
  newMessages?: Array<{
    role: 'user' | 'assistant' | 'system'
    content: string
  }>
  // 上下文修饰符
  contextModifier?: (context: EnhancedToolContext) => EnhancedToolContext
  // 用于显示的结果大小
  resultSize?: number
  // 是否已持久化到磁盘
  persisted?: boolean
}

// ============================================================================
// 增强工具定义
// ============================================================================

export interface ToolMetadata {
  // 工具别名 - 用于向后兼容和快捷方式
  aliases?: string[]
  // 搜索提示 - 帮助 LLM 发现工具
  searchHint?: string
  // 工具分类
  category?: ToolCategory
  // 是否延迟加载
  shouldDefer?: boolean
  // 是否总是加载
  alwaysLoad?: boolean
  // 最大结果大小（字符数）
  maxResultSizeChars?: number
  // 示例用法
  examples?: Array<{
    description: string
    input: any
  }>
}

// 工具接口 - 参考 Claude Code
export interface Tool<TInput = any, TOutput = any, TProgress extends ToolProgressData = ToolProgressData> 
  extends ToolMetadata {
  readonly __tool?: unique symbol
  name: string
  description: string
  inputSchema: z.ZodSchema<TInput> | LazySchema<TInput>
  outputSchema: z.ZodSchema<TOutput>
  
  // 核心执行方法 - 支持进度回调
  execute: (
    input: TInput, 
    context: EnhancedToolContext,
    onProgress?: ToolCallProgress<TProgress>
  ) => Promise<TOutput>
  
  // 行为特性 - Fail-Closed 默认策略
  isEnabled: () => boolean
  isConcurrencySafe: (input: TInput) => boolean
  isReadOnly: (input: TInput) => boolean
  isDestructive: (input: TInput) => boolean
  
  // 自动分类
  classify: (input: TInput) => ToolClassifierResult
  
  // 权限控制
  checkPermissions: (
    input: TInput, 
    context: EnhancedToolContext
  ) => EnhancedPermissionDecision | Promise<EnhancedPermissionDecision>
  
  // 渲染方法
  renderToolUseMessage?: (input: Partial<TInput>) => string
  renderToolResultMessage?: (result: TOutput) => string
  renderToolUseProgressMessage?: (progress: TProgress) => string
  
  // 用户友好的名称
  userFacingName: (input?: Partial<TInput>) => string
  
  // 转换为自动分类器输入
  toAutoClassifierInput: (input: TInput) => string
  
  // 是否是搜索或读取命令（用于优化）
  isSearchOrReadCommand?: (input: TInput) => {
    isSearch: boolean
    isRead: boolean
    isList?: boolean
  }
}

// ============================================================================
// 可默认化的工具键
// ============================================================================

type DefaultableToolKeys =
  | 'isEnabled'
  | 'isConcurrencySafe'
  | 'isReadOnly'
  | 'isDestructive'
  | 'classify'
  | 'checkPermissions'
  | 'userFacingName'
  | 'toAutoClassifierInput'
  | 'aliases'
  | 'category'

export type ToolDef<TInput = any, TOutput = any, TProgress extends ToolProgressData = ToolProgressData> = 
  Omit<Tool<TInput, TOutput, TProgress>, DefaultableToolKeys> &
  Partial<Pick<Tool<TInput, TOutput, TProgress>, DefaultableToolKeys>> &
  ToolMetadata

// ============================================================================
// 工具默认值 - 安全优先 (Fail-Closed)
// ============================================================================

const TOOL_DEFAULTS: Pick<Tool<any, any>, DefaultableToolKeys> = {
  // 默认启用
  isEnabled: () => true,
  // 默认不可并发（安全第一）
  isConcurrencySafe: () => false,
  // 默认会写入（安全第一）
  isReadOnly: () => false,
  // 默认非破坏性
  isDestructive: () => false,
  // 默认分类
  classify: () => ({
    category: 'execute',
    isSafe: false,
    riskLevel: 'medium',
    suggestedConfirmation: true
  }),
  // 默认允许（依赖外部权限系统）
  checkPermissions: (input) => ({ behavior: 'allow', updatedInput: input }),
  // 默认使用工具名
  userFacingName: function(this: { name: string }) { 
    return this.name 
  },
  // 默认跳过分类器
  toAutoClassifierInput: () => '',
  // 默认无别名
  aliases: [],
  // 默认分类
  category: 'execute'
}

// ============================================================================
// buildTool - 工厂函数
// ============================================================================

export function buildTool<TInput, TOutput, TProgress extends ToolProgressData = ToolProgressData>(
  def: ToolDef<TInput, TOutput, TProgress>
): Tool<TInput, TOutput, TProgress> {
  const tool = {
    ...TOOL_DEFAULTS,
    ...def,
    // 确保 userFacingName 能访问到 name
    userFacingName: def.userFacingName || function() { return def.name }
  } as Tool<TInput, TOutput, TProgress>
  
  return tool
}

// ============================================================================
// 工具注册表 - 增强版
// ============================================================================

export class ToolRegistry {
  private tools = new Map<string, Tool<any, any, any>>()
  private aliasMap = new Map<string, string>() // alias -> name
  private categoryMap = new Map<ToolCategory, Set<string>>()

  register<TInput, TOutput, TProgress extends ToolProgressData>(
    tool: Tool<TInput, TOutput, TProgress>
  ): void {
    this.tools.set(tool.name, tool)
    
    // 注册别名
    if (tool.aliases) {
      for (const alias of tool.aliases) {
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
  }

  get(name: string): Tool<any, any, any> | undefined {
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

  list(): string[] {
    return Array.from(this.tools.keys())
  }
  
  getAllTools(): Tool<any, any, any>[] {
    return Array.from(this.tools.values())
  }

  has(name: string): boolean {
    return this.tools.has(name) || this.aliasMap.has(name)
  }
  
  /**
   * 根据分类获取工具
   */
  getByCategory(category: ToolCategory): Tool<any, any, any>[] {
    const names = this.categoryMap.get(category)
    if (!names) return []
    return Array.from(names).map(name => this.tools.get(name)!).filter(Boolean)
  }
  
  /**
   * 获取所有分类
   */
  getCategories(): ToolCategory[] {
    return Array.from(this.categoryMap.keys())
  }
  
  /**
   * 根据搜索提示查找工具
   */
  searchByHint(keyword: string): Tool<any, any, any>[] {
    const lowerKeyword = keyword.toLowerCase()
    return this.getAllTools().filter(tool => {
      if (!tool.isEnabled()) return false
      if (tool.searchHint?.toLowerCase().includes(lowerKeyword)) return true
      if (tool.name.toLowerCase().includes(lowerKeyword)) return true
      if (tool.category?.toLowerCase().includes(lowerKeyword)) return true
      return false
    })
  }
  
  /**
   * 智能搜索 - 考虑输入内容
   */
  searchForTask(taskDescription: string): Tool<any, any, any>[] {
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
      return this.getAllTools().filter(t => t.isEnabled())
    }
    
    const results: Tool<any, any, any>[] = []
    for (const category of matchedCategories) {
      results.push(...this.getByCategory(category))
    }
    
    // 去重
    return [...new Map(results.map(t => [t.name, t])).values()]
  }
  
  /**
   * 获取可并发执行的工具（读取操作）
   */
  getConcurrencySafeTools(): Tool<any, any, any>[] {
    return this.getAllTools().filter(tool => {
      if (!tool.isEnabled()) return false
      return tool.isConcurrencySafe({})
    })
  }
  
  /**
   * 获取只读工具
   */
  getReadOnlyTools(): Tool<any, any, any>[] {
    return this.getAllTools().filter(tool => {
      if (!tool.isEnabled()) return false
      return tool.isReadOnly({})
    })
  }
  
  /**
   * 获取破坏性工具
   */
  getDestructiveTools(): Tool<any, any, any>[] {
    return this.getAllTools().filter(tool => {
      if (!tool.isEnabled()) return false
      return tool.isDestructive({})
    })
  }

  // 获取工具定义（用于 LLM）
  getToolDefinitions(): Array<{
    type: 'function'
    function: {
      name: string
      description: string
      parameters: object
    }
  }> {
    return this.getToolDescriptions().map(tool => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema
      }
    }))
  }

  // 获取工具描述（向后兼容）
  getToolDescriptions(): Array<{
    name: string
    description: string
    inputSchema: object
  }> {
    return Array.from(this.tools.values())
      .filter(tool => tool.isEnabled())
      .map(tool => {
        const schema = resolveSchema(tool.inputSchema)
        return {
          name: tool.name,
          description: tool.description,
          inputSchema: schema instanceof z.ZodObject 
            ? zodToJsonSchema(schema)
            : { type: 'object' }
        }
      })
  }
  
  /**
   * 获取延迟加载的工具（需要 ToolSearch）
   */
  getDeferredTools(): Tool<any, any, any>[] {
    return this.getAllTools().filter(tool => tool.shouldDefer && !tool.alwaysLoad)
  }
  
  /**
   * 获取总是加载的工具
   */
  getAlwaysLoadTools(): Tool<any, any, any>[] {
    return this.getAllTools().filter(tool => tool.alwaysLoad)
  }
  
  /**
   * 注销工具
   */
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
    
    return true
  }
  
  /**
   * 清空所有工具
   */
  clear(): void {
    this.tools.clear()
    this.aliasMap.clear()
    this.categoryMap.clear()
  }
}

// ============================================================================
// Zod Schema 转 JSON Schema - 增强版
// ============================================================================

function zodToJsonSchema(schema: z.ZodObject<any>): object {
  const shape = schema.shape
  const properties: Record<string, any> = {}
  const required: string[] = []

  for (const [key, value] of Object.entries(shape)) {
    properties[key] = zodTypeToJson(value as z.ZodTypeAny)
    if (!(value instanceof z.ZodOptional)) {
      required.push(key)
    }
  }

  return {
    type: 'object',
    properties,
    required
  }
}

function zodTypeToJson(schema: z.ZodTypeAny): any {
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
      items: zodTypeToJson(schema.element) 
    }
  } else if (schema instanceof z.ZodObject) {
    result = zodToJsonSchema(schema)
  } else if (schema instanceof z.ZodOptional) {
    result = zodTypeToJson(schema.unwrap())
  } else if (schema instanceof z.ZodDefault) {
    result = zodTypeToJson(schema._def.innerType)
    result.default = schema._def.defaultValue
  } else if (schema instanceof z.ZodEnum) {
    result = { type: 'string', enum: schema._def.values }
  } else if (schema instanceof z.ZodLiteral) {
    result = { type: 'string', const: schema._def.value }
  } else if (schema instanceof z.ZodUnion) {
    result = { 
      anyOf: schema._def.options.map((opt: z.ZodTypeAny) => zodTypeToJson(opt)) 
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
// 工具调用类型
// ============================================================================

export interface ToolCall {
  id: string
  name: string
  input: any
}

export interface ToolExecutionResult {
  id: string
  name: string
  input: any
  output?: any
  error?: string
  duration: number
  status: 'completed' | 'failed' | 'cancelled'
  progress?: ToolProgressData[]
}

// ============================================================================
// 全局工具注册表实例
// ============================================================================

export const globalToolRegistry = new ToolRegistry()

/**
 * Enhanced Tool System - 参考 Claude Code 设计优化
 * 
 * 优化点：
 * 1. TOOL_DEFAULTS 模式 - 安全默认值，减少样板代码
 * 2. 工具元数据 - isConcurrencySafe, isReadOnly, isDestructive
 * 3. 工具别名和搜索提示
 * 4. 更强大的 ToolResult 类型
 * 5. 权限检查默认值
 */
import { z } from 'zod'

// ============================================================================
// 权限类型定义
// ============================================================================

export type PermissionDecision = 
  | { type: 'allow'; updatedInput?: any }
  | { type: 'deny'; message: string }
  | { type: 'ask'; prompt: string }

// ============================================================================
// 工具上下文
// ============================================================================

export interface ToolContext {
  agentId: string
  workspacePath: string
  sendLog: (message: string, isError?: boolean) => void
  signal?: AbortSignal
  checkPermission?: <T>(toolName: string, input: T) => Promise<PermissionDecision>
  llm?: {
    complete: (prompt: string, options?: any) => Promise<string>
    chat: (messages: any[], options?: any) => Promise<string>
  }
}

// ============================================================================
// 工具进度和结果类型
// ============================================================================

export interface ToolProgress {
  type: string
  message?: string
  progress?: number // 0-100
  data?: any
}

export type ToolResult<T> = {
  data: T
  error?: string
  newMessages?: Array<{
    role: 'user' | 'assistant' | 'system'
    content: string
  }>
  /** 上下文修饰符 - 用于非并发安全工具更新上下文 */
  contextModifier?: (context: ToolContext) => ToolContext
}

// ============================================================================
// 工具元数据类型
// ============================================================================

export interface ToolMetadata {
  /** 工具别名 - 用于向后兼容 */
  aliases?: string[]
  /** 搜索提示 - 用于工具发现，3-10个词 */
  searchHint?: string
  /** 是否延迟加载 - 需要 ToolSearch 后才能使用 */
  shouldDefer?: boolean
  /** 是否总是加载 - 不受延迟加载影响 */
  alwaysLoad?: boolean
  /** 最大结果大小（字符数），超过则持久化到磁盘 */
  maxResultSizeChars?: number
}

// ============================================================================
// 完整工具定义接口
// ============================================================================

// 工具唯一标识符（用于类型区分）
declare const __toolSymbol: unique symbol

export interface Tool<TInput = any, TOutput = any> extends ToolMetadata {
  readonly __tool?: typeof __toolSymbol
  name: string
  description: string
  inputSchema: z.ZodSchema<TInput>
  outputSchema: z.ZodSchema<TOutput>
  
  // 核心执行方法
  execute: (input: TInput, context: ToolContext) => Promise<TOutput>
  
  // 行为特性 - 使用默认值模式
  /** 是否启用此工具 */
  isEnabled: () => boolean
  /** 是否可并发执行（读取操作通常可以） */
  isConcurrencySafe: (input: TInput) => boolean
  /** 是否只读操作（不修改状态） */
  isReadOnly: (input: TInput) => boolean
  /** 是否破坏性操作（删除、覆盖等） */
  isDestructive: (input: TInput) => boolean
  
  // 权限控制
  checkPermissions: (input: TInput, context: ToolContext) => PermissionDecision | Promise<PermissionDecision>
  
  // 渲染方法（可选）
  renderToolUseMessage?: (input: TInput) => string
  renderToolResultMessage?: (result: TOutput) => string
  
  // 用户友好的名称
  userFacingName: (input?: Partial<TInput>) => string
  
  // 转换为自动分类器输入（用于安全模式）
  toAutoClassifierInput: (input: TInput) => string
}

// ============================================================================
// 可默认化的工具键 - buildTool 会提供默认值
// ============================================================================

type DefaultableToolKeys =
  | 'isEnabled'
  | 'isConcurrencySafe'
  | 'isReadOnly'
  | 'isDestructive'
  | 'checkPermissions'
  | 'userFacingName'
  | 'toAutoClassifierInput'

/**
 * 工具定义（可省略默认值键）
 */
export type ToolDef<TInput = any, TOutput = any> = Omit<Tool<TInput, TOutput>, DefaultableToolKeys> &
  Partial<Pick<Tool<TInput, TOutput>, DefaultableToolKeys>> &
  ToolMetadata

// ============================================================================
// 工具默认值 - 安全优先
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
  // 默认允许（依赖外部权限系统）
  checkPermissions: (input) => ({ type: 'allow', updatedInput: input }),
  // 默认使用工具名
  userFacingName: function(this: { name: string }) { 
    return this.name 
  },
  // 默认跳过分类器
  toAutoClassifierInput: () => '',
}

// ============================================================================
// buildTool - 工厂函数，填充默认值
// ============================================================================

export function buildTool<TInput, TOutput>(def: ToolDef<TInput, TOutput>): Tool<TInput, TOutput> {
  const tool = {
    ...TOOL_DEFAULTS,
    ...def,
    // 确保 userFacingName 能访问到 name
    userFacingName: def.userFacingName || function() { return def.name }
  } as Tool<TInput, TOutput>
  
  return tool
}

// ============================================================================
// 工具注册表 - 增强版
// ============================================================================

export class ToolRegistry {
  private tools = new Map<string, Tool<any, any>>()
  private aliasMap = new Map<string, string>() // alias -> name

  register<TInput, TOutput>(tool: Tool<TInput, TOutput>): void {
    this.tools.set(tool.name, tool)
    
    // 注册别名
    if (tool.aliases) {
      for (const alias of tool.aliases) {
        this.aliasMap.set(alias, tool.name)
      }
    }
  }

  get(name: string): Tool<any, any> | undefined {
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
  
  getAllTools(): Tool<any, any>[] {
    return Array.from(this.tools.values())
  }

  has(name: string): boolean {
    return this.tools.has(name) || this.aliasMap.has(name)
  }
  
  /**
   * 根据搜索提示查找工具
   */
  searchByHint(keyword: string): Tool<any, any>[] {
    const lowerKeyword = keyword.toLowerCase()
    return this.getAllTools().filter(tool => {
      if (tool.searchHint?.toLowerCase().includes(lowerKeyword)) return true
      if (tool.name.toLowerCase().includes(lowerKeyword)) return true
      return false
    })
  }
  
  /**
   * 获取可并发执行的工具（读取操作）
   */
  getConcurrencySafeTools(input?: any): Tool<any, any>[] {
    return this.getAllTools().filter(tool => {
      if (!tool.isEnabled()) return false
      return tool.isConcurrencySafe(input)
    })
  }
  
  /**
   * 获取只读工具
   */
  getReadOnlyTools(): Tool<any, any>[] {
    return this.getAllTools().filter(tool => {
      if (!tool.isEnabled()) return false
      return tool.isReadOnly({} as any)
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
      .map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema instanceof z.ZodObject 
          ? zodToJsonSchema(tool.inputSchema)
          : { type: 'object' }
      }))
  }
  
  /**
   * 获取延迟加载的工具（需要 ToolSearch）
   */
  getDeferredTools(): Tool<any, any>[] {
    return this.getAllTools().filter(tool => tool.shouldDefer && !tool.alwaysLoad)
  }
  
  /**
   * 获取总是加载的工具
   */
  getAlwaysLoadTools(): Tool<any, any>[] {
    return this.getAllTools().filter(tool => tool.alwaysLoad)
  }
}

// ============================================================================
// Zod Schema 转 JSON Schema
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
  if (schema instanceof z.ZodString) return { type: 'string' }
  if (schema instanceof z.ZodNumber) return { type: 'number' }
  if (schema instanceof z.ZodBoolean) return { type: 'boolean' }
  if (schema instanceof z.ZodArray) return { 
    type: 'array', 
    items: zodTypeToJson(schema.element) 
  }
  if (schema instanceof z.ZodObject) return zodToJsonSchema(schema)
  if (schema instanceof z.ZodOptional) return zodTypeToJson(schema.unwrap())
  if (schema instanceof z.ZodDefault) return zodTypeToJson(schema._def.innerType)
  if (schema instanceof z.ZodEnum) return { type: 'string', enum: schema._def.values }
  if (schema instanceof z.ZodLiteral) return { type: 'string', const: schema._def.value }
  if (schema instanceof z.ZodUnion) return { 
    anyOf: schema._def.options.map((opt: z.ZodTypeAny) => zodTypeToJson(opt)) 
  }
  return { type: 'object' }
}

// ============================================================================
// 工具执行器 - 增强版
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
  status: 'completed' | 'failed'
}

export class ToolExecutor {
  constructor(private registry: ToolRegistry) {}

  async execute<TInput, TOutput>(
    toolName: string,
    input: TInput,
    context: ToolContext
  ): Promise<TOutput> {
    const tool = this.registry.get(toolName)
    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`)
    }

    // 验证输入
    const parseResult = tool.inputSchema.safeParse(input)
    if (!parseResult.success) {
      throw new Error(`Invalid input for tool ${toolName}: ${parseResult.error.message}`)
    }

    // 权限检查
    const permissionResult = await tool.checkPermissions(parseResult.data, context)
    if (permissionResult.type === 'deny') {
      throw new Error(`Permission denied: ${permissionResult.message}`)
    }
    if (permissionResult.type === 'ask' && context.checkPermission) {
      const userDecision = await context.checkPermission(toolName, parseResult.data)
      if (userDecision.type === 'deny') {
        throw new Error(`Permission denied by user`)
      }
    }

    // 执行工具
    context.sendLog(`Using tool: ${tool.userFacingName(parseResult.data)}`)
    if (tool.renderToolUseMessage) {
      context.sendLog(tool.renderToolUseMessage(parseResult.data))
    }

    try {
      const result = await tool.execute(parseResult.data, context)
      
      // 验证输出
      const outputResult = tool.outputSchema.safeParse(result)
      if (!outputResult.success) {
        throw new Error(`Invalid output from tool ${toolName}: ${outputResult.error.message}`)
      }

      if (tool.renderToolResultMessage) {
        context.sendLog(tool.renderToolResultMessage(result))
      }

      return result
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      context.sendLog(`Tool ${toolName} failed: ${message}`, true)
      throw error
    }
  }

  /**
   * 批量执行工具调用（串行）
   */
  async executeBatch(
    calls: ToolCall[],
    context: ToolContext
  ): Promise<ToolExecutionResult[]> {
    const results: ToolExecutionResult[] = []

    for (const call of calls) {
      const startTime = Date.now()
      try {
        const output = await this.execute(call.name, call.input, context)
        results.push({
          id: call.id,
          name: call.name,
          input: call.input,
          output,
          duration: Date.now() - startTime,
          status: 'completed'
        })
      } catch (error) {
        results.push({
          id: call.id,
          name: call.name,
          input: call.input,
          error: error instanceof Error ? error.message : 'Unknown error',
          duration: Date.now() - startTime,
          status: 'failed'
        })
      }
    }

    return results
  }
  
  /**
   * 检查工具是否可并发执行
   */
  isConcurrencySafe(toolName: string, input?: any): boolean {
    const tool = this.registry.get(toolName)
    if (!tool) return false
    return tool.isConcurrencySafe(input)
  }
  
  /**
   * 检查工具是否只读
   */
  isReadOnly(toolName: string, input?: any): boolean {
    const tool = this.registry.get(toolName)
    if (!tool) return false
    return tool.isReadOnly(input)
  }
}

// ============================================================================
// 全局工具注册表实例
// ============================================================================

export const globalToolRegistry = new ToolRegistry()

// 工具系统基础框架 - 参考 Claude Code 设计
import { z } from 'zod'

// 工具权限决策类型
export type PermissionDecision = 
  | { type: 'allow' }
  | { type: 'deny'; message: string }
  | { type: 'ask'; prompt: string }

// 工具上下文
export interface ToolContext {
  agentId: string
  workspacePath: string
  sendLog: (message: string, isError?: boolean) => void
  signal?: AbortSignal
  // 权限检查
  checkPermission?: <T>(toolName: string, input: T) => Promise<PermissionDecision>
  // LLM 调用
  llm?: {
    complete: (prompt: string, options?: any) => Promise<string>
    chat: (messages: any[], options?: any) => Promise<string>
  }
}

// 工具定义
export interface ToolDef<TInput, TOutput> {
  name: string
  description: string
  inputSchema: z.ZodSchema<TInput>
  outputSchema: z.ZodSchema<TOutput>
  execute: (input: TInput, context: ToolContext) => Promise<TOutput>
  checkPermissions?: (input: TInput, context: ToolContext) => PermissionDecision | Promise<PermissionDecision>
  renderToolUseMessage?: (input: TInput) => string
  renderToolResultMessage?: (result: TOutput) => string
}

// 工具接口
export interface Tool<TInput, TOutput> extends ToolDef<TInput, TOutput> {
  readonly __tool: unique symbol
}

// 构建工具
export function buildTool<TInput, TOutput>(def: ToolDef<TInput, TOutput>): Tool<TInput, TOutput> {
  return def as Tool<TInput, TOutput>
}

// 工具注册表
export class ToolRegistry {
  private tools = new Map<string, Tool<any, any>>()

  register<TInput, TOutput>(tool: Tool<TInput, TOutput>): void {
    this.tools.set(tool.name, tool)
  }

  get(name: string): Tool<any, any> | undefined {
    return this.tools.get(name)
  }

  list(): string[] {
    return Array.from(this.tools.keys())
  }

  has(name: string): boolean {
    return this.tools.has(name)
  }

  // 获取工具描述（用于 LLM）
  getToolDescriptions(): Array<{
    name: string
    description: string
    inputSchema: object
  }> {
    return Array.from(this.tools.values()).map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema instanceof z.ZodObject 
        ? zodToJsonSchema(tool.inputSchema)
        : { type: 'object' }
    }))
  }
}

// Zod Schema 转 JSON Schema
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

// 工具执行器
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
    if (tool.checkPermissions) {
      const decision = await tool.checkPermissions(parseResult.data, context)
      if (decision.type === 'deny') {
        throw new Error(`Permission denied: ${decision.message}`)
      }
      if (decision.type === 'ask' && context.checkPermission) {
        const userDecision = await context.checkPermission(toolName, parseResult.data)
        if (userDecision.type === 'deny') {
          throw new Error(`Permission denied by user`)
        }
      }
    }

    // 执行工具
    context.sendLog(`Using tool: ${toolName}`)
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

  // 批量执行工具
  async executeBatch(
    calls: Array<{ toolName: string; input: any }>,
    context: ToolContext
  ): Promise<any[]> {
    return Promise.all(
      calls.map(call => this.execute(call.toolName, call.input, context))
    )
  }
}

// 全局工具注册表实例
export const globalToolRegistry = new ToolRegistry()

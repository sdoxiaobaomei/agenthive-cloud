/**
 * Tool System V2 - Claude Code 风格接口
 * 
 * 核心改进：
 * 1. 完整的 call() 接口，支持权限检查和进度回调
 * 2. 统一的 ToolUseContext
 * 3. 更好的类型安全
 * 4. MCP 集成支持
 */

import { z } from 'zod'
import type { AbortController as NodeAbortController } from 'node-abort-controller'

// ============================================================================
// 基础类型
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

export type PermissionBehavior = 'allow' | 'deny' | 'ask' | 'defer' | 'passthrough'

export interface PermissionResult {
  behavior: PermissionBehavior
  message?: string
  prompt?: string
  updatedInput?: any
  ruleId?: string
  // 异步分类器结果
  pendingClassifier?: Promise<ClassifierResult>
}

export interface ClassifierResult {
  behavior: PermissionBehavior
  reason?: string
  confidence: 'high' | 'medium' | 'low'
}

// ============================================================================
// 进度回调
// ============================================================================

export interface ToolProgressData {
  type: string
  message?: string
  progress?: number // 0-100
  data?: any
}

export type ToolProgressCallback<T extends ToolProgressData = ToolProgressData> = 
  (progress: T) => void

// ============================================================================
// 工具结果
// ============================================================================

export interface ToolResult<T = any> {
  // 核心数据
  data: T
  
  // 错误信息
  error?: string
  
  // 结果类型
  type: 'result' | 'error' | 'cancelled'
  
  // 给助手的结果（格式化后的）
  resultForAssistant?: string
  
  // 上下文修饰符
  contextModifier?: (context: ToolUseContext) => ToolUseContext
  
  // MCP 元数据
  mcpMeta?: {
    _meta?: any
    structuredContent?: any
  }
}

// ============================================================================
// 消息类型
// ============================================================================

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  toolCalls?: ToolCall[]
  toolResults?: ToolResult[]
}

export interface ToolCall {
  id: string
  name: string
  input: any
}

export interface AssistantMessage {
  role: 'assistant'
  content: string
  toolCalls?: ToolCall[]
}

// ============================================================================
// ToolUseContext - 统一的工具使用上下文
// ============================================================================

export interface AppState {
  [key: string]: any
}

export interface QueryChainTracking {
  chainId: string
  depth: number
  parentChainId?: string
}

export interface ContentReplacementState {
  replacedBlocks: Map<string, string>
  replacementBudget: number
}

export interface MCPServerConnection {
  name: string
  type: 'connected' | 'pending' | 'failed' | 'needs-auth'
  client?: any
  error?: string
}

export interface LLMResult {
  content: string
  toolCalls?: ToolCall[]
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

export interface LLMStreamChunk {
  content?: string
  toolCall?: ToolCall
  usage?: LLMResult['usage']
}

export type CanUseToolFn = (
  toolName: string,
  input: any
) => Promise<PermissionResult>

export interface ToolUseContext {
  // 基础标识
  agentId: string
  workspacePath: string
  
  // 日志输出
  sendLog: (message: string, isError?: boolean) => void
  
  // 中止控制
  abortController: AbortController | NodeAbortController
  
  // 应用状态管理
  getAppState: () => AppState
  setAppState: (updater: (prev: AppState) => AppState) => void
  
  // 消息历史
  messages: Message[]
  
  // 查询链追踪（防止递归）
  queryTracking?: QueryChainTracking
  
  // 内容替换状态（工具结果预算）
  contentReplacementState?: ContentReplacementState
  
  // MCP 集成点
  mcpClients?: MCPServerConnection[]
  
  // 父上下文
  parentContext?: ToolUseContext
  
  // 权限检查
  checkPermission: CanUseToolFn
  
  // LLM 服务
  llm: {
    complete: (messages: Message[], options?: any) => Promise<LLMResult>
    stream: (messages: Message[], options?: any) => AsyncGenerator<LLMStreamChunk>
  }
}

// ============================================================================
// Lazy Schema
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
// Tool V2 接口
// ============================================================================

export interface ToolV2<
  TInput = any,
  TOutput = any,
  TProgress extends ToolProgressData = ToolProgressData
> {
  // 基础属性
  name: string
  description: string
  aliases?: string[]
  searchHint?: string
  category?: ToolCategory
  
  // Schema
  inputSchema: z.ZodSchema<TInput> | LazySchema<TInput>
  outputSchema?: z.ZodSchema<TOutput>
  
  // MCP 相关
  isMcp?: boolean
  mcpInfo?: {
    serverName: string
    toolName: string
  }
  
  // 加载控制
  shouldDefer?: boolean    // 延迟加载
  alwaysLoad?: boolean     // 始终加载
  
  // ==========================================================================
  // 核心方法 - Claude Code 风格
  // ==========================================================================
  
  /**
   * 执行工具调用
   * 
   * @param input - 工具输入
   * @param context - 工具使用上下文
   * @param canUseTool - 权限检查函数
   * @param assistantMessage - 助手消息（用于关联）
   * @param onProgress - 进度回调
   */
  call(
    input: TInput,
    context: ToolUseContext,
    canUseTool: CanUseToolFn,
    assistantMessage: AssistantMessage | null,
    onProgress?: ToolProgressCallback<TProgress>
  ): Promise<ToolResult<TOutput>>
  
  // ==========================================================================
  // 权限控制
  // ==========================================================================
  
  /**
   * 检查权限
   */
  checkPermissions(
    input: TInput,
    context: ToolUseContext
  ): Promise<PermissionResult>
  
  /**
   * 是否是只读操作
   */
  isReadOnly(input: TInput): boolean
  
  /**
   * 是否是破坏性操作
   */
  isDestructive?(input: TInput): boolean
  
  /**
   * 是否可并发执行
   */
  isConcurrencySafe(input: TInput): boolean
  
  // ==========================================================================
  // 渲染方法（可选）
  // ==========================================================================
  
  /**
   * 渲染工具使用消息
   */
  renderToolUseMessage?(input: Partial<TInput>): string
  
  /**
   * 渲染工具结果消息
   */
  renderToolResultMessage?(output: TOutput): string
  
  /**
   * 渲染进度消息
   */
  renderToolUseProgressMessage?(progress: TProgress): string
  
  // ==========================================================================
  // 分类器支持
  // ==========================================================================
  
  /**
   * 转换为自动分类器输入
   */
  toAutoClassifierInput(input: TInput): string
  
  /**
   * 用户友好的名称
   */
  userFacingName(input?: Partial<TInput>): string
}

// ============================================================================
// 工具定义类型（用于 buildToolV2）
// ============================================================================

type DefaultableToolV2Keys =
  | 'aliases'
  | 'searchHint'
  | 'category'
  | 'isMcp'
  | 'mcpInfo'
  | 'shouldDefer'
  | 'alwaysLoad'
  | 'checkPermissions'
  | 'isReadOnly'
  | 'isDestructive'
  | 'isConcurrencySafe'
  | 'renderToolUseMessage'
  | 'renderToolResultMessage'
  | 'renderToolUseProgressMessage'
  | 'toAutoClassifierInput'
  | 'userFacingName'

export type ToolV2Def<
  TInput = any,
  TOutput = any,
  TProgress extends ToolProgressData = ToolProgressData
> = Omit<ToolV2<TInput, TOutput, TProgress>, DefaultableToolV2Keys> &
  Partial<Pick<ToolV2<TInput, TOutput, TProgress>, DefaultableToolV2Keys>>

// ============================================================================
// 工具默认值
// ============================================================================

const TOOL_V2_DEFAULTS: Pick<ToolV2<any, any>, DefaultableToolV2Keys> = {
  aliases: [],
  searchHint: undefined,
  category: 'execute',
  isMcp: false,
  mcpInfo: undefined,
  shouldDefer: false,
  alwaysLoad: false,
  
  // 权限默认
  checkPermissions: async (input) => ({ behavior: 'allow', updatedInput: input }),
  isReadOnly: () => false,
  isDestructive: () => false,
  isConcurrencySafe: () => false,
  
  // 渲染默认
  renderToolUseMessage: undefined,
  renderToolResultMessage: undefined,
  renderToolUseProgressMessage: undefined,
  
  // 分类器默认
  toAutoClassifierInput: () => '',
  userFacingName: function(this: { name: string }) {
    return this.name
  }
}

// ============================================================================
// buildToolV2 工厂函数
// ============================================================================

export function buildToolV2<
  TInput,
  TOutput,
  TProgress extends ToolProgressData = ToolProgressData
>(
  def: ToolV2Def<TInput, TOutput, TProgress>
): ToolV2<TInput, TOutput, TProgress> {
  // 合并默认值
  const tool: ToolV2<TInput, TOutput, TProgress> = {
    ...TOOL_V2_DEFAULTS,
    ...def,
    // 确保 userFacingName 能访问到 name
    userFacingName: def.userFacingName || function() { return def.name }
  } as ToolV2<TInput, TOutput, TProgress>
  
  return tool
}

// ============================================================================
// 工具结果辅助函数
// ============================================================================

export function createToolResult<T>(
  data: T,
  options?: {
    resultForAssistant?: string
    contextModifier?: (context: ToolUseContext) => ToolUseContext
  }
): ToolResult<T> {
  return {
    data,
    type: 'result',
    resultForAssistant: options?.resultForAssistant,
    contextModifier: options?.contextModifier
  }
}

export function createToolError(error: string): ToolResult<null> {
  return {
    data: null,
    error,
    type: 'error'
  }
}

export function createToolCancelled(): ToolResult<null> {
  return {
    data: null,
    type: 'cancelled'
  }
}

// ============================================================================
// 类型守卫
// ============================================================================

export function isToolV2(obj: any): obj is ToolV2 {
  return !!obj && 
    typeof obj.name === 'string' &&
    typeof obj.call === 'function' &&
    typeof obj.checkPermissions === 'function' &&
    typeof obj.isReadOnly === 'function'
}

export function isToolResultError(result: ToolResult): boolean {
  return result.type === 'error' || !!result.error
}

export function isToolResultCancelled(result: ToolResult): boolean {
  return result.type === 'cancelled'
}

/**
 * QueryLoop V2 - 增强版查询循环
 * 
 * 核心改进：
 * 1. 集成三级上下文压缩策略 (Snip/Compact/Collapse)
 * 2. 支持 ToolV2 接口
 * 3. 完整的状态机管理
 * 4. 更好的流式处理
 * 
 * 参考 Claude Code 的 query.ts 实现
 */

import { EventEmitter } from 'events'
import type { LLMService } from '../services/llm/LLMService.js'
import type { LLMMessage, LLMToolDefinition, LLMCompletionResult } from '../services/llm/types.js'
import { ConversationContextV2 } from '../context/ConversationContextV2.js'
import type { ToolV2, ToolUseContext, ToolResult, CanUseToolFn } from '../tools/ToolV2.js'
import type { PermissionManager } from '../permissions/PermissionManager.js'
import type { ToolRegistryV2 } from '../tools/registry/ToolRegistryV2.js'
import { Logger } from '../utils/loggerEnhanced.js'
import type { CompactionEngine, CompactionResult } from '../context/compact/CompactionEngine.js'

// ============================================================================
// 类型定义
// ============================================================================

export interface QueryLoopV2Config {
  llmService: LLMService
  toolRegistry: ToolRegistryV2
  permissionManager?: PermissionManager
  compactionEngine?: CompactionEngine
  maxIterations?: number
  maxTokens?: number
  compactionThreshold?: number
  enableStreaming?: boolean
  enableCompaction?: boolean
  onProgress?: (data: QueryProgressData) => void
  /** 任务完成后回调，用于上报 token 消耗等计费信息 */
  onComplete?: (result: QueryLoopV2Result) => void | Promise<void>
}

export interface QueryProgressData {
  type: 'start' | 'thinking' | 'content' | 'tool_call' | 'tool_result' | 'compaction' | 'complete' | 'error' | 'stopped'
  message?: string
  content?: string
  toolName?: string
  toolInput?: any
  toolOutput?: any
  compactionResult?: CompactionResult
  error?: string
  iteration: number
}

export interface QueryLoopV2Result {
  success: boolean
  content: string
  toolCalls: Array<{
    name: string
    input: any
    output: any
    error?: string
  }>
  iterations: number
  compactionCount: number
  tokensSaved: number
  error?: string
  duration: number
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

export interface QueryState {
  status: 'idle' | 'running' | 'compacting' | 'tool_executing' | 'completed' | 'error' | 'stopped'
  iteration: number
  compactionCount: number
  tokensSaved: number
  startTime: number
  endTime?: number
  error?: string
}

// ============================================================================
// QueryLoopV2 类
// ============================================================================

export class QueryLoopV2 extends EventEmitter {
  private config: Required<QueryLoopV2Config>
  private state: QueryState
  private logger: Logger
  private abortController: AbortController | null = null

  constructor(config: QueryLoopV2Config) {
    super()
    
    this.config = {
      maxIterations: 20,
      maxTokens: 12000,
      compactionThreshold: 10000,
      enableStreaming: true,
      enableCompaction: true,
      onProgress: () => {},
      onComplete: undefined as any,
      compactionEngine: undefined as any,
      permissionManager: undefined as any,
      ...config
    }

    this.logger = new Logger('QueryLoopV2')
    
    this.state = {
      status: 'idle',
      iteration: 0,
      compactionCount: 0,
      tokensSaved: 0,
      startTime: 0
    }
  }

  // ========================================================================
  // 主执行方法
  // ========================================================================

  async execute(
    userInput: string,
    context: ConversationContextV2,
    options?: {
      systemPrompt?: string
      model?: string
      tools?: LLMToolDefinition[]
    }
  ): Promise<QueryLoopV2Result> {
    // 检查状态
    if (this.state.status === 'running') {
      throw new Error('QueryLoopV2 is already running')
    }

    // 初始化
    this.abortController = new AbortController()
    this.state = {
      status: 'running',
      iteration: 0,
      compactionCount: 0,
      tokensSaved: 0,
      startTime: Date.now()
    }

    this.emit('start', { userInput, state: this.state })
    this.config.onProgress({ type: 'start', message: 'Starting query loop', iteration: 0 })

    try {
      // 设置系统提示词
      if (options?.systemPrompt) {
        context.setSystemPrompt(options.systemPrompt)
      }

      // 添加用户输入
      context.addUserMessage(userInput)

      // 主循环
      const result = await this.runLoop(context, options)
      
      this.state.status = 'completed'
      this.state.endTime = Date.now()
      
      this.emit('complete', { result, state: this.state })

      const finalResult: QueryLoopV2Result = {
        ...result,
        duration: this.state.endTime - this.state.startTime
      }

      if (this.config.onComplete) {
        try {
          await this.config.onComplete(finalResult)
        } catch (err) {
          this.logger.error('onComplete callback failed', { error: err instanceof Error ? err.message : String(err) })
        }
      }

      return finalResult

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      this.state.status = 'error'
      this.state.error = errorMessage
      this.state.endTime = Date.now()
      
      this.logger.error('Query loop failed', { error: errorMessage })
      this.emit('error', { error: errorMessage, state: this.state }) as any
      
      this.config.onProgress({
        type: 'error',
        error: errorMessage,
        iteration: this.state.iteration
      })

      return {
        success: false,
        content: '',
        toolCalls: [],
        iterations: this.state.iteration,
        compactionCount: this.state.compactionCount,
        tokensSaved: this.state.tokensSaved,
        error: errorMessage,
        duration: this.state.endTime - this.state.startTime
      }

    } finally {
      this.abortController = null
    }
  }

  // ========================================================================
  // 主循环
  // ========================================================================

  private async runLoop(
    context: ConversationContextV2,
    options?: {
      systemPrompt?: string
      model?: string
      tools?: LLMToolDefinition[]
    }
  ): Promise<Omit<QueryLoopV2Result, 'duration'>> {
    const availableTools = options?.tools || this.getToolDefinitions()
    const toolCalls: QueryLoopV2Result['toolCalls'] = []
    let finalContent = ''
    let finalUsage: { promptTokens: number; completionTokens: number; totalTokens: number } | undefined

    while (this.state.iteration < this.config.maxIterations) {
      // 检查中止
      if (this.abortController?.signal.aborted) {
        this.logger.info('Query loop aborted')
        break
      }

      this.state.iteration++
      const currentIteration = this.state.iteration

      this.logger.debug(`Iteration ${currentIteration}`)
      this.emit('iteration', { iteration: currentIteration, state: this.state })

      // 步骤 1: 检查并执行压缩
      if (this.config.enableCompaction) {
        const compactionResult = await this.checkAndCompact(context)
        if (compactionResult) {
          this.state.compactionCount++
          this.state.tokensSaved += (compactionResult.originalTokens - compactionResult.compressedTokens)
          
          this.emit('compaction', { result: compactionResult, state: this.state })
          this.config.onProgress({
            type: 'compaction',
            compactionResult,
            iteration: currentIteration
          })
        }
      }

      // 步骤 2: 调用 LLM
      this.state.status = 'running'
      this.config.onProgress({ type: 'thinking', message: 'Thinking...', iteration: currentIteration })

      const messages = context.toLLMMessages()
      const response = await this.callLLM(messages, availableTools, options?.model)

      finalUsage = response.usage

      // 步骤 3: 处理助手回复
      if (response.content) {
        finalContent += response.content
        context.addAssistantMessage(response.content, response.toolCalls)
        
        this.emit('content', { content: response.content, iteration: currentIteration })
        this.config.onProgress({
          type: 'content',
          content: response.content,
          iteration: currentIteration
        })
      }

      // 步骤 4: 处理工具调用
      if (response.toolCalls && response.toolCalls.length > 0) {
        this.state.status = 'tool_executing'
        
        const results = await this.executeToolCalls(response.toolCalls, currentIteration)
        toolCalls.push(...results)

        // 添加工具结果到上下文
        context.addToolResults(results.map(r => ({
          toolCallId: r.id,
          output: r.output,
          error: r.error
        })))

        // 继续循环等待 LLM 处理工具结果
        continue
      }

      // 没有工具调用，结束循环
      break
    }

    this.state.endTime = Date.now()

    return {
      success: true,
      content: finalContent,
      toolCalls,
      iterations: this.state.iteration,
      compactionCount: this.state.compactionCount,
      tokensSaved: this.state.tokensSaved,
      usage: finalUsage
    }
  }

  // ========================================================================
  // 上下文压缩
  // ========================================================================

  private async checkAndCompact(context: ConversationContextV2): Promise<CompactionResult | null> {
    if (!this.config.compactionEngine) {
      return null
    }

    const stats = context.getStats()

    // 检查是否需要压缩
    if (stats.totalTokens <= this.config.compactionThreshold) {
      return null
    }

    this.logger.info(`Context exceeded threshold (${stats.totalTokens} > ${this.config.compactionThreshold}), compacting...`)

    try {
      const result = await this.config.compactionEngine.compact(context.getMessages())
      
      if (result.messages.length < context.getMessages().length) {
        // 应用压缩结果
        this.applyCompactionResult(context, result)
        return result
      }
    } catch (error) {
      this.logger.error('Compaction failed', { error })
    }

    return null
  }

  private applyCompactionResult(context: ConversationContextV2, result: CompactionResult): void {
    context.replaceMessages(result.messages)
    this.logger.info('Compaction result applied', {
      originalCount: result.originalMessages,
      compressedCount: result.messages.length,
      strategy: result.strategy,
      tokensSaved: result.tokensSaved
    })
  }

  // ========================================================================
  // LLM 调用
  // ========================================================================

  private async callLLM(
    messages: LLMMessage[],
    tools: LLMToolDefinition[],
    model?: string
  ): Promise<LLMCompletionResult> {
    return this.config.llmService.complete(messages, {
      model,
      tools: tools.length > 0 ? tools : undefined,
      toolChoice: tools.length > 0 ? 'auto' : undefined
    })
  }

  // ========================================================================
  // 工具执行
  // ========================================================================

  private async executeToolCalls(
    toolCalls: NonNullable<LLMCompletionResult['toolCalls']>,
    iteration: number
  ): Promise<Array<{
    id: string
    name: string
    input: any
    output: any
    error?: string
  }>> {
    const results = []

    for (const toolCall of toolCalls) {
      const { id, function: func } = toolCall
      const toolName = func.name
      let toolInput: any

      try {
        toolInput = JSON.parse(func.arguments)
      } catch {
        toolInput = { raw: func.arguments }
      }

      this.logger.info(`Executing tool: ${toolName}`, { input: toolInput })
      this.emit('tool_call', { name: toolName, input: toolInput, iteration })
      this.config.onProgress({
        type: 'tool_call',
        toolName,
        toolInput,
        iteration
      })

      try {
        const result = await this.executeTool(toolName, toolInput, iteration)

        this.logger.info(`Tool ${toolName} completed`)
        this.emit('tool_result', { name: toolName, output: result.data, iteration })
        this.config.onProgress({
          type: 'tool_result',
          toolName,
          toolOutput: result.data,
          iteration
        })

        results.push({ id, name: toolName, input: toolInput, output: result.data })

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        this.logger.error(`Tool ${toolName} failed`, { error: errorMessage })

        this.config.onProgress({
          type: 'error',
          toolName,
          error: errorMessage,
          iteration
        })

        results.push({ id, name: toolName, input: toolInput, output: null, error: errorMessage })
      }
    }

    return results
  }

  private async executeTool(
    toolName: string,
    input: any,
    iteration: number
  ): Promise<ToolResult<any>> {
    const tool = this.config.toolRegistry.get(toolName)
    
    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`)
    }

    // 创建权限检查函数
    const canUseTool: CanUseToolFn = async (name, toolInput) => {
      if (this.config.permissionManager) {
        const isDestructive = tool.isDestructive?.(toolInput) ?? false
        const isReadOnly = tool.isReadOnly(toolInput)
        return this.config.permissionManager.checkPermission(name, toolInput, {
          agentId: `query-loop-${iteration}`,
          workspacePath: process.cwd(),
          isDestructive,
          isReadOnly
        })
      }
      return { behavior: 'allow' }
    }

    // 创建工具上下文
    const toolContext: ToolUseContext = {
      agentId: `query-loop-${iteration}`,
      workspacePath: process.cwd(),
      sendLog: (message: string, isError = false) => {
        this.emit('log', { message, isError, tool: toolName })
      },
      abortController: this.abortController || new AbortController(),
      getAppState: () => ({}),
      setAppState: () => {},
      messages: [],
      checkPermission: canUseTool,
      llm: {
        complete: async (messages: any, options: any) => {
          const result = await this.config.llmService.complete(messages, options)
          return {
            content: result.content,
            toolCalls: result.toolCalls,
            usage: result.usage
          }
        },
        stream: async function* (this: any, messages: any, options: any) {
          for await (const chunk of this.config.llmService.stream(messages, options)) {
            yield chunk
          }
        }.bind(this)
      } as any
    }

    // 执行工具
    return tool.call(input, toolContext, canUseTool, null, (progress) => {
      this.emit('tool_progress', { tool: toolName, progress })
    })
  }

  // ========================================================================
  // 流式执行
  // ========================================================================

  async *stream(
    userInput: string,
    context: ConversationContextV2,
    options?: {
      systemPrompt?: string
      model?: string
      tools?: LLMToolDefinition[]
    }
  ): AsyncGenerator<QueryProgressData> {
    if (this.state.status === 'running') {
      throw new Error('QueryLoopV2 is already running')
    }

    this.abortController = new AbortController()
    this.state = {
      status: 'running',
      iteration: 0,
      compactionCount: 0,
      tokensSaved: 0,
      startTime: Date.now()
    }

    yield { type: 'start', message: 'Starting query loop', iteration: 0 }

    try {
      // 设置系统提示词
      if (options?.systemPrompt) {
        context.setSystemPrompt(options.systemPrompt)
      }

      // 添加用户输入
      context.addUserMessage(userInput)

      const availableTools = options?.tools || this.getToolDefinitions()
      let accumulatedContent = ''

      // 流式调用 LLM
      const messages = context.toLLMMessages()
      
      for await (const chunk of this.config.llmService.stream(messages, {
        model: options?.model,
        tools: availableTools.length > 0 ? availableTools : undefined
      })) {
        this.state.iteration++

        if (this.abortController.signal.aborted) {
          yield { type: 'stopped', message: 'Query stopped', iteration: this.state.iteration }
          break
        }

        // 处理内容
        if (chunk.content) {
          accumulatedContent += chunk.content
          yield {
            type: 'content',
            content: chunk.content,
            iteration: this.state.iteration
          }
        }

        // 处理工具调用（流式结束后的批量处理）
        if (chunk.toolCalls && chunk.toolCalls.length > 0) {
          for (const toolCall of chunk.toolCalls) {
            yield {
              type: 'tool_call',
              toolName: toolCall.function.name,
              toolInput: JSON.parse(toolCall.function.arguments || '{}'),
              iteration: this.state.iteration
            }
          }
        }
      }

      // 添加助手消息到上下文
      if (accumulatedContent) {
        context.addAssistantMessage(accumulatedContent)
      }

      this.state.status = 'completed'
      this.state.endTime = Date.now()
      
      yield { type: 'complete', iteration: this.state.iteration }

    } catch (error) {
      this.state.status = 'error'
      this.state.error = error instanceof Error ? error.message : 'Unknown error'
      this.state.endTime = Date.now()
      
      yield {
        type: 'error',
        error: this.state.error,
        iteration: this.state.iteration
      }
    } finally {
      this.abortController = null
    }
  }

  // ========================================================================
  // 工具定义获取
  // ========================================================================

  private getToolDefinitions(): LLMToolDefinition[] {
    return this.config.toolRegistry.getToolDefinitions()
  }

  // ========================================================================
  // 控制方法
  // ========================================================================

  stop(): void {
    if (this.abortController) {
      this.abortController.abort()
    }
    this.state.status = 'stopped'
    this.emit('stop', { state: this.state })
    this.config.onProgress({ type: 'stopped', message: 'Query stopped', iteration: this.state.iteration })
  }

  // ========================================================================
  // 状态查询
  // ========================================================================

  getState(): QueryState {
    return { ...this.state }
  }

  isRunning(): boolean {
    return this.state.status === 'running'
  }

  isActive(): boolean {
    return this.state.status === 'running' || this.state.status === 'compacting' || this.state.status === 'tool_executing'
  }
}

// ============================================================================
// 导出
// ============================================================================

export default QueryLoopV2

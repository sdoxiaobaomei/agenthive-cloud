/**
 * Enhanced Query Loop - 优化的查询循环
 * 
 * 参考 Claude Code 设计，主要优化：
 * 1. 使用 ToolOrchestrator 并行执行读取工具
 * 2. 自动分区工具调用（并发安全 vs 非安全）
 * 3. 流式执行支持
 * 4. 更好的错误处理和重试机制
 * 5. 工具调用进度追踪
 */

import { EventEmitter } from 'events'
import { LLMService } from '../services/llm/LLMService.js'
import { LLMMessage, LLMToolDefinition, LLMCompletionResult } from '../services/llm/types.js'
import { ConversationContextV2 } from '../context/ConversationContextV2.js'
import { ToolRegistry, ToolContext, ToolExecutor, ToolCall } from '../tools/ToolEnhanced.js'
import { ToolOrchestrator, ToolExecutionResult } from '../tools/ToolOrchestrator.js'
import { Logger } from '../utils/logger.js'

// ============================================================================
// 类型定义
// ============================================================================

export interface QueryLoopConfig {
  llmService: LLMService
  toolRegistry: ToolRegistry
  maxIterations?: number
  enableStreaming?: boolean
  onProgress?: (data: ProgressData) => void
  /** 协调器配置 */
  orchestratorConfig?: {
    maxConcurrency?: number
    timeout?: number
  }
}

export type ProgressData =
  | { type: 'thinking'; iteration: number; message?: string }
  | { type: 'content'; iteration: number; content: string }
  | { type: 'tool_call'; iteration: number; toolName: string; toolInput: any }
  | { type: 'tool_result'; iteration: number; toolName: string; toolOutput?: any; error?: string }
  | { type: 'tool_batch_start'; iteration: number; batchSize: number; isConcurrent: boolean }
  | { type: 'tool_batch_complete'; iteration: number; batchSize: number; duration: number }
  | { type: 'error'; iteration: number; error: string }
  | { type: 'complete'; iteration: number; totalDuration: number }

export interface QueryResult {
  success: boolean
  content: string
  toolCalls: Array<{
    name: string
    input: any
    output?: any
    error?: string
  }>
  iterations: number
  duration: number
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

// ============================================================================
// 增强版查询循环
// ============================================================================

export class QueryLoopEnhanced extends EventEmitter {
  private config: Required<QueryLoopConfig>
  private logger: Logger
  private isRunning = false
  private orchestrator: ToolOrchestrator
  private startTime: number = 0

  constructor(config: QueryLoopConfig) {
    super()
    this.config = {
      maxIterations: 20,
      enableStreaming: true,
      onProgress: () => {},
      orchestratorConfig: {
        maxConcurrency: 5,
        timeout: 120000
      },
      ...config
    }
    this.logger = new Logger('QueryLoopEnhanced')
    
    // 创建工具协调器
    this.orchestrator = new ToolOrchestrator(
      config.toolRegistry,
      {
        maxConcurrency: this.config.orchestratorConfig.maxConcurrency,
        timeout: this.config.orchestratorConfig.timeout,
        preserveOrder: true
      }
    )
    
    // 监听协调器事件
    this.orchestrator.on('cancelled', () => {
      this.emit('cancelled')
    })
  }

  /**
   * 执行单次查询循环（带并行工具执行）
   */
  async execute(
    userInput: string,
    context: ConversationContextV2,
    options?: {
      systemPrompt?: string
      model?: string
      tools?: LLMToolDefinition[]
    }
  ): Promise<QueryResult> {
    if (this.isRunning) {
      throw new Error('QueryLoop is already running')
    }

    this.isRunning = true
    this.startTime = Date.now()
    this.emit('start', { userInput })

    try {
      // 添加系统提示词
      if (options?.systemPrompt) {
        context.setSystemPrompt(options.systemPrompt)
      }

      // 添加用户输入
      context.addUserMessage(userInput)

      // 获取可用工具
      const availableTools = options?.tools || this.getToolDefinitions()

      let iterations = 0
      const toolCalls: QueryResult['toolCalls'] = []
      let finalContent = ''
      let finalUsage: QueryResult['usage']

      // 对话循环
      while (iterations < this.config.maxIterations) {
        iterations++
        this.logger.debug(`Iteration ${iterations}`)
        this.config.onProgress({ type: 'thinking', iteration: iterations })

        // 调用 LLM
        const messages = context.toLLMMessages()
        const response = await this.config.llmService.complete(messages, {
          model: options?.model,
          tools: availableTools.length > 0 ? availableTools : undefined,
          toolChoice: availableTools.length > 0 ? 'auto' : undefined
        })

        finalUsage = response.usage

        // 处理助手回复
        if (response.content) {
          finalContent += response.content
          context.addAssistantMessage(response.content, response.toolCalls)
          this.emit('content', { content: response.content, iteration: iterations })
          this.config.onProgress({
            type: 'content',
            content: response.content,
            iteration: iterations
          })
        }

        // 处理工具调用
        if (response.toolCalls && response.toolCalls.length > 0) {
          const batchStartTime = Date.now()
          
          // 转换工具调用格式
          const toolCallsData: ToolCall[] = response.toolCalls.map(tc => ({
            id: tc.id,
            name: tc.function.name,
            input: this.parseToolInput(tc.function.arguments)
          }))

          // 报告批次开始
          const isConcurrent = this.areAllConcurrentSafe(toolCallsData)
          this.config.onProgress({
            type: 'tool_batch_start',
            iteration: iterations,
            batchSize: toolCallsData.length,
            isConcurrent
          })

          this.logger.info(`Executing ${toolCallsData.length} tool calls`, {
            tools: toolCallsData.map(t => t.name),
            isConcurrent
          })

          // 使用协调器执行工具调用（自动分区并行执行）
          const results = await this.executeToolCallsWithOrchestrator(
            toolCallsData,
            iterations
          )

          // 报告批次完成
          this.config.onProgress({
            type: 'tool_batch_complete',
            iteration: iterations,
            batchSize: toolCallsData.length,
            duration: Date.now() - batchStartTime
          })

          // 收集工具调用记录
          for (const result of results) {
            toolCalls.push({
              name: result.name,
              input: result.input,
              output: result.output,
              error: result.error
            })
          }

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

      const totalDuration = Date.now() - this.startTime
      
      const result: QueryResult = {
        success: true,
        content: finalContent,
        toolCalls,
        iterations,
        duration: totalDuration,
        usage: finalUsage
      }

      this.config.onProgress({ type: 'complete', iteration: iterations, totalDuration })
      this.emit('complete', result)
      return result

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.logger.error('Query loop failed', { error: errorMessage })
      this.emit('error', { error: errorMessage })

      this.config.onProgress({
        type: 'error',
        error: errorMessage,
        iteration: 0
      })

      return {
        success: false,
        content: '',
        toolCalls: [],
        iterations: 0,
        duration: Date.now() - this.startTime
      }
    } finally {
      this.isRunning = false
    }
  }

  /**
   * 使用协调器执行工具调用
   */
  private async executeToolCallsWithOrchestrator(
    calls: ToolCall[],
    iteration: number
  ): Promise<ToolExecutionResult[]> {
    // 创建工具上下文
    const toolContext: ToolContext = {
      agentId: 'query-loop',
      workspacePath: process.cwd(),
      sendLog: (message: string, isError = false) => {
        this.emit('log', { message, isError })
      },
      signal: undefined,
      checkPermission: async () => ({ type: 'allow' as const }),
      llm: {
        complete: async (prompt: string) => {
          const result = await this.config.llmService.complete([
            { role: 'user', content: prompt }
          ])
          return result.content
        },
        chat: async (messages: LLMMessage[]) => {
          const result = await this.config.llmService.complete(messages)
          return result.content
        }
      }
    }

    // 执行并报告进度
    const results: ToolExecutionResult[] = []

    for await (const item of this.orchestrator.executeToolCallsStream(calls, toolContext)) {
      if ('type' in item && (item.type === 'started' || item.type === 'running')) {
        // 进度更新
        this.config.onProgress({
          type: 'tool_call',
          iteration,
          toolName: item.toolName,
          toolInput: calls.find(c => c.id === item.callId)?.input
        })
      } else if ('status' in item) {
        // 结果
        results.push(item)
        this.config.onProgress({
          type: 'tool_result',
          iteration,
          toolName: item.name,
          toolOutput: item.output,
          error: item.error
        })
      }
    }

    return results
  }

  /**
   * 流式执行
   */
  async *stream(
    userInput: string,
    context: ConversationContextV2,
    options?: {
      systemPrompt?: string
      model?: string
      tools?: LLMToolDefinition[]
    }
  ): AsyncGenerator<ProgressData> {
    if (this.isRunning) {
      throw new Error('QueryLoop is already running')
    }

    this.isRunning = true
    let iteration = 0

    try {
      // 添加系统提示词
      if (options?.systemPrompt) {
        context.setSystemPrompt(options.systemPrompt)
      }

      // 添加用户输入
      context.addUserMessage(userInput)

      // 获取可用工具
      const availableTools = options?.tools || this.getToolDefinitions()

      // 调用 LLM
      const messages = context.toLLMMessages()
      let accumulatedContent = ''

      for await (const chunk of this.config.llmService.stream(messages, {
        model: options?.model,
        tools: availableTools.length > 0 ? availableTools : undefined
      })) {
        iteration++

        if (chunk.content) {
          accumulatedContent += chunk.content
          yield { type: 'content', content: chunk.content, iteration }
        }

        if (chunk.toolCalls && chunk.toolCalls.length > 0) {
          // 处理流中的工具调用
          const toolCallsData: ToolCall[] = chunk.toolCalls.map(tc => ({
            id: tc.id,
            name: tc.function.name,
            input: this.parseToolInput(tc.function.arguments)
          }))

          yield {
            type: 'tool_batch_start',
            iteration,
            batchSize: toolCallsData.length,
            isConcurrent: this.areAllConcurrentSafe(toolCallsData)
          }

          // 执行工具调用
          const toolContext: ToolContext = {
            agentId: 'query-loop-stream',
            workspacePath: process.cwd(),
            sendLog: () => {},
            checkPermission: async () => ({ type: 'allow' as const })
          }

          const results = await this.orchestrator.executeToolCalls(toolCallsData, toolContext)

          for (const result of results) {
            yield {
              type: 'tool_result',
              iteration,
              toolName: result.name,
              toolOutput: result.output,
              error: result.error
            }
          }

          yield {
            type: 'tool_batch_complete',
            iteration,
            batchSize: toolCallsData.length,
            duration: 0
          }
        }

        if (chunk.done) {
          break
        }
      }

    } finally {
      this.isRunning = false
    }
  }

  /**
   * 停止执行
   */
  stop(): void {
    this.isRunning = false
    this.orchestrator.cancel()
    this.emit('stop')
  }

  /**
   * 检查是否正在运行
   */
  isActive(): boolean {
    return this.isRunning
  }

  /**
   * 检查是否所有工具调用都可并发执行
   */
  private areAllConcurrentSafe(calls: ToolCall[]): boolean {
    return calls.every(call => {
      const tool = this.config.toolRegistry.get(call.name)
      if (!tool) return false
      const parsedInput = tool.inputSchema.safeParse(call.input)
      return parsedInput.success && tool.isConcurrencySafe(parsedInput.data)
    })
  }

  /**
   * 解析工具输入
   */
  private parseToolInput(args: string): any {
    try {
      return JSON.parse(args)
    } catch {
      return { raw: args }
    }
  }

  /**
   * 获取工具定义
   */
  private getToolDefinitions(): LLMToolDefinition[] {
    return this.config.toolRegistry.getToolDefinitions()
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

export function createQueryLoop(config: QueryLoopConfig): QueryLoopEnhanced {
  return new QueryLoopEnhanced(config)
}

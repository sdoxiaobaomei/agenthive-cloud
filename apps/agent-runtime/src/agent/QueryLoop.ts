// Query Loop - 核心对话循环，参考 Claude Code 的设计
import { EventEmitter } from 'events'
import { LLMService } from '../services/llm/LLMService.js'
import { LLMMessage, LLMToolDefinition, LLMCompletionResult } from '../services/llm/types.js'
import { ConversationContextV2 } from '../context/ConversationContextV2.js'
import { ToolExecutor, ToolRegistry } from '../tools/Tool.js'
import { Logger } from '../utils/logger.js'

export interface QueryLoopConfig {
  llmService: LLMService
  toolRegistry: ToolRegistry
  toolExecutor: ToolExecutor
  maxIterations?: number
  enableStreaming?: boolean
  onProgress?: (data: ProgressData) => void
}

export interface ProgressData {
  type: 'thinking' | 'tool_call' | 'tool_result' | 'content' | 'error'
  message?: string
  toolName?: string
  toolInput?: any
  toolOutput?: any
  content?: string
  error?: string
  iteration: number
}

export interface QueryResult {
  success: boolean
  content: string
  toolCalls: Array<{
    name: string
    input: any
    output: any
  }>
  iterations: number
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

interface PendingToolCall {
  id: string
  name: string
  arguments: string
}

export class QueryLoop extends EventEmitter {
  private config: QueryLoopConfig
  private logger: Logger
  private isRunning = false

  constructor(config: QueryLoopConfig) {
    super()
    this.config = {
      maxIterations: 20,
      enableStreaming: true,
      ...config
    }
    this.logger = new Logger('QueryLoop')
  }

  // 执行单次查询循环
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
    this.emit('start', { userInput })
    
    let iterations = 0

    try {
      // 添加系统提示词
      if (options?.systemPrompt) {
        context.setSystemPrompt(options.systemPrompt)
      }

      // 添加用户输入
      context.addUserMessage(userInput)

      // 获取可用工具
      const availableTools = options?.tools || this.getToolDefinitions()

      const toolCalls: QueryResult['toolCalls'] = []
      let finalContent = ''
      let finalUsage: QueryResult['usage']

      // 对话循环
      while (iterations < (this.config.maxIterations || 20)) {
        iterations++
        this.logger.debug(`Iteration ${iterations}`)

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
          this.config.onProgress?.({
            type: 'content',
            content: response.content,
            iteration: iterations
          })
        }

        // 处理工具调用
        if (response.toolCalls && response.toolCalls.length > 0) {
          const toolResults = await this.executeToolCalls(response.toolCalls, iterations)
          toolCalls.push(...toolResults.map(r => ({
            name: r.name,
            input: r.input,
            output: r.output
          })))

          // 添加工具结果到上下文
          context.addToolResults(toolResults.map(r => ({
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

      const result: QueryResult = {
        success: true,
        content: finalContent,
        toolCalls,
        iterations,
        usage: finalUsage
      }

      this.emit('complete', result)
      return result

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.logger.error('Query loop failed', { error: errorMessage })
      this.emit('error', { error: errorMessage })

      this.config.onProgress?.({
        type: 'error',
        error: errorMessage,
        iteration: 0
      })

      return {
        success: false,
        content: '',
        toolCalls: [],
        iterations
      }
    } finally {
      this.isRunning = false
    }
  }

  // 执行工具调用
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
      this.config.onProgress?.({
        type: 'tool_call',
        toolName,
        toolInput,
        iteration
      })

      try {
        // 创建工具上下文
        const toolContext = {
          agentId: 'query-loop',
          workspacePath: process.cwd(),
          sendLog: (message: string, isError = false) => {
            this.emit('log', { message, isError, tool: toolName })
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

        const output = await this.config.toolExecutor.execute(toolName, toolInput, toolContext)

        this.logger.info(`Tool ${toolName} completed`, { output })
        this.emit('tool_result', { name: toolName, output, iteration })
        this.config.onProgress?.({
          type: 'tool_result',
          toolName,
          toolOutput: output,
          iteration
        })

        results.push({ id, name: toolName, input: toolInput, output })

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        this.logger.error(`Tool ${toolName} failed`, { error: errorMessage })

        this.config.onProgress?.({
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

  // 获取工具定义
  private getToolDefinitions(): LLMToolDefinition[] {
    const descriptions = this.config.toolRegistry.getToolDescriptions()

    return descriptions.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema
      }
    }))
  }

  // 流式执行
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
      let pendingToolCalls: typeof availableTools = []

      for await (const chunk of this.config.llmService.stream(messages, {
        model: options?.model,
        tools: availableTools.length > 0 ? availableTools : undefined
      })) {
        iteration++

        if (chunk.content) {
          accumulatedContent += chunk.content
          yield {
            type: 'content',
            content: chunk.content,
            iteration
          }
        }

        if (chunk.toolCalls) {
          pendingToolCalls = chunk.toolCalls
        }

        if (chunk.done) {
          // 流结束，添加助手消息到上下文
          if (accumulatedContent || pendingToolCalls.length > 0) {
            context.addAssistantMessage(accumulatedContent, pendingToolCalls)
          }

          // 处理工具调用
          if (pendingToolCalls.length > 0) {
            for (const toolCall of pendingToolCalls) {
              yield {
                type: 'tool_call',
                toolName: toolCall.function.name,
                toolInput: JSON.parse(toolCall.function.arguments || '{}'),
                iteration
              }
            }
          }

          break
        }
      }

    } finally {
      this.isRunning = false
    }
  }

  // 停止执行
  stop(): void {
    this.isRunning = false
    this.emit('stop')
  }

  // 检查是否正在运行
  isActive(): boolean {
    return this.isRunning
  }
}

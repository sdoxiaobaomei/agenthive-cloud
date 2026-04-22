// Task Executor V3 - 基于 QueryLoop 和 LLM 服务的完整 AI 任务执行器
import { EventEmitter } from 'events'
import { trace, SpanStatusCode } from '@opentelemetry/api'
import { AI_ATTRIBUTES, AI_SPAN_NAMES } from '@agenthive/observability'
import type { Task, ExecutionContext, ExecutionResult } from '../types/index.js'
import { Logger } from '../utils/logger.js'
import { ToolExecutor, ToolRegistry, ToolContext } from '../tools/Tool.js'
import { globalToolRegistry } from '../tools/index.js'
import { PermissionManager } from '../permissions/PermissionManager.js'
import { ConversationContextV2 } from '../context/ConversationContextV2.js'
import { createQueryLoop, type IQueryLoop } from '../agent/QueryLoopFactory.js'
import { LLMService, initializeLLMService } from './llm/LLMService.js'
import { SubAgentManager, registerBuiltInAgents } from '../agent/SubAgent.js'
import { initializeSkillSystem } from '../skills/SkillSystem.js'

export interface TaskExecutorV3Config {
  llmService?: LLMService
  llmConfig?: {
    provider: 'anthropic' | 'openai'
    apiKey: string
    model: string
    baseUrl?: string
  }
  toolRegistry?: ToolRegistry
  enableStreaming?: boolean
}

export class TaskExecutorManagerV3 extends EventEmitter {
  private currentExecution: AbortController | null = null
  private logger = new Logger('TaskExecutorV3')
  private toolRegistry: ToolRegistry
  private toolExecutor: ToolExecutor
  private permissionManager: PermissionManager
  private llmService: LLMService
  private queryLoop: IQueryLoop
  private subAgentManager: SubAgentManager
  private skillSystem: ReturnType<typeof initializeSkillSystem>
  private config: TaskExecutorV3Config

  constructor(config: TaskExecutorV3Config = {}) {
    super()
    this.config = config
    this.toolRegistry = config.toolRegistry || globalToolRegistry
    this.toolExecutor = new ToolExecutor(this.toolRegistry)
    this.permissionManager = new PermissionManager()

    // 初始化 LLM 服务
    if (config.llmService) {
      this.llmService = config.llmService
    } else if (config.llmConfig) {
      this.llmService = initializeLLMService({
        defaultProvider: {
          provider: config.llmConfig.provider,
          apiKey: config.llmConfig.apiKey,
          model: config.llmConfig.model,
          baseUrl: config.llmConfig.baseUrl
        },
        enableCache: true
      })
    } else {
      throw new Error('Either llmService or llmConfig must be provided')
    }

    // 初始化 QueryLoop
    this.queryLoop = createQueryLoop({
      llmService: this.llmService,
      toolRegistry: this.toolRegistry,
      toolExecutor: this.toolExecutor,
      maxIterations: 20,
      enableStreaming: config.enableStreaming ?? true,
      permissionManager: this.permissionManager,
      onProgress: (data) => {
        this.emit('query_progress', data)
      }
    })

    // 初始化 SubAgentManager
    this.subAgentManager = new SubAgentManager({
      llmService: this.llmService,
      toolRegistry: this.toolRegistry,
      toolExecutor: this.toolExecutor,
      maxIterations: 15
    })

    // 注册内置代理
    registerBuiltInAgents(this.subAgentManager)

    // 初始化技能系统
    this.skillSystem = initializeSkillSystem()

    this.logger.info(`TaskExecutorV3 initialized with ${this.toolRegistry.list().length} tools`)
  }

  // 执行任务
  async execute(task: Task, context: ExecutionContext): Promise<ExecutionResult> {
    const tracer = trace.getTracer('agenthive-task-executor')
    const span = tracer.startSpan(AI_SPAN_NAMES.TASK_EXECUTE, {
      attributes: {
        [AI_ATTRIBUTES.TASK_ID]: task.id,
        [AI_ATTRIBUTES.TASK_TYPE]: task.type,
        [AI_ATTRIBUTES.AGENT_ID]: context.agentId,
      },
    })

    this.logger.info(`Executing task with AI`, { taskId: task.id, type: task.type })

    this.currentExecution = new AbortController()
    const signal = this.currentExecution.signal

    const conversationContext = new ConversationContextV2({
      maxTokens: 12000,
      compressionThreshold: 10000
    })

    const toolContext: ToolContext = {
      agentId: context.agentId,
      workspacePath: context.workspacePath,
      sendLog: (message: string, isError = false) => {
        if (signal.aborted) return
        context.sendLog(message, isError)
        this.emit('log', { taskId: task.id, message, isError })
      },
      signal,
      checkPermission: async (toolName, input) => {
        return this.permissionManager.checkPermission(toolName, input)
      }
    }

    try {
      const result = await this.executeWithAI(task, toolContext, conversationContext)
      span.setAttributes({
        [AI_ATTRIBUTES.TASK_STATUS]: result.success ? 'completed' : 'failed',
        'task.iterations': result.output?.iterations ?? 0,
        'task.duration_ms': result.output?.duration ?? 0,
      })
      span.setStatus({ code: SpanStatusCode.OK })
      return result
    } catch (error) {
      if (signal.aborted) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: 'Task was cancelled' })
        span.end()
        return { success: false, error: 'Task was cancelled', logs: [] }
      }
      const message = error instanceof Error ? error.message : 'Unknown error'
      span.recordException(error as Error)
      span.setStatus({ code: SpanStatusCode.ERROR, message })
      return { success: false, error: message, logs: [] }
    } finally {
      span.end()
      this.currentExecution = null
    }
  }

  // 使用 AI 执行任务
  private async executeWithAI(
    task: Task,
    toolContext: ToolContext,
    conversationContext: ConversationContextV2
  ): Promise<ExecutionResult> {
    const tracer = trace.getTracer('agenthive-task-executor')
    const span = tracer.startSpan(AI_SPAN_NAMES.QUERY_LOOP_EXECUTE, {
      attributes: {
        [AI_ATTRIBUTES.TASK_ID]: task.id,
        [AI_ATTRIBUTES.TASK_TYPE]: task.type,
      },
    })

    const systemPrompt = this.buildSystemPrompt(task)
    const userInput = this.buildUserInput(task)

    toolContext.sendLog('Starting AI-powered execution...')

    try {
      const startTime = Date.now()
      const result = await this.queryLoop.execute(userInput, conversationContext, {
        systemPrompt,
        model: this.config.llmConfig?.model
      })
      const duration = Date.now() - startTime

      const output: Record<string, any> = {
        content: result.content,
        toolCalls: result.toolCalls.length,
        iterations: result.iterations,
        duration,
        usage: result.usage
      }

      span.setAttributes({
        [AI_ATTRIBUTES.QUERY_LOOP_TOTAL_ITERATIONS]: result.iterations,
        [AI_ATTRIBUTES.LLM_TOKENS_TOTAL]: result.usage?.totalTokens ?? 0,
        [AI_ATTRIBUTES.LLM_TOKENS_INPUT]: result.usage?.promptTokens ?? 0,
        [AI_ATTRIBUTES.LLM_TOKENS_OUTPUT]: result.usage?.completionTokens ?? 0,
      })
      span.setStatus({ code: SpanStatusCode.OK })
      toolContext.sendLog(`Execution completed in ${duration}ms`)

      return { success: result.success, output, logs: [] }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      span.recordException(error as Error)
      span.setStatus({ code: SpanStatusCode.ERROR, message })
      return { success: false, error: message, logs: [] }
    } finally {
      span.end()
    }
  }

  // 构建系统提示词
  private buildSystemPrompt(task: Task): string {
    return `You are an AI assistant helping with software development tasks.
Available tools: ${this.toolRegistry.list().join(', ')}
Think step by step and use tools when needed.`
  }

  // 构建用户输入
  private buildUserInput(task: Task): string {
    return `Task: ${task.title}
Description: ${task.description || 'No description'}
Type: ${task.type}
Input: ${JSON.stringify(task.input, null, 2)}`
  }

  // 取消当前执行
  async cancel(): Promise<void> {
    if (this.currentExecution) {
      this.currentExecution.abort()
      this.currentExecution = null
      this.logger.info('Task execution cancelled')
    }
  }

  // 获取可用工具列表
  getAvailableTools(): string[] {
    return this.toolRegistry.list()
  }

  // 获取权限管理器
  getPermissionManager(): PermissionManager {
    return this.permissionManager
  }

  // 获取 LLM 服务
  getLLMService(): LLMService {
    return this.llmService
  }

  // 获取子代理管理器
  getSubAgentManager(): SubAgentManager {
    return this.subAgentManager
  }

  // 获取技能系统
  getSkillSystem(): ReturnType<typeof initializeSkillSystem> {
    return this.skillSystem
  }
}

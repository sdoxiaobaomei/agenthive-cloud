// SubAgent System - 子代理系统，参考 Claude Code 的 AgentTool
import { EventEmitter } from 'events'
import { QueryLoop, QueryLoopConfig, QueryResult } from './QueryLoop.js'
import { ConversationContextV2 } from '../context/ConversationContextV2.js'
import { Logger } from '../utils/logger.js'

export interface AgentDefinition {
  agentType: string
  name: string
  description: string
  systemPrompt: string
  tools: string[]
  maxTurns?: number
  model?: string
  temperature?: number
}

export interface SubAgentConfig {
  agentDefinition: AgentDefinition
  queryLoopConfig: QueryLoopConfig
  isAsync?: boolean
  forkContext?: boolean
  parentContext?: ConversationContextV2
}

export interface SubAgentResult {
  success: boolean
  agentType: string
  content: string
  toolCalls: Array<{
    name: string
    input: any
    output: any
  }>
  iterations: number
  duration: number
}

export class SubAgent extends EventEmitter {
  private config: SubAgentConfig
  private queryLoop: QueryLoop
  private context: ConversationContextV2
  private logger: Logger
  private startTime: number = 0

  constructor(config: SubAgentConfig) {
    super()
    this.config = config
    this.logger = new Logger(`SubAgent:${config.agentDefinition.agentType}`)

    // 创建独立的上下文或 Fork 父上下文
    if (config.forkContext && config.parentContext) {
      this.context = this.forkContext(config.parentContext)
    } else {
      this.context = new ConversationContextV2()
    }

    // 创建 QueryLoop
    this.queryLoop = new QueryLoop({
      ...config.queryLoopConfig,
      onProgress: (data) => {
        this.emit('progress', data)
        config.queryLoopConfig.onProgress?.(data)
      }
    })

    // 转发事件
    this.queryLoop.on('content', (data) => this.emit('content', data))
    this.queryLoop.on('tool_call', (data) => this.emit('tool_call', data))
    this.queryLoop.on('tool_result', (data) => this.emit('tool_result', data))
    this.queryLoop.on('error', (data) => this.emit('error', data))
  }

  // 执行子代理任务
  async execute(directive: string, context?: Record<string, any>): Promise<SubAgentResult> {
    this.startTime = Date.now()
    this.logger.info(`Starting sub-agent: ${this.config.agentDefinition.name}`, { directive })

    this.emit('start', {
      agentType: this.config.agentDefinition.agentType,
      directive
    })

    try {
      // 构建完整的用户输入
      let userInput = directive
      if (context && Object.keys(context).length > 0) {
        userInput += `\n\nContext: ${JSON.stringify(context, null, 2)}`
      }

      // 过滤可用工具
      const filteredTools = this.getFilteredTools()

      // 执行查询循环
      const result = await this.queryLoop.execute(userInput, this.context, {
        systemPrompt: this.config.agentDefinition.systemPrompt,
        model: this.config.agentDefinition.model,
        tools: filteredTools
      })

      const duration = Date.now() - this.startTime

      const subAgentResult: SubAgentResult = {
        success: result.success,
        agentType: this.config.agentDefinition.agentType,
        content: result.content,
        toolCalls: result.toolCalls,
        iterations: result.iterations,
        duration
      }

      this.logger.info(`Sub-agent completed in ${duration}ms`, {
        success: result.success,
        iterations: result.iterations
      })

      this.emit('complete', subAgentResult)
      return subAgentResult

    } catch (error) {
      const duration = Date.now() - this.startTime
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      this.logger.error('Sub-agent failed', { error: errorMessage })
      this.emit('error', { error: errorMessage, duration })

      return {
        success: false,
        agentType: this.config.agentDefinition.agentType,
        content: '',
        toolCalls: [],
        iterations: 0,
        duration
      }
    }
  }

  // Fork 上下文（继承父上下文的关键信息）
  private forkContext(parentContext: ConversationContextV2): ConversationContextV2 {
    const forked = new ConversationContextV2()
    const parentMessages = parentContext.getMessages()

    // 保留系统消息
    const systemMessages = parentMessages.filter(m => m.role === 'system')
    if (systemMessages.length > 0) {
      forked.setSystemPrompt(systemMessages[0].content)
    }

    // 保留最近的消息摘要
    const recentMessages = parentMessages.slice(-3)
    if (recentMessages.length > 0) {
      const summary = `[Forked from parent context: ${recentMessages.length} recent messages preserved]`
      forked.addSystemMessage(summary)
    }

    return forked
  }

  // 获取过滤后的工具定义
  private getFilteredTools() {
    const { tools } = this.config.agentDefinition
    const allTools = this.config.queryLoopConfig.toolRegistry.getToolDescriptions()

    return allTools
      .filter(tool => tools.includes(tool.name))
      .map(tool => ({
        type: 'function' as const,
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.inputSchema
        }
      }))
  }

  // 流式执行
  async *stream(directive: string, context?: Record<string, any>): AsyncGenerator<{
    type: 'content' | 'tool_call' | 'tool_result' | 'complete' | 'error'
    content?: string
    toolName?: string
    toolInput?: any
    toolOutput?: any
    result?: SubAgentResult
    error?: string
  }> {
    this.startTime = Date.now()

    try {
      // 构建完整的用户输入
      let userInput = directive
      if (context && Object.keys(context).length > 0) {
        userInput += `\n\nContext: ${JSON.stringify(context, null, 2)}`
      }

      // 过滤可用工具
      const filteredTools = this.getFilteredTools()

      // 流式执行
      const generator = this.queryLoop.stream(userInput, this.context, {
        systemPrompt: this.config.agentDefinition.systemPrompt,
        model: this.config.agentDefinition.model,
        tools: filteredTools
      })

      let content = ''
      let toolCalls: SubAgentResult['toolCalls'] = []
      let iterations = 0

      for await (const chunk of generator) {
        iterations = Math.max(iterations, chunk.iteration)

        if (chunk.type === 'content' && chunk.content) {
          content += chunk.content
          yield { type: 'content', content: chunk.content }
        }

        if (chunk.type === 'tool_call') {
          yield {
            type: 'tool_call',
            toolName: chunk.toolName,
            toolInput: chunk.toolInput
          }
        }

        if (chunk.type === 'tool_result') {
          toolCalls.push({
            name: chunk.toolName!,
            input: chunk.toolInput,
            output: chunk.toolOutput
          })
          yield {
            type: 'tool_result',
            toolName: chunk.toolName,
            toolOutput: chunk.toolOutput
          }
        }
      }

      const duration = Date.now() - this.startTime
      const result: SubAgentResult = {
        success: true,
        agentType: this.config.agentDefinition.agentType,
        content,
        toolCalls,
        iterations,
        duration
      }

      yield { type: 'complete', result }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      yield { type: 'error', error: errorMessage }
    }
  }

  // 停止执行
  stop(): void {
    this.queryLoop.stop()
    this.emit('stop')
  }

  // 获取上下文
  getContext(): ConversationContextV2 {
    return this.context
  }
}

// 子代理管理器
export class SubAgentManager extends EventEmitter {
  private agents: Map<string, AgentDefinition> = new Map()
  private activeAgents: Map<string, SubAgent> = new Map()
  private queryLoopConfig: QueryLoopConfig
  private logger: Logger

  constructor(queryLoopConfig: QueryLoopConfig) {
    super()
    this.queryLoopConfig = queryLoopConfig
    this.logger = new Logger('SubAgentManager')
  }

  // 注册代理定义
  registerAgent(definition: AgentDefinition): void {
    this.agents.set(definition.agentType, definition)
    this.logger.info(`Registered agent: ${definition.agentType}`)
  }

  // 获取代理定义
  getAgent(agentType: string): AgentDefinition | undefined {
    return this.agents.get(agentType)
  }

  // 列出所有代理
  listAgents(): AgentDefinition[] {
    return Array.from(this.agents.values())
  }

  // 创建并执行子代理
  async execute(
    agentType: string,
    directive: string,
    options?: {
      context?: Record<string, any>
      forkContext?: boolean
      parentContext?: ConversationContextV2
      isAsync?: boolean
    }
  ): Promise<SubAgentResult> {
    const definition = this.agents.get(agentType)
    if (!definition) {
      throw new Error(`Agent type not found: ${agentType}`)
    }

    const agent = new SubAgent({
      agentDefinition: definition,
      queryLoopConfig: this.queryLoopConfig,
      isAsync: options?.isAsync,
      forkContext: options?.forkContext,
      parentContext: options?.parentContext
    })

    const agentId = `${agentType}-${Date.now()}`
    this.activeAgents.set(agentId, agent)

    // 清理完成的代理
    agent.on('complete', () => {
      this.activeAgents.delete(agentId)
    })

    agent.on('error', () => {
      this.activeAgents.delete(agentId)
    })

    return agent.execute(directive, options?.context)
  }

  // 并行执行多个子代理
  async executeParallel(
    tasks: Array<{
      agentType: string
      directive: string
      context?: Record<string, any>
    }>,
    options?: {
      forkContext?: boolean
      parentContext?: ConversationContextV2
    }
  ): Promise<SubAgentResult[]> {
    this.logger.info(`Executing ${tasks.length} sub-agents in parallel`)

    const promises = tasks.map(task =>
      this.execute(task.agentType, task.directive, {
        context: task.context,
        forkContext: options?.forkContext,
        parentContext: options?.parentContext
      })
    )

    return Promise.all(promises)
  }

  // 停止所有活跃的代理
  stopAll(): void {
    for (const agent of this.activeAgents.values()) {
      agent.stop()
    }
    this.activeAgents.clear()
  }

  // 获取活跃代理数量
  getActiveCount(): number {
    return this.activeAgents.size
  }
}

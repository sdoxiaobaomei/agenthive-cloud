// Enhanced SubAgent System - 优化版子代理系统
// 新增特性：
// - 支持模型覆盖
// - 支持上下文 Fork（继承/隔离）
// - 支持工作目录切换
// - 支持最大迭代次数覆盖
// - 支持温度参数
// - 更完善的进度追踪
// - Agent 生命周期钩子

import { EventEmitter } from 'events'
import { QueryLoop, QueryLoopConfig, QueryResult } from './QueryLoopEnhanced.js'
import { ConversationContextV2 } from '../context/ConversationContextV2.js'
import { Logger } from '../utils/logger.js'
import { LLMToolDefinition } from '../services/llm/types.js'

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
  // 新增选项
  model?: string           // 覆盖模型
  maxIterations?: number   // 覆盖最大迭代次数
  temperature?: number     // 覆盖温度
  cwd?: string            // 工作目录
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
  // 新增字段
  modelUsed?: string
  tokenUsage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

export interface SubAgentProgress {
  type: 'start' | 'thinking' | 'tool_call' | 'tool_result' | 'content' | 'complete' | 'error'
  agentType: string
  iteration?: number
  maxIterations?: number
  toolName?: string
  toolInput?: any
  toolOutput?: any
  content?: string
  error?: string
  timestamp: number
}

export class SubAgent extends EventEmitter {
  private config: SubAgentConfig
  private queryLoop: QueryLoop
  private context: ConversationContextV2
  private logger: Logger
  private startTime: number = 0
  private progress: SubAgentProgress[] = []

  constructor(config: SubAgentConfig) {
    super()
    this.config = config
    this.logger = new Logger(`SubAgent:${config.agentDefinition.agentType}`)

    // 创建独立的上下文或 Fork 父上下文
    if (config.forkContext && config.parentContext) {
      this.context = this.forkContext(config.parentContext)
    } else if (config.parentContext) {
      // 继承父上下文但不 Fork（共享历史）
      this.context = this.inheritContext(config.parentContext)
    } else {
      this.context = new ConversationContextV2()
    }

    // 创建 QueryLoop
    this.queryLoop = new QueryLoop({
      ...config.queryLoopConfig,
      onProgress: (data) => {
        const progress: SubAgentProgress = {
          type: data.type as SubAgentProgress['type'],
          agentType: config.agentDefinition.agentType,
          iteration: data.iteration,
          toolName: data.toolName,
          toolInput: data.toolInput,
          toolOutput: data.toolOutput,
          content: data.content,
          error: data.error,
          timestamp: Date.now()
        }
        this.progress.push(progress)
        this.emit('progress', progress)
        config.queryLoopConfig.onProgress?.(data)
      }
    })

    // 转发事件
    this.queryLoop.on('start', (data) => {
      this.emit('start', { ...data, agentType: config.agentDefinition.agentType })
    })
    this.queryLoop.on('content', (data) => {
      this.emit('content', { ...data, agentType: config.agentDefinition.agentType })
    })
    this.queryLoop.on('tool_call', (data) => {
      this.emit('tool_call', { ...data, agentType: config.agentDefinition.agentType })
    })
    this.queryLoop.on('tool_result', (data) => {
      this.emit('tool_result', { ...data, agentType: config.agentDefinition.agentType })
    })
    this.queryLoop.on('complete', (data) => {
      this.emit('complete', { ...data, agentType: config.agentDefinition.agentType })
    })
    this.queryLoop.on('error', (data) => {
      this.emit('error', { ...data, agentType: config.agentDefinition.agentType })
    })
  }

  // 执行子代理任务
  async execute(directive: string, context?: Record<string, any>): Promise<SubAgentResult> {
    this.startTime = Date.now()
    const { agentDefinition } = this.config
    
    this.logger.info(`Starting sub-agent: ${agentDefinition.name}`, { 
      directive: directive.slice(0, 100),
      model: this.config.model || agentDefinition.model,
      forkContext: this.config.forkContext
    })

    this.emit('start', {
      agentType: agentDefinition.agentType,
      directive,
      timestamp: this.startTime
    })

    // 记录进度
    this.progress.push({
      type: 'start',
      agentType: agentDefinition.agentType,
      timestamp: this.startTime
    })

    try {
      // 构建完整的用户输入
      let userInput = directive
      if (context && Object.keys(context).length > 0) {
        userInput += `\n\n<Context>\n${JSON.stringify(context, null, 2)}\n</Context>`
      }

      // 添加工作目录信息
      if (this.config.cwd) {
        userInput += `\n\n<WorkingDirectory>\n${this.config.cwd}\n</WorkingDirectory>`
      }

      // 过滤可用工具
      const filteredTools = this.getFilteredTools()

      // 确定系统提示词
      let systemPrompt = agentDefinition.systemPrompt
      
      // 如果是 Fork 的上下文，添加来源信息
      if (this.config.forkContext && this.config.parentContext) {
        systemPrompt += `\n\n[Note: You are running in an isolated context forked from a parent agent. Focus on your specific task.]`
      }

      // 执行查询循环
      const maxIterations = this.config.maxIterations || agentDefinition.maxTurns || 20
      
      const result = await this.queryLoop.execute(userInput, this.context, {
        systemPrompt,
        model: this.config.model || agentDefinition.model,
        tools: filteredTools,
        maxIterations,
        temperature: this.config.temperature || agentDefinition.temperature
      })

      const duration = Date.now() - this.startTime

      const subAgentResult: SubAgentResult = {
        success: result.success,
        agentType: agentDefinition.agentType,
        content: result.content,
        toolCalls: result.toolCalls,
        iterations: result.iterations,
        duration,
        modelUsed: this.config.model || agentDefinition.model,
        tokenUsage: result.usage
      }

      this.logger.info(`Sub-agent completed in ${duration}ms`, {
        success: result.success,
        iterations: result.iterations,
        tokens: result.usage
      })

      this.progress.push({
        type: 'complete',
        agentType: agentDefinition.agentType,
        iteration: result.iterations,
        timestamp: Date.now()
      })

      this.emit('complete', subAgentResult)
      return subAgentResult

    } catch (error) {
      const duration = Date.now() - this.startTime
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      this.logger.error('Sub-agent failed', { error: errorMessage })
      
      this.progress.push({
        type: 'error',
        agentType: agentDefinition.agentType,
        error: errorMessage,
        timestamp: Date.now()
      })
      
      this.emit('error', { error: errorMessage, duration })

      return {
        success: false,
        agentType: agentDefinition.agentType,
        content: '',
        toolCalls: [],
        iterations: 0,
        duration,
        modelUsed: this.config.model || agentDefinition.model,
        error: errorMessage
      }
    }
  }

  // Fork 上下文（完全隔离）
  private forkContext(parentContext: ConversationContextV2): ConversationContextV2 {
    const forked = new ConversationContextV2()
    const parentMessages = parentContext.getMessages()

    // 保留系统消息
    const systemMessages = parentMessages.filter(m => m.role === 'system')
    if (systemMessages.length > 0) {
      // 使用最新的系统消息
      forked.setSystemPrompt(systemMessages[systemMessages.length - 1].content)
    }

    // 保留最近的消息摘要
    const recentMessages = parentMessages.slice(-3)
    if (recentMessages.length > 0) {
      const summary = this.generateContextSummary(recentMessages)
      forked.addSystemMessage(`[Context Forked from Parent]\n${summary}`)
    }

    this.logger.debug('Context forked', { 
      parentMessages: parentMessages.length,
      keptMessages: systemMessages.length + 1 
    })

    return forked
  }

  // 继承上下文（共享历史）
  private inheritContext(parentContext: ConversationContextV2): ConversationContextV2 {
    const inherited = new ConversationContextV2()
    const messages = parentContext.getMessages()

    // 复制所有消息
    for (const msg of messages) {
      inherited.addMessage(msg)
    }

    this.logger.debug('Context inherited', { messages: messages.length })
    return inherited
  }

  // 生成上下文摘要
  private generateContextSummary(messages: any[]): string {
    const summaries: string[] = []
    
    for (const msg of messages) {
      if (msg.role === 'user') {
        const content = typeof msg.content === 'string' 
          ? msg.content.slice(0, 100) 
          : 'Complex content'
        summaries.push(`User: ${content}...`)
      } else if (msg.role === 'assistant') {
        const content = typeof msg.content === 'string' 
          ? msg.content.slice(0, 100) 
          : 'Complex content'
        summaries.push(`Assistant: ${content}...`)
      } else if (msg.role === 'tool') {
        summaries.push(`Tool result: ${msg.toolResults?.length || 0} results`)
      }
    }

    return summaries.join('\n')
  }

  // 获取过滤后的工具定义
  private getFilteredTools(): LLMToolDefinition[] {
    const { tools, agentDefinition } = this.config
    const allTools = agentDefinition.tools
    
    // 如果 agent 定义指定了工具，过滤
    if (allTools && allTools.length > 0) {
      return tools.toolRegistry.getToolDescriptions()
        .filter(tool => allTools.includes(tool.name))
        .map(tool => ({
          type: 'function' as const,
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.inputSchema
          }
        }))
    }

    // 否则返回所有工具
    return tools.toolRegistry.getToolDescriptions()
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
    type: 'content' | 'tool_call' | 'tool_result' | 'complete' | 'error' | 'progress'
    content?: string
    toolName?: string
    toolInput?: any
    toolOutput?: any
    result?: SubAgentResult
    error?: string
    progress?: SubAgentProgress
  }> {
    this.startTime = Date.now()

    try {
      // 构建完整的用户输入
      let userInput = directive
      if (context && Object.keys(context).length > 0) {
        userInput += `\n\n<Context>\n${JSON.stringify(context, null, 2)}\n</Context>`
      }

      if (this.config.cwd) {
        userInput += `\n\n<WorkingDirectory>\n${this.config.cwd}\n</WorkingDirectory>`
      }

      // 过滤可用工具
      const filteredTools = this.getFilteredTools()
      const maxIterations = this.config.maxIterations || this.config.agentDefinition.maxTurns || 20

      // 流式执行
      const generator = this.queryLoop.stream(userInput, this.context, {
        systemPrompt: this.config.agentDefinition.systemPrompt,
        model: this.config.model || this.config.agentDefinition.model,
        tools: filteredTools,
        maxIterations,
        temperature: this.config.temperature || this.config.agentDefinition.temperature
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

        if (chunk.type === 'thinking') {
          yield {
            type: 'progress',
            progress: {
              type: 'thinking',
              agentType: this.config.agentDefinition.agentType,
              iteration: chunk.iteration,
              timestamp: Date.now()
            }
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
        duration,
        modelUsed: this.config.model || this.config.agentDefinition.model
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
    this.logger.info('Sub-agent stopped')
  }

  // 获取上下文
  getContext(): ConversationContextV2 {
    return this.context
  }

  // 获取执行进度
  getProgress(): SubAgentProgress[] {
    return [...this.progress]
  }

  // 获取统计信息
  getStats() {
    return {
      progress: this.progress.length,
      toolCalls: this.progress.filter(p => p.type === 'tool_call').length,
      duration: this.startTime ? Date.now() - this.startTime : 0
    }
  }
}

// 增强版子代理管理器
export class SubAgentManager extends EventEmitter {
  private agents: Map<string, AgentDefinition> = new Map()
  private activeAgents: Map<string, SubAgent> = new Map()
  private queryLoopConfig: QueryLoopConfig
  private logger: Logger
  private agentCounter: number = 0

  constructor(queryLoopConfig: QueryLoopConfig) {
    super()
    this.queryLoopConfig = queryLoopConfig
    this.logger = new Logger('SubAgentManager')
  }

  // 注册代理定义
  registerAgent(definition: AgentDefinition): void {
    this.agents.set(definition.agentType, definition)
    this.logger.info(`Registered agent: ${definition.agentType}`)
    this.emit('agent:registered', definition)
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
    options: {
      context?: Record<string, any>
      forkContext?: boolean
      parentContext?: ConversationContextV2
      isAsync?: boolean
      model?: string
      maxIterations?: number
      temperature?: number
      cwd?: string
    } = {}
  ): Promise<SubAgentResult> {
    const definition = this.agents.get(agentType)
    if (!definition) {
      throw new Error(`Unknown agent type: ${agentType}`)
    }

    this.agentCounter++
    const agentId = `${agentType}-${this.agentCounter}`

    this.logger.info(`Creating agent instance: ${agentId}`)

    // 创建子代理实例
    const subAgent = new SubAgent({
      agentDefinition: definition,
      queryLoopConfig: this.queryLoopConfig,
      ...options
    })

    this.activeAgents.set(agentId, subAgent)

    // 转发事件
    subAgent.on('start', (data) => this.emit('agent:start', { agentId, ...data }))
    subAgent.on('complete', (data) => this.emit('agent:complete', { agentId, ...data }))
    subAgent.on('error', (data) => this.emit('agent:error', { agentId, ...data }))
    subAgent.on('progress', (data) => this.emit('agent:progress', { agentId, ...data }))

    try {
      const result = await subAgent.execute(directive, options.context)
      return result
    } finally {
      this.activeAgents.delete(agentId)
      this.emit('agent:finished', { agentId, agentType })
    }
  }

  // 创建流式子代理
  async *stream(
    agentType: string,
    directive: string,
    options: {
      context?: Record<string, any>
      forkContext?: boolean
      parentContext?: ConversationContextV2
      model?: string
      maxIterations?: number
      temperature?: number
      cwd?: string
    } = {}
  ): AsyncGenerator<{
    type: 'content' | 'tool_call' | 'tool_result' | 'complete' | 'error' | 'progress'
    content?: string
    toolName?: string
    result?: SubAgentResult
    error?: string
    agentId?: string
  }> {
    const definition = this.agents.get(agentType)
    if (!definition) {
      throw new Error(`Unknown agent type: ${agentType}`)
    }

    this.agentCounter++
    const agentId = `${agentType}-${this.agentCounter}`

    const subAgent = new SubAgent({
      agentDefinition: definition,
      queryLoopConfig: this.queryLoopConfig,
      ...options
    })

    this.activeAgents.set(agentId, subAgent)

    try {
      for await (const chunk of subAgent.stream(directive, options.context)) {
        yield { ...chunk, agentId }
      }
    } finally {
      this.activeAgents.delete(agentId)
    }
  }

  // 停止特定 Agent
  stopAgent(agentId: string): boolean {
    const agent = this.activeAgents.get(agentId)
    if (agent) {
      agent.stop()
      return true
    }
    return false
  }

  // 停止所有 Agent
  stopAll(): void {
    for (const [agentId, agent] of this.activeAgents) {
      this.logger.info(`Stopping agent: ${agentId}`)
      agent.stop()
    }
    this.activeAgents.clear()
  }

  // 获取活跃的 Agent 列表
  getActiveAgents(): Array<{ id: string; definition: AgentDefinition; stats: any }> {
    return Array.from(this.activeAgents.entries()).map(([id, agent]) => ({
      id,
      definition: this.agents.get(id.split('-')[0])!,
      stats: agent.getStats()
    }))
  }

  // 检查是否有活跃的 Agent
  hasActiveAgents(): boolean {
    return this.activeAgents.size > 0
  }

  // 获取活跃的 Agent 数量
  getActiveAgentCount(): number {
    return this.activeAgents.size
  }
}

export { SubAgent as SubAgentEnhanced }

// Agent Runtime V2 - Enhanced Version
// 整合所有优化模块的主入口

import { LLMServiceEnhanced, initializeLLMServiceEnhanced } from './services/llm/LLMServiceEnhanced.js'
import { ToolRegistry, ToolExecutor, buildTool } from './tools/Tool.js'
import { QueryLoop, QueryLoopConfig, QueryResult } from './agent/QueryLoopEnhanced.js'
import { SubAgentManager, SubAgentResult } from './agent/SubAgentEnhanced.js'
import { ConversationContextV2 } from './context/ConversationContextEnhanced.js'
import { createAgentToolEnhanced, registerEnhancedBuiltInAgents } from './tools/agent/AgentToolEnhanced.js'
import { Logger } from './utils/logger.js'
import { LLMProviderConfig, LLMToolDefinition } from './services/llm/types.js'

// 重新导出所有类型和类
export { 
  LLMServiceEnhanced,
  initializeLLMServiceEnhanced
} from './services/llm/LLMServiceEnhanced.js'

export { 
  QueryLoop,
  QueryLoopConfig,
  QueryResult 
} from './agent/QueryLoopEnhanced.js'

export { 
  SubAgentManager,
  SubAgent,
  SubAgentResult,
  SubAgentProgress
} from './agent/SubAgentEnhanced.js'

export { 
  ConversationContextV2,
  ContextStats,
  CompressionInfo 
} from './context/ConversationContextEnhanced.js'

export { 
  createAgentToolEnhanced,
  registerEnhancedBuiltInAgents,
  AgentToolInput,
  AgentToolOutput
} from './tools/agent/AgentToolEnhanced.js'

export {
  ToolRegistry,
  ToolExecutor,
  buildTool,
  ToolContext,
  ToolDef
} from './tools/Tool.js'

// 增强版 Agent Runtime 配置
export interface AgentRuntimeConfig {
  // LLM 配置
  llm: {
    defaultProvider: LLMProviderConfig
    fallbackProvider?: LLMProviderConfig
    enableCache?: boolean
    cacheTTL?: number
  }
  
  // 工具配置
  tools: {
    enabledTools: string[]
    customTools?: any[]
  }
  
  // Agent 配置
  agent: {
    maxIterations?: number
    enableStreaming?: boolean
    tokenBudget?: {
      maxTokensPerTurn?: number
      warningThreshold?: number
      enableAutoContinue?: boolean
    }
  }
  
  // 子代理配置
  subAgent: {
    enabledTypes?: string[]
    enableAsync?: boolean
    enableIsolation?: boolean
  }
}

// 增强版 Agent Runtime
export class AgentRuntimeEnhanced {
  private llmService: LLMServiceEnhanced
  private toolRegistry: ToolRegistry
  private toolExecutor: ToolExecutor
  private subAgentManager: SubAgentManager
  private logger: Logger
  private config: AgentRuntimeConfig
  private queryLoopConfig: QueryLoopConfig

  constructor(config: AgentRuntimeConfig) {
    this.config = config
    this.logger = new Logger('AgentRuntimeEnhanced')
    
    // 初始化 LLM Service
    this.llmService = initializeLLMServiceEnhanced({
      defaultProvider: config.llm.defaultProvider,
      fallbackProvider: config.llm.fallbackProvider,
      enableCache: config.llm.enableCache ?? true,
      cacheTTL: config.llm.cacheTTL ?? 3600,
      retryConfig: {
        maxRetries: 3,
        baseDelay: 1000,
        enableJitter: true
      },
      costTracking: { enabled: true, pricing: {} },
      enableMetrics: true
    })

    // 初始化工具系统
    this.toolRegistry = new ToolRegistry()
    this.toolExecutor = new ToolExecutor(this.toolRegistry)

    // 初始化子代理管理器
    this.queryLoopConfig = {
      llmService: this.llmService,
      toolRegistry: this.toolRegistry,
      toolExecutor: this.toolExecutor,
      maxIterations: config.agent?.maxIterations ?? 20,
      enableStreaming: config.agent?.enableStreaming ?? true,
      tokenBudget: config.agent?.tokenBudget,
      enableMetrics: true
    }
    
    this.subAgentManager = new SubAgentManager(this.queryLoopConfig)

    // 注册内置代理
    registerEnhancedBuiltInAgents(this.subAgentManager)
    
    // 注册 Agent Tool
    this.registerAgentTool()

    this.logger.info('Agent Runtime Enhanced initialized')
  }

  // 注册 Agent Tool
  private registerAgentTool(): void {
    const agentTool = createAgentToolEnhanced(
      this.subAgentManager,
      undefined,
      {
        enableAsync: this.config.subAgent?.enableAsync ?? true,
        enableIsolation: this.config.subAgent?.enableIsolation ?? true
      }
    )
    this.toolRegistry.register(agentTool)
  }

  // 注册工具
  registerTool(tool: any): void {
    this.toolRegistry.register(tool)
    this.logger.info(`Registered tool: ${tool.name}`)
  }

  // 批量注册工具
  registerTools(tools: any[]): void {
    for (const tool of tools) {
      this.registerTool(tool)
    }
  }

  // 执行单次查询
  async execute(
    prompt: string,
    options?: {
      systemPrompt?: string
      model?: string
      context?: ConversationContextV2
      enableStreaming?: boolean
    }
  ): Promise<QueryResult> {
    const context = options?.context || new ConversationContextV2()
    
    const queryLoop = new QueryLoop({
      ...this.queryLoopConfig,
      enableStreaming: options?.enableStreaming ?? this.config.agent?.enableStreaming ?? true
    })

    return queryLoop.execute(prompt, context, {
      systemPrompt: options?.systemPrompt,
      model: options?.model
    })
  }

  // 流式执行
  async *stream(
    prompt: string,
    options?: {
      systemPrompt?: string
      model?: string
      context?: ConversationContextV2
    }
  ): AsyncGenerator<{
    type: 'content' | 'tool_call' | 'tool_result' | 'error' | 'iteration_start'
    content?: string
    toolName?: string
    toolInput?: any
    toolOutput?: any
    error?: string
    iteration?: number
  }> {
    const context = options?.context || new ConversationContextV2()
    
    const queryLoop = new QueryLoop(this.queryLoopConfig)

    for await (const chunk of queryLoop.stream(prompt, context, {
      systemPrompt: options?.systemPrompt,
      model: options?.model
    })) {
      yield chunk
    }
  }

  // 执行子代理
  async executeAgent(
    agentType: string,
    directive: string,
    options?: {
      context?: Record<string, any>
      forkContext?: boolean
      model?: string
      maxIterations?: number
      temperature?: number
      cwd?: string
    }
  ): Promise<SubAgentResult> {
    return this.subAgentManager.execute(agentType, directive, options)
  }

  // 流式执行子代理
  async *streamAgent(
    agentType: string,
    directive: string,
    options?: {
      context?: Record<string, any>
      forkContext?: boolean
      model?: string
    }
  ): AsyncGenerator<{
    type: 'content' | 'tool_call' | 'tool_result' | 'complete' | 'error' | 'progress'
    content?: string
    toolName?: string
    result?: SubAgentResult
    error?: string
  }> {
    for await (const chunk of this.subAgentManager.stream(agentType, directive, options)) {
      yield chunk
    }
  }

  // 获取可用的 Agent 类型
  listAgentTypes(): Array<{ agentType: string; name: string; description: string }> {
    return this.subAgentManager.listAgents().map(a => ({
      agentType: a.agentType,
      name: a.name,
      description: a.description
    }))
  }

  // 获取可用的工具
  listTools(): string[] {
    return this.toolRegistry.list()
  }

  // 获取工具描述（用于 LLM）
  getToolDescriptions(): LLMToolDefinition[] {
    return this.toolRegistry.getToolDescriptions().map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema
      }
    }))
  }

  // 获取运行时统计
  getStats(): {
    llm: ReturnType<LLMServiceEnhanced['getMetrics']>
    cost: ReturnType<LLMServiceEnhanced['getCostStats']>
    activeAgents: number
  } {
    return {
      llm: this.llmService.getMetrics(),
      cost: this.llmService.getCostStats(),
      activeAgents: this.subAgentManager.getActiveAgentCount()
    }
  }

  // 获取 LLM Service 实例
  getLLMService(): LLMServiceEnhanced {
    return this.llmService
  }

  // 获取子代理管理器
  getSubAgentManager(): SubAgentManager {
    return this.subAgentManager
  }

  // 获取工具注册表
  getToolRegistry(): ToolRegistry {
    return this.toolRegistry
  }

  // 停止所有活动
  stop(): void {
    this.subAgentManager.stopAll()
    this.logger.info('Agent Runtime stopped')
  }

  // 创建新的上下文
  createContext(options?: { maxTokens?: number }): ConversationContextV2 {
    return new ConversationContextV2({
      maxTokens: options?.maxTokens ?? 16000
    })
  }
}

// 便捷工厂函数
export function createAgentRuntime(config: AgentRuntimeConfig): AgentRuntimeEnhanced {
  return new AgentRuntimeEnhanced(config)
}

// 默认导出
export default AgentRuntimeEnhanced

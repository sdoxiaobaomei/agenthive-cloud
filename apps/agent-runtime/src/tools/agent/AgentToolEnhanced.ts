// Agent Tool - 增强版，参考 Claude Code 的子代理系统
// 
// 核心特性：
// 1. Fork 子代理模式 - 继承父代理的系统提示词和工具集
// 2. 多种内置 Agent 类型 - Explore、Plan、Coder
// 3. 上下文消息分叉
// 4. 后台任务支持
// 5. 结果汇总和返回

import { z } from 'zod'
import { buildTool, type ToolContext, type PermissionDecision, ToolRegistry, ToolExecutor } from '../ToolEnhanced.js'
import { LLMServiceEnhanced } from '../../services/llm/LLMServiceEnhanced.js'
import { ConversationContextV2 } from '../../context/ConversationContextV2.js'
import { Logger } from '../../utils/logger.js'
import { EventEmitter } from 'events'

// ============================================================================
// 类型定义
// ============================================================================

export type AgentType = 'explore' | 'plan' | 'coder' | 'general' | 'custom'

export interface AgentDefinition {
  agentType: AgentType
  name: string
  description: string
  // 允许的工具列表，null 表示允许所有
  allowedTools?: string[] | null
  // 禁止的工具列表
  disallowedTools?: string[]
  // 系统提示词
  systemPrompt: string
  // 最大迭代次数
  maxIterations?: number
  // 是否只读（禁止修改操作）
  readOnly?: boolean
  // 是否后台运行
  background?: boolean
  // 模型选择
  model?: string
}

export interface AgentTask {
  id: string
  agentType: AgentType
  prompt: string
  context?: {
    // 父代理的上下文消息
    messages?: Array<{
      role: 'user' | 'assistant' | 'system'
      content: string
    }>
    // 继承父代理的工具集
    inheritTools?: boolean
  }
  // 任务特定选项
  options?: {
    maxIterations?: number
    timeout?: number
    model?: string
  }
}

export interface AgentResult {
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

export interface SubAgent {
  id: string
  task: AgentTask
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  result?: AgentResult
  error?: string
  startTime?: number
  endTime?: number
}

// ============================================================================
// 内置 Agent 定义 - 参考 Claude Code
// ============================================================================

export const BUILTIN_AGENTS: Record<AgentType, AgentDefinition> = {
  // Explore Agent - 只读代码库探索专家
  explore: {
    agentType: 'explore',
    name: 'Explore',
    description: 'Fast agent specialized for exploring codebases. Read-only operations only.',
    allowedTools: ['file_read', 'glob', 'grep', 'bash'],
    disallowedTools: ['file_write', 'file_edit', 'agent_run'],
    systemPrompt: `You are a file search specialist. Your job is to quickly explore and understand codebases.

**Your Capabilities:**
- Read files to understand code structure
- Use glob to find files by pattern
- Use grep to search for patterns in code
- Run read-only bash commands

**Rules:**
1. You are READ-ONLY. Never modify files.
2. Be thorough but concise in your exploration.
3. Focus on understanding the structure and key files.
4. Return a summary of your findings.

**Response Format:**
Provide a concise summary of:
1. Project structure overview
2. Key files and their purposes
3. Important patterns or conventions found
4. Any issues or observations`,
    maxIterations: 15,
    readOnly: true
  },

  // Plan Agent - 计划模式专家
  plan: {
    agentType: 'plan',
    name: 'Plan',
    description: 'Creates detailed implementation plans before making changes.',
    allowedTools: ['file_read', 'glob', 'grep'],
    disallowedTools: ['file_write', 'file_edit', 'bash'],
    systemPrompt: `You are a planning specialist. Your job is to create detailed implementation plans.

**Your Capabilities:**
- Read existing code to understand current state
- Search for related files and patterns
- Create comprehensive implementation plans

**Rules:**
1. You are READ-ONLY. Never modify files.
2. Always understand the existing code before planning.
3. Break down complex tasks into clear steps.
4. Identify potential risks and edge cases.

**Response Format:**
Provide a structured plan with:
1. Current state analysis
2. Proposed changes (step by step)
3. Files to modify
4. Potential risks and mitigation
5. Testing considerations`,
    maxIterations: 10,
    readOnly: true
  },

  // Coder Agent - 代码实现专家
  coder: {
    agentType: 'coder',
    name: 'Coder',
    description: 'Implements features and fixes bugs through code changes.',
    allowedTools: null, // 允许所有工具
    disallowedTools: [],
    systemPrompt: `You are a code implementation specialist. Your job is to write high-quality code.

**Your Capabilities:**
- Read and understand existing code
- Write new code and modify existing code
- Run tests and commands
- Use all available tools

**Rules:**
1. Follow existing code style and conventions.
2. Write clean, maintainable code with comments.
3. Test your changes if possible.
4. Make minimal, focused changes.
5. Always validate your changes work correctly.

**Response Format:**
After completing the task:
1. Summarize changes made
2. List files modified
3. Explain any important implementation details
4. Note any testing performed`,
    maxIterations: 25,
    readOnly: false
  },

  // General Agent - 通用目的
  general: {
    agentType: 'general',
    name: 'General',
    description: 'General-purpose agent for various tasks.',
    allowedTools: null,
    disallowedTools: [],
    systemPrompt: `You are a helpful AI assistant. Help the user accomplish their tasks effectively.

**Rules:**
1. Use tools appropriately to accomplish tasks.
2. Ask for clarification if the task is unclear.
3. Provide clear, actionable responses.
4. Be thorough but efficient.`,
    maxIterations: 20,
    readOnly: false
  },

  // Custom Agent - 用户自定义
  custom: {
    agentType: 'custom',
    name: 'Custom',
    description: 'Custom agent with user-defined configuration.',
    allowedTools: null,
    disallowedTools: [],
    systemPrompt: 'You are a custom agent. Follow the specific instructions provided.',
    maxIterations: 20,
    readOnly: false
  }
}

// ============================================================================
// 子代理管理器
// ============================================================================

export class SubAgentManager extends EventEmitter {
  private agents = new Map<string, SubAgent>()
  private logger = new Logger('SubAgentManager')
  private llmService: LLMServiceEnhanced
  private toolRegistry: ToolRegistry

  constructor(llmService: LLMServiceEnhanced, toolRegistry: ToolRegistry) {
    super()
    this.llmService = llmService
    this.toolRegistry = toolRegistry
  }

  // 创建子代理任务
  createTask(task: Omit<AgentTask, 'id'>): SubAgent {
    const id = `agent-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    
    const agent: SubAgent = {
      id,
      task: { ...task, id },
      status: 'pending'
    }

    this.agents.set(id, agent)
    this.logger.info(`Created subagent task: ${id} (${task.agentType})`)
    this.emit('task:created', { id, task })

    return agent
  }

  // 执行子代理
  async run(agentId: string): Promise<AgentResult> {
    const agent = this.agents.get(agentId)
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`)
    }

    agent.status = 'running'
    agent.startTime = Date.now()
    this.emit('task:started', { id: agentId })

    try {
      const result = await this.executeAgent(agent)
      
      agent.result = result
      agent.status = result.success ? 'completed' : 'failed'
      agent.endTime = Date.now()

      this.emit('task:completed', { 
        id: agentId, 
        success: result.success,
        duration: agent.endTime - agent.startTime
      })

      return result

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      agent.status = 'failed'
      agent.error = errorMessage
      agent.endTime = Date.now()

      this.logger.error(`Agent ${agentId} failed`, { error: errorMessage })
      this.emit('task:failed', { id: agentId, error: errorMessage })

      return {
        success: false,
        content: '',
        toolCalls: [],
        iterations: 0
      }
    }
  }

  // 后台执行子代理
  async runInBackground(agentId: string): Promise<void> {
    this.run(agentId).catch(error => {
      this.logger.error(`Background agent ${agentId} failed`, { error })
    })
  }

  // 取消子代理
  cancel(agentId: string): boolean {
    const agent = this.agents.get(agentId)
    if (!agent) return false

    if (agent.status === 'running') {
      agent.status = 'cancelled'
      agent.endTime = Date.now()
      this.emit('task:cancelled', { id: agentId })
      return true
    }

    return false
  }

  // 获取子代理状态
  getStatus(agentId: string): SubAgent | undefined {
    return this.agents.get(agentId)
  }

  // 列出所有子代理
  listAll(): SubAgent[] {
    return Array.from(this.agents.values())
  }

  // 清理已完成的子代理
  cleanup(): void {
    const now = Date.now()
    const maxAge = 24 * 60 * 60 * 1000 // 24 hours

    for (const [id, agent] of this.agents.entries()) {
      if (agent.endTime && now - agent.endTime > maxAge) {
        this.agents.delete(id)
      }
    }
  }

  // 核心执行逻辑
  private async executeAgent(agent: SubAgent): Promise<AgentResult> {
    const definition = BUILTIN_AGENTS[agent.task.agentType]
    const toolCalls: AgentResult['toolCalls'] = []
    
    // 创建子代理的上下文
    const context = new ConversationContextV2()
    
    // 添加系统提示词
    context.setSystemPrompt(definition.systemPrompt)
    
    // 如果继承父代理上下文，添加相关消息
    if (agent.task.context?.messages) {
      for (const msg of agent.task.context.messages.slice(-5)) { // 只取最近5条
        if (msg.role === 'user') {
          context.addUserMessage(msg.content)
        } else if (msg.role === 'assistant') {
          context.addAssistantMessage(msg.content)
        }
      }
    }

    // 添加任务提示词
    context.addUserMessage(agent.task.prompt)

    // 准备工具集
    const availableTools = this.prepareTools(definition, agent.task)

    // 执行查询循环
    const maxIterations = agent.task.options?.maxIterations || definition.maxIterations || 20
    let iterations = 0
    let finalContent = ''

    while (iterations < maxIterations) {
      iterations++

      // 调用 LLM
      const messages = context.toLLMMessages()
      const response = await this.llmService.complete(messages, {
        model: agent.task.options?.model || definition.model,
        tools: availableTools,
        toolChoice: availableTools.length > 0 ? 'auto' : undefined
      })

      // 处理助手回复
      if (response.content) {
        finalContent += response.content
        context.addAssistantMessage(response.content, response.toolCalls)
      }

      // 处理工具调用
      if (response.toolCalls && response.toolCalls.length > 0) {
        const toolResults = await this.executeToolCalls(
          response.toolCalls, 
          definition,
          agent.task.context
        )
        
        toolCalls.push(...toolResults)
        context.addToolResults(toolResults.map(r => ({
          toolCallId: r.id,
          output: r.output,
          error: r.error
        })))

        continue
      }

      // 没有工具调用，结束循环
      break
    }

    return {
      success: true,
      content: finalContent,
      toolCalls,
      iterations,
      usage: {
        promptTokens: 0, // 可以从 LLM 服务获取
        completionTokens: 0,
        totalTokens: 0
      }
    }
  }

  // 准备工具集
  private prepareTools(definition: AgentDefinition, task: AgentTask): any[] {
    const allTools = this.toolRegistry.getToolDefinitions()
    
    // 如果继承父代理工具集且未指定允许列表
    if (task.context?.inheritTools && !definition.allowedTools) {
      return allTools
    }

    // 过滤工具
    return allTools.filter(tool => {
      // 检查禁止列表
      if (definition.disallowedTools?.includes(tool.function.name)) {
        return false
      }

      // 检查允许列表
      if (definition.allowedTools === null) {
        return true // null 表示允许所有
      }
      
      if (definition.allowedTools) {
        return definition.allowedTools.includes(tool.function.name)
      }

      return true
    })
  }

  // 执行工具调用
  private async executeToolCalls(
    toolCalls: any[],
    definition: AgentDefinition,
    parentContext?: AgentTask['context']
  ): Promise<Array<{ id: string; name: string; input: any; output: any; error?: string }>> {
    const results = []
    const toolExecutor = new ToolExecutor(this.toolRegistry)

    for (const toolCall of toolCalls) {
      const { id, function: func } = toolCall
      const toolName = func.name
      
      // 检查是否允许使用此工具
      if (definition.disallowedTools?.includes(toolName)) {
        results.push({
          id,
          name: toolName,
          input: func.arguments,
          output: null,
          error: `Tool '${toolName}' is not allowed for this agent type`
        })
        continue
      }

      try {
        let toolInput: any
        try {
          toolInput = JSON.parse(func.arguments)
        } catch {
          toolInput = { raw: func.arguments }
        }

        // 创建工具上下文
        const toolContext: ToolContext = {
          agentId: `subagent-${toolName}`,
          workspacePath: process.cwd(),
          sendLog: (message: string, isError = false) => {
            this.logger.debug(`Tool ${toolName}: ${message}`, { isError })
          },
          signal: undefined,
          checkPermission: async () => ({ type: 'allow' as const }),
          llm: {
            complete: async (prompt: string) => {
              const result = await this.llmService.complete([
                { role: 'user', content: prompt }
              ])
              return result.content || ''
            },
            chat: async (messages: any[]) => {
              const result = await this.llmService.complete(messages)
              return result.content || ''
            }
          }
        }

        // 如果是只读 agent，检查工具是否为只读
        if (definition.readOnly) {
          const tool = this.toolRegistry.get(toolName)
          if (tool && !tool.isReadOnly(toolInput)) {
            results.push({
              id,
              name: toolName,
              input: toolInput,
              output: null,
              error: `Tool '${toolName}' is not read-only. This agent can only perform read operations.`
            })
            continue
          }
        }

        const output = await toolExecutor.execute(toolName, toolInput, toolContext)

        results.push({
          id,
          name: toolName,
          input: toolInput,
          output
        })

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        results.push({
          id,
          name: toolName,
          input: func.arguments,
          output: null,
          error: errorMessage
        })
      }
    }

    return results
  }
}

// ============================================================================
// Agent Tool - 主工具实现
// ============================================================================

const inputSchema = z.object({
  agentType: z.enum(['explore', 'plan', 'coder', 'general', 'custom'])
    .describe('Type of agent to use'),
  prompt: z.string()
    .describe('Task description for the agent'),
  background: z.boolean().optional().default(false)
    .describe('Run the agent in the background'),
  inheritContext: z.boolean().optional().default(true)
    .describe('Inherit parent agent context'),
  maxIterations: z.number().optional()
    .describe('Maximum iterations for this agent'),
  model: z.string().optional()
    .describe('Model to use for this agent')
})

const outputSchema = z.object({
  success: z.boolean(),
  agentId: z.string(),
  content: z.string(),
  status: z.enum(['completed', 'failed', 'running', 'pending', 'cancelled']),
  toolCalls: z.array(z.object({
    name: z.string(),
    input: z.any(),
    output: z.any()
  })),
  iterations: z.number()
})

// 全局子代理管理器实例
let globalSubAgentManager: SubAgentManager | null = null

export function initializeSubAgentManager(
  llmService: LLMServiceEnhanced, 
  toolRegistry: ToolRegistry
): SubAgentManager {
  globalSubAgentManager = new SubAgentManager(llmService, toolRegistry)
  return globalSubAgentManager
}

export function getSubAgentManager(): SubAgentManager {
  if (!globalSubAgentManager) {
    throw new Error('SubAgentManager not initialized. Call initializeSubAgentManager first.')
  }
  return globalSubAgentManager
}

export const AgentTool = buildTool({
  name: 'agent_run',
  description: `Create and run a specialized sub-agent to handle a specific task.

Available agent types:
- explore: Read-only codebase exploration specialist
- plan: Creates detailed implementation plans
- coder: Implements features and fixes bugs
- general: General-purpose agent for various tasks

Use this when:
1. A task requires focused exploration (use 'explore')
2. You need a detailed implementation plan (use 'plan')
3. A task can be parallelized or delegated
4. You want to isolate a complex sub-task`,
  searchHint: 'create subagent delegate task',
  inputSchema,
  outputSchema,

  // 安全标记
  isConcurrencySafe: () => true, // 子代理可以并发运行
  isReadOnly: (input) => {
    // explore 和 plan 是只读的
    return input.agentType === 'explore' || input.agentType === 'plan'
  },
  isDestructive: () => false,

  async execute(input, context: ToolContext) {
    const manager = getSubAgentManager()
    
    // 构建父代理上下文
    const parentContext = input.inheritContext ? {
      messages: [], // 可以从 context 获取
      inheritTools: true
    } : undefined

    // 创建任务
    const task = manager.createTask({
      agentType: input.agentType,
      prompt: input.prompt,
      context: parentContext,
      options: {
        maxIterations: input.maxIterations,
        model: input.model
      }
    })

    // 后台运行或同步运行
    if (input.background) {
      manager.runInBackground(task.id)
      
      return {
        success: true,
        agentId: task.id,
        content: `Agent '${input.agentType}' started in background. ID: ${task.id}`,
        status: 'running',
        toolCalls: [],
        iterations: 0
      }
    }

    // 同步运行
    const result = await manager.run(task.id)

    return {
      success: result.success,
      agentId: task.id,
      content: result.content,
      status: result.success ? 'completed' : 'failed',
      toolCalls: result.toolCalls,
      iterations: result.iterations
    }
  },

  async checkPermissions(input, context): Promise<PermissionDecision> {
    // 检查递归调用限制
    if (context.agentId.startsWith('subagent-')) {
      return {
        type: 'deny',
        message: 'Sub-agents cannot create nested sub-agents to prevent infinite recursion'
      }
    }

    return { type: 'allow' }
  },

  renderToolUseMessage(input) {
    return `Creating ${input.agentType} agent: ${input.prompt.slice(0, 50)}${input.prompt.length > 50 ? '...' : ''}`
  },

  renderToolResultMessage(result) {
    if (result.status === 'running') {
      return `Agent ${result.agentId} running in background`
    }
    return `Agent ${result.agentId} completed with ${result.iterations} iterations`
  },

  userFacingName(input) {
    return `Run ${input?.agentType || 'agent'}`
  },

  toAutoClassifierInput(input) {
    return `Create ${input.agentType} agent: ${input.prompt.slice(0, 100)}`
  }
})

// 默认导出
export default AgentTool

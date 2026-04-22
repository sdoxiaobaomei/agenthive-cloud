/**
 * Agent System - Enhanced with Claude Code Design Patterns
 * 
 * 核心特性：
 * 1. 子代理隔离模式 - worktree / remote / container
 * 2. 异步任务队列和后台执行
 * 3. 团队成员协作模式
 * 4. 完整的生命周期管理
 */
import { EventEmitter } from 'events'
import { z } from 'zod'
import { 
  buildTool, 
  type ToolContext, 
  type EnhancedToolContext,
  type EnhancedPermissionDecision,
  ToolRegistry,
  FileStateCache,
  createFileStateCache,
  ToolProgressData
} from '../tools/ToolClaudeCode.js'
import { ConversationContextV2 } from '../context/ConversationContextV2.js'
import { Logger } from '../utils/loggerEnhanced.js'

// ============================================================================
// 类型定义
// ============================================================================

export type AgentType = 'explore' | 'plan' | 'coder' | 'general' | 'custom'
export type IsolationMode = 'none' | 'worktree' | 'remote' | 'container'
export type AgentStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

export interface AgentDefinition {
  agentType: AgentType
  name: string
  description: string
  allowedTools?: string[] | null
  disallowedTools?: string[]
  systemPrompt: string
  maxIterations?: number
  readOnly?: boolean
  model?: string
  // 默认隔离模式
  defaultIsolation?: IsolationMode
}

export interface AgentConfig {
  description: string
  prompt: string
  subagentType?: AgentType
  model?: string
  runInBackground?: boolean
  name?: string
  teamName?: string
  isolation?: IsolationMode
  cwd?: string
  customSystemPrompt?: string
  appendSystemPrompt?: string
  maxIterations?: number
  timeout?: number
  // 继承父 Agent 的上下文
  inheritContext?: boolean
  // 父上下文消息数量
  parentContextMessages?: number
}

export interface AgentTask {
  id: string
  config: AgentConfig
  agentType: AgentType
  status: AgentStatus
  result?: AgentResult
  error?: string
  startTime?: number
  endTime?: number
  // 运行时数据
  context?: ConversationContextV2
  abortController?: AbortController
  progress: AgentProgress[]
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
  duration: number
}

export interface AgentProgress {
  type: 'started' | 'thinking' | 'tool_call' | 'tool_result' | 'content' | 'completed' | 'error'
  timestamp: number
  message?: string
  toolName?: string
  toolInput?: any
  toolOutput?: any
  content?: string
  error?: string
  iteration?: number
}

export interface Team {
  name: string
  members: Map<string, AgentTask>
  createdAt: number
}

// ============================================================================
// 内置 Agent 定义
// ============================================================================

export const BUILTIN_AGENTS: Record<AgentType, AgentDefinition> = {
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
    readOnly: true,
    defaultIsolation: 'none'
  },

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
    readOnly: true,
    defaultIsolation: 'none'
  },

  coder: {
    agentType: 'coder',
    name: 'Coder',
    description: 'Implements features and fixes bugs through code changes.',
    allowedTools: null,
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
    readOnly: false,
    defaultIsolation: 'none'
  },

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
    readOnly: false,
    defaultIsolation: 'none'
  },

  custom: {
    agentType: 'custom',
    name: 'Custom',
    description: 'Custom agent with user-defined configuration.',
    allowedTools: null,
    disallowedTools: [],
    systemPrompt: 'You are a custom agent. Follow the specific instructions provided.',
    maxIterations: 20,
    readOnly: false,
    defaultIsolation: 'none'
  }
}

// ============================================================================
// Agent 管理器
// ============================================================================

export class AgentManager extends EventEmitter {
  private agents = new Map<string, AgentTask>()
  private teams = new Map<string, Team>()
  private logger = new Logger('AgentManager')
  private toolRegistry: ToolRegistry
  private llmService: any // LLMService type
  
  // 后台任务队列
  private backgroundQueue: string[] = []
  private isProcessingQueue = false
  private maxConcurrentBackground = 3
  private runningBackgroundTasks = new Set<string>()

  constructor(toolRegistry: ToolRegistry, llmService: any) {
    super()
    this.toolRegistry = toolRegistry
    this.llmService = llmService
  }

  // ============================================================================
  // 任务创建
  // ============================================================================

  createTask(config: AgentConfig): AgentTask {
    const id = `agent-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    const agentType = config.subagentType || 'general'
    
    const task: AgentTask = {
      id,
      config,
      agentType,
      status: 'pending',
      progress: []
    }

    this.agents.set(id, task)
    this.logger.info(`Created agent task: ${id} (${agentType})`)
    this.emit('task:created', { id, config, agentType })

    return task
  }

  // ============================================================================
  // 同步执行
  // ============================================================================

  async run(id: string, parentContext?: EnhancedToolContext): Promise<AgentResult> {
    const task = this.agents.get(id)
    if (!task) {
      throw new Error(`Agent not found: ${id}`)
    }

    if (task.status === 'running') {
      throw new Error(`Agent ${id} is already running`)
    }

    task.status = 'running'
    task.startTime = Date.now()
    task.abortController = new AbortController()
    
    this.emit('task:started', { id })
    this.addProgress(task, { type: 'started' })

    try {
      const result = await this.executeAgent(task, parentContext)
      
      task.result = result
      task.status = result.success ? 'completed' : 'failed'
      task.endTime = Date.now()

      this.emit('task:completed', { 
        id, 
        success: result.success,
        duration: task.endTime - task.startTime
      })

      return result

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      task.status = 'failed'
      task.error = errorMessage
      task.endTime = Date.now()

      this.logger.error(`Agent ${id} failed`, { error: errorMessage })
      this.emit('task:failed', { id, error: errorMessage })

      return {
        success: false,
        content: '',
        toolCalls: [],
        iterations: 0,
        duration: task.endTime - task.startTime
      }
    }
  }

  // ============================================================================
  // 后台执行
  // ============================================================================

  async runInBackground(id: string, parentContext?: EnhancedToolContext): Promise<void> {
    const task = this.agents.get(id)
    if (!task) {
      throw new Error(`Agent not found: ${id}`)
    }

    // 添加到队列
    this.backgroundQueue.push(id)
    this.logger.info(`Agent ${id} queued for background execution`)
    
    // 触发队列处理
    this.processBackgroundQueue(parentContext)
  }

  private async processBackgroundQueue(parentContext?: EnhancedToolContext): Promise<void> {
    if (this.isProcessingQueue) return
    if (this.runningBackgroundTasks.size >= this.maxConcurrentBackground) return
    if (this.backgroundQueue.length === 0) return

    this.isProcessingQueue = true

    try {
      while (this.backgroundQueue.length > 0 && 
             this.runningBackgroundTasks.size < this.maxConcurrentBackground) {
        const id = this.backgroundQueue.shift()!
        
        // 启动后台任务
        this.runningBackgroundTasks.add(id)
        
        this.run(id, parentContext).finally(() => {
          this.runningBackgroundTasks.delete(id)
          // 继续处理队列
          this.processBackgroundQueue(parentContext)
        })
      }
    } finally {
      this.isProcessingQueue = false
    }
  }

  // ============================================================================
  // 团队成员协作
  // ============================================================================

  createTeam(teamName: string): Team {
    const team: Team = {
      name: teamName,
      members: new Map(),
      createdAt: Date.now()
    }
    
    this.teams.set(teamName, team)
    this.logger.info(`Created team: ${teamName}`)
    this.emit('team:created', { name: teamName })
    
    return team
  }

  spawnTeammate(
    teamName: string, 
    config: AgentConfig,
    parentContext?: EnhancedToolContext
  ): AgentTask {
    // 确保团队存在
    let team = this.teams.get(teamName)
    if (!team) {
      team = this.createTeam(teamName)
    }

    // 创建队友任务
    const task = this.createTask({
      ...config,
      teamName
    })

    // 添加到团队
    team.members.set(task.id, task)

    // 后台运行
    this.runInBackground(task.id, parentContext)

    return task
  }

  getTeam(teamName: string): Team | undefined {
    return this.teams.get(teamName)
  }

  getTeamStatus(teamName: string): { 
    total: number
    running: number
    completed: number
    failed: number
  } {
    const team = this.teams.get(teamName)
    if (!team) {
      return { total: 0, running: 0, completed: 0, failed: 0 }
    }

    const members = Array.from(team.members.values())
    return {
      total: members.length,
      running: members.filter(m => m.status === 'running').length,
      completed: members.filter(m => m.status === 'completed').length,
      failed: members.filter(m => m.status === 'failed').length
    }
  }

  // ============================================================================
  // 隔离模式执行
  // ============================================================================

  private async executeWithIsolation(
    task: AgentTask,
    executeFn: () => Promise<AgentResult>
  ): Promise<AgentResult> {
    const isolation = task.config.isolation || 'none'

    switch (isolation) {
      case 'worktree':
        return this.runInWorktree(task, executeFn)
      case 'remote':
        return this.runRemote(task, executeFn)
      case 'container':
        return this.runInContainer(task, executeFn)
      case 'none':
      default:
        return executeFn()
    }
  }

  private async runInWorktree(
    task: AgentTask,
    executeFn: () => Promise<AgentResult>
  ): Promise<AgentResult> {
    this.logger.info(`Running agent ${task.id} in git worktree`)
    
    // 注意：实际实现需要创建 git worktree
    // 这里简化处理，实际应该：
    // 1. 创建临时 worktree
    // 2. 在 worktree 中执行
    // 3. 清理 worktree
    
    // 临时：直接执行
    return executeFn()
  }

  private async runRemote(
    task: AgentTask,
    executeFn: () => Promise<AgentResult>
  ): Promise<AgentResult> {
    this.logger.info(`Running agent ${task.id} in remote environment`)
    
    // 注意：实际实现需要远程执行支持
    // 这里简化处理
    return executeFn()
  }

  private async runInContainer(
    task: AgentTask,
    executeFn: () => Promise<AgentResult>
  ): Promise<AgentResult> {
    this.logger.info(`Running agent ${task.id} in container`)
    
    // 注意：实际实现需要容器支持
    // 这里简化处理
    return executeFn()
  }

  // ============================================================================
  // 核心执行逻辑
  // ============================================================================

  private async executeAgent(
    task: AgentTask,
    parentContext?: EnhancedToolContext
  ): Promise<AgentResult> {
    const definition = BUILTIN_AGENTS[task.agentType]
    const toolCalls: AgentResult['toolCalls'] = []
    
    // 创建文件状态缓存
    const fileState = createFileStateCache()
    
    // 创建子 Agent 上下文
    const agentContext = this.createSubagentContext(parentContext, task.id, { fileState })
    
    // 创建对话上下文
    const context = new ConversationContextV2()
    task.context = context
    
    // 构建系统提示词
    const systemPrompt = this.buildEffectiveSystemPrompt({
      basePrompt: definition.systemPrompt,
      customSystemPrompt: task.config.customSystemPrompt,
      appendSystemPrompt: task.config.appendSystemPrompt
    })
    context.setSystemPrompt(systemPrompt)
    
    // 继承父上下文消息
    if (task.config.inheritContext && parentContext?.parentContext) {
      // 这里简化处理，实际应该从父上下文获取消息
    }
    
    // 添加任务提示词
    context.addUserMessage(task.config.prompt)

    // 准备工具集
    const availableTools = this.prepareTools(definition, task.config)

    // 执行查询循环
    const maxIterations = task.config.maxIterations || definition.maxIterations || 20
    let iterations = 0
    let finalContent = ''

    const startTime = Date.now()

    while (iterations < maxIterations) {
      // 检查取消
      if (task.abortController?.signal.aborted) {
        throw new Error('Agent execution cancelled')
      }

      iterations++
      this.addProgress(task, { 
        type: 'thinking', 
        iteration: iterations
      })

      // 调用 LLM
      const messages = context.toLLMMessages()
      const response = await this.llmService.complete(messages, {
        model: task.config.model || definition.model,
        tools: availableTools,
        toolChoice: availableTools.length > 0 ? 'auto' : undefined
      })

      // 处理助手回复
      if (response.content) {
        finalContent += response.content
        context.addAssistantMessage(response.content, response.toolCalls)
        this.addProgress(task, { 
          type: 'content', 
          content: response.content,
          iteration: iterations
        })
      }

      // 处理工具调用
      if (response.toolCalls && response.toolCalls.length > 0) {
        for (const toolCall of response.toolCalls) {
          this.addProgress(task, { 
            type: 'tool_call', 
            toolName: toolCall.function.name,
            toolInput: toolCall.function.arguments,
            iteration: iterations
          })
        }

        const toolResults = await this.executeToolCalls(
          response.toolCalls, 
          definition,
          agentContext
        )
        
        toolCalls.push(...toolResults)
        context.addToolResults(toolResults.map(r => ({
          toolCallId: r.id,
          output: r.output,
          error: r.error
        })))

        for (const result of toolResults) {
          this.addProgress(task, { 
            type: 'tool_result', 
            toolName: result.name,
            toolOutput: result.output,
            error: result.error,
            iteration: iterations
          })
        }

        continue
      }

      // 没有工具调用，结束循环
      break
    }

    const duration = Date.now() - startTime

    return {
      success: true,
      content: finalContent,
      toolCalls,
      iterations,
      duration
    }
  }

  // ============================================================================
  // 子 Agent 上下文创建
  // ============================================================================

  private createSubagentContext(
    parentContext: EnhancedToolContext | undefined,
    agentId: string,
    options: { 
      fileState: FileStateCache
    }
  ): EnhancedToolContext {
    const chainId = parentContext?.queryTracking?.chainId || `chain-${Date.now()}`
    const depth = (parentContext?.queryTracking?.depth || 0) + 1

    return {
      agentId,
      workspacePath: parentContext?.workspacePath || process.cwd(),
      sendLog: (message: string, isError = false) => {
        this.logger.debug(`[${agentId}] ${message}`, { isError })
      },
      signal: undefined,
      fileState: options.fileState,
      queryTracking: {
        chainId,
        depth
      },
      parentContext,
      llm: parentContext?.llm,
      checkPermission: parentContext?.checkPermission
    }
  }

  // ============================================================================
  // 系统提示词构建
  // ============================================================================

  private buildEffectiveSystemPrompt(options: {
    basePrompt: string
    customSystemPrompt?: string
    appendSystemPrompt?: string
  }): string {
    let prompt = options.basePrompt

    if (options.customSystemPrompt) {
      prompt = options.customSystemPrompt
    }

    if (options.appendSystemPrompt) {
      prompt += '\n\n' + options.appendSystemPrompt
    }

    return prompt
  }

  // ============================================================================
  // 工具准备和执行
  // ============================================================================

  private prepareTools(definition: AgentDefinition, config: AgentConfig): any[] {
    const allTools = this.toolRegistry.getToolDefinitions()
    
    // 如果继承父 Agent 工具集且未指定允许列表
    if (config.inheritContext && !definition.allowedTools) {
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
        return true
      }
      
      if (definition.allowedTools) {
        return definition.allowedTools.includes(tool.function.name)
      }

      return true
    })
  }

  private async executeToolCalls(
    toolCalls: any[],
    definition: AgentDefinition,
    context: EnhancedToolContext
  ): Promise<Array<{ id: string; name: string; input: any; output: any; error?: string }>> {
    const results = []

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

        // 获取工具并执行
        const tool = this.toolRegistry.get(toolName)
        if (!tool) {
          results.push({
            id,
            name: toolName,
            input: toolInput,
            output: null,
            error: `Tool '${toolName}' not found in registry`
          })
          continue
        }

        // 验证输入
        const parseResult = (tool.inputSchema as any).safeParse(toolInput)
        if (!parseResult.success) {
          results.push({
            id,
            name: toolName,
            input: toolInput,
            output: null,
            error: `Invalid input: ${parseResult.error.message}`
          })
          continue
        }

        // 权限检查
        const permissionResult = await tool.checkPermissions(parseResult.data, context)
        if (permissionResult.behavior === 'deny') {
          results.push({
            id,
            name: toolName,
            input: toolInput,
            output: null,
            error: `Permission denied: ${permissionResult.message || 'Access denied'}`
          })
          continue
        }

        // 执行工具
        this.logger.debug(`Executing tool: ${toolName}`, { agentId: context.agentId })
        const output = await tool.execute(parseResult.data, context)
        
        results.push({
          id,
          name: toolName,
          input: toolInput,
          output
        })

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        this.logger.error(`Tool execution failed: ${toolName}`, { error: errorMessage, agentId: context.agentId })
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

  // ============================================================================
  // 进度管理
  // ============================================================================

  private addProgress(task: AgentTask, progress: Omit<AgentProgress, 'timestamp'>): void {
    const fullProgress: AgentProgress = {
      ...progress,
      timestamp: Date.now()
    }
    task.progress.push(fullProgress)
    this.emit('task:progress', { id: task.id, progress: fullProgress })
  }

  // ============================================================================
  // 任务控制
  // ============================================================================

  cancel(id: string): boolean {
    const task = this.agents.get(id)
    if (!task) return false

    if (task.status === 'running') {
      task.abortController?.abort()
      task.status = 'cancelled'
      task.endTime = Date.now()
      this.emit('task:cancelled', { id })
      return true
    }

    return false
  }

  getStatus(id: string): AgentTask | undefined {
    return this.agents.get(id)
  }

  listAll(): AgentTask[] {
    return Array.from(this.agents.values())
  }

  listRunning(): AgentTask[] {
    return this.listAll().filter(a => a.status === 'running')
  }

  listBackground(): AgentTask[] {
    return this.listAll().filter(a => 
      this.runningBackgroundTasks.has(a.id) || 
      this.backgroundQueue.includes(a.id)
    )
  }

  // ============================================================================
  // 清理
  // ============================================================================

  cleanup(maxAge: number = 24 * 60 * 60 * 1000): void {
    const now = Date.now()

    for (const [id, agent] of this.agents.entries()) {
      if (agent.endTime && now - agent.endTime > maxAge) {
        this.agents.delete(id)
      }
    }

    // 清理空团队
    for (const [name, team] of this.teams.entries()) {
      if (team.members.size === 0 && now - team.createdAt > maxAge) {
        this.teams.delete(name)
      }
    }
  }
}

// ============================================================================
// Agent Tool 定义
// ============================================================================

const inputSchema = z.object({
  description: z.string().describe('A short (3-5 word) description of the task'),
  prompt: z.string().describe('The task for the agent to perform'),
  subagentType: z.enum(['explore', 'plan', 'coder', 'general', 'custom']).optional()
    .describe('Type of agent to use'),
  model: z.string().optional().describe('Model to use for this agent'),
  runInBackground: z.boolean().optional().default(false)
    .describe('Run the agent in the background'),
  name: z.string().optional().describe('Name for this agent instance'),
  teamName: z.string().optional().describe('Team name for multi-agent collaboration'),
  isolation: z.enum(['none', 'worktree', 'remote', 'container']).optional()
    .describe('Isolation mode for the agent'),
  cwd: z.string().optional().describe('Working directory override'),
  maxIterations: z.number().optional().describe('Maximum iterations for this agent'),
  inheritContext: z.boolean().optional().default(true)
    .describe('Inherit parent agent context')
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
  iterations: z.number(),
  duration: z.number()
})

// 全局 Agent 管理器实例
let globalAgentManager: AgentManager | null = null

export function initializeAgentManager(
  toolRegistry: ToolRegistry,
  llmService: any
): AgentManager {
  globalAgentManager = new AgentManager(toolRegistry, llmService)
  return globalAgentManager
}

export function getAgentManager(): AgentManager {
  if (!globalAgentManager) {
    throw new Error('AgentManager not initialized. Call initializeAgentManager first.')
  }
  return globalAgentManager
}

export function createAgentTool(agentManager: AgentManager) {
  return buildTool({
    name: 'Agent',
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
4. You want to isolate a complex sub-task
5. You need to run tasks in the background`,
    searchHint: 'create subagent delegate task fork',
    category: 'agent',
    inputSchema,
    outputSchema,

    isConcurrencySafe: () => true,
    isReadOnly: (input) => {
      return input.subagentType === 'explore' || input.subagentType === 'plan'
    },
    isDestructive: () => false,

    async execute(input, context: EnhancedToolContext) {
      // 检查递归限制
      if (context.queryTracking && context.queryTracking.depth > 3) {
        throw new Error('Maximum agent nesting depth exceeded (max: 3)')
      }

      const config: AgentConfig = {
        description: input.description,
        prompt: input.prompt,
        subagentType: input.subagentType,
        model: input.model,
        runInBackground: input.runInBackground,
        name: input.name,
        teamName: input.teamName,
        isolation: input.isolation,
        cwd: input.cwd,
        maxIterations: input.maxIterations,
        inheritContext: input.inheritContext
      }

      // 团队模式
      if (input.teamName && input.name) {
        const task = agentManager.spawnTeammate(input.teamName, config, context)
        
        return {
          success: true,
          agentId: task.id,
          content: `Spawned teammate '${input.name}' in team '${input.teamName}'`,
          status: 'running' as const,
          toolCalls: [],
          iterations: 0,
          duration: 0
        }
      }

      // 创建任务
      const task = agentManager.createTask(config)

      // 后台运行或同步运行
      if (input.runInBackground) {
        await agentManager.runInBackground(task.id, context)
        
        return {
          success: true,
          agentId: task.id,
          content: `Agent '${input.subagentType || 'general'}' started in background. ID: ${task.id}`,
          status: 'running' as const,
          toolCalls: [],
          iterations: 0,
          duration: 0
        }
      }

      // 同步运行
      const result = await agentManager.run(task.id, context)

      return {
        success: result.success,
        agentId: task.id,
        content: result.content,
        status: (result.success ? 'completed' : 'failed') as 'completed' | 'failed',
        toolCalls: result.toolCalls,
        iterations: result.iterations,
        duration: result.duration
      }
    },

    async checkPermissions(input, context): Promise<EnhancedPermissionDecision> {
      // 检查递归调用限制
      if (context.queryTracking && context.queryTracking.depth >= 3) {
        return {
          behavior: 'deny',
          message: 'Maximum agent nesting depth exceeded (max: 3)'
        }
      }

      return { behavior: 'allow' }
    },

    renderToolUseMessage(input) {
      return `Creating ${input.subagentType || 'general'} agent: ${input.description}`
    },

    renderToolResultMessage(result) {
      if (result.status === 'running') {
        return `Agent ${result.agentId} running in background`
      }
      return `Agent ${result.agentId} completed with ${result.iterations} iterations`
    },

    userFacingName(input) {
      return `Run ${input?.subagentType || 'agent'}`
    },

    toAutoClassifierInput(input) {
      return `Create ${input.subagentType} agent: ${input.description}`
    },

    classify(input) {
      if (input.subagentType === 'explore' || input.subagentType === 'plan') {
        return {
          category: 'agent',
          isSafe: true,
          riskLevel: 'low',
          suggestedConfirmation: false
        }
      }
      return {
        category: 'agent',
        isSafe: false,
        riskLevel: 'medium',
        suggestedConfirmation: true
      }
    }
  })
}

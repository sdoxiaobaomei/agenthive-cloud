// Agent Runtime V3 - 使用 LLM 和 QueryLoop 的完整 AI Agent
import { BaseAgentRuntime } from './BaseAgentRuntime.js'
import type { AgentConfig, Task, Command } from '../types/index.js'
import { trace, SpanStatusCode } from '@opentelemetry/api'
import { AI_ATTRIBUTES, AI_SPAN_NAMES } from '@agenthive/observability'
import { TaskExecutorManagerV3 } from './task-executor-v3.js'
import { initializeLLMService } from './llm/LLMService.js'
import { getMCPManager } from '../mcp/index.js'

export interface AgentRuntimeV3Config extends AgentConfig {
  llmConfig: {
    provider: 'anthropic' | 'openai'
    apiKey: string
    model: string
    baseUrl?: string
  }
  enableStreaming?: boolean
}

export class AgentRuntimeV3 extends BaseAgentRuntime<AgentRuntimeV3Config> {
  private executorManager: TaskExecutorManagerV3
  private mcpManager = getMCPManager()

  constructor(config: AgentRuntimeV3Config) {
    super(config)
    const llmService = initializeLLMService({
      defaultProvider: {
        provider: config.llmConfig.provider,
        apiKey: config.llmConfig.apiKey,
        model: config.llmConfig.model,
        baseUrl: config.llmConfig.baseUrl
      },
      enableCache: true
    })
    this.executorManager = new TaskExecutorManagerV3({
      llmService,
      enableStreaming: config.enableStreaming ?? true
    })
    this.setupExecutorEventHandlers()
  }

  protected getRuntimeName(): string {
    return 'Agent Runtime V3'
  }

  getAvailableTools(): string[] {
    return this.executorManager.getAvailableTools()
  }

  protected getRegisterCapabilities(): string[] {
    return [...this.config.capabilities, 'llm', 'ai_execution']
  }

  protected getRegisterExtraFields(): Record<string, unknown> {
    return { model: this.config.llmConfig.model }
  }

  protected getHeartbeatExtraFields(): Record<string, unknown> {
    return {
      tools: this.executorManager.getAvailableTools(),
      model: this.config.llmConfig.model
    }
  }

  protected getExecutorManager(): TaskExecutorManagerV3 {
    return this.executorManager
  }

  protected async beforeDisconnect(): Promise<void> {
    await this.mcpManager.disconnectAll()
  }

  private setupExecutorEventHandlers(): void {
    this.executorManager.on('progress', (data) => {
      this.wsClient.send('task:progress', { taskId: data.taskId, progress: data.progress, message: data.message })
    })
    this.executorManager.on('log', (data) => {
      this.wsClient.send('log:output', { agentId: this.config.id, taskId: data.taskId, data: data.message, isError: data.isError })
    })
    this.executorManager.on('query_progress', (data) => {
      this.wsClient.send('llm:progress', { agentId: this.config.id, type: data.type, iteration: data.iteration })
    })
  }

  protected async handleCustomCommand(command: Command): Promise<void> {
    switch (command.type) {
      case 'add_mcp':
        await this.handleAddMCP(command.payload as { name: string; command: string; args?: string[] })
        break
      case 'set_permission_mode':
        await this.handleSetPermissionMode(command.payload as { mode: string })
        break
      case 'list_tools':
        await this.handleListTools()
        break
      default:
        // V3 原始代码对未知命令静默忽略
        break
    }
  }

  protected async handleRunTask(task: Task): Promise<void> {
    if (this.status === 'paused') {
      this.logger.warn('Cannot start task while paused')
      return
    }
    if (this.currentTask) {
      this.logger.warn('Already executing a task', { currentTaskId: this.currentTask.id })
      return
    }
    this.currentTask = task
    this.status = 'working'
    this.logger.info('Starting task execution', { taskId: task.id, type: task.type })
    this.emit('task:started', task)

    const tracer = trace.getTracer('agenthive-agent-runtime')
    const span = tracer.startSpan(AI_SPAN_NAMES.RUNTIME_TASK, {
      attributes: {
        [AI_ATTRIBUTES.AGENT_ID]: this.config.id,
        [AI_ATTRIBUTES.AGENT_TYPE]: this.config.role || 'unknown',
        [AI_ATTRIBUTES.TASK_ID]: task.id,
        [AI_ATTRIBUTES.TASK_TYPE]: task.type,
        [AI_ATTRIBUTES.WORKSPACE_ID]: this.config.workspacePath || 'default',
      },
    })

    try {
      const context = {
        agentId: this.config.id,
        workspacePath: this.config.workspacePath,
        sendLog: (message: string, isError = false) => {
          this.executorManager.emit('log', { taskId: task.id, message, isError })
        },
        updateProgress: (progress: number, message?: string) => {
          this.executorManager.emit('progress', { taskId: task.id, progress, message })
        }
      }
      const result = await this.executorManager.execute(task, context)
      await this.wsClient.send('task:completed', {
        taskId: task.id,
        status: result.success ? 'completed' : 'failed',
        output: result.output,
        logs: result.logs
      })
      this.logger.info('Task execution completed', { taskId: task.id, success: result.success })
      span.setAttributes({
        [AI_ATTRIBUTES.TASK_STATUS]: result.success ? 'completed' : 'failed',
        'task.output_length': JSON.stringify(result.output).length,
      })
      span.setStatus({ code: SpanStatusCode.OK })
      this.emit('task:completed', { task, result })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      this.logger.error('Task execution failed', { taskId: task.id, error: message })
      span.recordException(error as Error)
      span.setStatus({ code: SpanStatusCode.ERROR, message })
      await this.wsClient.send('task:completed', {
        taskId: task.id,
        status: 'failed',
        error: message
      })
      this.emit('task:failed', { task, error })
    } finally {
      span.end()
      this.currentTask = null
      this.status = 'idle'
    }
  }

  protected async handleCancelTask(): Promise<void> {
    if (!this.currentTask) {
      this.logger.warn('No task to cancel')
      return
    }
    this.logger.info('Cancelling current task', { taskId: this.currentTask.id })
    await this.executorManager.cancel()
    await this.wsClient.send('task:completed', {
      taskId: this.currentTask.id,
      status: 'cancelled'
    })
    this.currentTask = null
    this.status = 'idle'
    this.emit('task:cancelled')
  }

  private async handleAddMCP(payload: { name: string; command: string; args?: string[] }): Promise<void> {
    try {
      await this.mcpManager.addClient({ name: payload.name, command: payload.command, args: payload.args })
      this.logger.info(`MCP server added: ${payload.name}`)
      await this.wsClient.send('log:output', { agentId: this.config.id, data: `MCP server connected: ${payload.name}`, isError: false })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      this.logger.error(`Failed to add MCP server: ${payload.name}`, { error: message })
      await this.wsClient.send('log:output', { agentId: this.config.id, data: `Failed to connect MCP server: ${message}`, isError: true })
    }
  }

  private async handleSetPermissionMode(payload: { mode: string }): Promise<void> {
    const validModes = ['default', 'auto', 'strict', 'plan']
    if (!validModes.includes(payload.mode)) {
      this.logger.error(`Invalid permission mode: ${payload.mode}`)
      return
    }
    this.executorManager.getPermissionManager().setMode(payload.mode as any)
    this.logger.info(`Permission mode set to: ${payload.mode}`)
  }

  private async handleListTools(): Promise<void> {
    const tools = this.executorManager.getAvailableTools()
    const mcpTools = this.mcpManager.getAllTools()
    await this.wsClient.send('log:output', {
      agentId: this.config.id,
      data: `Built-in tools: ${tools.join(', ')}\nMCP tools: ${mcpTools.map(t => `${t.client}:${t.tool.name}`).join(', ')}`,
      isError: false
    })
  }
}

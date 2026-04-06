// Agent Runtime V3 - 使用 LLM 和 QueryLoop 的完整 AI Agent
import { EventEmitter } from 'events'
import type { AgentConfig, AgentStatus, Task, Command } from '../types/index.js'
import { WebSocketClient } from './websocket-client.js'
import { TaskExecutorManagerV3 } from './task-executor-v3.js'
import { FileSystemService } from './filesystem.js'
import { Logger } from '../utils/logger.js'
import { getMCPManager } from '../mcp/index.js'
import { initializeLLMService } from './llm/LLMService.js'

export interface AgentRuntimeV3Config extends AgentConfig {
  llmConfig: {
    provider: 'anthropic' | 'openai'
    apiKey: string
    model: string
    baseUrl?: string
  }
  enableStreaming?: boolean
}

export class AgentRuntimeV3 extends EventEmitter {
  private config: AgentRuntimeV3Config
  private wsClient: WebSocketClient
  private executorManager: TaskExecutorManagerV3
  private fileSystem: FileSystemService
  private logger: Logger
  private mcpManager = getMCPManager()
  private status: AgentStatus = 'idle'
  private currentTask: Task | null = null
  private heartbeatTimer: NodeJS.Timeout | null = null
  private isShuttingDown = false

  constructor(config: AgentRuntimeV3Config) {
    super()
    this.config = config
    this.logger = new Logger(config.id)
    this.wsClient = new WebSocketClient(config.supervisorUrl, config.id)
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
    this.fileSystem = new FileSystemService(config.workspacePath)
    this.setupEventHandlers()
  }

  async start(): Promise<void> {
    this.logger.info('Starting Agent Runtime V3...', { agentId: this.config.id })
    try {
      await this.fileSystem.initialize()
      await this.wsClient.connect()
      await this.register()
      this.startHeartbeat()
      this.status = 'idle'
      this.emit('started')
      this.logger.info('Agent Runtime V3 started successfully')
    } catch (error) {
      this.logger.error('Failed to start Agent Runtime', { error })
      this.status = 'error'
      throw error
    }
  }

  async stop(): Promise<void> {
    if (this.isShuttingDown) return
    this.isShuttingDown = true
    this.logger.info('Stopping Agent Runtime...')
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
    if (this.currentTask && this.status === 'working') {
      await this.waitForTaskCompletion(30000)
    }
    await this.mcpManager.disconnectAll()
    await this.wsClient.disconnect()
    this.status = 'shutdown'
    this.emit('stopped')
    this.logger.info('Agent Runtime stopped')
  }

  async pause(): Promise<void> {
    if (this.status !== 'working') {
      this.status = 'paused'
      this.emit('paused')
      this.logger.info('Agent paused')
    }
  }

  async resume(): Promise<void> {
    if (this.status === 'paused') {
      this.status = 'idle'
      this.emit('resumed')
      this.logger.info('Agent resumed')
    }
  }

  async executeCommand(command: Command): Promise<void> {
    this.logger.info('Executing command', { type: command.type })
    switch (command.type) {
      case 'run_task':
        await this.handleRunTask(command.payload as unknown as Task)
        break
      case 'cancel_task':
        await this.handleCancelTask()
        break
      case 'pause':
        await this.pause()
        break
      case 'resume':
        await this.resume()
        break
      case 'shutdown':
        await this.stop()
        break
      case 'add_mcp':
        await this.handleAddMCP(command.payload as { name: string; command: string; args?: string[] })
        break
      case 'set_permission_mode':
        await this.handleSetPermissionMode(command.payload as { mode: string })
        break
      case 'list_tools':
        await this.handleListTools()
        break
    }
  }

  getStatus(): AgentStatus { return this.status }
  getCurrentTask(): Task | null { return this.currentTask }
  getConfig(): AgentRuntimeV3Config { return this.config }
  getAvailableTools(): string[] { return this.executorManager.getAvailableTools() }

  private setupEventHandlers(): void {
    this.wsClient.on('message', (message) => { this.handleWebSocketMessage(message) })
    this.wsClient.on('disconnected', () => { this.emit('disconnected') })
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

  private async register(): Promise<void> {
    await this.wsClient.send('agent:register', {
      id: this.config.id,
      name: this.config.name,
      role: this.config.role,
      capabilities: [...this.config.capabilities, 'llm', 'ai_execution'],
      status: this.status,
      tools: this.executorManager.getAvailableTools(),
      model: this.config.llmConfig.model
    })
    this.logger.info('Agent registered with supervisor')
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(async () => {
      if (this.isShuttingDown) return
      try {
        const usage = process.memoryUsage()
        await this.wsClient.send('agent:heartbeat', {
          agentId: this.config.id,
          status: this.status,
          currentTask: this.currentTask?.id,
          memory: Math.round(usage.heapUsed / 1024 / 1024),
          tools: this.executorManager.getAvailableTools(),
          model: this.config.llmConfig.model
        })
      } catch (error) {
        this.logger.error('Failed to send heartbeat', { error })
      }
    }, this.config.heartbeatInterval)
  }

  private async handleWebSocketMessage(message: any): Promise<void> {
    switch (message.type) {
      case 'task:assigned':
        await this.handleRunTask(message.payload as Task)
        break
      case 'command':
        await this.executeCommand(message.payload as Command)
        break
      case 'ping':
        await this.wsClient.send('pong', {})
        break
    }
  }

  private async handleRunTask(task: Task): Promise<void> {
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
      this.emit('task:completed', { task, result })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      this.logger.error('Task execution failed', { taskId: task.id, error: message })
      await this.wsClient.send('task:completed', {
        taskId: task.id,
        status: 'failed',
        error: message
      })
      this.emit('task:failed', { task, error })
    } finally {
      this.currentTask = null
      this.status = 'idle'
    }
  }

  private async handleCancelTask(): Promise<void> {
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

  private async waitForTaskCompletion(timeout: number): Promise<void> {
    const startTime = Date.now()
    while (this.currentTask && Date.now() - startTime < timeout) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }
}

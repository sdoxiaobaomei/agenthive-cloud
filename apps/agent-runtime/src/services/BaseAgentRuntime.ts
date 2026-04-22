// Agent Runtime - 公共基类
import { EventEmitter } from 'events'
import type { AgentConfig, AgentStatus, Task, Command } from '../types/index.js'
import { WebSocketClient } from './websocket-client.js'
import { FileSystemService } from './filesystem.js'
import { Logger } from '../utils/logger.js'

export abstract class BaseAgentRuntime<TConfig extends AgentConfig = AgentConfig> extends EventEmitter {
  protected config: TConfig
  protected wsClient: WebSocketClient
  protected fileSystem: FileSystemService
  protected logger: Logger
  protected status: AgentStatus = 'idle'
  protected currentTask: Task | null = null
  protected heartbeatTimer: NodeJS.Timeout | null = null
  protected isShuttingDown = false

  constructor(config: TConfig) {
    super()
    this.config = config
    this.logger = new Logger(config.id)
    this.wsClient = new WebSocketClient(config.supervisorUrl, config.id)
    this.fileSystem = new FileSystemService(config.workspacePath)
    this.setupEventHandlers()
  }

  // 启动 Agent Runtime
  async start(): Promise<void> {
    this.logger.info(`Starting ${this.getRuntimeName()}...`, {
      agentId: this.config.id,
      role: this.config.role
    })

    try {
      // 初始化文件系统
      await this.fileSystem.initialize()

      // 连接 Supervisor
      await this.wsClient.connect()

      // 注册 Agent
      await this.register()

      // 开始心跳
      this.startHeartbeat()

      this.status = 'idle'
      this.emit('started')

      this.logger.info(`${this.getRuntimeName()} started successfully`)
      await this.afterStart()
    } catch (error) {
      this.logger.error('Failed to start Agent Runtime', { error })
      this.status = 'error'
      throw error
    }
  }

  // 停止 Agent Runtime
  async stop(): Promise<void> {
    if (this.isShuttingDown) return

    this.isShuttingDown = true
    this.logger.info('Stopping Agent Runtime...')

    // 停止心跳
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }

    // 如果有正在执行的任务，先完成或取消
    if (this.currentTask && this.status === 'working') {
      this.logger.info('Waiting for current task to complete...', {
        taskId: this.currentTask.id
      })
      await this.waitForTaskCompletion(30000)
    }

    // 子类自定义断开前清理（如 MCP）
    await this.beforeDisconnect()

    // 断开连接
    await this.wsClient.disconnect()

    this.status = 'shutdown'
    this.emit('stopped')

    this.logger.info('Agent Runtime stopped')
  }

  // 暂停 Agent
  async pause(): Promise<void> {
    if (this.status !== 'working') {
      this.status = 'paused'
      this.emit('paused')
      this.logger.info('Agent paused')
    }
  }

  // 恢复 Agent
  async resume(): Promise<void> {
    if (this.status === 'paused') {
      this.status = 'idle'
      this.emit('resumed')
      this.logger.info('Agent resumed')
    }
  }

  // 执行命令
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
      default:
        await this.handleCustomCommand(command)
    }
  }

  // 获取当前状态
  getStatus(): AgentStatus {
    return this.status
  }

  getCurrentTask(): Task | null {
    return this.currentTask
  }

  getConfig(): TConfig {
    return this.config
  }

  // 抽象方法 - 子类必须实现
  protected abstract getRuntimeName(): string
  protected abstract getAvailableTools(): string[]
  protected abstract getRegisterCapabilities(): string[]
  protected abstract handleRunTask(task: Task): Promise<void>
  protected abstract handleCancelTask(): Promise<void>
  protected abstract getExecutorManager(): EventEmitter

  // 可重写钩子
  protected getRegisterExtraFields(): Record<string, unknown> {
    return {}
  }

  protected getHeartbeatExtraFields(): Record<string, unknown> {
    return {}
  }

  protected async afterStart(): Promise<void> {}
  protected async beforeDisconnect(): Promise<void> {}

  protected async handleCustomCommand(command: Command): Promise<void> {
    this.logger.warn('Unknown command type', { type: command.type })
  }

  // 私有方法：设置事件处理器（WebSocket 基础部分）
  private setupEventHandlers(): void {
    // WebSocket 消息处理
    this.wsClient.on('message', (message) => {
      this.handleWebSocketMessage(message)
    })

    // 连接断开处理
    this.wsClient.on('disconnected', () => {
      this.logger.warn('Disconnected from supervisor, attempting to reconnect...')
      this.emit('disconnected')
    })
  }

  // 私有方法：注册 Agent
  private async register(): Promise<void> {
    await this.wsClient.send('agent:register', {
      id: this.config.id,
      name: this.config.name,
      role: this.config.role,
      capabilities: this.getRegisterCapabilities(),
      status: this.status,
      tools: this.getAvailableTools(),
      ...this.getRegisterExtraFields()
    })
    this.logger.info('Agent registered with supervisor')
  }

  // 私有方法：开始心跳
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(async () => {
      if (this.isShuttingDown) return

      try {
        const usage = process.memoryUsage()

        await this.wsClient.send('agent:heartbeat', {
          agentId: this.config.id,
          status: this.status,
          currentTask: this.currentTask?.id,
          progress: this.currentTask?.progress,
          memory: Math.round(usage.heapUsed / 1024 / 1024), // MB
          cpu: 0, // TODO: 获取 CPU 使用率
          ...this.getHeartbeatExtraFields()
        })
      } catch (error) {
        this.logger.error('Failed to send heartbeat', { error })
      }
    }, this.config.heartbeatInterval)
  }

  // 私有方法：处理 WebSocket 消息
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

  // 保护方法：等待任务完成（子类 stop 中复用）
  protected async waitForTaskCompletion(timeout: number): Promise<void> {
    const startTime = Date.now()

    while (this.currentTask && Date.now() - startTime < timeout) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }
}

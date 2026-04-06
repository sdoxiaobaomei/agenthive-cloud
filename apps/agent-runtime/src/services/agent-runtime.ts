// Agent Runtime - 核心运行时服务
import { EventEmitter } from 'events'
import type { AgentConfig, AgentStatus, Task, Command, LogEntry } from '../types/index.js'
import { WebSocketClient } from './websocket-client.js'
import { TaskExecutorManager } from './task-executor.js'
import { FileSystemService } from './filesystem.js'
import { Logger } from '../utils/logger.js'

export class AgentRuntime extends EventEmitter {
  private config: AgentConfig
  private wsClient: WebSocketClient
  private executorManager: TaskExecutorManager
  private fileSystem: FileSystemService
  private logger: Logger
  
  private status: AgentStatus = 'idle'
  private currentTask: Task | null = null
  private heartbeatTimer: NodeJS.Timeout | null = null
  private isShuttingDown = false

  constructor(config: AgentConfig) {
    super()
    this.config = config
    this.logger = new Logger(config.id)
    this.wsClient = new WebSocketClient(config.supervisorUrl, config.id)
    this.executorManager = new TaskExecutorManager()
    this.fileSystem = new FileSystemService(config.workspacePath)
    
    this.setupEventHandlers()
  }

  // 启动 Agent Runtime
  async start(): Promise<void> {
    this.logger.info('Starting Agent Runtime...', { 
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
      
      this.logger.info('Agent Runtime started successfully')
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
      // 等待任务完成或超时
      await this.waitForTaskCompletion(30000)
    }

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
        this.logger.warn('Unknown command type', { type: command.type })
    }
  }

  // 获取当前状态
  getStatus(): AgentStatus {
    return this.status
  }

  getCurrentTask(): Task | null {
    return this.currentTask
  }

  getConfig(): AgentConfig {
    return this.config
  }

  // 私有方法：设置事件处理器
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

    // 任务执行器事件
    this.executorManager.on('progress', (data) => {
      this.wsClient.send('task:progress', {
        taskId: data.taskId,
        progress: data.progress,
        message: data.message
      })
    })

    this.executorManager.on('log', (data) => {
      this.wsClient.send('log:output', {
        agentId: this.config.id,
        taskId: data.taskId,
        data: data.message,
        isError: data.isError
      })
    })
  }

  // 私有方法：注册 Agent
  private async register(): Promise<void> {
    await this.wsClient.send('agent:register', {
      id: this.config.id,
      name: this.config.name,
      role: this.config.role,
      capabilities: this.config.capabilities,
      status: this.status
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
          cpu: 0 // TODO: 获取 CPU 使用率
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

  // 私有方法：处理任务执行
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
      // 创建执行上下文
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

      // 执行任务
      const result = await this.executorManager.execute(task, context)

      // 发送任务完成消息
      await this.wsClient.send('task:completed', {
        taskId: task.id,
        status: result.success ? 'completed' : 'failed',
        output: result.output,
        logs: result.logs
      })

      this.logger.info('Task execution completed', { 
        taskId: task.id, 
        success: result.success 
      })
      
      this.emit('task:completed', { task, result })
    } catch (error) {
      this.logger.error('Task execution failed', { taskId: task.id, error })
      
      await this.wsClient.send('task:completed', {
        taskId: task.id,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      
      this.emit('task:failed', { task, error })
    } finally {
      this.currentTask = null
      this.status = 'idle'
    }
  }

  // 私有方法：处理任务取消
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

  // 私有方法：等待任务完成
  private async waitForTaskCompletion(timeout: number): Promise<void> {
    const startTime = Date.now()
    
    while (this.currentTask && Date.now() - startTime < timeout) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }
}

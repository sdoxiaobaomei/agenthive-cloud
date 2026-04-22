// Agent Runtime - 核心运行时服务 (V1)
import { BaseAgentRuntime } from './BaseAgentRuntime.js'
import type { AgentConfig, Task } from '../types/index.js'
import { TaskExecutorManager } from './task-executor.js'

export class AgentRuntime extends BaseAgentRuntime {
  private executorManager: TaskExecutorManager

  constructor(config: AgentConfig) {
    super(config)
    this.executorManager = new TaskExecutorManager()
    this.setupExecutorEventHandlers()
  }

  protected getRuntimeName(): string {
    return 'Agent Runtime'
  }

  protected getAvailableTools(): string[] {
    return []
  }

  protected getRegisterCapabilities(): string[] {
    return this.config.capabilities
  }

  protected getExecutorManager(): TaskExecutorManager {
    return this.executorManager
  }

  private setupExecutorEventHandlers(): void {
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
}

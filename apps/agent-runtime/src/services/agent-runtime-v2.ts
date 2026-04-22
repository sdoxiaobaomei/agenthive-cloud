// Agent Runtime V2 - 使用新的工具系统
import { BaseAgentRuntime } from './BaseAgentRuntime.js'
import type { AgentConfig, Task, Command } from '../types/index.js'
import { TaskExecutorManagerV2 } from './task-executor-v2.js'
import { getMCPManager } from '../mcp/index.js'

export class AgentRuntimeV2 extends BaseAgentRuntime {
  private executorManager: TaskExecutorManagerV2
  private mcpManager = getMCPManager()

  constructor(config: AgentConfig) {
    super(config)
    this.executorManager = new TaskExecutorManagerV2()
    this.setupExecutorEventHandlers()
  }

  protected getRuntimeName(): string {
    return 'Agent Runtime V2'
  }

  getAvailableTools(): string[] {
    return this.executorManager.getAvailableTools()
  }

  protected getRegisterCapabilities(): string[] {
    return this.config.capabilities
  }

  protected getHeartbeatExtraFields(): Record<string, unknown> {
    return {
      tools: this.executorManager.getAvailableTools()
    }
  }

  protected getExecutorManager(): TaskExecutorManagerV2 {
    return this.executorManager
  }

  protected async afterStart(): Promise<void> {
    this.logger.info(`Available tools: ${this.executorManager.getAvailableTools().join(', ')}`)
  }

  protected async beforeDisconnect(): Promise<void> {
    await this.mcpManager.disconnectAll()
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
        await super.handleCustomCommand(command)
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

  // 私有方法：处理添加 MCP 服务器
  private async handleAddMCP(payload: { name: string; command: string; args?: string[] }): Promise<void> {
    try {
      await this.mcpManager.addClient({
        name: payload.name,
        command: payload.command,
        args: payload.args
      })

      this.logger.info(`MCP server added: ${payload.name}`)

      await this.wsClient.send('log:output', {
        agentId: this.config.id,
        data: `MCP server connected: ${payload.name}`,
        isError: false
      })
    } catch (error) {
      this.logger.error(`Failed to add MCP server: ${payload.name}`, { error })

      await this.wsClient.send('log:output', {
        agentId: this.config.id,
        data: `Failed to connect MCP server: ${error instanceof Error ? error.message : 'Unknown error'}`,
        isError: true
      })
    }
  }

  // 私有方法：设置权限模式
  private async handleSetPermissionMode(payload: { mode: string }): Promise<void> {
    const validModes = ['default', 'auto', 'strict', 'plan']

    if (!validModes.includes(payload.mode)) {
      this.logger.error(`Invalid permission mode: ${payload.mode}`)
      return
    }

    this.executorManager.getPermissionManager().setMode(payload.mode as any)
    this.logger.info(`Permission mode set to: ${payload.mode}`)
  }

  // 私有方法：列出可用工具
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

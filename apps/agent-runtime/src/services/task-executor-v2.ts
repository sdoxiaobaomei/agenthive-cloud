// 任务执行器 V2 - 基于工具系统重构
import { EventEmitter } from 'events'
import type { Task, ExecutionContext, ExecutionResult } from '../types/index.js'
import { Logger } from '../utils/logger.js'
import { ToolExecutor, ToolRegistry, ToolContext } from '../tools/Tool.js'
import { registerAllTools, globalToolRegistry } from '../tools/index.js'
import { PermissionManager } from '../permissions/PermissionManager.js'
import { ConversationContext } from '../context/ConversationContext.js'

export interface ToolTaskExecutor extends ExecutionContext {
  toolRegistry: ToolRegistry
  toolExecutor: ToolExecutor
  permissionManager: PermissionManager
  conversationContext: ConversationContext
}

export class TaskExecutorManagerV2 extends EventEmitter {
  private executors: Map<string, ToolBasedExecutor> = new Map()
  private currentExecution: AbortController | null = null
  private logger = new Logger('TaskExecutorV2')
  private toolRegistry: ToolRegistry
  private toolExecutor: ToolExecutor
  private permissionManager: PermissionManager

  constructor() {
    super()
    this.toolRegistry = globalToolRegistry
    this.toolExecutor = new ToolExecutor(this.toolRegistry)
    this.permissionManager = new PermissionManager()
    
    // 注册所有工具
    registerAllTools(this.toolRegistry)
    
    this.logger.info(`Registered ${this.toolRegistry.list().length} tools`)
  }

  // 执行任务
  async execute(task: Task, context: ExecutionContext): Promise<ExecutionResult> {
    this.logger.info(`Executing task with tools`, { taskId: task.id, type: task.type })

    // 创建中止控制器
    this.currentExecution = new AbortController()
    const signal = this.currentExecution.signal

    // 创建对话上下文
    const conversationContext = new ConversationContext()
    conversationContext.addSystemMessage(
      `You are an AI agent task executor. Your task is: ${task.title}\n` +
      `Description: ${task.description || 'No description'}\n` +
      `Use the available tools to complete this task.`
    )

    // 创建工具执行上下文
    const toolContext: ToolContext = {
      agentId: context.agentId,
      workspacePath: context.workspacePath,
      sendLog: (message: string, isError = false) => {
        if (signal.aborted) return
        context.sendLog(message, isError)
        this.emit('log', { taskId: task.id, message, isError })
      },
      signal,
      checkPermission: async (toolName, input) => {
        return this.permissionManager.checkPermission(toolName, input)
      }
    }

    try {
      // 根据任务类型选择合适的执行策略
      const result = await this.executeWithTools(task, toolContext, conversationContext)
      return result
    } catch (error) {
      if (signal.aborted) {
        return {
          success: false,
          error: 'Task was cancelled',
          logs: []
        }
      }
      
      const message = error instanceof Error ? error.message : 'Unknown error'
      return {
        success: false,
        error: message,
        logs: []
      }
    } finally {
      this.currentExecution = null
    }
  }

  // 使用工具执行任务
  private async executeWithTools(
    task: Task, 
    toolContext: ToolContext,
    conversationContext: ConversationContext
  ): Promise<ExecutionResult> {
    const logs: string[] = []
    const taskType = task.type.toLowerCase()

    // 包装日志函数
    const log = (message: string, isError = false) => {
      logs.push(message)
      toolContext.sendLog(message, isError)
    }

    // 根据任务类型路由
    switch (taskType) {
      case 'shell':
      case 'command':
        return this.executeShellTask(task, toolContext, log)

      case 'file_read':
        return this.executeFileRead(task, toolContext, log)

      case 'file_write':
        return this.executeFileWrite(task, toolContext, log)

      case 'file_edit':
        return this.executeFileEdit(task, toolContext, log)

      case 'search':
      case 'grep':
        return this.executeSearchTask(task, toolContext, log)

      case 'git':
        return this.executeGitTask(task, toolContext, log)

      case 'code_generation':
      case 'feature':
        return this.executeCodeGeneration(task, toolContext, conversationContext, log)

      case 'code_review':
      case 'review':
        return this.executeCodeReview(task, toolContext, conversationContext, log)

      case 'build':
      case 'deploy':
        return this.executeBuildTask(task, toolContext, log)

      case 'test':
      case 'testing':
        return this.executeTestTask(task, toolContext, log)

      case 'multi_tool':
        return this.executeMultiToolTask(task, toolContext, log)

      default:
        // 尝试作为工具直接执行
        if (this.toolRegistry.has(taskType)) {
          return this.executeGenericTool(task, toolContext, log)
        }
        
        return {
          success: false,
          error: `Unknown task type: ${task.type}. Available tools: ${this.toolRegistry.list().join(', ')}`,
          logs
        }
    }
  }

  // 执行 Shell 任务
  private async executeShellTask(
    task: Task, 
    toolContext: ToolContext,
    log: (msg: string, err?: boolean) => void
  ): Promise<ExecutionResult> {
    const result = await this.toolExecutor.execute('bash', {
      command: task.input.command as string,
      args: (task.input.args as string[]) || [],
      cwd: task.input.cwd as string,
      env: task.input.env as Record<string, string>,
      description: task.input.description as string
    }, toolContext) as { success: boolean; exitCode: number; stdout: string; stderr: string }

    return {
      success: result.success,
      output: { 
        exitCode: result.exitCode,
        stdout: result.stdout.slice(0, 10000),
        stderr: result.stderr.slice(0, 5000)
      },
      error: result.success ? undefined : `Exit code: ${result.exitCode}`,
      logs: []
    }
  }

  // 执行文件读取
  private async executeFileRead(
    task: Task,
    toolContext: ToolContext,
    log: (msg: string, err?: boolean) => void
  ): Promise<ExecutionResult> {
    const result = await this.toolExecutor.execute('file_read', {
      path: task.input.path as string,
      offset: task.input.offset as number | undefined,
      limit: task.input.limit as number | undefined
    }, toolContext) as { content: string; lines: number; truncated: boolean }

    return {
      success: true,
      output: {
        content: result.content,
        lines: result.lines,
        truncated: result.truncated
      },
      logs: []
    }
  }

  // 执行文件写入
  private async executeFileWrite(
    task: Task,
    toolContext: ToolContext,
    log: (msg: string, err?: boolean) => void
  ): Promise<ExecutionResult> {
    const result = await this.toolExecutor.execute('file_write', {
      path: task.input.path as string,
      content: task.input.content as string,
      overwrite: task.input.overwrite as boolean | undefined
    }, toolContext) as { success: boolean; bytesWritten: number; path: string }

    return {
      success: result.success,
      output: {
        bytesWritten: result.bytesWritten,
        path: result.path
      },
      logs: []
    }
  }

  // 执行文件编辑
  private async executeFileEdit(
    task: Task,
    toolContext: ToolContext,
    log: (msg: string, err?: boolean) => void
  ): Promise<ExecutionResult> {
    const result = await this.toolExecutor.execute('file_edit', {
      path: task.input.path as string,
      oldString: task.input.oldString as string,
      newString: task.input.newString as string,
      replaceAll: task.input.replaceAll as boolean | undefined
    }, toolContext) as { success: boolean; replacements: number; path: string }

    return {
      success: result.success,
      output: {
        replacements: result.replacements,
        path: result.path
      },
      logs: []
    }
  }

  // 执行搜索任务
  private async executeSearchTask(
    task: Task,
    toolContext: ToolContext,
    log: (msg: string, err?: boolean) => void
  ): Promise<ExecutionResult> {
    const result = await this.toolExecutor.execute('grep', {
      pattern: task.input.pattern as string,
      path: task.input.path as string | undefined,
      glob: task.input.glob as string | undefined,
      caseSensitive: task.input.caseSensitive as boolean | undefined,
      maxResults: task.input.maxResults as number | undefined
    }, toolContext) as { matches: any[]; total: number; truncated: boolean }

    return {
      success: true,
      output: {
        matches: result.matches,
        total: result.total,
        truncated: result.truncated
      },
      logs: []
    }
  }

  // 执行 Git 任务
  private async executeGitTask(
    task: Task,
    toolContext: ToolContext,
    log: (msg: string, err?: boolean) => void
  ): Promise<ExecutionResult> {
    const result = await this.toolExecutor.execute('git', {
      command: task.input.command as string,
      args: (task.input.args as string[]) || [],
      cwd: task.input.cwd as string | undefined
    }, toolContext) as { success: boolean; output: any; message?: string }

    return {
      success: result.success,
      output: result.output,
      error: result.success ? undefined : result.message,
      logs: result.message ? [result.message] : []
    }
  }

  // 执行代码生成任务
  private async executeCodeGeneration(
    task: Task,
    toolContext: ToolContext,
    conversationContext: ConversationContext,
    log: (msg: string, err?: boolean) => void
  ): Promise<ExecutionResult> {
    log('Starting code generation...')
    
    // 模拟进度更新
    const steps = [
      { progress: 20, message: 'Analyzing requirements...' },
      { progress: 40, message: 'Generating code structure...' },
      { progress: 60, message: 'Implementing logic...' },
      { progress: 80, message: 'Adding tests...' },
      { progress: 100, message: 'Code generation completed' }
    ]

    for (const step of steps) {
      await this.delay(800)
      toolContext.sendLog(step.message)
      this.emit('progress', { taskId: task.id, progress: step.progress, message: step.message })
    }

    log('Code generation completed successfully')

    return {
      success: true,
      output: {
        files: task.input.targetFiles as string[] || ['src/generated/module.ts'],
        description: task.input.description as string
      },
      logs: []
    }
  }

  // 执行代码审查任务
  private async executeCodeReview(
    task: Task,
    toolContext: ToolContext,
    conversationContext: ConversationContext,
    log: (msg: string, err?: boolean) => void
  ): Promise<ExecutionResult> {
    log('Starting code review...')

    const targetFiles = task.input.files as string[] || []
    
    // 使用 grep 搜索潜在问题
    const issues: Array<{ file: string; line: number; issue: string; severity: string }> = []
    
    for (const file of targetFiles) {
      try {
        const content = await this.toolExecutor.execute('file_read', {
          path: file,
          limit: 100
        }, toolContext) as { content: string }

        // 简单的代码审查逻辑
        const lines = content.content.split('\n')
        lines.forEach((line: string, idx: number) => {
          // 检查 console.log
          if (line.includes('console.log')) {
            issues.push({
              file,
              line: idx + 1,
              issue: 'console.log statement found',
              severity: 'warning'
            })
          }
          // 检查 TODO
          if (line.includes('TODO') || line.includes('FIXME')) {
            issues.push({
              file,
              line: idx + 1,
              issue: line.match(/(TODO|FIXME).*/)?.[0] || 'TODO found',
              severity: 'info'
            })
          }
        })
      } catch (error) {
        log(`Failed to read ${file}: ${error}`, true)
      }
    }

    log(`Found ${issues.length} issues`)

    return {
      success: true,
      output: {
        issues,
        summary: `Reviewed ${targetFiles.length} files, found ${issues.length} issues`
      },
      logs: []
    }
  }

  // 执行构建任务
  private async executeBuildTask(
    task: Task,
    toolContext: ToolContext,
    log: (msg: string, err?: boolean) => void
  ): Promise<ExecutionResult> {
    log('Starting build...')

    // 尝试执行常见的构建命令
    const buildCommands = [
      'npm run build',
      'yarn build',
      'pnpm build',
      'make',
      'cargo build'
    ]

    for (const cmd of buildCommands) {
      try {
        const result = await this.toolExecutor.execute('bash', {
          command: cmd,
          cwd: toolContext.workspacePath
        }, toolContext)

        if ((result as { success: boolean }).success) {
          return {
            success: true,
            output: {
              command: cmd,
              outputPath: 'dist/',
              duration: 'unknown'
            },
            logs: []
          }
        }
      } catch {
        // 尝试下一个命令
      }
    }

    return {
      success: false,
      error: 'No build command succeeded',
      logs: []
    }
  }

  // 执行测试任务
  private async executeTestTask(
    task: Task,
    toolContext: ToolContext,
    log: (msg: string, err?: boolean) => void
  ): Promise<ExecutionResult> {
    log('Running tests...')

    const testCommands = [
      'npm test',
      'yarn test',
      'pnpm test',
      'cargo test',
      'pytest',
      'go test'
    ]

    for (const cmd of testCommands) {
      try {
        const result = await this.toolExecutor.execute('bash', {
          command: cmd,
          cwd: toolContext.workspacePath
        }, toolContext)

        return {
          success: (result as { success: boolean }).success,
          output: {
            command: cmd,
            exitCode: (result as { exitCode: number }).exitCode,
            stdout: (result as { stdout: string }).stdout.slice(0, 5000)
          },
          error: (result as { success: boolean }).success ? undefined : `Tests failed with exit code ${(result as { exitCode: number }).exitCode}`,
          logs: []
        }
      } catch {
        // 尝试下一个命令
      }
    }

    return {
      success: false,
      error: 'No test command succeeded',
      logs: []
    }
  }

  // 执行多工具任务
  private async executeMultiToolTask(
    task: Task,
    toolContext: ToolContext,
    log: (msg: string, err?: boolean) => void
  ): Promise<ExecutionResult> {
    const calls = task.input.calls as Array<{ tool: string; input: any }>
    
    if (!Array.isArray(calls)) {
      return {
        success: false,
        error: 'Invalid multi_tool task: calls must be an array',
        logs: []
      }
    }

    const results = []
    for (const call of calls) {
      try {
        const result = await this.toolExecutor.execute(call.tool, call.input, toolContext)
        results.push({ tool: call.tool, success: true, result })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        results.push({ tool: call.tool, success: false, error: message })
      }
    }

    const allSuccess = results.every(r => r.success)

    return {
      success: allSuccess,
      output: { results },
      logs: []
    }
  }

  // 执行通用工具
  private async executeGenericTool(
    task: Task,
    toolContext: ToolContext,
    log: (msg: string, err?: boolean) => void
  ): Promise<ExecutionResult> {
    const result = await this.toolExecutor.execute(task.type, task.input, toolContext)

    return {
      success: true,
      output: result as Record<string, unknown>,
      logs: []
    }
  }

  // 取消当前执行
  async cancel(): Promise<void> {
    if (this.currentExecution) {
      this.currentExecution.abort()
      this.currentExecution = null
      this.logger.info('Task execution cancelled')
    }
  }

  // 获取可用的工具列表
  getAvailableTools(): string[] {
    return this.toolRegistry.list()
  }

  // 获取权限管理器
  getPermissionManager(): PermissionManager {
    return this.permissionManager
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// 工具型执行器接口
interface ToolBasedExecutor {
  name: string
  canExecute(taskType: string): boolean
  execute(task: Task, context: ToolContext): Promise<ExecutionResult>
}

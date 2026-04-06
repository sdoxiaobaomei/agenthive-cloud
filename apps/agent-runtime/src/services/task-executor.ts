// 任务执行器管理
import { EventEmitter } from 'events'
import type { Task, TaskExecutor, ExecutionContext, ExecutionResult } from '../types/index.js'
import { Logger } from '../utils/logger.js'

export class TaskExecutorManager extends EventEmitter {
  private executors: TaskExecutor[] = []
  private currentExecution: AbortController | null = null
  private logger = new Logger('TaskExecutorManager')

  constructor() {
    super()
    this.registerDefaultExecutors()
  }

  // 注册执行器
  registerExecutor(executor: TaskExecutor): void {
    this.executors.push(executor)
    this.logger.info(`Registered executor: ${executor.name}`)
  }

  // 执行任务
  async execute(task: Task, context: ExecutionContext): Promise<ExecutionResult> {
    const executor = this.findExecutor(task.type)
    
    if (!executor) {
      return {
        success: false,
        error: `No executor found for task type: ${task.type}`,
        logs: []
      }
    }

    this.logger.info(`Executing task with ${executor.name}`, { taskId: task.id })

    // 创建中止控制器
    this.currentExecution = new AbortController()
    const signal = this.currentExecution.signal

    try {
      // 包装执行上下文，添加中止信号检查
      const wrappedContext: ExecutionContext = {
        ...context,
        sendLog: (message: string, isError = false) => {
          if (signal.aborted) return
          context.sendLog(message, isError)
          this.emit('log', { taskId: task.id, message, isError })
        },
        updateProgress: (progress: number, message?: string) => {
          if (signal.aborted) return
          context.updateProgress(progress, message)
          this.emit('progress', { taskId: task.id, progress, message })
        }
      }

      const result = await executor.execute(task, wrappedContext)
      return result
    } catch (error) {
      if (signal.aborted) {
        return {
          success: false,
          error: 'Task was cancelled',
          logs: []
        }
      }
      
      throw error
    } finally {
      this.currentExecution = null
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

  // 查找执行器
  private findExecutor(taskType: string): TaskExecutor | undefined {
    return this.executors.find(e => e.canExecute(taskType))
  }

  // 注册默认执行器
  private registerDefaultExecutors(): void {
    // Shell 命令执行器
    this.registerExecutor(new ShellExecutor())
    
    // 代码生成执行器
    this.registerExecutor(new CodeGenerationExecutor())
    
    // 代码审查执行器
    this.registerExecutor(new CodeReviewExecutor())
    
    // 测试执行器
    this.registerExecutor(new TestExecutor())
    
    // 构建执行器
    this.registerExecutor(new BuildExecutor())
  }
}

// Shell 命令执行器
class ShellExecutor implements TaskExecutor {
  name = 'ShellExecutor'
  
  canExecute(taskType: string): boolean {
    return taskType === 'shell' || taskType === 'command'
  }
  
  async execute(task: Task, context: ExecutionContext): Promise<ExecutionResult> {
    const { spawn } = await import('child_process')
    const logs: string[] = []
    
    return new Promise((resolve) => {
      const command = task.input.command as string
      const args = (task.input.args as string[]) || []
      const cwd = task.input.cwd as string || context.workspacePath
      
      context.sendLog(`Executing: ${command} ${args.join(' ')}`)
      
      const child = spawn(command, args, {
        cwd,
        shell: true,
        env: { ...process.env, ...task.input.env as Record<string, string> }
      })
      
      child.stdout.on('data', (data: Buffer) => {
        const message = data.toString()
        logs.push(message)
        context.sendLog(message)
      })
      
      child.stderr.on('data', (data: Buffer) => {
        const message = data.toString()
        logs.push(message)
        context.sendLog(message, true)
      })
      
      child.on('close', (code: number) => {
        resolve({
          success: code === 0,
          output: { exitCode: code },
          error: code !== 0 ? `Command failed with exit code ${code}` : undefined,
          logs
        })
      })
      
      child.on('error', (error: Error) => {
        resolve({
          success: false,
          error: error.message,
          logs
        })
      })
    })
  }
}

// 代码生成执行器
class CodeGenerationExecutor implements TaskExecutor {
  name = 'CodeGenerationExecutor'
  
  canExecute(taskType: string): boolean {
    return taskType === 'code_generation' || taskType === 'feature'
  }
  
  async execute(task: Task, context: ExecutionContext): Promise<ExecutionResult> {
    const logs: string[] = []
    
    context.sendLog('Starting code generation...')
    logs.push('Starting code generation...')
    
    // 模拟代码生成过程
    await this.delay(1000)
    context.updateProgress(20, 'Analyzing requirements...')
    
    await this.delay(1000)
    context.updateProgress(40, 'Generating code structure...')
    
    await this.delay(1000)
    context.updateProgress(60, 'Implementing logic...')
    
    await this.delay(1000)
    context.updateProgress(80, 'Adding tests...')
    
    await this.delay(1000)
    context.updateProgress(100, 'Code generation completed')
    
    context.sendLog('Code generation completed successfully')
    logs.push('Code generation completed successfully')
    
    return {
      success: true,
      output: {
        files: [
          'src/generated/module.ts',
          'tests/generated/module.test.ts'
        ]
      },
      logs
    }
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// 代码审查执行器
class CodeReviewExecutor implements TaskExecutor {
  name = 'CodeReviewExecutor'
  
  canExecute(taskType: string): boolean {
    return taskType === 'code_review' || taskType === 'review'
  }
  
  async execute(task: Task, context: ExecutionContext): Promise<ExecutionResult> {
    const logs: string[] = []
    
    context.sendLog('Starting code review...')
    logs.push('Starting code review...')
    
    // 模拟代码审查
    context.updateProgress(30, 'Analyzing code style...')
    await this.delay(800)
    
    context.updateProgress(60, 'Checking for bugs...')
    await this.delay(800)
    
    context.updateProgress(90, 'Generating review comments...')
    await this.delay(800)
    
    context.sendLog('Code review completed')
    logs.push('Code review completed')
    
    return {
      success: true,
      output: {
        issues: [],
        suggestions: ['Consider adding more comments']
      },
      logs
    }
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// 测试执行器
class TestExecutor implements TaskExecutor {
  name = 'TestExecutor'
  
  canExecute(taskType: string): boolean {
    return taskType === 'test' || taskType === 'testing'
  }
  
  async execute(task: Task, context: ExecutionContext): Promise<ExecutionResult> {
    const logs: string[] = []
    
    context.sendLog('Running tests...')
    logs.push('Running tests...')
    
    // 模拟测试执行
    context.updateProgress(50, 'Running unit tests...')
    await this.delay(2000)
    
    context.updateProgress(100, 'All tests passed')
    
    context.sendLog('Test execution completed')
    logs.push('Test execution completed')
    
    return {
      success: true,
      output: {
        passed: 42,
        failed: 0,
        skipped: 3
      },
      logs
    }
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// 构建执行器
class BuildExecutor implements TaskExecutor {
  name = 'BuildExecutor'
  
  canExecute(taskType: string): boolean {
    return taskType === 'build' || taskType === 'deploy'
  }
  
  async execute(task: Task, context: ExecutionContext): Promise<ExecutionResult> {
    const logs: string[] = []
    
    context.sendLog('Starting build...')
    logs.push('Starting build...')
    
    // 模拟构建过程
    context.updateProgress(25, 'Installing dependencies...')
    await this.delay(1500)
    
    context.updateProgress(50, 'Compiling...')
    await this.delay(1500)
    
    context.updateProgress(75, 'Bundling...')
    await this.delay(1500)
    
    context.updateProgress(100, 'Build completed')
    
    context.sendLog('Build completed successfully')
    logs.push('Build completed successfully')
    
    return {
      success: true,
      output: {
        outputPath: 'dist/',
        size: '2.5MB'
      },
      logs
    }
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

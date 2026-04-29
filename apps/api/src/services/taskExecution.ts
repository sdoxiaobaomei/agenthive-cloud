// Task Execution Service - 使用真实 LLM 调用
import { broadcast } from '../websocket/hub.js'
import { mkdir, writeFile, readFile } from 'fs/promises'
import { resolve, join } from 'path'
import { getLLMService } from './llm.js'
import { debitCredits, type DebitPayload } from './credits.js'
import { enqueueBillingRetry } from './billingRetry.js'
import logger from '../utils/logger.js'

// 任务执行配置
export interface TaskExecutionConfig {
  maxIterations?: number
  maxConcurrentTasks?: number
  workspaceBasePath: string
  timeoutMs?: number
}

// 任务信息
export interface TaskInfo {
  id: string
  title: string
  description?: string
  type: string
  userId: string
  projectId?: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  progress: number
  createdAt: Date
  startedAt?: Date
  completedAt?: Date
  result?: any
  error?: string
  input?: any
}

// 全局配置
const DEFAULT_CONFIG: Partial<TaskExecutionConfig> = {
  maxIterations: 50,
  maxConcurrentTasks: 3,
  timeoutMs: 10 * 60 * 1000,
}

export class TaskExecutionService {
  private config: TaskExecutionConfig
  private runningTasks: Map<string, AbortController> = new Map()
  private taskResults: Map<string, TaskInfo> = new Map()

  constructor(config: TaskExecutionConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    logger.info('[TaskExecution] Service initialized with LLM support')
  }

  // 获取工作区路径
  private getWorkspacePath(userId: string, projectId?: string): string {
    const base = this.config.workspaceBasePath
    if (projectId) {
      return resolve(base, userId, projectId)
    }
    return resolve(base, userId, 'default')
  }

  // 确保工作区目录存在
  private async ensureWorkspace(workspacePath: string): Promise<void> {
    await mkdir(workspacePath, { recursive: true })
  }

  // 执行任务
  async execute(task: TaskInfo): Promise<TaskInfo> {
    // 检查并发限制
    if (this.runningTasks.size >= (this.config.maxConcurrentTasks || 3)) {
      throw new Error('Too many concurrent tasks, please try again later')
    }

    // 检查是否已在运行
    if (this.runningTasks.has(task.id)) {
      throw new Error('Task is already running')
    }

    // 创建工作区
    const workspacePath = this.getWorkspacePath(task.userId, task.projectId)
    await this.ensureWorkspace(workspacePath)

    // 创建 AbortController 用于取消
    const abortController = new AbortController()
    this.runningTasks.set(task.id, abortController)

    // 更新任务状态
    task.status = 'running'
    task.startedAt = new Date()
    task.progress = 0
    this.taskResults.set(task.id, task)

    // 广播状态更新
    broadcast.taskProgress(task.id, 0, { status: 'running' })

    try {
      // 使用真实 LLM 执行任务
      const result = await this.executeWithLLM(task, workspacePath, abortController.signal)

      // 更新任务结果
      task.status = result.code === 200 ? 'completed' : 'failed'
      task.result = result
      task.completedAt = new Date()
      task.progress = 100

      // 广播完成
      broadcast.taskProgress(task.id, 100, {
        status: task.status,
        result: result.code === 200 ? 'success' : 'failed',
        output: result.data,
      })

      // 任务完成后扣费
      await this.chargeForTask(task, result.data?.usage)

      logger.info('[TaskExecution] Task completed', { taskId: task.id, status: task.status })

      return task

    } catch (error) {
      // 更新失败状态
      task.status = 'failed'
      task.error = error instanceof Error ? error.message : 'Unknown error'
      task.completedAt = new Date()

      // 广播失败
      broadcast.taskProgress(task.id, task.progress, {
        status: 'failed',
        error: task.error,
      })

      logger.error('[TaskExecution] Task failed', error as Error, { taskId: task.id })
      
      return task

    } finally {
      // 清理
      this.runningTasks.delete(task.id)
    }
  }

  // 使用 LLM 执行任务
  private async executeWithLLM(
    task: TaskInfo, 
    workspacePath: string,
    signal: AbortSignal
  ): Promise<{ code: number; message: string; data?: any }> {
    
    try {
      // 获取 LLM 服务
      const llmService = getLLMService()
      
      // 构建系统提示词
      const systemPrompt = this.getSystemPrompt(task.type, workspacePath)
      
      // 构建用户提示词
      const userPrompt = this.buildUserPrompt(task, workspacePath)
      
      // 构建消息
      const messages = [
        { role: 'system' as const, content: systemPrompt },
        { role: 'user' as const, content: userPrompt }
      ]

      // 更新进度
      task.progress = 10
      broadcast.taskProgress(task.id, 10, { step: 'calling llm' })

      // 流式调用 LLM
      let fullContent = ''
      let usage: any = null
      
      for await (const chunk of llmService.stream(messages)) {
        // 检查是否被取消
        if (signal.aborted) {
          throw new Error('Task cancelled')
        }
        
        if (chunk.content) {
          fullContent += chunk.content
        }
        
        if (chunk.usage) {
          usage = chunk.usage
        }
        
        // 更新进度（模拟）
        if (task.progress < 80) {
          task.progress += 5
          broadcast.taskProgress(task.id, task.progress, { 
            step: 'generating',
            contentLength: fullContent.length 
          })
        }
      }

      task.progress = 90
      broadcast.taskProgress(task.id, 90, { step: 'processing result' })

      // 将结果保存到工作区
      const resultPath = join(workspacePath, 'task-results', `${task.id}.md`)
      await mkdir(join(workspacePath, 'task-results'), { recursive: true })
      await writeFile(resultPath, fullContent, 'utf-8')

      return {
        code: 200,
        message: 'success',
        data: {
          content: fullContent,
          resultPath,
          workspace: workspacePath,
          type: task.type,
          usage,
        }
      }

    } catch (error) {
      logger.error('[TaskExecution] LLM execution failed', error as Error)
      return {
        code: 500,
        message: error instanceof Error ? error.message : 'LLM execution failed',
        data: null
      }
    }
  }

  // 获取系统提示词
  private getSystemPrompt(taskType: string, workspacePath: string): string {
    const basePrompt = `You are an AI assistant helping with software development tasks.
You are working in the workspace: ${workspacePath}

When analyzing code or files:
1. Read files using file paths relative to the workspace
2. Provide clear explanations of your findings
3. Suggest improvements when appropriate
4. Be concise but thorough

When generating code:
1. Use best practices for the language/framework
2. Include comments for complex logic
3. Consider error handling
4. Follow existing code style if present

Respond in a helpful, professional manner.`

    const typeSpecificPrompts: Record<string, string> = {
      code_analysis: `You are a code analysis expert. Analyze the provided codebase and provide insights on:
- Architecture and design patterns
- Code quality and potential issues
- Dependencies and relationships
- Suggestions for improvement

Format your response as markdown with clear sections.`,

      code_generation: `You are a code generation expert. Generate clean, well-documented code following best practices.
- Use meaningful variable and function names
- Add comments for complex logic
- Follow the existing code style
- Include error handling

Wrap code blocks with appropriate language tags.`,

      code_review: `You are a code reviewer. Review the code and provide:
- Issues and bugs
- Security concerns
- Performance optimizations
- Style improvements

Be constructive and specific in your feedback.`,

      refactoring: `You are a refactoring expert. Refactor the code to improve:
- Readability and maintainability
- Performance
- Testability
- Adherence to best practices

Explain the changes you made and why.`,

      documentation: `You are a technical writer. Generate documentation including:
- API documentation
- README files
- Code comments
- Usage examples

Use clear, concise language and proper formatting.`,

      shell_command: `You are a DevOps expert. Provide shell commands to accomplish tasks.
- Ensure commands are safe and well-explained
- Include error handling where appropriate
- Explain what each command does`,
    }

    return typeSpecificPrompts[taskType] || basePrompt
  }

  // 构建用户提示词
  private buildUserPrompt(task: TaskInfo, workspacePath: string): string {
    let prompt = `Task: ${task.title}\n\n`
    
    if (task.description) {
      prompt += `Description: ${task.description}\n\n`
    }
    
    prompt += `Task Type: ${task.type}\n`
    prompt += `Workspace: ${workspacePath}\n`
    
    if (task.input && Object.keys(task.input).length > 0) {
      prompt += `\nAdditional Input:\n${JSON.stringify(task.input, null, 2)}\n`
    }
    
    return prompt
  }

  // 取消任务
  async cancel(taskId: string): Promise<boolean> {
    const controller = this.runningTasks.get(taskId)
    if (!controller) {
      return false
    }

    controller.abort()
    this.runningTasks.delete(taskId)

    const task = this.taskResults.get(taskId)
    if (task) {
      task.status = 'cancelled'
      task.completedAt = new Date()
    }

    logger.info('[TaskExecution] Task cancelled', { taskId })
    return true
  }

  // 获取任务状态
  getTaskStatus(taskId: string): TaskInfo | undefined {
    return this.taskResults.get(taskId)
  }

  // 获取所有运行中的任务
  getRunningTasks(): TaskInfo[] {
    return Array.from(this.taskResults.values())
      .filter(t => t.status === 'running')
  }

  // 获取可用工具列表
  getAvailableTools(): string[] {
    return ['llm_chat', 'file_analysis', 'code_generation']
  }

  // 任务完成后扣费
  private async chargeForTask(task: TaskInfo, usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number }): Promise<void> {
    if (!task.userId) {
      logger.warn('[TaskExecution] No userId for billing', { taskId: task.id })
      return
    }

    const tokensUsed = usage?.totalTokens ?? 0
    const workerRole = this.inferWorkerRole(task.type)

    try {
      const debitResult = await debitCredits({
        userId: task.userId,
        taskId: task.id,
        workerRole,
        tokensUsed,
      })

      if (!debitResult.success) {
        logger.error('[TaskExecution] Billing failed, enqueuing retry', undefined, {
          taskId: task.id,
          error: debitResult.errorCode,
        })
        await enqueueBillingRetry({
          taskId: task.id,
          userId: task.userId,
          workerRole,
          tokensUsed,
          originalError: debitResult.errorCode || 'debit_failed',
        })
      } else {
        logger.info('[TaskExecution] Billing success', {
          taskId: task.id,
          creditsDeducted: debitResult.creditsDeducted,
          remaining: debitResult.creditsRemaining,
        })
      }
    } catch (billingError) {
      logger.error('[TaskExecution] Billing exception, enqueuing retry', billingError as Error, { taskId: task.id })
      await enqueueBillingRetry({
        taskId: task.id,
        userId: task.userId,
        workerRole,
        tokensUsed,
        originalError: billingError instanceof Error ? billingError.message : 'billing_exception',
      })
    }
  }

  private inferWorkerRole(taskType: string): string {
    if (taskType.includes('test') || taskType.includes('review') || taskType.includes('qa')) return 'qa'
    if (taskType.includes('frontend') || taskType.includes('ui') || taskType.includes('css')) return 'frontend'
    if (taskType.includes('deploy') || taskType.includes('devops') || taskType.includes('docker')) return 'devops'
    return 'backend'
  }
}

// 全局实例
let globalTaskExecutionService: TaskExecutionService | null = null

// 初始化服务
export function initializeTaskExecution(config: TaskExecutionConfig): TaskExecutionService {
  globalTaskExecutionService = new TaskExecutionService(config)
  return globalTaskExecutionService
}

// 获取服务实例
export function getTaskExecutionService(): TaskExecutionService {
  if (!globalTaskExecutionService) {
    throw new Error('TaskExecutionService not initialized. Call initializeTaskExecution first.')
  }
  return globalTaskExecutionService
}

// TaskInfo and TaskExecutionConfig are already exported as interfaces above

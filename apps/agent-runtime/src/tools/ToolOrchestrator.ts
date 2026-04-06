/**
 * Tool Orchestrator - 工具执行协调器
 * 
 * 参考 Claude Code 的 toolOrchestration.ts 实现
 * 
 * 核心优化：
 * 1. 自动分区工具调用 - 将可并发和不可并发的工具分组
 * 2. 可并发工具并行执行，提高性能
 * 3. 不可并发工具串行执行，保证安全
 * 4. 保持工具调用顺序返回结果
 * 
 * 执行策略：
 * - 读取工具（file_read, grep, glob）可并发
 * - 写入工具（file_write, file_edit, bash写操作）串行
 * - 破坏性工具（删除、覆盖）串行且需要确认
 */

import { EventEmitter } from 'events'
import { ToolRegistry, ToolCall, ToolExecutionResult, ToolContext, Tool } from './ToolEnhanced.js'
import { Logger } from '../utils/logger.js'

// ============================================================================
// 类型定义
// ============================================================================

export interface OrchestratorConfig {
  /** 最大并发数 */
  maxConcurrency: number
  /** 单工具超时（毫秒） */
  timeout: number
  /** 是否保持调用顺序 */
  preserveOrder: boolean
}

export interface ToolBatch {
  /** 是否可并发执行 */
  isConcurrencySafe: boolean
  /** 工具调用列表 */
  calls: ToolCall[]
}

export interface ToolExecutionProgress {
  type: 'started' | 'running' | 'completed' | 'failed'
  callId: string
  toolName: string
  message?: string
}

// ============================================================================
// 工具执行协调器
// ============================================================================

export class ToolOrchestrator extends EventEmitter {
  private registry: ToolRegistry
  private config: OrchestratorConfig
  private logger: Logger
  private runningExecutions = new Map<string, AbortController>()
  private globalAbortController: AbortController | null = null

  constructor(
    registry: ToolRegistry,
    config: Partial<OrchestratorConfig> = {}
  ) {
    super()
    this.registry = registry
    this.config = {
      maxConcurrency: 5,
      timeout: 120000, // 2分钟
      preserveOrder: true,
      ...config
    }
    this.logger = new Logger('ToolOrchestrator')
  }

  /**
   * 执行工具调用列表
   * 自动分区：并发安全的批次并行执行，非安全的串行执行
   */
  async executeToolCalls(
    calls: ToolCall[],
    context: ToolContext
  ): Promise<ToolExecutionResult[]> {
    if (calls.length === 0) return []

    this.logger.info(`Executing ${calls.length} tool calls with orchestration`)
    this.globalAbortController = new AbortController()

    const results: ToolExecutionResult[] = []

    try {
      // 分区工具调用
      const batches = this.partitionToolCalls(calls)
      this.logger.debug(`Partitioned into ${batches.length} batches`)

      for (const batch of batches) {
        // 检查是否被取消
        if (this.globalAbortController.signal.aborted) {
          throw new Error('Execution cancelled')
        }

        if (batch.isConcurrencySafe) {
          // 并行执行
          this.logger.debug(`Running ${batch.calls.length} tools concurrently`)
          const batchResults = await this.executeConcurrently(batch.calls, context)
          results.push(...batchResults)
        } else {
          // 串行执行
          this.logger.debug(`Running ${batch.calls.length} tools serially`)
          const batchResults = await this.executeSerially(batch.calls, context)
          results.push(...batchResults)
        }
      }

      // 如果需要保持顺序，重新排序结果
      if (this.config.preserveOrder) {
        return this.reorderResults(results, calls)
      }

      return results

    } finally {
      this.globalAbortController = null
      this.runningExecutions.clear()
    }
  }

  /**
   * 流式执行工具调用 - 实时返回进度
   */
  async *executeToolCallsStream(
    calls: ToolCall[],
    context: ToolContext
  ): AsyncGenerator<ToolExecutionProgress | ToolExecutionResult> {
    if (calls.length === 0) return

    this.globalAbortController = new AbortController()

    // 分区工具调用
    const batches = this.partitionToolCalls(calls)

    for (const batch of batches) {
      if (this.globalAbortController.signal.aborted) {
        throw new Error('Execution cancelled')
      }

      if (batch.isConcurrencySafe) {
        // 并行执行流
        yield* this.executeConcurrentlyStream(batch.calls, context)
      } else {
        // 串行执行流
        yield* this.executeSeriallyStream(batch.calls, context)
      }
    }
  }

  /**
   * 分区工具调用
   * 将工具调用分组为可并发和不可并发的批次
   * 
   * 策略：
   * - 连续的并发安全工具放入同一批次并行执行
   * - 非并发安全工具单独成批串行执行
   */
  private partitionToolCalls(calls: ToolCall[]): ToolBatch[] {
    return calls.reduce<ToolBatch[]>((batches, call) => {
      const tool = this.registry.get(call.name)
      
      // 解析输入以检查并发安全性
      const parsedInput = tool?.inputSchema.safeParse(call.input)
      const isSafe = parsedInput?.success
        ? tool?.isConcurrencySafe(parsedInput.data) ?? false
        : false

      const lastBatch = batches[batches.length - 1]

      if (isSafe && lastBatch?.isConcurrencySafe) {
        // 添加到当前并发批次
        lastBatch.calls.push(call)
      } else {
        // 创建新批次
        batches.push({ isConcurrencySafe: isSafe, calls: [call] })
      }

      return batches
    }, [])
  }

  /**
   * 串行执行工具调用
   */
  private async executeSerially(
    calls: ToolCall[],
    context: ToolContext
  ): Promise<ToolExecutionResult[]> {
    const results: ToolExecutionResult[] = []

    for (const call of calls) {
      const result = await this.executeSingle(call, context)
      results.push(result)

      // 串行执行时，应用上下文修饰符
      if (result.contextModifier) {
        // 注意：这里我们假设 contextModifier 已经在 executeSingle 中应用
      }
    }

    return results
  }

  /**
   * 串行执行流
   */
  private async *executeSeriallyStream(
    calls: ToolCall[],
    context: ToolContext
  ): AsyncGenerator<ToolExecutionProgress | ToolExecutionResult> {
    for (const call of calls) {
      yield { type: 'started', callId: call.id, toolName: call.name }
      
      const result = await this.executeSingle(call, context)
      
      yield result
    }
  }

  /**
   * 并发执行工具调用
   */
  private async executeConcurrently(
    calls: ToolCall[],
    context: ToolContext
  ): Promise<ToolExecutionResult[]> {
    // 使用 Promise.all 限制并发数
    const executing: Promise<ToolExecutionResult>[] = []
    const results: ToolExecutionResult[] = []

    for (let i = 0; i < calls.length; i++) {
      const call = calls[i]
      
      // 如果达到最大并发数，等待一个完成
      if (executing.length >= this.config.maxConcurrency) {
        const completed = await Promise.race(executing)
        results.push(completed)
        executing.splice(executing.findIndex(p => p === Promise.resolve(completed)), 1)
      }

      // 开始新执行
      const promise = this.executeSingle(call, context)
      executing.push(promise)
    }

    // 等待所有剩余执行完成
    const remaining = await Promise.all(executing)
    results.push(...remaining)

    return results
  }

  /**
   * 并发执行流
   */
  private async *executeConcurrentlyStream(
    calls: ToolCall[],
    context: ToolContext
  ): AsyncGenerator<ToolExecutionProgress | ToolExecutionResult> {
    const results: (ToolExecutionResult | null)[] = new Array(calls.length).fill(null)
    const pendingIndices = new Set(calls.map((_, i) => i))
    const runningIndices = new Set<number>()

    // 启动初始执行
    while (runningIndices.size < this.config.maxConcurrency && pendingIndices.size > 0) {
      const index = pendingIndices.values().next().value!
      pendingIndices.delete(index)
      runningIndices.add(index)

      const call = calls[index]
      yield { type: 'started', callId: call.id, toolName: call.name }

      // 开始执行（不等待）
      this.executeSingle(call, context)
        .then(result => {
          results[index] = result
        })
        .catch(error => {
          results[index] = {
            id: call.id,
            name: call.name,
            input: call.input,
            error: error instanceof Error ? error.message : 'Unknown error',
            duration: 0,
            status: 'failed'
          }
        })
    }

    // 等待所有完成并产出结果
    while (runningIndices.size > 0 || pendingIndices.size > 0) {
      // 检查已完成的
      for (let i = 0; i < results.length; i++) {
        if (results[i] !== null) {
          yield results[i] as ToolExecutionResult
          results[i] = null
          runningIndices.delete(i)

          // 启动下一个
          if (pendingIndices.size > 0) {
            const nextIndex = pendingIndices.values().next().value!
            pendingIndices.delete(nextIndex)
            runningIndices.add(nextIndex)

            const call = calls[nextIndex]
            yield { type: 'started', callId: call.id, toolName: call.name }

            this.executeSingle(call, context)
              .then(result => {
                results[nextIndex] = result
              })
              .catch(error => {
                results[nextIndex] = {
                  id: call.id,
                  name: call.name,
                  input: call.input,
                  error: error instanceof Error ? error.message : 'Unknown error',
                  duration: 0,
                  status: 'failed'
                }
              })
          }
        }
      }

      // 短暂等待避免忙等
      if (runningIndices.size > 0) {
        await this.delay(10)
      }
    }
  }

  /**
   * 执行单个工具
   */
  private async executeSingle(
    call: ToolCall,
    context: ToolContext
  ): Promise<ToolExecutionResult & { contextModifier?: (ctx: ToolContext) => ToolContext }> {
    const startTime = Date.now()
    const tool = this.registry.get(call.name)

    if (!tool) {
      return {
        id: call.id,
        name: call.name,
        input: call.input,
        error: `Tool not found: ${call.name}`,
        duration: 0,
        status: 'failed'
      }
    }

    // 创建执行专用的 AbortController
    const executionController = new AbortController()
    this.runningExecutions.set(call.id, executionController)

    // 组合信号
    const combinedSignal = this.combineAbortSignals(
      this.globalAbortController?.signal,
      executionController.signal,
      context.signal
    )

    const toolContext: ToolContext = {
      ...context,
      signal: combinedSignal
    }

    try {
      // 验证输入
      const parsedInput = tool.inputSchema.safeParse(call.input)
      if (!parsedInput.success) {
        throw new Error(`Invalid input: ${parsedInput.error.message}`)
      }

      // 权限检查
      const permissionResult = await tool.checkPermissions(parsedInput.data, toolContext)
      if (permissionResult.type === 'deny') {
        throw new Error(`Permission denied: ${permissionResult.message}`)
      }

      // 执行（带超时）
      const output = await this.executeWithTimeout(
        () => tool.execute(parsedInput.data, toolContext),
        this.config.timeout
      )

      return {
        id: call.id,
        name: call.name,
        input: call.input,
        output,
        duration: Date.now() - startTime,
        status: 'completed'
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.logger.error(`Tool execution failed: ${call.name}`, { error: errorMessage })

      return {
        id: call.id,
        name: call.name,
        input: call.input,
        error: errorMessage,
        duration: Date.now() - startTime,
        status: 'failed'
      }
    } finally {
      this.runningExecutions.delete(call.id)
    }
  }

  /**
   * 按原始调用顺序重新排序结果
   */
  private reorderResults(
    results: ToolExecutionResult[],
    originalCalls: ToolCall[]
  ): ToolExecutionResult[] {
    const orderMap = new Map(originalCalls.map((call, index) => [call.id, index]))
    return [...results].sort((a, b) => {
      const orderA = orderMap.get(a.id) ?? Infinity
      const orderB = orderMap.get(b.id) ?? Infinity
      return orderA - orderB
    })
  }

  /**
   * 带超时执行
   */
  private executeWithTimeout<T>(fn: () => Promise<T>, timeout: number): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Tool execution timeout')), timeout)
      })
    ])
  }

  /**
   * 组合多个 AbortSignal
   */
  private combineAbortSignals(...signals: (AbortSignal | undefined)[]): AbortSignal {
    const controller = new AbortController()

    for (const signal of signals) {
      if (!signal) continue
      if (signal.aborted) {
        controller.abort()
        return controller.signal
      }
      signal.addEventListener('abort', () => controller.abort())
    }

    return controller.signal
  }

  /**
   * 取消所有执行
   */
  cancel(): void {
    this.logger.info('Cancelling all tool executions')
    
    if (this.globalAbortController) {
      this.globalAbortController.abort()
    }

    for (const [id, controller] of this.runningExecutions) {
      controller.abort()
      this.logger.debug(`Cancelled execution: ${id}`)
    }

    this.runningExecutions.clear()
    this.emit('cancelled')
  }

  /**
   * 检查是否有正在运行的执行
   */
  isRunning(): boolean {
    return this.runningExecutions.size > 0
  }

  /**
   * 获取正在运行的执行数量
   */
  getRunningCount(): number {
    return this.runningExecutions.size
  }

  /**
   * 延迟
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// ============================================================================
// 工具分类辅助函数
// ============================================================================

/**
 * 判断工具调用是否为读取操作
 */
export function isReadOperation(toolName: string, tool?: Tool, input?: any): boolean {
  if (tool) {
    // 使用工具的 isReadOnly 方法
    return tool.isReadOnly(input)
  }
  
  // 启发式判断
  const readTools = ['file_read', 'glob', 'grep', 'cat', 'head', 'tail', 'ls']
  return readTools.some(name => toolName.toLowerCase().includes(name))
}

/**
 * 判断工具调用是否为破坏性操作
 */
export function isDestructiveOperation(toolName: string, tool?: Tool, input?: any): boolean {
  if (tool) {
    return tool.isDestructive(input)
  }
  
  // 启发式判断
  const destructivePatterns = ['delete', 'remove', 'rm ', 'truncate', 'drop']
  return destructivePatterns.some(pattern => toolName.toLowerCase().includes(pattern))
}

// ============================================================================
// 创建默认协调器
// ============================================================================

export function createToolOrchestrator(
  registry: ToolRegistry,
  config?: Partial<OrchestratorConfig>
): ToolOrchestrator {
  return new ToolOrchestrator(registry, config)
}

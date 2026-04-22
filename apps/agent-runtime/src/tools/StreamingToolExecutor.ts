/**
 * Streaming Tool Executor - inspired by Claude Code
 * 
 * Executes tools in parallel with progress tracking and result ordering.
 * Supports:
 * - Concurrent execution of independent tool calls
 * - Progress callbacks for real-time updates
 * - Result ordering (results returned in call order)
 * - Concurrency limiting
 * - Cancellation support
 */
import { EventEmitter } from 'events'
import { ToolExecutor, ToolRegistry, ToolContext } from './Tool.js'
import { Logger } from '../utils/logger.js'

export interface ToolCall {
  id: string
  name: string
  input: any
}

export interface ToolResult {
  id: string
  name: string
  input: any
  output?: any
  error?: string
  duration: number
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
}

export interface ToolProgress {
  id: string
  name: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  progress?: number // 0-100
  message?: string
}

export interface StreamingExecutorConfig {
  /** Maximum concurrent tool executions */
  maxConcurrency: number
  /** Timeout for each tool call in ms */
  timeout: number
  /** Whether to preserve call order in results */
  preserveOrder: boolean
  /** Logger instance */
  logger?: Logger
}

export class StreamingToolExecutor extends EventEmitter {
  private registry: ToolRegistry
  private config: StreamingExecutorConfig
  private logger: Logger
  private abortController: AbortController | null = null
  private runningExecutions = new Map<string, AbortController>()
  
  constructor(
    registry: ToolRegistry,
    config: Partial<StreamingExecutorConfig> = {}
  ) {
    super()
    this.registry = registry
    this.config = {
      maxConcurrency: 5,
      timeout: 120000, // 2 minutes
      preserveOrder: true,
      ...config
    }
    this.logger = config.logger || new Logger('StreamingToolExecutor')
  }
  
  /**
   * Execute multiple tools in parallel with streaming progress
   */
  async *executeStream(
    calls: ToolCall[],
    context: ToolContext
  ): AsyncGenerator<ToolProgress | ToolResult> {
    if (calls.length === 0) return
    
    this.abortController = new AbortController()
    const signal = this.abortController.signal
    
    this.logger.info(`Starting parallel execution of ${calls.length} tools`, {
      tools: calls.map(c => c.name),
      maxConcurrency: this.config.maxConcurrency
    })
    
    // Initialize results tracking
    const results: (ToolResult | null)[] = new Array(calls.length).fill(null)
    const pendingIndices = new Set(calls.map((_, i) => i))
    const runningIndices = new Set<number>()
    
    // Yield initial pending state
    for (const call of calls) {
      yield {
        id: call.id,
        name: call.name,
        status: 'pending'
      }
    }
    
    try {
      while (pendingIndices.size > 0 || runningIndices.size > 0) {
        // Check for cancellation
        if (signal.aborted) {
          throw new Error('Execution cancelled')
        }
        
        // Start new executions up to maxConcurrency
        while (
          runningIndices.size < this.config.maxConcurrency &&
          pendingIndices.size > 0
        ) {
          const index = pendingIndices.values().next().value!
          pendingIndices.delete(index)
          runningIndices.add(index)
          
          const call = calls[index]
          
          // Start execution (don't await - run in parallel)
          this.executeSingle(call, index, context, signal, results, runningIndices)
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
        
        // Yield any completed results
        for (let i = 0; i < results.length; i++) {
          if (results[i] !== null) {
            yield results[i] as ToolResult
            results[i] = null // Clear after yielding
          }
        }
        
        // Small delay to prevent tight loop
        if (runningIndices.size > 0) {
          await this.delay(50)
        }
      }
      
      // Yield any remaining results
      for (let i = 0; i < results.length; i++) {
        if (results[i] !== null) {
          yield results[i] as ToolResult
        }
      }
      
    } finally {
      this.abortController = null
      this.runningExecutions.clear()
    }
  }
  
  /**
   * Execute tools in parallel and return all results
   */
  async executeBatch(
    calls: ToolCall[],
    context: ToolContext,
    onProgress?: (progress: ToolProgress) => void
  ): Promise<ToolResult[]> {
    const results: ToolResult[] = []
    
    for await (const item of this.executeStream(calls, context)) {
      if ('status' in item) {
        if (item.status === 'completed' || item.status === 'failed' || item.status === 'cancelled') {
          results.push(item as ToolResult)
        } else {
          onProgress?.(item as ToolProgress)
        }
      }
    }
    
    // Sort by original call order if needed
    if (this.config.preserveOrder) {
      const orderMap = new Map(calls.map((c, i) => [c.id, i]))
      results.sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0))
    }
    
    return results
  }
  
  /**
   * Cancel all running executions
   */
  cancel(): void {
    this.logger.info('Cancelling all tool executions')
    
    if (this.abortController) {
      this.abortController.abort()
    }
    
    // Cancel individual executions
    for (const [id, controller] of this.runningExecutions) {
      controller.abort()
      this.logger.debug(`Cancelled execution: ${id}`)
    }
    
    this.runningExecutions.clear()
  }
  
  /**
   * Check if any tools are currently running
   */
  isRunning(): boolean {
    return this.runningExecutions.size > 0
  }
  
  /**
   * Get count of running executions
   */
  getRunningCount(): number {
    return this.runningExecutions.size
  }
  
  /**
   * Update configuration
   */
  updateConfig(config: Partial<StreamingExecutorConfig>): void {
    this.config = { ...this.config, ...config }
  }
  
  private async executeSingle(
    call: ToolCall,
    index: number,
    context: ToolContext,
    signal: AbortSignal,
    results: (ToolResult | null)[],
    runningIndices: Set<number>
  ): Promise<ToolResult> {
    const startTime = Date.now()
    const executionId = `${call.name}-${call.id}`
    
    // Create abort controller for this specific execution
    const executionController = new AbortController()
    this.runningExecutions.set(executionId, executionController)
    
    // Update context with combined signal
    const toolContext: ToolContext = {
      ...context,
      signal: this.combineSignals(signal, executionController.signal)
    }
    
    this.logger.debug(`Starting execution: ${call.name}`, { id: call.id })
    
    // Yield running status
    this.emit('progress', {
      id: call.id,
      name: call.name,
      status: 'running'
    })
    
    try {
      // Get tool and execute
      const tool = this.registry.get(call.name)
      if (!tool) {
        throw new Error(`Tool not found: ${call.name}`)
      }
      
      // Validate input
      const parseResult = tool.inputSchema.safeParse(call.input)
      if (!parseResult.success) {
        throw new Error(`Invalid input: ${parseResult.error.message}`)
      }
      
      // Check permissions
      if (tool.checkPermissions) {
        const decision = await tool.checkPermissions(parseResult.data, toolContext)
        if (decision.type === 'deny') {
          throw new Error(`Permission denied: ${decision.message}`)
        }
      }
      
      // Execute with timeout
      const output = await this.executeWithTimeout(
        () => tool.execute(parseResult.data, toolContext),
        this.config.timeout
      )
      
      // Validate output
      const outputResult = tool.outputSchema.safeParse(output)
      if (!outputResult.success) {
        throw new Error(`Invalid output: ${outputResult.error.message}`)
      }
      
      const duration = Date.now() - startTime
      
      this.logger.debug(`Completed execution: ${call.name}`, { 
        id: call.id, 
        duration 
      })
      
      return {
        id: call.id,
        name: call.name,
        input: call.input,
        output,
        duration,
        status: 'completed'
      }
      
    } catch (error) {
      const duration = Date.now() - startTime
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      this.logger.error(`Execution failed: ${call.name}`, { 
        id: call.id, 
        error: errorMessage 
      })
      
      return {
        id: call.id,
        name: call.name,
        input: call.input,
        error: errorMessage,
        duration,
        status: errorMessage.includes('cancelled') ? 'cancelled' : 'failed'
      }
    } finally {
      runningIndices.delete(index)
      this.runningExecutions.delete(executionId)
    }
  }
  
  private async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeout: number
  ): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Tool execution timeout')), timeout)
      })
    ])
  }
  
  private combineSignals(...signals: AbortSignal[]): AbortSignal {
    const controller = new AbortController()
    
    for (const signal of signals) {
      if (signal.aborted) {
        controller.abort()
        return controller.signal
      }
      
      signal.addEventListener('abort', () => controller.abort())
    }
    
    return controller.signal
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

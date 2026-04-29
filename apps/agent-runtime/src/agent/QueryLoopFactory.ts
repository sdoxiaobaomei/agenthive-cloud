/**
 * QueryLoop Factory - QueryLoop 工厂
 * 
 * 根据特性标志自动选择使用 QueryLoop 或 QueryLoopV2
 */

import { QueryLoop, QueryLoopConfig as LegacyConfig } from './QueryLoop.js'
import { QueryLoopV2, QueryLoopV2Config } from './QueryLoopV2.js'
import { isFeatureEnabled } from '../config/featureFlags.js'
import type { ConversationContextV2 } from '../context/ConversationContextV2.js'
import type { QueryLoopV2Result, QueryProgressData } from './QueryLoopV2.js'
import type { PermissionManager } from '../permissions/PermissionManager.js'

// 统一的配置接口
export interface UnifiedQueryLoopConfig extends Omit<LegacyConfig, 'toolRegistry'> {
  toolRegistry?: any
  permissionManager?: PermissionManager
  // 可选的 V2 配置
  compactionEngine?: QueryLoopV2Config['compactionEngine']
  maxTokens?: number
  compactionThreshold?: number
  enableCompaction?: boolean
  onComplete?: QueryLoopV2Config['onComplete']
}

// 统一的 QueryLoop 接口
export interface IQueryLoop {
  execute(
    userInput: string,
    context: ConversationContextV2,
    options?: {
      systemPrompt?: string
      model?: string
      tools?: any[]
    }
  ): Promise<QueryLoopV2Result>
  
  stream?(
    userInput: string,
    context: ConversationContextV2,
    options?: {
      systemPrompt?: string
      model?: string
      tools?: any[]
    }
  ): AsyncGenerator<QueryProgressData>
  
  stop(): void
  isActive(): boolean
}

/**
 * 创建 QueryLoop 实例
 * 
 * 根据 USE_QUERY_LOOP_V2 特性标志自动选择实现
 */
export function createQueryLoop(config: UnifiedQueryLoopConfig): IQueryLoop {
  const useV2 = isFeatureEnabled('USE_QUERY_LOOP_V2')
  
  if (useV2) {
    // 转换配置为 V2 格式
    const v2Config: QueryLoopV2Config = {
      llmService: config.llmService,
      toolRegistry: config.toolRegistry as any, // V2 registry
      permissionManager: config.permissionManager,
      compactionEngine: config.compactionEngine,
      maxIterations: config.maxIterations,
      maxTokens: config.maxTokens ?? 12000,
      compactionThreshold: config.compactionThreshold ?? 10000,
      enableStreaming: config.enableStreaming,
      enableCompaction: config.enableCompaction ?? false,
      onProgress: config.onProgress as any,
      onComplete: config.onComplete as any,
    }
    
    return new QueryLoopV2(v2Config)
  }
  
  // 使用旧版 QueryLoop
  // 需要适配器来适配工具注册表
  const legacyConfig: LegacyConfig = {
    llmService: config.llmService,
    toolRegistry: config.toolRegistry as any,
    toolExecutor: config.toolExecutor as any,
    maxIterations: config.maxIterations,
    enableStreaming: config.enableStreaming,
    onProgress: config.onProgress
  }
  
  return new QueryLoopAdapter(new QueryLoop(legacyConfig))
}

/**
 * QueryLoop 适配器 - 将旧版 QueryLoop 适配到新版接口
 */
class QueryLoopAdapter implements IQueryLoop {
  private inner: QueryLoop
  
  constructor(queryLoop: QueryLoop) {
    this.inner = queryLoop
  }
  
  async execute(
    userInput: string,
    context: ConversationContextV2,
    options?: {
      systemPrompt?: string
      model?: string
      tools?: any[]
    }
  ): Promise<QueryLoopV2Result> {
    const result = await this.inner.execute(userInput, context, options)
    
    // 转换结果格式
    return {
      success: result.success,
      content: result.content,
      toolCalls: result.toolCalls,
      iterations: result.iterations,
      compactionCount: 0,
      tokensSaved: 0,
      usage: result.usage,
      duration: 0
    }
  }
  
  async *stream(
    userInput: string,
    context: ConversationContextV2,
    options?: {
      systemPrompt?: string
      model?: string
      tools?: any[]
    }
  ): AsyncGenerator<QueryProgressData> {
    for await (const chunk of this.inner.stream(userInput, context, options)) {
      yield {
        type: chunk.type as any,
        message: chunk.message,
        content: chunk.content,
        toolName: chunk.toolName,
        toolInput: chunk.toolInput,
        toolOutput: chunk.toolOutput,
        error: chunk.error,
        iteration: chunk.iteration
      }
    }
  }
  
  stop(): void {
    this.inner.stop()
  }
  
  isActive(): boolean {
    return this.inner.isActive()
  }
}

export default createQueryLoop

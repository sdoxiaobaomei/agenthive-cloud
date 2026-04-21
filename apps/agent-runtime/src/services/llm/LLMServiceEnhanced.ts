// LLM Service - 增强版
// 优化点：
// 1. 使用 crypto 生成 SHA-256 缓存键
// 2. 添加指数退避重试机制
// 3. 改进错误分类和处理
// 4. 添加请求/响应拦截器
// 5. 更好的流式处理

import { EventEmitter } from 'events'
import { createHash } from 'crypto'
import { trace, SpanStatusCode } from '@opentelemetry/api'
import { AI_ATTRIBUTES, AI_SPAN_NAMES } from '@agenthive/observability'
import { ILLMProvider, LLMMessage, LLMCompletionOptions, LLMCompletionResult, LLMStreamChunk, LLMProviderConfig, LLMToolDefinition } from './types.js'
import { AnthropicProvider } from './providers/anthropic.js'
import { OpenAIProvider } from './providers/openai.js'
import { Logger } from '../../utils/logger.js'

// ============================================================================
// 配置类型
// ============================================================================

export interface LLMServiceEnhancedConfig {
  defaultProvider: LLMProviderConfig
  fallbackProvider?: LLMProviderConfig
  enableCache?: boolean
  cacheTTL?: number // seconds
  maxCacheSize?: number
  retryConfig?: RetryConfig
  enableMetrics?: boolean
}

export interface RetryConfig {
  maxRetries: number
  initialDelayMs: number
  maxDelayMs: number
  backoffMultiplier: number
  retryableErrors: string[] // 错误类型列表，这些错误会触发重试
}

interface CacheEntry {
  result: LLMCompletionResult
  timestamp: number
  accessCount: number
}

interface LLMError {
  type: 'network' | 'rate_limit' | 'auth' | 'invalid_request' | 'server' | 'unknown'
  message: string
  retryable: boolean
  originalError: Error
}

// 默认重试配置
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  retryableErrors: ['network', 'rate_limit', 'server']
}

// ============================================================================
// LLM Service - 增强版
// ============================================================================

export class LLMServiceEnhanced extends EventEmitter {
  private providers: Map<string, ILLMProvider> = new Map()
  private defaultProvider: string
  private fallbackProvider?: string
  private cache: Map<string, CacheEntry> = new Map()
  private config: LLMServiceEnhancedConfig
  private logger: Logger
  private retryConfig: RetryConfig
  private metrics: {
    totalRequests: number
    cacheHits: number
    cacheMisses: number
    retries: number
    errors: number
    totalLatency: number
  }

  constructor(config: LLMServiceEnhancedConfig) {
    super()
    this.config = config
    this.defaultProvider = config.defaultProvider.provider
    this.logger = new Logger('LLMServiceEnhanced')
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config.retryConfig }
    this.metrics = {
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      retries: 0,
      errors: 0,
      totalLatency: 0
    }

    // 初始化默认 provider
    this.registerProvider(config.defaultProvider)

    // 初始化 fallback provider
    if (config.fallbackProvider) {
      this.fallbackProvider = config.fallbackProvider.provider
      this.registerProvider(config.fallbackProvider)
    }

    this.logger.info(`LLM Service Enhanced initialized with provider: ${this.defaultProvider}`)
  }

  // 注册 Provider
  registerProvider(config: LLMProviderConfig): void {
    let provider: ILLMProvider

    switch (config.provider) {
      case 'anthropic':
        if (!config.apiKey) throw new Error('Anthropic provider requires apiKey')
        provider = new AnthropicProvider({
          apiKey: config.apiKey,
          baseUrl: config.baseUrl,
          model: config.model,
          defaultOptions: config.defaultOptions
        })
        break

      case 'openai':
        if (!config.apiKey) throw new Error('OpenAI provider requires apiKey')
        provider = new OpenAIProvider({
          apiKey: config.apiKey,
          baseUrl: config.baseUrl,
          model: config.model,
          defaultOptions: config.defaultOptions
        })
        break

      default:
        throw new Error(`Unsupported provider: ${config.provider}`)
    }

    this.providers.set(config.provider, provider)
    this.logger.info(`Registered provider: ${config.provider} with model: ${config.model}`)
  }

  // 获取 Provider
  getProvider(name?: string): ILLMProvider {
    const providerName = name || this.defaultProvider
    const provider = this.providers.get(providerName)
    if (!provider) {
      throw new Error(`Provider not found: ${providerName}`)
    }
    return provider
  }

  // 获取默认 Provider 名称
  getDefaultProvider(): string {
    return this.defaultProvider
  }

  // 设置默认 Provider
  setDefaultProvider(name: string): void {
    if (!this.providers.has(name)) {
      throw new Error(`Provider not registered: ${name}`)
    }
    this.defaultProvider = name
  }

  // ============================================================================
  // 缓存系统 - 使用 SHA-256
  // ============================================================================

  // 生成缓存键 - 使用 SHA-256 避免冲突
  private generateCacheKey(messages: LLMMessage[], options?: LLMCompletionOptions): string {
    const data = JSON.stringify({ messages, options })
    return createHash('sha256').update(data).digest('hex')
  }

  // 检查缓存
  private checkCache(key: string): LLMCompletionResult | null {
    if (!this.config.enableCache) return null

    const entry = this.cache.get(key)
    if (!entry) {
      this.metrics.cacheMisses++
      return null
    }

    const now = Date.now()
    const ttl = (this.config.cacheTTL || 3600) * 1000

    if (now - entry.timestamp > ttl) {
      this.cache.delete(key)
      this.metrics.cacheMisses++
      return null
    }

    // 更新访问计数
    entry.accessCount++
    this.metrics.cacheHits++
    this.logger.debug('Cache hit', { key: key.slice(0, 16) + '...' })
    return entry.result
  }

  // 设置缓存
  private setCache(key: string, result: LLMCompletionResult): void {
    if (!this.config.enableCache) return

    // 检查缓存大小限制
    const maxSize = this.config.maxCacheSize || 1000
    if (this.cache.size >= maxSize) {
      this.evictLRU()
    }

    this.cache.set(key, {
      result,
      timestamp: Date.now(),
      accessCount: 1
    })
  }

  // LRU 淘汰
  private evictLRU(): void {
    let oldestKey: string | null = null
    let oldestTime = Infinity

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp
        oldestKey = key
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey)
      this.logger.debug('Evicted LRU cache entry', { key: oldestKey.slice(0, 16) + '...' })
    }
  }

  // 清理过期缓存
  private cleanupCache(): void {
    const now = Date.now()
    const ttl = (this.config.cacheTTL || 3600) * 1000

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > ttl) {
        this.cache.delete(key)
      }
    }
  }

  // ============================================================================
  // 错误处理 - 分类和重试
  // ============================================================================

  // 分类错误
  private classifyError(error: Error): LLMError {
    const message = error.message.toLowerCase()
    
    // 网络错误
    if (message.includes('network') || 
        message.includes('fetch') || 
        message.includes('timeout') ||
        message.includes('econnrefused') ||
        message.includes('ENOTFOUND')) {
      return {
        type: 'network',
        message: error.message,
        retryable: true,
        originalError: error
      }
    }

    // 速率限制
    if (message.includes('rate limit') || 
        message.includes('429') ||
        message.includes('too many requests')) {
      return {
        type: 'rate_limit',
        message: error.message,
        retryable: true,
        originalError: error
      }
    }

    // 认证错误
    if (message.includes('auth') || 
        message.includes('api key') || 
        message.includes('401') ||
        message.includes('403')) {
      return {
        type: 'auth',
        message: error.message,
        retryable: false,
        originalError: error
      }
    }

    // 无效请求
    if (message.includes('invalid') || 
        message.includes('bad request') ||
        message.includes('400')) {
      return {
        type: 'invalid_request',
        message: error.message,
        retryable: false,
        originalError: error
      }
    }

    // 服务器错误
    if (message.includes('internal server') || 
        message.includes('500') ||
        message.includes('502') ||
        message.includes('503') ||
        message.includes('504')) {
      return {
        type: 'server',
        message: error.message,
        retryable: true,
        originalError: error
      }
    }

    return {
      type: 'unknown',
      message: error.message,
      retryable: false,
      originalError: error
    }
  }

  // 指数退避延迟
  private async delay(retryCount: number): Promise<void> {
    const delayMs = Math.min(
      this.retryConfig.initialDelayMs * Math.pow(this.retryConfig.backoffMultiplier, retryCount),
      this.retryConfig.maxDelayMs
    )
    await new Promise(resolve => setTimeout(resolve, delayMs))
  }

  // ============================================================================
  // 核心 API - 带重试的完成请求
  // ============================================================================

  // 完成请求（非流式）- 带重试
  async complete(
    messages: LLMMessage[],
    options?: LLMCompletionOptions & { provider?: string; skipCache?: boolean }
  ): Promise<LLMCompletionResult> {
    const tracer = trace.getTracer('agenthive-llm')
    const providerName = options?.provider || this.defaultProvider
    const cacheKey = this.generateCacheKey(messages, options)

    this.metrics.totalRequests++

    // 检查缓存
    if (!options?.skipCache) {
      const cached = this.checkCache(cacheKey)
      if (cached) {
        this.emit('cache:hit', { provider: providerName, messages })
        return cached
      }
    }

    let lastError: Error | null = null
    let retryCount = 0

    while (retryCount <= this.retryConfig.maxRetries) {
      const span = tracer.startSpan(AI_SPAN_NAMES.LLM_COMPLETION, {
        attributes: {
          [AI_ATTRIBUTES.LLM_PROVIDER]: providerName,
          [AI_ATTRIBUTES.LLM_MODEL]: options?.model || 'unknown',
          [AI_ATTRIBUTES.LLM_CACHE_HIT]: false,
          [AI_ATTRIBUTES.LLM_STREAMING]: false,
          [AI_ATTRIBUTES.LLM_MAX_TOKENS]: options?.maxTokens ?? -1,
          [AI_ATTRIBUTES.LLM_TEMPERATURE]: options?.temperature ?? -1,
          'llm.retry_attempt': retryCount,
        },
      })

      try {
        const provider = this.getProvider(providerName)
        this.emit('completion:start', { provider: providerName, messages, attempt: retryCount + 1 })

        const startTime = Date.now()
        const result = await provider.complete(messages, options)
        const duration = Date.now() - startTime
        this.metrics.totalLatency += duration

        span.setAttributes({
          [AI_ATTRIBUTES.LLM_TOKENS_INPUT]: result.usage?.promptTokens ?? 0,
          [AI_ATTRIBUTES.LLM_TOKENS_OUTPUT]: result.usage?.completionTokens ?? 0,
          [AI_ATTRIBUTES.LLM_TOKENS_TOTAL]: result.usage?.totalTokens ?? 0,
          [AI_ATTRIBUTES.LLM_LATENCY_MS]: duration,
          [AI_ATTRIBUTES.LLM_REQUEST_ID]: result.id || 'unknown',
        })
        span.setStatus({ code: SpanStatusCode.OK })

        this.emit('completion:end', {
          provider: providerName,
          duration,
          usage: result.usage,
          retries: retryCount
        })

        // 缓存结果
        if (!options?.skipCache) {
          this.setCache(cacheKey, result)
        }

        span.end()
        return result

      } catch (error) {
        lastError = error as Error
        const classifiedError = this.classifyError(error as Error)
        lastError = classifiedError.originalError
        this.metrics.errors++

        span.recordException(classifiedError.originalError)
        span.setAttributes({
          [AI_ATTRIBUTES.LLM_ERROR_TYPE]: classifiedError.type,
          'llm.retryable': classifiedError.retryable,
        })
        span.setStatus({ code: SpanStatusCode.ERROR, message: classifiedError.message })
        span.end()

        this.logger.error('Completion failed', { 
          error: classifiedError.message, 
          type: classifiedError.type,
          retryable: classifiedError.retryable,
          attempt: retryCount + 1
        })

        // 检查是否应该重试
        if (!classifiedError.retryable || 
            retryCount >= this.retryConfig.maxRetries ||
            !this.retryConfig.retryableErrors.includes(classifiedError.type)) {
          break
        }

        // 速率限制需要更长的延迟
        if (classifiedError.type === 'rate_limit') {
          await this.delay(retryCount + 2) // 更长的延迟
        } else {
          await this.delay(retryCount)
        }

        retryCount++
        this.metrics.retries++
        this.emit('completion:retry', { 
          provider: providerName, 
          attempt: retryCount,
          error: classifiedError.type 
        })
      }
    }

    // 所有重试都失败，尝试 fallback
    if (this.fallbackProvider && providerName !== this.fallbackProvider) {
      this.emit('completion:fallback', { from: providerName, to: this.fallbackProvider })
      return this.complete(messages, { ...options, provider: this.fallbackProvider })
    }

    this.emit('completion:error', { provider: providerName, error: lastError })
    throw lastError || new Error('Unknown error')
  }

  // 流式完成 - 带重试
  async *stream(
    messages: LLMMessage[],
    options?: LLMCompletionOptions & { provider?: string }
  ): AsyncGenerator<LLMStreamChunk> {
    const providerName = options?.provider || this.defaultProvider
    let retryCount = 0
    let streamStarted = false
    let lastError: Error | null = null

    while (retryCount <= this.retryConfig.maxRetries) {
      try {
        const provider = this.getProvider(providerName)
        
        if (!streamStarted) {
          this.emit('stream:start', { provider: providerName, messages, attempt: retryCount + 1 })
        }

        const startTime = Date.now()
        let totalTokens = 0

        for await (const chunk of provider.stream(messages, options)) {
          streamStarted = true
          if (chunk.content) {
            totalTokens += Math.ceil(chunk.content.length / 4)
          }
          yield chunk
        }

        const duration = Date.now() - startTime
        this.emit('stream:end', {
          provider: providerName,
          duration,
          estimatedTokens: totalTokens,
          retries: retryCount
        })

        return

      } catch (error) {
        const classifiedError = this.classifyError(error as Error)
        
        this.logger.error('Stream failed', { 
          error: classifiedError.message, 
          type: classifiedError.type,
          retryable: classifiedError.retryable 
        })

        // 如果流已经开始，不要重试
        if (streamStarted) {
          this.emit('stream:error', { provider: providerName, error, partial: true })
          throw error
        }

        // 检查是否应该重试
        if (!classifiedError.retryable || 
            retryCount >= this.retryConfig.maxRetries ||
            !this.retryConfig.retryableErrors.includes(classifiedError.type)) {
          break
        }

        await this.delay(retryCount)
        retryCount++
        this.metrics.retries++
        this.emit('stream:retry', { provider: providerName, attempt: retryCount })
      }
    }

    // 尝试 fallback
    if (this.fallbackProvider && providerName !== this.fallbackProvider) {
      this.emit('stream:fallback', { from: providerName, to: this.fallbackProvider })
      yield* this.stream(messages, { ...options, provider: this.fallbackProvider })
      return
    }

    this.emit('stream:error', { provider: providerName, error: lastError })
    throw lastError || new Error('Stream failed after all retries')
  }

  // 工具调用
  async callWithTools(
    messages: LLMMessage[],
    tools: LLMToolDefinition[],
    options?: Omit<LLMCompletionOptions, 'tools'> & { provider?: string }
  ): Promise<LLMCompletionResult> {
    return this.complete(messages, {
      ...options,
      tools,
      toolChoice: 'auto'
    })
  }

  // ============================================================================
  // 缓存和指标管理
  // ============================================================================

  // 清空缓存
  clearCache(): void {
    this.cache.clear()
    this.logger.info('Cache cleared')
  }

  // 获取缓存统计
  getCacheStats(): { 
    size: number
    maxSize: number
    hitRate: number
    entries: Array<{ key: string; age: number; accessCount: number }>
  } {
    const total = this.metrics.cacheHits + this.metrics.cacheMisses
    const hitRate = total > 0 ? this.metrics.cacheHits / total : 0

    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key: key.slice(0, 16) + '...',
      age: Date.now() - entry.timestamp,
      accessCount: entry.accessCount
    }))

    return {
      size: this.cache.size,
      maxSize: this.config.maxCacheSize || 1000,
      hitRate,
      entries
    }
  }

  // 获取性能指标
  getMetrics(): {
    totalRequests: number
    cacheHitRate: number
    averageLatency: number
    retryRate: number
    errorRate: number
  } {
    const total = this.metrics.cacheHits + this.metrics.cacheMisses
    return {
      totalRequests: this.metrics.totalRequests,
      cacheHitRate: total > 0 ? this.metrics.cacheHits / total : 0,
      averageLatency: this.metrics.totalRequests > 0 
        ? this.metrics.totalLatency / this.metrics.totalRequests 
        : 0,
      retryRate: this.metrics.totalRequests > 0 
        ? this.metrics.retries / this.metrics.totalRequests 
        : 0,
      errorRate: this.metrics.totalRequests > 0 
        ? this.metrics.errors / this.metrics.totalRequests 
        : 0
    }
  }

  // 重置指标
  resetMetrics(): void {
    this.metrics = {
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      retries: 0,
      errors: 0,
      totalLatency: 0
    }
  }
}

// ============================================================================
// 全局实例管理
// ============================================================================

let globalLLMServiceEnhanced: LLMServiceEnhanced | null = null

export function initializeLLMServiceEnhanced(config: LLMServiceEnhancedConfig): LLMServiceEnhanced {
  globalLLMServiceEnhanced = new LLMServiceEnhanced(config)
  return globalLLMServiceEnhanced
}

export function getLLMServiceEnhanced(): LLMServiceEnhanced {
  if (!globalLLMServiceEnhanced) {
    throw new Error('LLM Service Enhanced not initialized. Call initializeLLMServiceEnhanced first.')
  }
  return globalLLMServiceEnhanced
}

export function resetLLMServiceEnhanced(): void {
  globalLLMServiceEnhanced = null
}

// LLM Service - 统一的大语言模型服务接口
import { EventEmitter } from 'events'
import crypto from 'crypto'
import { ILLMProvider, LLMMessage, LLMCompletionOptions, LLMCompletionResult, LLMStreamChunk, LLMProviderConfig, LLMToolDefinition } from './types.js'
import { AnthropicProvider } from './providers/anthropic.js'
import { OpenAIProvider } from './providers/openai.js'
import { OllamaProvider } from './providers/ollama.js'
import { Logger } from '../../utils/logger.js'

export interface LLMServiceConfig {
  defaultProvider: LLMProviderConfig
  fallbackProvider?: LLMProviderConfig
  enableCache?: boolean
  cacheTTL?: number // seconds
}

interface CacheEntry {
  result: LLMCompletionResult
  timestamp: number
}

export class LLMService extends EventEmitter {
  private providers: Map<string, ILLMProvider> = new Map()
  private defaultProvider: string
  private fallbackProvider?: string
  private cache: Map<string, CacheEntry> = new Map()
  private config: LLMServiceConfig
  private logger: Logger

  constructor(config: LLMServiceConfig) {
    super()
    this.config = config
    this.defaultProvider = config.defaultProvider.provider
    this.logger = new Logger('LLMService')

    // 初始化默认 provider
    this.registerProvider(config.defaultProvider)

    // 初始化 fallback provider
    if (config.fallbackProvider) {
      this.fallbackProvider = config.fallbackProvider.provider
      this.registerProvider(config.fallbackProvider)
    }

    this.logger.info(`LLM Service initialized with provider: ${this.defaultProvider}`)
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

      case 'ollama':
        // Ollama 不需要 API key
        provider = new OllamaProvider({
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

  // 生成缓存键
  private generateCacheKey(messages: LLMMessage[], options?: LLMCompletionOptions): string {
    const data = JSON.stringify({ messages, options })
    return crypto.createHash('sha256').update(data).digest('hex')
  }

  // 检查缓存
  private checkCache(key: string): LLMCompletionResult | null {
    if (!this.config.enableCache) return null

    const entry = this.cache.get(key)
    if (!entry) return null

    const now = Date.now()
    const ttl = (this.config.cacheTTL || 3600) * 1000

    if (now - entry.timestamp > ttl) {
      this.cache.delete(key)
      return null
    }

    this.logger.debug('Cache hit', { key })
    return entry.result
  }

  // 设置缓存
  private setCache(key: string, result: LLMCompletionResult): void {
    if (!this.config.enableCache) return

    this.cache.set(key, {
      result,
      timestamp: Date.now()
    })

    // 清理过期缓存
    this.cleanupCache()
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

  // 完成请求（非流式）
  async complete(
    messages: LLMMessage[],
    options?: LLMCompletionOptions & { provider?: string; skipCache?: boolean }
  ): Promise<LLMCompletionResult> {
    const providerName = options?.provider || this.defaultProvider
    const cacheKey = this.generateCacheKey(messages, options)

    // 检查缓存
    if (!options?.skipCache) {
      const cached = this.checkCache(cacheKey)
      if (cached) {
        this.emit('cache:hit', { provider: providerName, messages })
        return cached
      }
    }

    try {
      const provider = this.getProvider(providerName)
      this.emit('completion:start', { provider: providerName, messages })

      const startTime = Date.now()
      const result = await provider.complete(messages, options)
      const duration = Date.now() - startTime

      this.emit('completion:end', {
        provider: providerName,
        duration,
        usage: result.usage
      })

      // 缓存结果
      if (!options?.skipCache) {
        this.setCache(cacheKey, result)
      }

      return result
    } catch (error) {
      this.logger.error('Completion failed, trying fallback', { error, provider: providerName })

      // 尝试 fallback
      if (this.fallbackProvider && providerName !== this.fallbackProvider) {
        this.emit('completion:fallback', { from: providerName, to: this.fallbackProvider })
        return this.complete(messages, { ...options, provider: this.fallbackProvider })
      }

      this.emit('completion:error', { provider: providerName, error })
      throw error
    }
  }

  // 流式完成
  async *stream(
    messages: LLMMessage[],
    options?: LLMCompletionOptions & { provider?: string }
  ): AsyncGenerator<LLMStreamChunk> {
    const providerName = options?.provider || this.defaultProvider

    try {
      const provider = this.getProvider(providerName)
      this.emit('stream:start', { provider: providerName, messages })

      const startTime = Date.now()
      let totalTokens = 0

      for await (const chunk of provider.stream(messages, options)) {
        if (chunk.content) {
          totalTokens += Math.ceil(chunk.content.length / 4) // 粗略估算
        }
        yield chunk
      }

      const duration = Date.now() - startTime
      this.emit('stream:end', {
        provider: providerName,
        duration,
        estimatedTokens: totalTokens
      })
    } catch (error) {
      this.logger.error('Stream failed, trying fallback', { error, provider: providerName })

      // 尝试 fallback
      if (this.fallbackProvider && providerName !== this.fallbackProvider) {
        this.emit('stream:fallback', { from: providerName, to: this.fallbackProvider })
        yield* this.stream(messages, { ...options, provider: this.fallbackProvider })
        return
      }

      this.emit('stream:error', { provider: providerName, error })
      throw error
    }
  }

  // 工具调用（基于 complete 的封装）
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

  // 获取可用工具描述
  async getToolDescriptions(): Promise<LLMToolDefinition[]> {
    // 这个方法可以被具体实现覆盖
    return []
  }

  // 清空缓存
  clearCache(): void {
    this.cache.clear()
    this.logger.info('Cache cleared')
  }

  // 获取缓存统计
  getCacheStats(): { size: number; maxSize: number } {
    return {
      size: this.cache.size,
      maxSize: 1000 // 默认最大缓存条目数
    }
  }
}

// 全局 LLM Service 实例
let globalLLMService: LLMService | null = null

export function initializeLLMService(config: LLMServiceConfig): LLMService {
  globalLLMService = new LLMService(config)
  return globalLLMService
}

export function getLLMService(): LLMService {
  if (!globalLLMService) {
    throw new Error('LLM Service not initialized. Call initializeLLMService first.')
  }
  return globalLLMService
}

export function resetLLMService(): void {
  globalLLMService = null
}

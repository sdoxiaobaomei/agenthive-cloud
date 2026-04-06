// LLM Service 模块导出 - 包含增强版

// 基础类型
export * from './types.js'

// 基础版 LLM Service
export {
  LLMService,
  LLMServiceConfig,
  initializeLLMService,
  getLLMService,
  resetLLMService
} from './LLMService.js'

// 增强版 LLM Service（推荐使用）
export {
  LLMServiceEnhanced,
  LLMServiceEnhancedConfig,
  RetryConfig,
  initializeLLMServiceEnhanced,
  getLLMServiceEnhanced,
  resetLLMServiceEnhanced
} from './LLMServiceEnhanced.js'

// Provider 实现
export { AnthropicProvider } from './providers/anthropic.js'
export { OpenAIProvider } from './providers/openai.js'

// ============================================================================
// 推荐配置
// ============================================================================

import { LLMServiceEnhancedConfig } from './LLMServiceEnhanced.js'

/**
 * 生产环境推荐配置
 */
export const RECOMMENDED_PRODUCTION_CONFIG: LLMServiceEnhancedConfig = {
  defaultProvider: {
    provider: 'anthropic',
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    model: 'claude-3-sonnet-20240229'
  },
  fallbackProvider: {
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY || '',
    model: 'gpt-4'
  },
  enableCache: true,
  cacheTTL: 3600, // 1 hour
  maxCacheSize: 1000,
  retryConfig: {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
    retryableErrors: ['network', 'rate_limit', 'server']
  },
  enableMetrics: true
}

/**
 * 开发环境推荐配置
 */
export const RECOMMENDED_DEVELOPMENT_CONFIG: LLMServiceEnhancedConfig = {
  defaultProvider: {
    provider: 'anthropic',
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    model: 'claude-3-haiku-20240307' // 使用更快的模型
  },
  enableCache: true,
  cacheTTL: 600, // 10 minutes
  maxCacheSize: 100,
  retryConfig: {
    maxRetries: 2,
    initialDelayMs: 500,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
    retryableErrors: ['network', 'rate_limit', 'server']
  },
  enableMetrics: true
}

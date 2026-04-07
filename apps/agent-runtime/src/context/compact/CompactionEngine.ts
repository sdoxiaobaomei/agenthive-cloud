/**
 * Context Compression Engine - 上下文压缩引擎
 * 
 * 提供三级压缩策略：
 * 1. Snip Compaction - 简单消息移除
 * 2. Compact Conversation - 摘要压缩
 * 3. Context Collapse - 完全折叠
 * 
 * 参考 Claude Code 的 compaction 实现
 */

import type { LLMMessage } from '../../services/llm/types.js'
import type { LLMService } from '../../services/llm/LLMService.js'
import { Logger } from '../../utils/loggerEnhanced.js'

// ============================================================================
// 类型定义
// ============================================================================

export type CompactionStrategy = 'snip' | 'compact' | 'collapse'

export interface CompactionResult {
  strategy: CompactionStrategy
  messages: LLMMessage[]
  originalMessages: number
  compressedTokens: number
  originalTokens: number
  summary?: string
  tokensSaved: number
  compactionRatio: number
}

export interface CompactionConfig {
  llmService: LLMService
  snipThreshold?: number          // Snip 策略触发阈值 (tokens)
  compactThreshold?: number       // Compact 策略触发阈值
  collapseThreshold?: number      // Collapse 策略触发阈值
  snipRatio?: number              // Snip 移除比例 (0-1)
  targetReduction?: number        // Compact 目标压缩比例
  summaryModel?: string           // 用于生成摘要的模型
}

export interface TokenEstimator {
  estimate(messages: LLMMessage[]): number
  estimateSingle(message: LLMMessage): number
}

// ============================================================================
// 简单的 Token 估算器
// ============================================================================

export class SimpleTokenEstimator implements TokenEstimator {
  estimate(messages: LLMMessage[]): number {
    return messages.reduce((total, msg) => total + this.estimateSingle(msg), 0)
  }

  estimateSingle(message: LLMMessage): number {
    // 简单估算：每个字符约 0.25 token，加上固定开销
    const content = message.content || ''
    const toolCalls = (message as any).toolCalls
    let toolTokens = 0
    
    if (toolCalls && Array.isArray(toolCalls)) {
      toolTokens = toolCalls.reduce((sum, tc) => {
        return sum + (tc.function?.arguments?.length || 0) * 0.25 + 50 // 固定开销
      }, 0)
    }
    
    return Math.ceil(content.length * 0.25) + toolTokens + 4 // +4 是角色和格式开销
  }
}

// ============================================================================
// 压缩策略接口
// ============================================================================

export interface CompactionStrategyHandler {
  name: CompactionStrategy
  compact(messages: LLMMessage[], options: any): Promise<CompactionResult>
}

// ============================================================================
// Snip Compaction - 简单消息移除
// ============================================================================

export class SnipCompactionStrategy implements CompactionStrategyHandler {
  name: CompactionStrategy = 'snip'
  private estimator: TokenEstimator
  private logger: Logger

  constructor(estimator: TokenEstimator = new SimpleTokenEstimator()) {
    this.estimator = estimator
    this.logger = new Logger('SnipCompaction')
  }

  async compact(
    messages: LLMMessage[],
    options: { ratio?: number; keepSystem?: boolean; keepFirstN?: number; keepLastN?: number }
  ): Promise<CompactionResult> {
    const originalTokens = this.estimator.estimate(messages)
    const ratio = options.ratio ?? 0.5
    const keepSystem = options.keepSystem ?? true
    const keepFirstN = options.keepFirstN ?? 1
    const keepLastN = options.keepLastN ?? 3

    this.logger.debug('Snip compaction', { ratio, messages: messages.length })

    // 分离系统消息
    const systemMessages = keepSystem 
      ? messages.filter(m => m.role === 'system')
      : []

    // 分离用户/助手消息
    const conversationMessages = messages.filter(m => m.role !== 'system')

    // 如果消息太少，不需要压缩
    if (conversationMessages.length <= Math.max(1, keepFirstN + keepLastN - 1)) {
      return {
        strategy: 'snip',
        messages: [...messages],
        originalMessages: messages.length,
        compressedTokens: originalTokens,
        originalTokens,
        summary: 'No messages to remove',
        tokensSaved: 0,
        compactionRatio: 0
      }
    }

    // 计算需要保留的消息
    const targetKeepCount = Math.ceil(conversationMessages.length * (1 - ratio))
    const minKeepCount = Math.min(keepFirstN + keepLastN, conversationMessages.length)
    const totalToKeep = Math.max(targetKeepCount, minKeepCount)

    // 保留前面的消息
    const firstPart = conversationMessages.slice(0, keepFirstN)
    
    // 保留后面的消息
    const lastPart = conversationMessages.slice(-keepLastN)

    // 中间的消息被移除
    const middleRemoved = Math.max(0, conversationMessages.length - firstPart.length - lastPart.length)

    // 组合结果
    const compressed = [
      ...systemMessages,
      ...firstPart,
      ...lastPart
    ]

    const compressedTokens = this.estimator.estimate(compressed)
    const tokensSaved = Math.max(0, originalTokens - compressedTokens)

    this.logger.info(`Snip removed ${middleRemoved} messages, saved ${tokensSaved} tokens`)

    return {
      strategy: 'snip',
      messages: compressed,
      originalMessages: messages.length,
      compressedTokens,
      originalTokens,
      summary: `Removed ${middleRemoved} middle messages`,
      tokensSaved,
      compactionRatio: tokensSaved / originalTokens
    }
  }
}

// ============================================================================
// Compact Conversation - 摘要压缩
// ============================================================================

export class CompactConversationStrategy implements CompactionStrategyHandler {
  name: CompactionStrategy = 'compact'
  private llmService: LLMService
  private estimator: TokenEstimator
  private logger: Logger
  private summaryModel: string

  constructor(
    llmService: LLMService,
    estimator: TokenEstimator = new SimpleTokenEstimator(),
    summaryModel?: string
  ) {
    this.llmService = llmService
    this.estimator = estimator
    this.summaryModel = summaryModel || 'gpt-4o-mini'
    this.logger = new Logger('CompactConversation')
  }

  async compact(
    messages: LLMMessage[],
    options: { keepSystem?: boolean; keepRecent?: number }
  ): Promise<CompactionResult> {
    const originalTokens = this.estimator.estimate(messages)
    const keepSystem = options.keepSystem ?? true
    const keepRecent = options.keepRecent ?? 4

    this.logger.debug('Compact conversation', { messages: messages.length })

    // 分离系统消息
    const systemMessages = keepSystem
      ? messages.filter(m => m.role === 'system')
      : []

    // 分离用户/助手消息
    const conversationMessages = messages.filter(m => m.role !== 'system')

    // 分离最近的消息（保留原样）
    const recentMessages = conversationMessages.slice(-keepRecent)
    const olderMessages = conversationMessages.slice(0, -keepRecent)

    if (olderMessages.length === 0) {
      // 没有旧消息需要压缩
      return {
        strategy: 'compact',
        messages,
        originalMessages: messages.length,
        compressedTokens: originalTokens,
        originalTokens,
        summary: 'No messages to compress',
        tokensSaved: 0,
        compactionRatio: 0
      }
    }

    // 生成摘要
    const summary = await this.generateSummary(olderMessages)

    // 创建摘要消息
    const summaryMessage: LLMMessage = {
      role: 'user',
      content: `[Previous conversation summary: ${summary}]`
    }

    // 组合结果
    const compressed = [
      ...systemMessages,
      summaryMessage,
      ...recentMessages
    ]

    const compressedTokens = this.estimator.estimate(compressed)
    const tokensSaved = originalTokens - compressedTokens

    this.logger.info(`Compact reduced from ${messages.length} to ${compressed.length} messages, saved ${tokensSaved} tokens`)

    return {
      strategy: 'compact',
      messages: compressed,
      originalMessages: messages.length,
      compressedTokens,
      originalTokens,
      summary,
      tokensSaved,
      compactionRatio: tokensSaved / originalTokens
    }
  }

  private async generateSummary(messages: LLMMessage[]): Promise<string> {
    const conversationText = messages
      .map(m => `${m.role}: ${m.content}`)
      .join('\n\n')

    const prompt = `Summarize the following conversation concisely. Focus on:
- Key decisions made
- Important context that needs to be remembered
- Current state or progress

Conversation:
${conversationText}

Summary:`

    try {
      const result = await this.llmService.complete([
        { role: 'user', content: prompt }
      ], {
        model: this.summaryModel,
        maxTokens: 500
      })

      return result.content?.trim() || 'No summary available'
    } catch (error) {
      this.logger.error('Failed to generate summary', { error: String(error) })
      return 'Summary generation failed'
    }
  }
}

// ============================================================================
// Context Collapse - 完全折叠
// ============================================================================

export class ContextCollapseStrategy implements CompactionStrategyHandler {
  name: CompactionStrategy = 'collapse'
  private llmService: LLMService
  private estimator: TokenEstimator
  private logger: Logger
  private summaryModel: string

  constructor(
    llmService: LLMService,
    estimator: TokenEstimator = new SimpleTokenEstimator(),
    summaryModel?: string
  ) {
    this.llmService = llmService
    this.estimator = estimator
    this.summaryModel = summaryModel || 'gpt-4o'
    this.logger = new Logger('ContextCollapse')
  }

  async compact(
    messages: LLMMessage[],
    options: { keepSystem?: boolean; preserveTask?: boolean }
  ): Promise<CompactionResult> {
    const originalTokens = this.estimator.estimate(messages)
    const keepSystem = options.keepSystem ?? true
    const preserveTask = options.preserveTask ?? true

    this.logger.debug('Context collapse', { messages: messages.length })

    // 分离系统消息
    const systemMessages = keepSystem
      ? messages.filter(m => m.role === 'system')
      : []

    // 分离用户/助手消息
    const conversationMessages = messages.filter(m => m.role !== 'system')

    // 如果要求保留任务，提取最近的任务描述
    let taskContext = ''
    if (preserveTask) {
      const lastUserMessage = messages
        .reverse()
        .find(m => m.role === 'user' && !m.content?.includes('['))
      if (lastUserMessage) {
        taskContext = `Current task: ${lastUserMessage.content}`
      }
    }

    // 生成完整摘要
    const fullSummary = await this.generateFullSummary(conversationMessages)

    // 创建摘要消息
    let summaryContent = `[Complete context summary: ${fullSummary}]`
    if (taskContext) {
      summaryContent += `\n\n${taskContext}`
    }

    const summaryMessage: LLMMessage = {
      role: 'user',
      content: summaryContent
    }

    // 组合结果 - 只保留系统消息和摘要
    const compressed = [...systemMessages, summaryMessage]

    const compressedTokens = this.estimator.estimate(compressed)
    const tokensSaved = originalTokens - compressedTokens

    this.logger.info(`Collapse reduced from ${messages.length} to ${compressed.length} messages, saved ${tokensSaved} tokens`)

    return {
      strategy: 'collapse',
      messages: compressed,
      originalMessages: messages.length,
      compressedTokens,
      originalTokens,
      summary: fullSummary,
      tokensSaved,
      compactionRatio: tokensSaved / originalTokens
    }
  }

  private async generateFullSummary(messages: LLMMessage[]): Promise<string> {
    const conversationText = messages
      .map(m => `${m.role}: ${m.content}`)
      .join('\n\n')

    const prompt = `Provide a comprehensive summary of this conversation. Include:
- Original user request and intent
- All significant actions taken
- Key findings or results
- Current progress and state
- Any pending items or next steps

Conversation:
${conversationText}

Comprehensive Summary:`

    try {
      const result = await this.llmService.complete([
        { role: 'user', content: prompt }
      ], {
        model: this.summaryModel,
        maxTokens: 1000
      })

      return result.content?.trim() || 'No summary available'
    } catch (error) {
      this.logger.error('Failed to generate full summary', { error: String(error) })
      return 'Summary generation failed'
    }
  }
}

// ============================================================================
// 压缩引擎主类
// ============================================================================

export class CompactionEngine {
  private config: CompactionConfig
  private strategies: Map<CompactionStrategy, CompactionStrategyHandler>
  private estimator: TokenEstimator
  private logger: Logger

  constructor(config: CompactionConfig) {
    this.config = {
      snipThreshold: 8000,
      compactThreshold: 12000,
      collapseThreshold: 16000,
      snipRatio: 0.3,
      targetReduction: 0.5,
      summaryModel: 'gpt-4o-mini',
      ...config
    }

    this.estimator = new SimpleTokenEstimator()
    this.logger = new Logger('CompactionEngine')

    // 初始化策略
    this.strategies = new Map()
    this.strategies.set('snip', new SnipCompactionStrategy(this.estimator))
    this.strategies.set('compact', new CompactConversationStrategy(
      config.llmService,
      this.estimator,
      config.summaryModel
    ))
    this.strategies.set('collapse', new ContextCollapseStrategy(
      config.llmService,
      this.estimator,
      config.summaryModel
    ))
  }

  /**
   * 智能压缩 - 根据 token 数量自动选择策略
   */
  async compact(messages: LLMMessage[]): Promise<CompactionResult> {
    const totalTokens = this.estimator.estimate(messages)

    // 确定策略
    let strategy: CompactionStrategy = 'snip'
    if (totalTokens >= (this.config.collapseThreshold || 16000)) {
      strategy = 'collapse'
    } else if (totalTokens >= (this.config.compactThreshold || 12000)) {
      strategy = 'compact'
    } else if (totalTokens >= (this.config.snipThreshold || 8000)) {
      strategy = 'snip'
    } else {
      // 不需要压缩
      return {
        strategy: 'snip',
        messages,
        originalMessages: messages.length,
        compressedTokens: totalTokens,
        originalTokens: totalTokens,
        summary: 'No compaction needed',
        tokensSaved: 0,
        compactionRatio: 0
      }
    }

    this.logger.info(`Auto-selected compaction strategy: ${strategy}`, { totalTokens })

    // 执行压缩
    const handler = this.strategies.get(strategy)
    if (!handler) {
      throw new Error(`Unknown compaction strategy: ${strategy}`)
    }

    return handler.compact(messages, {
      ratio: this.config.snipRatio,
      targetReduction: this.config.targetReduction
    })
  }

  /**
   * 使用指定策略压缩
   */
  async compactWithStrategy(
    messages: LLMMessage[],
    strategy: CompactionStrategy,
    options?: any
  ): Promise<CompactionResult> {
    const handler = this.strategies.get(strategy)
    if (!handler) {
      throw new Error(`Unknown compaction strategy: ${strategy}`)
    }

    return handler.compact(messages, options || {})
  }

  /**
   * 获取 token 数量
   */
  estimateTokens(messages: LLMMessage[]): number {
    return this.estimator.estimate(messages)
  }

  /**
   * 设置策略
   */
  setStrategy(strategy: CompactionStrategy, handler: CompactionStrategyHandler): void {
    this.strategies.set(strategy, handler)
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<CompactionConfig>): void {
    Object.assign(this.config, config)
  }
}

// ============================================================================
// 导出
// ============================================================================

export default CompactionEngine

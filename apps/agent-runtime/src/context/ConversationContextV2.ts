// 增强版对话上下文管理 - 参考 Claude Code 的智能压缩策略
import { Logger } from '../utils/logger.js'
import { LLMMessage, LLMToolCall, LLMToolResult } from '../services/llm/types.js'

export interface ContextStats {
  totalMessages: number
  totalTokens: number
  userMessages: number
  assistantMessages: number
  toolCalls: number
  compressedMessages: number
}

export interface CompressionInfo {
  originalTokens: number
  compressedTokens: number
  strategy: string
  timestamp: number
}

// Token 估算器
function estimateTokens(text: string): number {
  // 更准确的估算：英文约 4 字符/token，中文约 1 字符/token
  // 使用加权平均
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length
  const otherChars = text.length - chineseChars
  return Math.ceil(chineseChars + otherChars / 4)
}

// 消息重要性评分
function scoreMessageImportance(message: LLMMessage, index: number, total: number): number {
  let score = 0

  // 系统消息重要性最高
  if (message.role === 'system') {
    score += 100
  }

  // 最近的对话更重要
  const recency = index / total
  score += (1 - recency) * 50

  // 包含工具调用的消息较重要
  if (message.toolCalls && message.toolCalls.length > 0) {
    score += 20
  }

  // 包含错误的结果较重要
  if (message.toolResults) {
    const hasError = message.toolResults.some(r => r.error)
    if (hasError) score += 15
  }

  // 用户消息比助手消息略重要
  if (message.role === 'user') {
    score += 5
  }

  return score
}

export class ConversationContextV2 {
  private messages: LLMMessage[] = []
  private maxTokens: number
  private compressionThreshold: number
  private targetTokens: number
  private logger: Logger
  private compressionHistory: CompressionInfo[] = []
  private systemPrompt: string = ''

  constructor(options: {
    maxTokens?: number
    compressionThreshold?: number
    targetTokens?: number
  } = {}) {
    this.maxTokens = options.maxTokens || 12000
    this.compressionThreshold = options.compressionThreshold || 10000
    this.targetTokens = options.targetTokens || 6000
    this.logger = new Logger('ConversationContextV2')
  }

  // 设置系统提示词
  setSystemPrompt(prompt: string): void {
    this.systemPrompt = prompt
    // 更新或添加系统消息
    const existingIndex = this.messages.findIndex(m => m.role === 'system')
    if (existingIndex >= 0) {
      this.messages[existingIndex].content = prompt
    } else {
      this.messages.unshift({
        role: 'system',
        content: prompt
      })
    }
  }

  // 添加消息
  addMessage(message: Omit<LLMMessage, 'toolCalls' | 'toolResults'> & { toolCalls?: LLMToolCall[]; toolResults?: LLMToolResult[] }): void {
    const content = typeof message.content === 'string' ? message.content : JSON.stringify(message.content)
    const tokens = estimateTokens(content)

    const fullMessage: LLMMessage = {
      role: message.role,
      content: message.content,
      toolCalls: message.toolCalls,
      toolResults: message.toolResults
    }

    this.messages.push(fullMessage)
    this.logger.debug(`Added message`, { role: message.role, tokens, contentLength: content.length })

    // 检查是否需要压缩
    this.maybeCompress()
  }

  // 添加系统消息
  addSystemMessage(content: string): void {
    this.addMessage({ role: 'system', content })
  }

  // 添加用户消息
  addUserMessage(content: string): void {
    this.addMessage({ role: 'user', content })
  }

  // 添加助手消息
  addAssistantMessage(content: string, toolCalls?: LLMToolCall[]): void {
    this.addMessage({ role: 'assistant', content, toolCalls })
  }

  // 添加工具结果
  addToolResults(results: LLMToolResult[]): void {
    const content = results.map(r =>
      `${r.toolCallId}: ${r.error ? `Error: ${r.error}` : JSON.stringify(r.output)}`
    ).join('\n')

    this.addMessage({
      role: 'tool',
      content,
      toolResults: results
    })
  }

  // 获取所有消息
  getMessages(): LLMMessage[] {
    return [...this.messages]
  }

  // 获取最近的消息
  getRecentMessages(count: number): LLMMessage[] {
    return this.messages.slice(-count)
  }

  // 获取上下文统计
  getStats(): ContextStats {
    const totalTokens = this.messages.reduce((sum, m) => sum + estimateTokens(m.content), 0)

    return {
      totalMessages: this.messages.length,
      totalTokens,
      userMessages: this.messages.filter(m => m.role === 'user').length,
      assistantMessages: this.messages.filter(m => m.role === 'assistant').length,
      toolCalls: this.messages.filter(m => m.toolCalls).length,
      compressedMessages: this.compressionHistory.reduce((sum, h) => sum + (h.originalTokens - h.compressedTokens), 0)
    }
  }

  // 清空上下文
  clear(): void {
    this.messages = []
    this.compressionHistory = []
    if (this.systemPrompt) {
      this.messages.push({
        role: 'system',
        content: this.systemPrompt
      })
    }
    this.logger.info('Context cleared')
  }

  // 检查是否需要压缩
  private maybeCompress(): void {
    const stats = this.getStats()

    if (stats.totalTokens > this.compressionThreshold) {
      this.logger.info(`Context exceeded threshold (${stats.totalTokens} > ${this.compressionThreshold}), compressing...`)
      this.compress()
    }
  }

  // 智能压缩策略
  private compress(): void {
    const originalTokens = this.getStats().totalTokens

    if (this.messages.length <= 5) {
      this.logger.debug('Too few messages to compress')
      return
    }

    // 策略 1: 保留系统消息和高重要性消息
    const scoredMessages = this.messages.map((msg, idx) => ({
      message: msg,
      score: scoreMessageImportance(msg, idx, this.messages.length),
      index: idx
    }))

    // 排序并决定保留哪些消息
    scoredMessages.sort((a, b) => b.score - a.score)

    // 保留前 N 条最重要的消息 + 最近的消息
    const keepCount = Math.max(10, Math.floor(this.messages.length * 0.3))
    const topMessages = scoredMessages.slice(0, keepCount)
    const recentMessages = this.messages.slice(-5)

    // 合并去重并保持原始顺序
    const keepIndices = new Set([
      ...topMessages.map(m => m.index),
      ...recentMessages.map((_, i) => this.messages.length - 5 + i)
    ])

    // 策略 2: 压缩中间消息为摘要
    const keptMessages: LLMMessage[] = []
    const omittedMessages: LLMMessage[] = []

    for (let i = 0; i < this.messages.length; i++) {
      if (keepIndices.has(i) || this.messages[i].role === 'system') {
        keptMessages.push(this.messages[i])
      } else {
        omittedMessages.push(this.messages[i])
      }
    }

    // 生成摘要
    if (omittedMessages.length > 0) {
      const summary = this.generateSummary(omittedMessages)
      const summaryMessage: LLMMessage = {
        role: 'system',
        content: `[Context Summary: ${summary}]`
      }

      // 插入到系统消息之后
      const systemIndex = keptMessages.findIndex(m => m.role === 'system')
      const insertIndex = systemIndex >= 0 ? systemIndex + 1 : 0
      keptMessages.splice(insertIndex, 0, summaryMessage)
    }

    this.messages = keptMessages

    // 记录压缩信息
    const compressedTokens = this.getStats().totalTokens
    this.compressionHistory.push({
      originalTokens,
      compressedTokens,
      strategy: 'smart_summarization',
      timestamp: Date.now()
    })

    this.logger.info('Context compressed', {
      originalTokens,
      compressedTokens,
      saved: originalTokens - compressedTokens,
      keptMessages: keptMessages.length
    })

    // 如果还是超过限制，使用更激进的策略
    if (compressedTokens > this.maxTokens) {
      this.aggressiveCompress()
    }
  }

  // 激进压缩 - 仅保留系统消息和最近的消息
  private aggressiveCompress(): void {
    const originalTokens = this.getStats().totalTokens

    // 保留系统消息
    const systemMessages = this.messages.filter(m => m.role === 'system')

    // 只保留最近 5 条
    const recentMessages = this.messages.slice(-5)

    this.messages = [...systemMessages, ...recentMessages]

    const compressedTokens = this.getStats().totalTokens
    this.compressionHistory.push({
      originalTokens,
      compressedTokens,
      strategy: 'aggressive_truncation',
      timestamp: Date.now()
    })

    this.logger.info('Aggressive compression applied', {
      originalTokens,
      compressedTokens,
      saved: originalTokens - compressedTokens
    })
  }

  // 生成摘要
  private generateSummary(messages: LLMMessage[]): string {
    const toolCallCount = messages.filter(m => m.toolCalls).length
    const toolResultCount = messages.filter(m => m.toolResults).length
    const userCount = messages.filter(m => m.role === 'user').length
    const assistantCount = messages.filter(m => m.role === 'assistant').length

    const parts: string[] = []
    parts.push(`${messages.length} messages omitted`)

    if (userCount > 0) parts.push(`${userCount} user messages`)
    if (assistantCount > 0) parts.push(`${assistantCount} assistant responses`)
    if (toolCallCount > 0) parts.push(`${toolCallCount} tool calls`)
    if (toolResultCount > 0) parts.push(`${toolResultCount} tool results`)

    return parts.join(', ')
  }

  // 导出为 LLM 格式
  toLLMMessages(): LLMMessage[] {
    return this.messages.map(m => ({
      role: m.role,
      content: m.content,
      toolCalls: m.toolCalls,
      toolResults: m.toolResults
    }))
  }

  // 导出为 OpenAI/Anthropic 格式
  toProviderMessages(): Array<{ role: string; content: string }> {
    return this.messages
      .filter(m => m.role !== 'tool') // 工具结果通常需要特殊处理
      .map(m => ({
        role: m.role,
        content: m.content
      }))
  }

  // 序列化（用于持久化）
  serialize(): string {
    return JSON.stringify({
      messages: this.messages,
      maxTokens: this.maxTokens,
      compressionThreshold: this.compressionThreshold,
      targetTokens: this.targetTokens,
      systemPrompt: this.systemPrompt,
      compressionHistory: this.compressionHistory
    })
  }

  // 反序列化
  static deserialize(data: string): ConversationContextV2 {
    const parsed = JSON.parse(data)
    const context = new ConversationContextV2({
      maxTokens: parsed.maxTokens,
      compressionThreshold: parsed.compressionThreshold,
      targetTokens: parsed.targetTokens
    })
    context.messages = parsed.messages || []
    context.systemPrompt = parsed.systemPrompt || ''
    context.compressionHistory = parsed.compressionHistory || []
    return context
  }

  // 获取压缩历史
  getCompressionHistory(): CompressionInfo[] {
    return [...this.compressionHistory]
  }

  // 替换消息（用于应用压缩结果）
  replaceMessages(messages: LLMMessage[]): void {
    // 保留系统提示词
    const systemMessages = this.messages.filter(m => m.role === 'system')
    const newSystemMessages = messages.filter(m => m.role === 'system')

    // 如果新的消息中没有系统消息但原来有，保留原来的系统消息
    if (newSystemMessages.length === 0 && systemMessages.length > 0) {
      this.messages = [...systemMessages, ...messages.filter(m => m.role !== 'system')]
    } else {
      this.messages = [...messages]
    }

    this.logger.info('Messages replaced', {
      newCount: this.messages.length,
      systemPromptPreserved: this.systemPrompt ? true : false
    })
  }
}

// 全局上下文实例
export const globalContextV2 = new ConversationContextV2()

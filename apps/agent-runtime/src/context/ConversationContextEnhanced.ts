// Enhanced Conversation Context - 优化版对话上下文管理
// 参考 Claude Code 的压缩策略：
// - Snip Compaction: 剪除不重要历史
// - Micro-compact: 微观压缩
// - Context Collapse: 上下文折叠
// - Auto-compact: 自动摘要

import { Logger } from '../utils/logger.js'
import { LLMMessage, LLMToolCall, LLMToolResult } from '../services/llm/types.js'

export interface ContextStats {
  totalMessages: number
  totalTokens: number
  userMessages: number
  assistantMessages: number
  systemMessages: number
  toolCalls: number
  toolResults: number
  compressedMessages: number
  compressionRatio: number
}

export interface CompressionInfo {
  originalTokens: number
  compressedTokens: number
  originalMessages: number
  compressedMessages: number
  strategy: 'snip' | 'micro' | 'collapse' | 'summary' | 'aggressive'
  timestamp: number
  preservedMessageIds: string[]
}

export interface CompressionStrategy {
  name: string
  threshold: number // 触发阈值（token 比例）
  targetRatio: number // 目标压缩比例
  priority: number // 优先级（数字越小优先级越高）
}

// 默认压缩策略配置
const DEFAULT_STRATEGIES: CompressionStrategy[] = [
  { name: 'snip', threshold: 0.7, targetRatio: 0.8, priority: 1 },
  { name: 'micro', threshold: 0.8, targetRatio: 0.6, priority: 2 },
  { name: 'summary', threshold: 0.85, targetRatio: 0.5, priority: 3 },
  { name: 'collapse', threshold: 0.9, targetRatio: 0.4, priority: 4 },
  { name: 'aggressive', threshold: 0.95, targetRatio: 0.3, priority: 5 }
]

// 消息接口（带元数据）
interface MessageWithMeta extends LLMMessage {
  id: string
  timestamp: number
  importanceScore?: number
  compressedFrom?: string[] // 记录由哪些消息压缩而来
  compressionLevel?: number
}

// Token 估算器 - 更精确的估算
function estimateTokens(text: string): number {
  if (!text) return 0
  
  // 更准确的估算策略：
  // - 中文：约 1 字符/token
  // - 英文：约 4 字符/token
  // - 代码：约 3 字符/token（混合）
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length
  const codeIndicators = (text.match(/[{}();,=<>]/g) || []).length
  const otherChars = text.length - chineseChars
  
  // 代码密度高时使用不同的估算
  const codeRatio = codeIndicators / text.length
  const avgCharsPerToken = codeRatio > 0.1 ? 3.5 : 4
  
  return Math.ceil(chineseChars + otherChars / avgCharsPerToken)
}

// 消息重要性评分算法
function calculateImportanceScore(message: MessageWithMeta, index: number, total: number): number {
  let score = 0

  // 1. 角色权重
  switch (message.role) {
    case 'system':
      score += 100 // 系统消息最重要
      break
    case 'user':
      score += 30  // 用户消息重要
      break
    case 'assistant':
      score += 20
      break
    case 'tool':
      score += 15
      break
  }

  // 2. 时间衰减（越近越重要）
  const recency = Math.pow(1 - index / total, 2) // 平方衰减，近期更重要
  score += recency * 50

  // 3. 内容特征
  const content = typeof message.content === 'string' ? message.content : JSON.stringify(message.content)
  
  // 包含工具调用的消息较重要
  if (message.toolCalls && message.toolCalls.length > 0) {
    score += 25
    // 编辑类工具更重要
    const editTools = message.toolCalls.filter(t => 
      ['file_write', 'file_edit', 'bash'].some(name => 
        t.function?.name?.includes(name)
      )
    )
    score += editTools.length * 10
  }

  // 包含错误的结果很重要
  if (message.toolResults) {
    const hasError = message.toolResults.some(r => r.error)
    if (hasError) score += 30
    else score += 10
  }

  // 包含关键信息的内容更重要
  const criticalPatterns = [
    /error|exception|fail|bug/i,
    /success|completed|done/i,
    /important|critical|warning/i,
    /function|class|interface/i
  ]
  
  for (const pattern of criticalPatterns) {
    if (pattern.test(content)) {
      score += 5
      break
    }
  }

  // 4. 长度因子（适中长度更重要，太短可能是无意义的）
  const tokenCount = estimateTokens(content)
  if (tokenCount > 10 && tokenCount < 500) {
    score += 5
  }

  return score
}

export class ConversationContextEnhanced {
  private messages: MessageWithMeta[] = []
  private maxTokens: number
  private compressionThreshold: number
  private targetTokens: number
  private logger: Logger
  private compressionHistory: CompressionInfo[] = []
  private systemPrompt: string = ''
  private strategies: CompressionStrategy[]
  private messageCounter: number = 0

  constructor(options: {
    maxTokens?: number
    compressionThreshold?: number
    targetTokens?: number
    strategies?: CompressionStrategy[]
  } = {}) {
    this.maxTokens = options.maxTokens || 16000
    this.compressionThreshold = options.compressionThreshold || 0.8 // 80% 时触发压缩
    this.targetTokens = options.targetTokens || Math.floor(this.maxTokens * 0.6)
    this.strategies = options.strategies || DEFAULT_STRATEGIES
    this.logger = new Logger('ConversationContextEnhanced')
  }

  // 生成唯一消息 ID
  private generateMessageId(): string {
    return `msg-${++this.messageCounter}-${Date.now().toString(36)}`
  }

  // 设置系统提示词
  setSystemPrompt(prompt: string): void {
    this.systemPrompt = prompt
    
    // 查找现有的系统消息
    const existingIndex = this.messages.findIndex(m => m.role === 'system' && !m.compressedFrom)
    
    if (existingIndex >= 0) {
      this.messages[existingIndex].content = prompt
      this.messages[existingIndex].timestamp = Date.now()
    } else {
      this.messages.unshift({
        id: this.generateMessageId(),
        role: 'system',
        content: prompt,
        timestamp: Date.now()
      })
    }
  }

  // 添加系统消息（辅助/摘要类）
  addSystemMessage(content: string, isCompressed = false): void {
    this.addMessage({
      role: 'system',
      content,
      isCompressed
    })
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

  // 添加消息（核心方法）
  addMessage(message: Omit<LLMMessage, 'toolCalls' | 'toolResults'> & { 
    toolCalls?: LLMToolCall[]
    toolResults?: LLMToolResult[]
    isCompressed?: boolean
  }): void {
    const content = typeof message.content === 'string' ? message.content : JSON.stringify(message.content)
    const tokens = estimateTokens(content)

    const fullMessage: MessageWithMeta = {
      id: this.generateMessageId(),
      role: message.role,
      content: message.content,
      toolCalls: message.toolCalls,
      toolResults: message.toolResults,
      timestamp: Date.now(),
      compressionLevel: message.isCompressed ? 1 : 0
    }

    this.messages.push(fullMessage)
    
    this.logger.debug(`Added message`, { 
      role: message.role, 
      tokens, 
      id: fullMessage.id,
      totalMessages: this.messages.length 
    })

    // 检查是否需要压缩
    this.maybeCompress()
  }

  // 获取所有消息
  getMessages(): LLMMessage[] {
    return this.messages.map(m => ({
      role: m.role,
      content: m.content,
      toolCalls: m.toolCalls,
      toolResults: m.toolResults
    }))
  }

  // 转换为 LLM 消息格式
  toLLMMessages(): LLMMessage[] {
    return this.getMessages()
  }

  // 获取最近的消息
  getRecentMessages(count: number): LLMMessage[] {
    return this.messages.slice(-count).map(m => ({
      role: m.role,
      content: m.content,
      toolCalls: m.toolCalls,
      toolResults: m.toolResults
    }))
  }

  // 获取上下文统计
  getStats(): ContextStats {
    const totalTokens = this.messages.reduce((sum, m) => 
      sum + estimateTokens(typeof m.content === 'string' ? m.content : JSON.stringify(m.content)), 0
    )
    
    const originalTokens = this.compressionHistory.reduce((sum, h) => sum + h.originalTokens, 0) || totalTokens
    
    return {
      totalMessages: this.messages.length,
      totalTokens,
      userMessages: this.messages.filter(m => m.role === 'user' && !m.compressedFrom).length,
      assistantMessages: this.messages.filter(m => m.role === 'assistant' && !m.compressedFrom).length,
      systemMessages: this.messages.filter(m => m.role === 'system').length,
      toolCalls: this.messages.filter(m => m.toolCalls).length,
      toolResults: this.messages.filter(m => m.toolResults).length,
      compressedMessages: this.messages.filter(m => m.compressedFrom).length,
      compressionRatio: originalTokens > 0 ? Math.round((1 - totalTokens / originalTokens) * 100) : 0
    }
  }

  // 清空上下文
  clear(): void {
    const systemMessages = this.messages.filter(m => m.role === 'system')
    this.messages = [...systemMessages]
    this.compressionHistory = []
    this.messageCounter = 0
    this.logger.info('Context cleared')
  }

  // 检查是否需要压缩
  private maybeCompress(): void {
    const stats = this.getStats()
    const ratio = stats.totalTokens / this.maxTokens

    if (ratio >= this.compressionThreshold) {
      this.logger.info(`Context exceeded threshold (${Math.round(ratio * 100)}% > ${Math.round(this.compressionThreshold * 100)}%), compressing...`)
      this.compress(ratio)
    }
  }

  // 智能压缩 - 多策略管道
  compress(currentRatio?: number): void {
    const ratio = currentRatio || this.getStats().totalTokens / this.maxTokens
    
    // 根据当前比例选择合适的策略
    const strategy = this.strategies
      .filter(s => ratio >= s.threshold)
      .sort((a, b) => a.priority - b.priority)[0]

    if (!strategy) {
      this.logger.debug('No compression strategy applicable')
      return
    }

    this.logger.info(`Applying compression strategy: ${strategy.name}`)

    switch (strategy.name) {
      case 'snip':
        this.snipCompact()
        break
      case 'micro':
        this.microCompact()
        break
      case 'summary':
        this.summaryCompact()
        break
      case 'collapse':
        this.collapseCompact()
        break
      case 'aggressive':
        this.aggressiveCompact()
        break
      default:
        this.summaryCompact()
    }
  }

  // 策略 1: Snip Compaction - 剪除低重要性历史
  private snipCompact(): void {
    const originalTokens = this.getStats().totalTokens
    const originalCount = this.messages.length

    if (this.messages.length <= 10) {
      this.logger.debug('Too few messages for snip compaction')
      return
    }

    // 计算重要性分数
    const scoredMessages = this.messages.map((msg, idx) => ({
      message: msg,
      score: calculateImportanceScore(msg, idx, this.messages.length),
      index: idx
    }))

    // 保留：系统消息 + 最近的消息 + 高重要性消息
    const recentCount = 8
    const recentIndices = new Set(
      this.messages.slice(-recentCount).map((_, i) => this.messages.length - recentCount + i)
    )
    
    // 保留高重要性消息（前 30%）
    const topMessages = scoredMessages
      .filter(m => !recentIndices.has(m.index))
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.floor(this.messages.length * 0.3))

    const keepIndices = new Set([
      ...recentIndices,
      ...topMessages.map(m => m.index),
      // 始终保留系统消息
      ...this.messages.map((m, i) => m.role === 'system' ? i : -1).filter(i => i >= 0)
    ])

    // 被剪除的消息
    const snippedMessages: MessageWithMeta[] = []
    const keptMessages: MessageWithMeta[] = []

    for (let i = 0; i < this.messages.length; i++) {
      if (keepIndices.has(i)) {
        keptMessages.push(this.messages[i])
      } else {
        snippedMessages.push(this.messages[i])
      }
    }

    // 如果有被剪除的消息，添加摘要
    if (snippedMessages.length > 0) {
      const summary = `[${snippedMessages.length} older messages snipped to save context]`
      const summaryMsg: MessageWithMeta = {
        id: this.generateMessageId(),
        role: 'system',
        content: summary,
        timestamp: Date.now(),
        compressedFrom: snippedMessages.map(m => m.id)
      }
      
      // 插入到系统消息之后
      const lastSystemIndex = keptMessages.findLastIndex(m => m.role === 'system')
      const insertIndex = lastSystemIndex >= 0 ? lastSystemIndex + 1 : 0
      keptMessages.splice(insertIndex, 0, summaryMsg)
    }

    this.messages = keptMessages
    this.recordCompression(originalTokens, originalCount, 'snip')
  }

  // 策略 2: Micro-compact - 微观压缩（合并相邻的短消息）
  private microCompact(): void {
    const originalTokens = this.getStats().totalTokens
    const originalCount = this.messages.length

    const compacted: MessageWithMeta[] = []
    let pendingMerge: MessageWithMeta[] = []

    for (const msg of this.messages) {
      const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
      const tokens = estimateTokens(content)

      // 短消息（< 50 tokens）考虑合并
      if (tokens < 50 && msg.role !== 'system' && !msg.toolCalls && !msg.toolResults) {
        pendingMerge.push(msg)
        
        // 累积 3 条或达到一定 token 数时合并
        const pendingTokens = pendingMerge.reduce((sum, m) => 
          sum + estimateTokens(typeof m.content === 'string' ? m.content : JSON.stringify(m.content)), 0
        )
        
        if (pendingMerge.length >= 3 || pendingTokens > 100) {
          compacted.push(this.mergeMessages(pendingMerge))
          pendingMerge = []
        }
      } else {
        // 先处理待合并的消息
        if (pendingMerge.length > 0) {
          compacted.push(this.mergeMessages(pendingMerge))
          pendingMerge = []
        }
        compacted.push(msg)
      }
    }

    // 处理剩余的待合并消息
    if (pendingMerge.length > 0) {
      if (pendingMerge.length === 1) {
        compacted.push(pendingMerge[0])
      } else {
        compacted.push(this.mergeMessages(pendingMerge))
      }
    }

    this.messages = compacted
    this.recordCompression(originalTokens, originalCount, 'micro')
  }

  // 合并消息
  private mergeMessages(messages: MessageWithMeta[]): MessageWithMeta {
    if (messages.length === 1) return messages[0]

    const contents = messages.map(m => 
      `[${m.role}]: ${typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}`
    )

    return {
      id: this.generateMessageId(),
      role: 'system',
      content: `[Merged ${messages.length} messages]\n${contents.join('\n')}`,
      timestamp: Date.now(),
      compressedFrom: messages.map(m => m.id),
      compressionLevel: (messages[0].compressionLevel || 0) + 1
    }
  }

  // 策略 3: Summary Compact - 智能摘要压缩
  private summaryCompact(): void {
    const originalTokens = this.getStats().totalTokens
    const originalCount = this.messages.length

    if (this.messages.length <= 8) return

    // 保留系统和最近消息
    const systemMessages = this.messages.filter(m => m.role === 'system')
    const recentMessages = this.messages.slice(-6)
    
    // 中间的消息进行摘要
    const middleStart = systemMessages.length
    const middleEnd = this.messages.length - 6
    
    if (middleEnd <= middleStart) return

    const middleMessages = this.messages.slice(middleStart, middleEnd)
    const summary = this.generateSmartSummary(middleMessages)

    const summaryMsg: MessageWithMeta = {
      id: this.generateMessageId(),
      role: 'system',
      content: `[Earlier conversation summary]\n${summary}`,
      timestamp: Date.now(),
      compressedFrom: middleMessages.map(m => m.id)
    }

    this.messages = [...systemMessages, summaryMsg, ...recentMessages]
    this.recordCompression(originalTokens, originalCount, 'summary')
  }

  // 生成智能摘要
  private generateSmartSummary(messages: MessageWithMeta[]): string {
    const summaries: string[] = []
    
    // 提取关键信息
    const toolCalls: string[] = []
    const userRequests: string[] = []
    const assistantResponses: string[] = []
    
    for (const msg of messages) {
      if (msg.toolCalls) {
        for (const call of msg.toolCalls) {
          toolCalls.push(`${call.function.name}(${Object.keys(JSON.parse(call.function.arguments || '{}')).join(', ')})`)
        }
      }
      
      if (msg.role === 'user') {
        const content = typeof msg.content === 'string' ? msg.content : ''
        if (content.length < 200) {
          userRequests.push(content.slice(0, 100))
        }
      }
      
      if (msg.role === 'assistant') {
        const content = typeof msg.content === 'string' ? msg.content : ''
        // 提取关键结论
        const keyPoints = content.split(/[.!?]/).filter(s => 
          s.length > 20 && (
            s.includes('success') || 
            s.includes('completed') ||
            s.includes('found') ||
            s.includes('error') ||
            s.includes('use')
          )
        )
        if (keyPoints.length > 0) {
          assistantResponses.push(keyPoints[0].trim().slice(0, 150))
        }
      }
    }

    if (toolCalls.length > 0) {
      summaries.push(`Tools used: ${[...new Set(toolCalls)].slice(0, 5).join(', ')}${toolCalls.length > 5 ? '...' : ''}`)
    }
    
    if (userRequests.length > 0) {
      summaries.push(`Requests: ${userRequests.slice(-2).join('; ')}`)
    }
    
    if (assistantResponses.length > 0) {
      summaries.push(`Key findings: ${assistantResponses.slice(-2).join('; ')}`)
    }

    return summaries.join('\n') || `[${messages.length} messages summarized]`
  }

  // 策略 4: Collapse Compact - 上下文折叠（保留轨迹）
  private collapseCompact(): void {
    const originalTokens = this.getStats().totalTokens
    const originalCount = this.messages.length

    if (this.messages.length <= 6) return

    // 识别对话中的"段"
    const segments: MessageWithMeta[][] = []
    let currentSegment: MessageWithMeta[] = []

    for (const msg of this.messages) {
      // 新段开始的信号
      if (msg.role === 'user' && currentSegment.length > 0) {
        segments.push(currentSegment)
        currentSegment = [msg]
      } else {
        currentSegment.push(msg)
      }
    }
    if (currentSegment.length > 0) {
      segments.push(currentSegment)
    }

    // 保留最近 2 个完整段，其他的折叠
    if (segments.length <= 2) return

    const recentSegments = segments.slice(-2)
    const oldSegments = segments.slice(0, -2)

    // 折叠旧段
    const collapsed = oldSegments.map((seg, idx) => {
      const userMsg = seg.find(m => m.role === 'user')
      const toolCalls = seg.filter(m => m.toolCalls).length
      const errors = seg.filter(m => 
        m.toolResults?.some(r => r.error)
      ).length

      return `[Segment ${idx + 1}: ${userMsg ? 'User request' : 'Continuation'}, ${toolCalls} tool calls${errors > 0 ? `, ${errors} errors` : ''}]`
    })

    const collapsedMsg: MessageWithMeta = {
      id: this.generateMessageId(),
      role: 'system',
      content: `[${oldSegments.length} earlier conversation segments collapsed]\n${collapsed.join('\n')}`,
      timestamp: Date.now(),
      compressedFrom: oldSegments.flat().map(m => m.id)
    }

    this.messages = [
      ...this.messages.filter(m => m.role === 'system'),
      collapsedMsg,
      ...recentSegments.flat()
    ]

    this.recordCompression(originalTokens, originalCount, 'collapse')
  }

  // 策略 5: Aggressive Compact - 激进压缩（仅保留系统+最近）
  private aggressiveCompact(): void {
    const originalTokens = this.getStats().totalTokens
    const originalCount = this.messages.length

    // 保留所有系统消息
    const systemMessages = this.messages.filter(m => m.role === 'system')
    
    // 只保留最近 4 条非系统消息
    const recentMessages = this.messages
      .filter(m => m.role !== 'system')
      .slice(-4)

    const omittedCount = this.messages.length - systemMessages.length - recentMessages.length

    if (omittedCount > 0) {
      const aggressiveMsg: MessageWithMeta = {
        id: this.generateMessageId(),
        role: 'system',
        content: `[Context aggressively compressed: ${omittedCount} messages omitted, ${recentMessages.length} recent messages preserved]`,
        timestamp: Date.now()
      }
      
      this.messages = [...systemMessages, aggressiveMsg, ...recentMessages]
    } else {
      this.messages = [...systemMessages, ...recentMessages]
    }

    this.recordCompression(originalTokens, originalCount, 'aggressive')
  }

  // 记录压缩信息
  private recordCompression(
    originalTokens: number, 
    originalCount: number, 
    strategy: CompressionInfo['strategy']
  ): void {
    const stats = this.getStats()
    const preservedIds = this.messages.map(m => m.id)

    const info: CompressionInfo = {
      originalTokens,
      compressedTokens: stats.totalTokens,
      originalMessages: originalCount,
      compressedMessages: this.messages.length,
      strategy,
      timestamp: Date.now(),
      preservedMessageIds: preservedIds
    }

    this.compressionHistory.push(info)

    this.logger.info('Context compressed', {
      strategy,
      originalTokens,
      compressedTokens: stats.totalTokens,
      saved: originalTokens - stats.totalTokens,
      ratio: `${Math.round((1 - stats.totalTokens / originalTokens) * 100)}%`
    })

    // 如果还是超过限制，继续压缩
    if (stats.totalTokens > this.maxTokens && strategy !== 'aggressive') {
      this.logger.info('Still over limit after compression, escalating...')
      this.compress(stats.totalTokens / this.maxTokens)
    }
  }

  // 获取压缩历史
  getCompressionHistory(): CompressionInfo[] {
    return [...this.compressionHistory]
  }

  // 导出完整状态（用于持久化）
  exportState(): {
    messages: MessageWithMeta[]
    systemPrompt: string
    compressionHistory: CompressionInfo[]
    stats: ContextStats
  } {
    return {
      messages: this.messages,
      systemPrompt: this.systemPrompt,
      compressionHistory: this.compressionHistory,
      stats: this.getStats()
    }
  }

  // 导入状态
  importState(state: {
    messages: MessageWithMeta[]
    systemPrompt: string
    compressionHistory: CompressionInfo[]
  }): void {
    this.messages = state.messages
    this.systemPrompt = state.systemPrompt
    this.compressionHistory = state.compressionHistory
    this.messageCounter = this.messages.length
    this.logger.info('Context state imported', { messages: this.messages.length })
  }
}

export { ConversationContextEnhanced as ConversationContextV2 }

// 对话上下文管理 - 参考 Claude Code 的上下文压缩
import { Logger } from '../utils/logger.js'

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  toolCalls?: ToolCall[]
  toolResults?: ToolResult[]
  timestamp: number
  tokens?: number
}

export interface ToolCall {
  id: string
  name: string
  input: any
}

export interface ToolResult {
  toolCallId: string
  output: any
  error?: string
}

export interface ContextStats {
  totalMessages: number
  totalTokens: number
  userMessages: number
  assistantMessages: number
  toolCalls: number
}

// 简单的 Token 估算
function estimateTokens(text: string): number {
  // 粗略估算：英文约 4 字符/token，中文约 1 字符/token
  // 这里使用保守估算
  return Math.ceil(text.length / 3)
}

export class ConversationContext {
  private messages: Message[] = []
  private maxTokens: number
  private logger: Logger

  constructor(maxTokens: number = 8000) {
    this.maxTokens = maxTokens
    this.logger = new Logger('ConversationContext')
  }

  // 添加消息
  addMessage(message: Omit<Message, 'timestamp' | 'tokens'>): void {
    const content = typeof message.content === 'string' ? message.content : JSON.stringify(message.content)
    const tokens = estimateTokens(content)
    
    const fullMessage: Message = {
      ...message,
      timestamp: Date.now(),
      tokens
    }

    this.messages.push(fullMessage)
    this.logger.debug(`Added message`, { role: message.role, tokens })

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
  addAssistantMessage(content: string, toolCalls?: ToolCall[]): void {
    this.addMessage({ role: 'assistant', content, toolCalls })
  }

  // 添加工具结果
  addToolResults(results: ToolResult[]): void {
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
  getMessages(): Message[] {
    return [...this.messages]
  }

  // 获取最近的消息
  getRecentMessages(count: number): Message[] {
    return this.messages.slice(-count)
  }

  // 获取上下文统计
  getStats(): ContextStats {
    const totalTokens = this.messages.reduce((sum, m) => sum + (m.tokens || 0), 0)
    
    return {
      totalMessages: this.messages.length,
      totalTokens,
      userMessages: this.messages.filter(m => m.role === 'user').length,
      assistantMessages: this.messages.filter(m => m.role === 'assistant').length,
      toolCalls: this.messages.filter(m => m.toolCalls).length
    }
  }

  // 清空上下文
  clear(): void {
    this.messages = []
    this.logger.info('Context cleared')
  }

  // 压缩上下文
  private maybeCompress(): void {
    const stats = this.getStats()
    
    if (stats.totalTokens > this.maxTokens) {
      this.logger.info(`Context exceeded limit (${stats.totalTokens} > ${this.maxTokens}), compressing...`)
      this.compress()
    }
  }

  // 压缩策略：保留系统消息和最近的消息
  private compress(): void {
    if (this.messages.length <= 3) {
      return // 太少，不压缩
    }

    // 保留第一条系统消息
    const systemMessages = this.messages.filter(m => m.role === 'system')
    const firstSystem = systemMessages.length > 0 ? [systemMessages[0]] : []

    // 保留最近的消息（最多 10 条）
    const recentMessages = this.messages.slice(-10)

    // 中间的消息摘要
    const middleMessages = this.messages.slice(firstSystem.length, -10)
    let summary = ''
    if (middleMessages.length > 0) {
      const toolCalls = middleMessages.filter(m => m.toolCalls).length
      summary = `[${middleMessages.length} earlier messages omitted${toolCalls > 0 ? `, including ${toolCalls} tool calls` : ''}]`
    }

    this.messages = [
      ...firstSystem,
      ...(summary ? [{ 
        role: 'system' as const, 
        content: summary, 
        timestamp: Date.now(),
        tokens: estimateTokens(summary)
      }] : []),
      ...recentMessages
    ]

    this.logger.info('Context compressed', { stats: this.getStats() })
  }

  // 导出为 LLM 格式
  toLLMMessages(): Array<{ role: string; content: string }> {
    return this.messages.map(m => ({
      role: m.role,
      content: m.content
    }))
  }

  // 序列化（用于持久化）
  serialize(): string {
    return JSON.stringify({
      messages: this.messages,
      maxTokens: this.maxTokens
    })
  }

  // 反序列化
  static deserialize(data: string): ConversationContext {
    const parsed = JSON.parse(data)
    const context = new ConversationContext(parsed.maxTokens)
    context.messages = parsed.messages || []
    return context
  }
}

// 全局上下文实例（可选）
export const globalContext = new ConversationContext()

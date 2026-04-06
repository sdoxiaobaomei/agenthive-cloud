// Context compaction types - inspired by Claude Code
import { LLMMessage } from '../../services/llm/types.js'

export interface CompactionResult {
  /** Whether compaction was applied */
  applied: boolean
  /** Original token count */
  originalTokens: number
  /** New token count after compaction */
  newTokens: number
  /** Strategy name that was applied */
  strategy: string
  /** Description of what was compacted */
  description: string
  /** Messages that were removed/replaced */
  affectedMessages?: number
}

export interface CompactionContext {
  messages: LLMMessage[]
  systemPrompt?: string
  maxTokens: number
  targetTokens: number
}

export interface CompactionStrategy {
  name: string
  priority: number // Lower = runs first
  canCompact(context: CompactionContext): boolean
  compact(context: CompactionContext): CompactionResult
}

// Token estimator - more accurate than simple character count
export function estimateTokens(text: string): number {
  if (!text) return 0
  
  // Count different character types
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length
  const japaneseChars = (text.match(/[\u3040-\u309f\u30a0-\u30ff]/g) || []).length
  const koreanChars = (text.match(/[\uac00-\ud7af]/g) || []).length
  const otherChars = text.length - chineseChars - japaneseChars - koreanChars
  
  // CJK characters are roughly 1 token each
  // Other characters are roughly 4 per token
  return Math.ceil(chineseChars + japaneseChars + koreanChars + otherChars / 4)
}

export function estimateMessageTokens(message: LLMMessage): number {
  const content = typeof message.content === 'string' 
    ? message.content 
    : JSON.stringify(message.content)
  
  // Base overhead for message structure
  const baseOverhead = 4
  
  // Tool calls add tokens
  const toolCallTokens = message.toolCalls 
    ? message.toolCalls.reduce((sum, tc) => {
        return sum + estimateTokens(tc.function.name) + estimateTokens(tc.function.arguments)
      }, 0)
    : 0
  
  // Tool results add tokens
  const toolResultTokens = message.toolResults
    ? message.toolResults.reduce((sum, tr) => {
        return sum + estimateTokens(tr.output) + (tr.error ? estimateTokens(tr.error) : 0)
      }, 0)
    : 0
  
  return baseOverhead + estimateTokens(content) + toolCallTokens + toolResultTokens
}

export function countTotalTokens(messages: LLMMessage[]): number {
  return messages.reduce((sum, msg) => sum + estimateMessageTokens(msg), 0)
}

// Message importance scoring for smart compaction
export interface MessageScore {
  message: LLMMessage
  index: number
  score: number
  reasons: string[]
}

export function scoreMessage(message: LLMMessage, index: number, total: number): MessageScore {
  const reasons: string[] = []
  let score = 0
  
  // System messages are critical
  if (message.role === 'system') {
    score += 1000
    reasons.push('system_message')
  }
  
  // Recent messages are more important
  const recency = 1 - (index / total)
  score += recency * 100
  if (recency > 0.8) reasons.push('recent')
  
  // Messages with tool calls are important
  if (message.toolCalls && message.toolCalls.length > 0) {
    score += 50
    reasons.push('has_tool_calls')
  }
  
  // Tool results with errors are important
  if (message.toolResults) {
    const hasError = message.toolResults.some(r => r.error)
    if (hasError) {
      score += 40
      reasons.push('has_error')
    } else {
      score += 20
      reasons.push('has_tool_results')
    }
  }
  
  // User messages are slightly more important than assistant
  if (message.role === 'user') {
    score += 10
    reasons.push('user_message')
  }
  
  // Empty or very short messages are less important
  const contentLength = typeof message.content === 'string' 
    ? message.content.length 
    : JSON.stringify(message.content).length
  if (contentLength < 10) {
    score -= 20
    reasons.push('very_short')
  }
  
  return { message, index, score, reasons }
}

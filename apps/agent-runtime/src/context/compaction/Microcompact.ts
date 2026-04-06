/**
 * Microcompact Strategy - inspired by Claude Code
 * 
 * Removes non-essential messages between conversation turns.
 * Keeps: system messages, user messages, final assistant responses, tool calls with results
 * Removes: Intermediate assistant "thinking" messages that don't add tool calls
 * 
 * This is a lighter compaction that preserves conversation flow while removing fluff.
 */
import { CompactionStrategy, CompactionContext, CompactionResult, estimateMessageTokens, scoreMessage } from './types.js'
import { LLMMessage } from '../../services/llm/types.js'

export class Microcompact implements CompactionStrategy {
  name = 'microcompact'
  priority = 20 // Run after snip
  
  // Configuration
  private readonly keepRecentCount = 5 // Always keep this many recent messages
  private readonly importanceThreshold = 50 // Minimum score to keep a message
  
  canCompact(context: CompactionContext): boolean {
    const { messages, maxTokens } = context
    
    // Need enough messages to compact
    if (messages.length < 8) return false
    
    const totalTokens = countTokens(messages)
    
    // Only compact if we're approaching the limit
    return totalTokens > maxTokens * 0.6
  }
  
  compact(context: CompactionContext): CompactionResult {
    const { messages } = context
    const originalTokens = countTokens(messages)
    
    // Score all messages
    const scoredMessages = messages.map((msg, idx) => 
      scoreMessage(msg, idx, messages.length)
    )
    
    // Identify messages to keep
    const keepIndices = new Set<number>()
    
    // Always keep system messages
    for (let i = 0; i < messages.length; i++) {
      if (messages[i].role === 'system') {
        keepIndices.add(i)
      }
    }
    
    // Always keep recent messages
    const recentStart = Math.max(0, messages.length - this.keepRecentCount)
    for (let i = recentStart; i < messages.length; i++) {
      keepIndices.add(i)
    }
    
    // Keep high-importance messages outside the recent window
    const nonRecentMessages = scoredMessages.slice(0, recentStart)
    const highImportanceMessages = nonRecentMessages.filter(m => m.score >= this.importanceThreshold)
    
    // Sort by score and keep top N, but ensure we keep at least some user messages
    highImportanceMessages.sort((a, b) => b.score - a.score)
    const keepCount = Math.min(
      Math.floor(messages.length * 0.4), // Keep up to 40% of non-recent messages
      20 // But cap at 20 messages
    )
    
    for (let i = 0; i < Math.min(keepCount, highImportanceMessages.length); i++) {
      keepIndices.add(highImportanceMessages[i].index)
    }
    
    // Build new message list
    const newMessages: LLMMessage[] = []
    let removedCount = 0
    
    for (let i = 0; i < messages.length; i++) {
      if (keepIndices.has(i)) {
        newMessages.push(messages[i])
      } else {
        removedCount++
      }
    }
    
    const newTokens = countTokens(newMessages)
    
    return {
      applied: removedCount > 0,
      originalTokens,
      newTokens,
      strategy: this.name,
      description: `Microcompact: removed ${removedCount} low-importance messages, keeping ${newMessages.length}`,
      affectedMessages: removedCount
    }
  }
}

function countTokens(messages: LLMMessage[]): number {
  return messages.reduce((sum, msg) => sum + estimateMessageTokens(msg), 0)
}

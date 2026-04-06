/**
 * Autocompact Strategy - inspired by Claude Code
 * 
 * Uses LLM to intelligently summarize old conversation history when context gets too long.
 * This is the most aggressive compaction strategy and should be used as a last resort.
 * 
 * Process:
 * 1. Identify oldest messages that can be summarized
 * 2. Call LLM to create a summary preserving key facts and decisions
 * 3. Replace original messages with summary
 */
import { CompactionStrategy, CompactionContext, CompactionResult, estimateMessageTokens } from './types.js'
import { LLMMessage } from '../../services/llm/types.js'

export interface AutocompactConfig {
  // LLM function for summarization
  summarize: (messages: LLMMessage[]) => Promise<string>
  // Minimum messages to trigger autocompact
  minMessages: number
  // How many recent messages to always preserve
  preserveRecent: number
  // Maximum messages to summarize at once
  maxBatchSize: number
}

export class Autocompact implements CompactionStrategy {
  name = 'autocompact'
  priority = 40 // Run last
  private config: AutocompactConfig
  
  constructor(config: Partial<AutocompactConfig> = {}) {
    this.config = {
      minMessages: 20,
      preserveRecent: 10,
      maxBatchSize: 15,
      summarize: config.summarize || this.defaultSummarize,
      ...config
    }
  }
  
  canCompact(context: CompactionContext): boolean {
    const { messages, maxTokens } = context
    
    // Need enough messages
    if (messages.length < this.config.minMessages + this.config.preserveRecent) {
      return false
    }
    
    const totalTokens = countTokens(messages)
    
    // Only autocompact if we're very close to the limit
    return totalTokens > maxTokens * 0.85
  }
  
  async compactAsync(context: CompactionContext): Promise<CompactionResult> {
    const { messages } = context
    const originalTokens = countTokens(messages)
    
    // Determine range to summarize
    const recentStart = Math.max(0, messages.length - this.config.preserveRecent)
    const batchEnd = Math.min(recentStart, this.config.maxBatchSize)
    
    if (batchEnd < 3) {
      return {
        applied: false,
        originalTokens,
        newTokens: originalTokens,
        strategy: this.name,
        description: 'Not enough messages to autocompact',
        affectedMessages: 0
      }
    }
    
    // Select messages to summarize (skip system messages)
    const toSummarize: LLMMessage[] = []
    let startIndex = 0
    
    for (let i = 0; i < batchEnd; i++) {
      if (messages[i].role !== 'system') {
        toSummarize.push(messages[i])
      } else {
        startIndex = i + 1
      }
    }
    
    if (toSummarize.length < 3) {
      return {
        applied: false,
        originalTokens,
        newTokens: originalTokens,
        strategy: this.name,
        description: 'Not enough non-system messages to summarize',
        affectedMessages: 0
      }
    }
    
    // Generate summary
    let summary: string
    try {
      summary = await this.config.summarize(toSummarize)
    } catch (error) {
      return {
        applied: false,
        originalTokens,
        newTokens: originalTokens,
        strategy: this.name,
        description: `Summarization failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        affectedMessages: 0
      }
    }
    
    // Build new message list
    const newMessages: LLMMessage[] = []
    let affectedCount = 0
    
    // Keep system messages at the start
    for (let i = 0; i < startIndex; i++) {
      newMessages.push(messages[i])
    }
    
    // Add summary as a system message
    newMessages.push({
      role: 'system',
      content: `[Earlier conversation summary]: ${summary}`
    })
    
    // Add remaining messages
    for (let i = batchEnd; i < messages.length; i++) {
      newMessages.push(messages[i])
    }
    
    affectedCount = batchEnd - startIndex
    const newTokens = countTokens(newMessages)
    
    return {
      applied: true,
      originalTokens,
      newTokens,
      strategy: this.name,
      description: `Autocompacted ${affectedCount} messages into summary (${summary.length} chars)`,
      affectedMessages: affectedCount
    }
  }
  
  // Synchronous version (for interface compliance)
  compact(context: CompactionContext): CompactionResult {
    // This is a placeholder - use compactAsync for actual summarization
    // The compaction pipeline will handle async strategies specially
    return {
      applied: false,
      originalTokens: countTokens(context.messages),
      newTokens: countTokens(context.messages),
      strategy: this.name,
      description: 'Autocompact requires async operation - use compactAsync',
      affectedMessages: 0
    }
  }
  
  private async defaultSummarize(messages: LLMMessage[]): Promise<string> {
    // Default summarization without LLM
    // Extracts key facts from messages
    
    const facts: string[] = []
    let toolCallCount = 0
    let errorCount = 0
    
    for (const msg of messages) {
      if (msg.toolCalls) {
        toolCallCount += msg.toolCalls.length
        for (const tc of msg.toolCalls) {
          facts.push(`Used ${tc.function.name}`)
        }
      }
      
      if (msg.toolResults) {
        for (const tr of msg.toolResults) {
          if (tr.error) {
            errorCount++
            facts.push(`Error: ${tr.error.substring(0, 50)}`)
          }
        }
      }
      
      // Extract key content (first 100 chars of user/assistant messages)
      if (msg.role === 'user' || msg.role === 'assistant') {
        const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
        if (content.length > 10) {
          const keyPoint = content.substring(0, 100).replace(/\n/g, ' ')
          if (!facts.some(f => f.includes(keyPoint.substring(0, 30)))) {
            facts.push(keyPoint)
          }
        }
      }
    }
    
    const summary = [
      `${messages.length} messages processed`,
      `${toolCallCount} tool calls made`,
      errorCount > 0 ? `${errorCount} errors encountered` : null,
      'Key points:',
      ...facts.slice(0, 5)
    ].filter(Boolean).join('. ')
    
    return summary
  }
}

function countTokens(messages: LLMMessage[]): number {
  return messages.reduce((sum, msg) => sum + estimateMessageTokens(msg), 0)
}

/**
 * Context Collapse Strategy - inspired by Claude Code
 * 
 * Archives ranges of old messages into a summary.
 * Unlike full summarization, this creates "breakpoints" where context can be restored.
 * 
 * Example:
 * Before: [M1][M2][M3]...[M100][M101][M102]
 * After:  [Summary of M1-M95][M96][M97][M98][M99][M100][M101][M102]
 */
import { CompactionStrategy, CompactionContext, CompactionResult, estimateMessageTokens, scoreMessage } from './types.js'
import { LLMMessage } from '../../services/llm/types.js'

export interface CollapsedRange {
  startIndex: number
  endIndex: number
  summary: string
  originalTokenCount: number
}

export class ContextCollapse implements CompactionStrategy {
  name = 'collapse'
  priority = 30 // Run after microcompact
  
  // Configuration
  private readonly recentWindow = 10 // Always keep this many recent messages
  private readonly minCollapseSize = 5 // Don't collapse fewer than this many messages
  private readonly maxCollapseRanges = 3 // Maximum number of collapsed ranges
  
  // Collapsed ranges storage (could be persisted)
  private collapsedRanges: CollapsedRange[] = []
  
  canCompact(context: CompactionContext): boolean {
    const { messages, maxTokens } = context
    
    // Need enough messages outside the recent window
    if (messages.length <= this.recentWindow + this.minCollapseSize) return false
    
    const totalTokens = countTokens(messages)
    
    // Only collapse if we're over threshold
    return totalTokens > maxTokens * 0.7
  }
  
  compact(context: CompactionContext): CompactionResult {
    const { messages } = context
    const originalTokens = countTokens(messages)
    
    // Identify collapsible ranges
    const collapsibleRange = this.findCollapsibleRange(messages)
    
    if (!collapsibleRange || (collapsibleRange.end - collapsibleRange.start) < this.minCollapseSize) {
      return {
        applied: false,
        originalTokens,
        newTokens: originalTokens,
        strategy: this.name,
        description: 'No suitable range found for collapse',
        affectedMessages: 0
      }
    }
    
    // Generate summary for the range
    const summary = this.generateSummary(messages, collapsibleRange.start, collapsibleRange.end)
    
    // Create collapsed range record
    const collapsedRange: CollapsedRange = {
      startIndex: collapsibleRange.start,
      endIndex: collapsibleRange.end,
      summary,
      originalTokenCount: collapsibleRange.tokens
    }
    
    this.collapsedRanges.push(collapsedRange)
    
    // Build new messages with collapsed section replaced by summary
    const newMessages: LLMMessage[] = []
    
    for (let i = 0; i < messages.length; i++) {
      if (i === collapsibleRange.start) {
        // Insert summary message
        newMessages.push({
          role: 'system',
          content: `[Context collapsed: Messages ${collapsibleRange.start + 1}-${collapsibleRange.end + 1}]\n${summary}`
        })
      }
      
      if (i < collapsibleRange.start || i > collapsibleRange.end) {
        newMessages.push(messages[i])
      }
    }
    
    const newTokens = countTokens(newMessages)
    const affectedCount = collapsibleRange.end - collapsibleRange.start + 1
    
    return {
      applied: true,
      originalTokens,
      newTokens,
      strategy: this.name,
      description: `Collapsed messages ${collapsibleRange.start + 1}-${collapsibleRange.end + 1} (${affectedCount} messages)`,
      affectedMessages: affectedCount
    }
  }
  
  private findCollapsibleRange(messages: LLMMessage[]): { start: number; end: number; tokens: number } | null {
    // Find the oldest contiguous range of low-importance messages
    // outside the recent window
    
    const recentStart = Math.max(0, messages.length - this.recentWindow)
    
    // Score messages
    const scoredMessages = messages.map((msg, idx) => ({
      index: idx,
      score: scoreMessage(msg, idx, messages.length).score,
      tokens: estimateMessageTokens(msg)
    }))
    
    // Find the best range to collapse (oldest, lowest total importance)
    let bestRange: { start: number; end: number; tokens: number; totalScore: number } | null = null
    
    // Try different window sizes
    for (let windowSize = this.minCollapseSize; windowSize <= recentStart; windowSize += 5) {
      for (let start = 0; start <= recentStart - windowSize; start += windowSize) {
        const end = Math.min(start + windowSize - 1, recentStart - 1)
        
        // Calculate total score for this range (lower is better for collapsing)
        let totalScore = 0
        let totalTokens = 0
        let hasSystemMessage = false
        
        for (let i = start; i <= end; i++) {
          totalScore += scoredMessages[i].score
          totalTokens += scoredMessages[i].tokens
          if (messages[i].role === 'system') {
            hasSystemMessage = true
            break
          }
        }
        
        // Skip if contains system messages
        if (hasSystemMessage) continue
        
        // Normalize score by window size
        const normalizedScore = totalScore / windowSize
        
        // Prefer older ranges with lower scores
        const ageBonus = start // Older ranges get higher bonus
        const effectiveness = (ageBonus * 10) - normalizedScore
        
        if (!bestRange || effectiveness > ((bestRange.start * 10) - (bestRange.totalScore / (bestRange.end - bestRange.start + 1)))) {
          bestRange = { start, end, tokens: totalTokens, totalScore }
        }
      }
    }
    
    return bestRange ? { start: bestRange.start, end: bestRange.end, tokens: bestRange.tokens } : null
  }
  
  private generateSummary(messages: LLMMessage[], start: number, end: number): string {
    // Generate a summary of the collapsed range
    const parts: string[] = []
    
    let userMessages = 0
    let assistantMessages = 0
    let toolCalls = 0
    let toolResults = 0
    let errors = 0
    
    for (let i = start; i <= end && i < messages.length; i++) {
      const msg = messages[i]
      
      switch (msg.role) {
        case 'user':
          userMessages++
          break
        case 'assistant':
          assistantMessages++
          if (msg.toolCalls) toolCalls += msg.toolCalls.length
          break
        case 'tool':
          toolResults++
          if (msg.toolResults?.some(r => r.error)) errors++
          break
      }
    }
    
    parts.push(`Contains ${userMessages} user messages, ${assistantMessages} assistant responses`)
    
    if (toolCalls > 0) {
      parts.push(`${toolCalls} tool calls`)
    }
    
    if (toolResults > 0) {
      parts.push(`${toolResults} tool results`)
    }
    
    if (errors > 0) {
      parts.push(`${errors} errors occurred`)
    }
    
    // Add key topics (simplified - could use NLP)
    const topics = this.extractTopics(messages, start, end)
    if (topics.length > 0) {
      parts.push(`Topics: ${topics.join(', ')}`)
    }
    
    return parts.join('. ')
  }
  
  private extractTopics(messages: LLMMessage[], start: number, end: number): string[] {
    // Simple keyword extraction
    const text = messages
      .slice(start, end + 1)
      .map(m => typeof m.content === 'string' ? m.content : '')
      .join(' ')
      .toLowerCase()
    
    const topics: string[] = []
    const keywords = [
      { word: 'file', topic: 'file operations' },
      { word: 'code', topic: 'code' },
      { word: 'function', topic: 'functions' },
      { word: 'bug', topic: 'debugging' },
      { word: 'error', topic: 'errors' },
      { word: 'test', topic: 'testing' },
      { word: 'git', topic: 'git' },
      { word: 'search', topic: 'search' },
      { word: 'create', topic: 'creation' },
      { word: 'update', topic: 'updates' },
      { word: 'delete', topic: 'deletion' },
      { word: 'install', topic: 'installation' },
      { word: 'configure', topic: 'configuration' },
      { word: 'deploy', topic: 'deployment' }
    ]
    
    for (const { word, topic } of keywords) {
      if (text.includes(word) && !topics.includes(topic)) {
        topics.push(topic)
      }
    }
    
    return topics.slice(0, 5) // Limit to 5 topics
  }
  
  // Get collapsed ranges (for restoration if needed)
  getCollapsedRanges(): CollapsedRange[] {
    return [...this.collapsedRanges]
  }
  
  // Clear collapsed ranges
  clearCollapsedRanges(): void {
    this.collapsedRanges = []
  }
}

function countTokens(messages: LLMMessage[]): number {
  return messages.reduce((sum, msg) => sum + estimateMessageTokens(msg), 0)
}

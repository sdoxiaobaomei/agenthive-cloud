/**
 * Snip Compaction Strategy - inspired by Claude Code
 * 
 * Removes intermediate progress messages and tool progress updates.
 * Keeps the initial request and final result, removes intermediate progress.
 * 
 * Example transformation:
 * Before: [tool_call] -> [progress_1] -> [progress_2] -> [progress_3] -> [result]
 * After:  [tool_call] -> [result]
 */
import { CompactionStrategy, CompactionContext, CompactionResult, estimateMessageTokens } from './types.js'
import { LLMMessage } from '../../services/llm/types.js'

export class SnipCompaction implements CompactionStrategy {
  name = 'snip'
  priority = 10 // Run early
  
  // Messages that indicate progress (can be snipped)
  private progressIndicators = [
    /progress/i,
    /loading/i,
    /thinking/i,
    /working/i,
    /processing/i,
    /\d+% complete/i,
    /step \d+ of \d+/i,
    /^\.\.\./,
    /^\[/, // Progress bars like [====>   ]
  ]
  
  canCompact(context: CompactionContext): boolean {
    const { messages } = context
    
    // Need at least a few messages to snip
    if (messages.length < 5) return false
    
    // Count how many messages look like progress messages
    let progressCount = 0
    for (const msg of messages) {
      if (this.isProgressMessage(msg)) {
        progressCount++
      }
    }
    
    // Only compact if we have enough progress messages to make it worthwhile
    return progressCount >= 2
  }
  
  compact(context: CompactionContext): CompactionResult {
    const { messages } = context
    const originalTokens = countTokens(messages)
    
    const newMessages: LLMMessage[] = []
    let snippedCount = 0
    let inProgressSequence = false
    let lastNonProgressIndex = -1
    
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i]
      const isProgress = this.isProgressMessage(msg)
      
      if (isProgress) {
        // Start of a progress sequence
        if (!inProgressSequence) {
          inProgressSequence = true
          // Keep reference to last non-progress message
          if (lastNonProgressIndex >= 0) {
            newMessages.push(messages[lastNonProgressIndex])
          }
        }
        snippedCount++
      } else {
        // End of progress sequence - add this message
        if (inProgressSequence) {
          inProgressSequence = false
        }
        newMessages.push(msg)
        lastNonProgressIndex = newMessages.length - 1
      }
    }
    
    const newTokens = countTokens(newMessages)
    
    return {
      applied: snippedCount > 0,
      originalTokens,
      newTokens,
      strategy: this.name,
      description: `Snipped ${snippedCount} intermediate progress messages`,
      affectedMessages: snippedCount
    }
  }
  
  private isProgressMessage(message: LLMMessage): boolean {
    const content = typeof message.content === 'string' 
      ? message.content 
      : JSON.stringify(message.content)
    
    // Check against progress indicators
    for (const pattern of this.progressIndicators) {
      if (pattern.test(content)) {
        return true
      }
    }
    
    // Tool progress messages (role='tool' with partial results)
    if (message.role === 'tool' && message.toolResults) {
      // If the tool result seems like a progress update (short, contains progress indicators)
      const result = JSON.stringify(message.toolResults)
      if (result.length < 200 && this.progressIndicators.some(p => p.test(result))) {
        return true
      }
    }
    
    return false
  }
}

function countTokens(messages: LLMMessage[]): number {
  return messages.reduce((sum, msg) => sum + estimateMessageTokens(msg), 0)
}

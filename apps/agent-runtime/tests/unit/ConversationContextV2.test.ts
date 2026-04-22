/**
 * ConversationContextV2 Unit Tests
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { ConversationContextV2 } from '../../src/context/ConversationContextV2.js'

describe('ConversationContextV2', () => {
  let context: ConversationContextV2

  beforeEach(() => {
    context = new ConversationContextV2()
  })

  describe('replaceMessages', () => {
    it('should replace messages array', () => {
      context.addUserMessage('hello')
      context.addAssistantMessage('hi')

      context.replaceMessages([
        { role: 'user', content: 'new message' }
      ])

      const messages = context.getMessages()
      expect(messages).toHaveLength(1)
      expect(messages[0].content).toBe('new message')
    })

    it('should preserve system prompt if new messages have no system', () => {
      context.setSystemPrompt('You are a helper')
      context.addUserMessage('hello')

      context.replaceMessages([
        { role: 'user', content: 'replaced' }
      ])

      const messages = context.getMessages()
      expect(messages).toHaveLength(2)
      expect(messages[0].role).toBe('system')
      expect(messages[0].content).toBe('You are a helper')
      expect(messages[1].role).toBe('user')
      expect(messages[1].content).toBe('replaced')
    })

    it('should use new system message if provided', () => {
      context.setSystemPrompt('Old system')
      context.addUserMessage('hello')

      context.replaceMessages([
        { role: 'system', content: 'New system' },
        { role: 'user', content: 'replaced' }
      ])

      const messages = context.getMessages()
      expect(messages).toHaveLength(2)
      expect(messages[0].role).toBe('system')
      expect(messages[0].content).toBe('New system')
      expect(messages[1].role).toBe('user')
      expect(messages[1].content).toBe('replaced')
    })

    it('should keep original system messages when new messages have no system', () => {
      // Add multiple system messages manually
      context.setSystemPrompt('System 1')
      context.addSystemMessage('System 2')
      context.addUserMessage('hello')

      context.replaceMessages([
        { role: 'user', content: 'only user' }
      ])

      const messages = context.getMessages()
      const systemMessages = messages.filter((m) => m.role === 'system')
      expect(systemMessages).toHaveLength(2)
      expect(systemMessages[0].content).toBe('System 1')
      expect(systemMessages[1].content).toBe('System 2')
    })

    it('should update stats correctly after replace', () => {
      context.addUserMessage('hello world this is a test')
      context.addAssistantMessage('how can I help you today')

      context.replaceMessages([
        { role: 'user', content: 'short' }
      ])

      const stats = context.getStats()
      expect(stats.totalMessages).toBe(1)
      expect(stats.userMessages).toBe(1)
      expect(stats.assistantMessages).toBe(0)
    })

    it('should reflect replaced messages in getMessages()', () => {
      context.addUserMessage('original')

      context.replaceMessages([
        { role: 'assistant', content: 'replaced assistant' },
        { role: 'user', content: 'replaced user' }
      ])

      const messages = context.getMessages()
      expect(messages[0].role).toBe('assistant')
      expect(messages[0].content).toBe('replaced assistant')
      expect(messages[1].role).toBe('user')
      expect(messages[1].content).toBe('replaced user')
    })
  })
})

import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useChatStore, type ChatMessage, type MessageType } from '~/stores/chat'

/**
 * visibleMessages 过滤逻辑专项测试
 * 覆盖不同 message type 组合的过滤行为
 */
describe('visibleMessages filter logic', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  const createMsg = (
    id: string,
    type: MessageType,
    convId = 'conv-1',
    overrides: Partial<ChatMessage> = {}
  ): ChatMessage => ({
    id,
    role: 'assistant',
    type,
    content: `Content ${id}`,
    timestamp: '2026-01-01T00:00:00Z',
    conversationId: convId,
    metadata: {},
    ...overrides,
  })

  it('keeps active recommend (not selected/dismissed) in visibleMessages', () => {
    const store = useChatStore()
    store.currentConversation = {
      id: 'conv-1',
      title: 'Test',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      messageCount: 5,
    }
    store.messages = [
      createMsg('m1', 'message'),
      createMsg('m2', 'think'),
      createMsg('m3', 'task'),
      createMsg('m4', 'recommend'),                                   // active: visible
      createMsg('m5', 'system_event'),
    ]

    const visible = store.visibleMessages
    expect(visible.map((m) => m.id)).toEqual(['m1', 'm2', 'm3', 'm4', 'm5'])
    expect(visible).toHaveLength(5)
  })

  it('filters out selected recommend', () => {
    const store = useChatStore()
    store.currentConversation = {
      id: 'conv-1',
      title: 'Test',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      messageCount: 3,
    }
    store.messages = [
      createMsg('m1', 'message'),
      createMsg('m2', 'recommend', 'conv-1', { selectedOptionId: 'opt-1' }), // selected: filtered
      createMsg('m3', 'task'),
    ]

    const visible = store.visibleMessages
    expect(visible).toHaveLength(2)
    expect(visible.map((m) => m.id)).toEqual(['m1', 'm3'])
  })

  it('filters out dismissed recommend', () => {
    const store = useChatStore()
    store.currentConversation = {
      id: 'conv-1',
      title: 'Test',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      messageCount: 3,
    }
    store.messages = [
      createMsg('m1', 'message'),
      createMsg('m2', 'recommend', 'conv-1', { metadata: { dismissed: true } }), // dismissed: filtered
      createMsg('m3', 'think'),
    ]

    const visible = store.visibleMessages
    expect(visible).toHaveLength(2)
    expect(visible.map((m) => m.id)).toEqual(['m1', 'm3'])
  })

  it('filters by conversationId and selected/dismissed recommend', () => {
    const store = useChatStore()
    store.currentConversation = {
      id: 'conv-1',
      title: 'Test',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      messageCount: 4,
    }
    store.messages = [
      createMsg('m1', 'message', 'conv-1'),
      createMsg('m2', 'recommend', 'conv-1'),                               // active: visible
      createMsg('m3', 'recommend', 'conv-1', { selectedOptionId: 'opt-1' }), // selected: filtered
      createMsg('m4', 'message', 'conv-2'),
    ]

    const visible = store.visibleMessages
    expect(visible).toHaveLength(2)
    expect(visible[0].id).toBe('m1')
    expect(visible[1].id).toBe('m2')
  })

  it('returns all messages when no recommend present', () => {
    const store = useChatStore()
    store.currentConversation = {
      id: 'conv-1',
      title: 'Test',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      messageCount: 3,
    }
    store.messages = [
      createMsg('m1', 'message'),
      createMsg('m2', 'think'),
      createMsg('m3', 'task'),
    ]

    expect(store.visibleMessages).toHaveLength(3)
  })

  it('returns empty array for empty messages', () => {
    const store = useChatStore()
    store.currentConversation = {
      id: 'conv-1',
      title: 'Test',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      messageCount: 0,
    }
    expect(store.visibleMessages).toEqual([])
  })

  it('returns empty when no currentConversation', () => {
    const store = useChatStore()
    store.messages = [createMsg('m1', 'message')]
    store.currentConversation = null
    expect(store.visibleMessages).toEqual([])
  })

  it('filters all recommend when all are selected/dismissed', () => {
    const store = useChatStore()
    store.currentConversation = {
      id: 'conv-1',
      title: 'Test',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      messageCount: 3,
    }
    store.messages = [
      createMsg('m1', 'recommend', 'conv-1', { selectedOptionId: 'opt-1' }),
      createMsg('m2', 'recommend', 'conv-1', { metadata: { dismissed: true } }),
      createMsg('m3', 'recommend', 'conv-1', { selectedOptionId: 'opt-2' }),
    ]

    expect(store.visibleMessages).toHaveLength(0)
  })

  it('preserves message order', () => {
    const store = useChatStore()
    store.currentConversation = {
      id: 'conv-1',
      title: 'Test',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      messageCount: 5,
    }
    store.messages = [
      createMsg('m1', 'message'),
      createMsg('m2', 'recommend', 'conv-1', { selectedOptionId: 'opt-1' }), // filtered
      createMsg('m3', 'think'),
      createMsg('m4', 'recommend'),                                           // visible
      createMsg('m5', 'task'),
    ]

    const visible = store.visibleMessages
    expect(visible.map((m) => m.id)).toEqual(['m1', 'm3', 'm4', 'm5'])
    expect(visible[0].id).toBe('m1')
    expect(visible[1].id).toBe('m3')
    expect(visible[2].id).toBe('m4')
    expect(visible[3].id).toBe('m5')
  })

  it('handles mixed roles with recommend inline', () => {
    const store = useChatStore()
    store.currentConversation = {
      id: 'conv-1',
      title: 'Test',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      messageCount: 6,
    }
    store.messages = [
      { ...createMsg('m1', 'message'), role: 'user' },
      { ...createMsg('m2', 'recommend'), role: 'assistant' },              // active: visible
      { ...createMsg('m3', 'think'), role: 'assistant' },
      { ...createMsg('m4', 'recommend'), role: 'assistant', selectedOptionId: 'opt-1' }, // filtered
      { ...createMsg('m5', 'task'), role: 'assistant' },
      { ...createMsg('m6', 'system_event'), role: 'system' },
    ]

    const visible = store.visibleMessages
    expect(visible).toHaveLength(5)
    expect(visible.map((m) => m.id)).toEqual(['m1', 'm2', 'm3', 'm5', 'm6'])
  })

  it('activeRecommend returns the last active recommend', () => {
    const store = useChatStore()
    store.currentConversation = {
      id: 'conv-1',
      title: 'Test',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      messageCount: 4,
    }
    store.messages = [
      createMsg('m1', 'message'),
      createMsg('m2', 'recommend'),                                           // active
      createMsg('m3', 'message'),
      createMsg('m4', 'recommend', 'conv-1', { selectedOptionId: 'opt-1' }),  // selected: excluded
    ]

    expect(store.activeRecommend?.id).toBe('m2')
  })

  it('activeRecommend ignores recommend from other sessions', () => {
    const store = useChatStore()
    store.currentConversation = {
      id: 'conv-1',
      title: 'Test',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      messageCount: 2,
    }
    store.messages = [
      createMsg('m1', 'recommend', 'conv-1'),                                // active
      createMsg('m2', 'recommend', 'conv-2'),
    ]

    expect(store.activeRecommend?.id).toBe('m1')
  })

  it('activeRecommend ignores dismissed recommend', () => {
    const store = useChatStore()
    store.currentConversation = {
      id: 'conv-1',
      title: 'Test',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      messageCount: 2,
    }
    store.messages = [
      createMsg('m1', 'recommend', 'conv-1', { metadata: { dismissed: true } }),
      createMsg('m2', 'recommend', 'conv-1'),                                // active
    ]

    expect(store.activeRecommend?.id).toBe('m2')
  })
})

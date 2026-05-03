import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useChatStore, type ChatMessage, type ChatVersion, type TaskItem } from '../chat'

// Mock useApi composable
vi.mock('~/composables/useApi', () => ({
  useApi: () => ({
    chat: {
      listVersions: vi.fn(),
      switchVersion: vi.fn(),
      createVersion: vi.fn(),
      approveTask: vi.fn(),
      selectRecommend: vi.fn(),
      dismissRecommend: vi.fn(),
      createSession: vi.fn(),
      sendMessage: vi.fn(),
      getMessages: vi.fn(),
    },
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  }),
}))

describe('useChatStore - v2', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  const mockMessage = (overrides: Partial<ChatMessage> = {}): ChatMessage => ({
    id: 'msg-1',
    role: 'assistant',
    type: 'message',
    content: 'Hello',
    timestamp: '2026-01-01T00:00:00Z',
    conversationId: 'conv-1',
    metadata: {},
    ...overrides,
  })

  describe('v2 getters', () => {
    it('visibleMessages keeps active recommend, filters selected/dismissed', () => {
      const store = useChatStore()
      store.currentConversation = {
        id: 'conv-1',
        title: 'Test',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        messageCount: 5,
      }
      store.messages = [
        mockMessage({ id: 'm1', type: 'message' }),
        mockMessage({ id: 'm2', type: 'think' }),
        mockMessage({ id: 'm3', type: 'recommend' }),                              // active: visible
        mockMessage({ id: 'm4', type: 'recommend', selectedOptionId: 'opt-1' }),    // selected: filtered
        mockMessage({ id: 'm5', type: 'recommend', metadata: { dismissed: true } }), // dismissed: filtered
        mockMessage({ id: 'm6', type: 'task' }),
        mockMessage({ id: 'm7', type: 'message', conversationId: 'conv-2' }),
      ]

      const visible = store.visibleMessages
      expect(visible).toHaveLength(4)
      expect(visible.map((m) => m.id)).toEqual(['m1', 'm2', 'm3', 'm6'])
    })

    it('visibleMessages returns empty when no currentConversation', () => {
      const store = useChatStore()
      store.messages = [mockMessage()]
      expect(store.visibleMessages).toHaveLength(0)
    })

    it('activeRecommend returns last active recommend', () => {
      const store = useChatStore()
      store.currentConversation = {
        id: 'conv-1',
        title: 'Test',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        messageCount: 4,
      }
      store.messages = [
        mockMessage({ id: 'm1', type: 'recommend', selectedOptionId: 'opt-1' }), // selected: excluded
        mockMessage({ id: 'm2', type: 'message' }),
        mockMessage({ id: 'm3', type: 'recommend' }),                                // active
        mockMessage({ id: 'm4', type: 'recommend', metadata: { dismissed: true } }),  // dismissed: excluded
      ]

      expect(store.activeRecommend?.id).toBe('m3')
    })

    it('activeRecommend returns null when no active recommend', () => {
      const store = useChatStore()
      store.currentConversation = {
        id: 'conv-1',
        title: 'Test',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        messageCount: 2,
      }
      store.messages = [
        mockMessage({ id: 'm1', type: 'message' }),
        mockMessage({ id: 'm2', type: 'recommend', selectedOptionId: 'opt-1' }),
      ]

      expect(store.activeRecommend).toBeNull()
    })

    it('currentVersionMessages filters by versionId', () => {
      const store = useChatStore()
      store.currentConversation = {
        id: 'conv-1',
        title: 'Test',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        messageCount: 4,
      }
      store.messages = [
        mockMessage({ id: 'm1', type: 'message' }),
        mockMessage({ id: 'm2', type: 'message', versionId: 'v1' }),
        mockMessage({ id: 'm3', type: 'message', versionId: 'v2' }),
        mockMessage({ id: 'm4', type: 'recommend', versionId: 'v2' }),
      ]

      store.currentVersionId = 'v2'
      expect(store.currentVersionMessages).toHaveLength(2)
      expect(store.currentVersionMessages[0].id).toBe('m3')
      expect(store.currentVersionMessages[1].id).toBe('m4')
    })

    it('currentVersionMessages returns all visible when no versionId', () => {
      const store = useChatStore()
      store.currentConversation = {
        id: 'conv-1',
        title: 'Test',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        messageCount: 2,
      }
      store.messages = [
        mockMessage({ id: 'm1' }),
        mockMessage({ id: 'm2' }),
      ]

      store.currentVersionId = null
      expect(store.currentVersionMessages).toHaveLength(2)
    })
  })

  describe('v2 actions', () => {
    it('dismissRecommend calls backend and marks metadata.dismissed', async () => {
      const store = useChatStore()
      store.currentConversation = {
        id: 'conv-1',
        title: 'Test',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        messageCount: 2,
      }
      store.messages = [
        mockMessage({ id: 'm1', type: 'message' }),
        mockMessage({ id: 'm2', type: 'recommend' }),
      ]

      const { chat: chatApi } = useApi()
      ;(chatApi.dismissRecommend as any).mockResolvedValue({ success: true })

      await store.dismissRecommend()

      expect(chatApi.dismissRecommend).toHaveBeenCalledWith('conv-1', 'm2')
      expect(store.messages).toHaveLength(2)
      const recommendMsg = store.messages.find((m) => m.id === 'm2')
      expect(recommendMsg?.metadata?.dismissed).toBe(true)
    })

    it('dismissRecommend does nothing when no currentConversation', async () => {
      const store = useChatStore()
      store.messages = [mockMessage({ id: 'm1', type: 'recommend' })]
      await store.dismissRecommend()
      expect(store.messages).toHaveLength(1)
    })

    it('selectRecommend calls backend with messageId and marks selectedOptionId', async () => {
      const store = useChatStore()
      store.currentConversation = {
        id: 'conv-1',
        title: 'Test',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        messageCount: 2,
      }
      store.messages = [
        mockMessage({ id: 'm1', type: 'message' }),
        mockMessage({ id: 'm2', type: 'recommend', options: [{ id: 'opt-1', label: 'A', prompt: 'Do A' }] }),
      ]

      const { chat: chatApi } = useApi()
      ;(chatApi.selectRecommend as any).mockResolvedValue({ success: true })

      await store.selectRecommend('opt-1')

      expect(chatApi.selectRecommend).toHaveBeenCalledWith('conv-1', 'm2', {
        optionId: 'opt-1',
      })
      expect(store.messages).toHaveLength(2)
      const recommendMsg = store.messages.find((m) => m.id === 'm2')
      expect(recommendMsg?.selectedOptionId).toBe('opt-1')
    })

    it('approveTask calls backend with messageId and action', async () => {
      const store = useChatStore()
      store.currentConversation = {
        id: 'conv-1',
        title: 'Test',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        messageCount: 1,
      }
      const task: TaskItem = {
        id: 'task-1',
        title: 'Build UI',
        status: 'pending',
        workerRole: 'frontend',
      }
      store.messages = [
        mockMessage({
          id: 'm1',
          type: 'task',
          tasks: [task],
        }),
      ]

      const { chat: chatApi } = useApi()
      ;(chatApi.approveTask as any).mockResolvedValue({ success: true })

      await store.approveTask('task-1', true)

      expect(chatApi.approveTask).toHaveBeenCalledWith('conv-1', 'm1', {
        action: 'approve',
      })
      expect(store.messages[0].tasks![0].status).toBe('approved')
    })

    it('approveTask declines with action: decline', async () => {
      const store = useChatStore()
      store.currentConversation = {
        id: 'conv-1',
        title: 'Test',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        messageCount: 1,
      }
      store.messages = [
        mockMessage({
          id: 'm1',
          type: 'task',
          tasks: [{ id: 'task-1', title: 'Build', status: 'pending' }],
        }),
      ]

      const { chat: chatApi } = useApi()
      ;(chatApi.approveTask as any).mockResolvedValue({ success: true })

      await store.approveTask('task-1', false)

      expect(chatApi.approveTask).toHaveBeenCalledWith('conv-1', 'm1', {
        action: 'decline',
      })
      expect(store.messages[0].tasks![0].status).toBe('declined')
    })

    it('loadVersions uses result.data.versions', async () => {
      const store = useChatStore()
      const mockVersions: ChatVersion[] = [
        {
          id: 'v1',
          sessionId: 'conv-1',
          versionNumber: 1,
          title: '版本 1',
          isActive: true,
          createdAt: '2026-01-01T00:00:00Z',
        },
      ]

      const { chat: chatApi } = useApi()
      ;(chatApi.listVersions as any).mockResolvedValue({
        success: true,
        data: { versions: mockVersions, total: 1 },
      })

      const result = await store.loadVersions('conv-1')

      expect(chatApi.listVersions).toHaveBeenCalledWith('conv-1')
      expect(store.versions).toEqual(mockVersions)
      expect(result).toEqual(mockVersions)
    })

    it('switchVersion uses backend returned messages directly', async () => {
      const store = useChatStore()
      store.currentConversation = {
        id: 'conv-1',
        title: 'Test',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        messageCount: 1,
      }
      store.messages = [
        mockMessage({ id: 'old1', conversationId: 'conv-1' }),
        mockMessage({ id: 'other', conversationId: 'conv-2' }),
      ]

      const switchedVersion: ChatVersion = {
        id: 'v2',
        sessionId: 'conv-1',
        versionNumber: 2,
        title: '版本 2',
        isActive: true,
        createdAt: '2026-01-02T00:00:00Z',
      }

      const { chat: chatApi } = useApi()
      ;(chatApi.switchVersion as any).mockResolvedValue({
        success: true,
        data: {
          ...switchedVersion,
          messages: [mockMessage({ id: 'new1', conversationId: 'conv-1', versionId: 'v2' })],
        },
      })

      const result = await store.switchVersion('v2')

      expect(chatApi.switchVersion).toHaveBeenCalledWith('conv-1', 'v2')
      expect(store.currentVersionId).toBe('v2')
      expect(store.messages.some((m) => m.id === 'new1')).toBe(true)
      expect(store.messages.some((m) => m.id === 'other')).toBe(true)
      expect(store.messages.some((m) => m.id === 'old1')).toBe(false)
    })

    it('switchVersion does nothing when no currentConversation', async () => {
      const store = useChatStore()
      const result = await store.switchVersion('v2')
      expect(result).toEqual([])
    })

    it('createVersion uses result.data directly', async () => {
      const store = useChatStore()
      store.currentConversation = {
        id: 'conv-1',
        title: 'Test',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        messageCount: 0,
      }

      const newVersion: ChatVersion = {
        id: 'v3',
        sessionId: 'conv-1',
        versionNumber: 3,
        title: '版本 3',
        isActive: true,
        createdAt: '2026-01-02T00:00:00Z',
      }

      const { chat: chatApi } = useApi()
      ;(chatApi.createVersion as any).mockResolvedValue({
        success: true,
        data: newVersion,
      })

      const result = await store.createVersion('版本 3')

      expect(chatApi.createVersion).toHaveBeenCalledWith('conv-1', {
        title: '版本 3',
        description: undefined,
      })
      expect(store.versions[0]).toEqual(newVersion)
      expect(store.currentVersionId).toBe('v3')
      expect(result).toEqual(newVersion)
    })
  })

  describe('backward compatibility', () => {
    it('treats messages without type as message type', () => {
      const store = useChatStore()
      store.currentConversation = {
        id: 'conv-1',
        title: 'Test',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        messageCount: 2,
      }
      store.messages = [
        mockMessage({ id: 'm1', type: undefined as any }),
        mockMessage({ id: 'm2', type: 'message' }),
      ]

      expect(store.visibleMessages).toHaveLength(2)
    })
  })
})

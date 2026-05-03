// Chat Controller Service 单元测试
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../src/utils/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

vi.mock('../../src/config/redis', () => ({
  default: {
    get: vi.fn(),
    set: vi.fn(),
    setex: vi.fn(),
    lpush: vi.fn(),
    ltrim: vi.fn(),
    expire: vi.fn(),
    lrange: vi.fn().mockResolvedValue([]),
  },
  key: (...parts: string[]) => parts.join(':'),
}))

vi.mock('../../src/services/llm', () => ({
  getLLMService: vi.fn(() => ({
    complete: vi.fn().mockResolvedValue({ content: 'chat' }),
  })),
}))

vi.mock('../../src/services/taskQueue', () => ({
  enqueueTask: vi.fn(),
}))

vi.mock('../../src/config/workspace', () => ({
  getChatWorkspacePath: vi.fn(() => '/tmp/chat/test'),
}))

vi.mock('../../src/services/credits', () => ({
  checkBalance: vi.fn().mockResolvedValue({ sufficient: true, balance: 100, estimatedCost: 10 }),
}))

const mockQuery = vi.fn()
const mockConnect = vi.fn()
vi.mock('../../src/config/database', () => ({
  pool: {
    query: (...args: any[]) => mockQuery(...args),
    connect: () => mockConnect(),
  },
}))

import { chatService } from '../../src/chat-controller/service'

beforeEach(() => {
  vi.clearAllMocks()
  mockQuery.mockReset()
  mockConnect.mockReset()
})

// ========== Session Management ==========
describe('Session Management', () => {
  it('createSession with workspaceId and projectId', async () => {
    mockQuery
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'proj-1' }] }) // project check
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'ws-1' }] }) // workspace check
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{
          id: 'sess-1', user_id: 'u-1', workspace_id: 'ws-1', project_id: 'proj-1',
          title: 'Test', status: 'active', session_type: 'default',
          created_at: '2026-05-04T00:00:00Z', updated_at: '2026-05-04T00:00:00Z',
        }],
      })

    const session = await chatService.createSession({
      userId: 'u-1',
      workspaceId: 'ws-1',
      projectId: 'proj-1',
      title: 'Test',
      sessionType: 'default',
    })

    expect(session.id).toBe('sess-1')
    expect(session.workspaceId).toBe('ws-1')
    expect(session.projectId).toBe('proj-1')
    expect(session.sessionType).toBe('default')
  })

  it('createSession falls back when project not found', async () => {
    mockQuery
      .mockResolvedValueOnce({ rowCount: 0, rows: [] }) // project not found
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'ws-1' }] }) // workspace check
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{
          id: 'sess-2', user_id: 'u-1', workspace_id: 'ws-1', project_id: null,
          title: '新会话', status: 'active', session_type: 'default',
          created_at: '2026-05-04T00:00:00Z', updated_at: '2026-05-04T00:00:00Z',
        }],
      })

    const session = await chatService.createSession({
      userId: 'u-1',
      workspaceId: 'ws-1',
      projectId: 'bad-proj',
    })

    expect(session.projectId).toBeNull()
  })

  it('getSession returns undefined when not found', async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] })
    const result = await chatService.getSession('nonexistent')
    expect(result).toBeUndefined()
  })

  it('listSessions filters by user and active status', async () => {
    mockQuery.mockResolvedValueOnce({
      rowCount: 2,
      rows: [
        { id: 's-1', user_id: 'u-1', workspace_id: null, project_id: null, title: 'A', status: 'active', session_type: 'default', created_at: '2026-05-04T00:00:00Z', updated_at: '2026-05-04T00:00:00Z' },
        { id: 's-2', user_id: 'u-1', workspace_id: null, project_id: null, title: 'B', status: 'active', session_type: 'review', created_at: '2026-05-04T00:00:00Z', updated_at: '2026-05-04T00:00:00Z' },
      ],
    })

    const sessions = await chatService.listSessions('u-1')
    expect(sessions).toHaveLength(2)
    expect(sessions[1].sessionType).toBe('review')
  })
})

// ========== Message Management ==========
describe('Message Management', () => {
  it('addMessage stores messageType and versionId', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{
          id: 'm-1', session_id: 's-1', role: 'user', message_type: 'think',
          content: 'test', metadata: '{}', version_id: 'v-1',
          is_visible_in_history: false, created_at: '2026-05-04T00:00:00Z',
        }],
      })
      .mockResolvedValueOnce({ rowCount: 1 })

    const msg = await chatService.addMessage('s-1', 'user', 'test', {
      messageType: 'think',
      versionId: 'v-1',
      isVisibleInHistory: false,
    })

    expect(msg.messageType).toBe('think')
    expect(msg.versionId).toBe('v-1')
    expect(msg.isVisibleInHistory).toBe(false)
  })

  it('getSessionMessages filters by versionId', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ count: '3' }] })
      .mockResolvedValueOnce({
        rows: [
          { id: 'm-1', session_id: 's-1', role: 'user', message_type: 'message', content: 'hi', metadata: '{}', version_id: 'v-1', is_visible_in_history: true, created_at: '2026-05-04T00:00:00Z' },
          { id: 'm-2', session_id: 's-1', role: 'assistant', message_type: 'message', content: 'hello', metadata: '{}', version_id: 'v-1', is_visible_in_history: true, created_at: '2026-05-04T00:01:00Z' },
        ],
      })

    const { messages, total } = await chatService.getSessionMessages('s-1', 1, 50, { versionId: 'v-1' })
    expect(total).toBe(3)
    expect(messages).toHaveLength(2)
    expect(messages[0].versionId).toBe('v-1')
  })

  it('getSessionMessages excludes invisible by default', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ count: '1' }] })
      .mockResolvedValueOnce({
        rows: [
          { id: 'm-1', session_id: 's-1', role: 'user', message_type: 'message', content: 'hi', metadata: '{}', version_id: null, is_visible_in_history: true, created_at: '2026-05-04T00:00:00Z' },
        ],
      })

    const { messages, total } = await chatService.getSessionMessages('s-1')
    expect(total).toBe(1)
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('is_visible_in_history = $2'),
      expect.anything(),
    )
  })
})

// ========== Task 交互 ==========
describe('Task Interactions', () => {
  it('approveTask updates approvalStatus to approved', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{
          id: 'm-task', session_id: 's-1', role: 'assistant', message_type: 'task',
          content: 'confirm', metadata: JSON.stringify({ taskPayload: { actions: [] } }),
          version_id: null, is_visible_in_history: true, created_at: '2026-05-04T00:00:00Z',
        }],
      })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{
          id: 'm-task', session_id: 's-1', role: 'assistant', message_type: 'task',
          content: 'confirm', metadata: JSON.stringify({ taskPayload: { actions: [] }, approvalStatus: 'approved' }),
          version_id: null, is_visible_in_history: true, created_at: '2026-05-04T00:00:00Z',
        }],
      })
      // getSession call inside onTaskApproved
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{
          id: 's-1', user_id: 'u-1', workspace_id: null, project_id: null,
          title: 'Test', status: 'active', session_type: 'default',
          created_at: '2026-05-04T00:00:00Z', updated_at: '2026-05-04T00:00:00Z',
        }],
      })

    const updated = await chatService.approveTask('m-task', 's-1', 'approve')
    expect(updated.metadata?.approvalStatus).toBe('approved')
  })

  it('approveTask throws when message not found in session', async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] })
    await expect(chatService.approveTask('bad-id', 'wrong-session', 'approve')).rejects.toThrow('Task message not found in session')
  })
})

// ========== Recommend 交互 ==========
describe('Recommend Interactions', () => {
  it('selectRecommend updates selectedOptionId', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{
          id: 'm-rec', session_id: 's-1', role: 'assistant', message_type: 'recommend',
          content: '', metadata: JSON.stringify({ recommendOptions: [{ id: 'opt-1', label: 'A', prompt: 'do A' }] }),
          version_id: null, is_visible_in_history: false, created_at: '2026-05-04T00:00:00Z',
        }],
      })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{
          id: 'm-rec', session_id: 's-1', role: 'assistant', message_type: 'recommend',
          content: '', metadata: JSON.stringify({ recommendOptions: [{ id: 'opt-1', label: 'A', prompt: 'do A' }], selectedOptionId: 'opt-1' }),
          version_id: null, is_visible_in_history: false, created_at: '2026-05-04T00:00:00Z',
        }],
      })
      // addMessage call inside onRecommendSelected
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{
          id: 'm-new', session_id: 's-1', role: 'user', message_type: 'message',
          content: 'A', metadata: JSON.stringify({ source: 'recommend', originalOptionId: 'opt-1', prompt: 'do A' }),
          version_id: null, is_visible_in_history: true, created_at: '2026-05-04T00:00:00Z',
        }],
      })
      .mockResolvedValueOnce({ rowCount: 1 })
      // classifyIntent + system_event inside onRecommendSelected
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{
          id: 'm-sys', session_id: 's-1', role: 'system', message_type: 'system_event',
          content: '检测到意图: chat', metadata: '{}',
          version_id: null, is_visible_in_history: true, created_at: '2026-05-04T00:00:00Z',
        }],
      })
      .mockResolvedValueOnce({ rowCount: 1 })

    const updated = await chatService.selectRecommend('m-rec', 's-1', 'opt-1')
    expect(updated.metadata?.selectedOptionId).toBe('opt-1')
  })

  it('selectRecommend throws when message not in session', async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] })
    await expect(chatService.selectRecommend('m-rec', 'wrong-session', 'opt-1')).rejects.toThrow('Recommend message not found in session')
  })

  it('dismissRecommend marks message as invisible', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{
          id: 'm-rec', session_id: 's-1', role: 'assistant', message_type: 'recommend',
          content: '', metadata: '{}', version_id: null, is_visible_in_history: true, created_at: '2026-05-04T00:00:00Z',
        }],
      })
      .mockResolvedValueOnce({ rowCount: 1 })

    const result = await chatService.dismissRecommend('m-rec', 's-1')
    expect(result).toBe(true)
  })

  it('dismissRecommend throws when message not in session', async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] })
    await expect(chatService.dismissRecommend('m-rec', 'wrong-session')).rejects.toThrow('Recommend message not found in session')
  })
})

// ========== Version 管理 ==========
describe('Version Management', () => {
  it('createVersion increments version_number per session', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ max: 2 }] })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{
          id: 'v-3', session_id: 's-1', version_number: 3, title: 'v3',
          description: null, base_message_id: null, is_active: false,
          created_at: '2026-05-04T00:00:00Z', updated_at: '2026-05-04T00:00:00Z',
        }],
      })

    const version = await chatService.createVersion('s-1', { title: 'v3' }, 'u-1')
    expect(version.versionNumber).toBe(3)
    expect(version.isActive).toBe(false)
  })

  it('switchVersion uses transaction and returns messages', async () => {
    const mockClient = {
      query: vi.fn(),
      release: vi.fn(),
    }
    mockConnect.mockResolvedValue(mockClient)

    mockClient.query
      .mockResolvedValueOnce(undefined) // BEGIN
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'v-2' }] }) // version check
      .mockResolvedValueOnce({ rowCount: 1 }) // deactivate old
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{
          id: 'v-2', session_id: 's-1', version_number: 2, title: 'v2',
          description: null, base_message_id: null, is_active: true,
          created_at: '2026-05-04T00:00:00Z', updated_at: '2026-05-04T00:00:00Z',
        }],
      })
      .mockResolvedValueOnce({ rowCount: 1 }) // update session
      .mockResolvedValueOnce(undefined) // COMMIT

    // getSessionMessages mock for fetching messages after switch
    mockQuery.mockResolvedValueOnce({ rows: [{ count: '1' }] }) // count
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 'm-1', session_id: 's-1', role: 'user', message_type: 'message',
        content: 'hi', metadata: '{}', version_id: 'v-2', is_visible_in_history: true,
        created_at: '2026-05-04T00:00:00Z',
      }],
    })

    const result = await chatService.switchVersion('s-1', 'v-2')
    expect(result.version.isActive).toBe(true)
    expect(result.messages).toHaveLength(1)
    expect(result.messages[0].versionId).toBe('v-2')
    expect(mockClient.query).toHaveBeenCalledWith('BEGIN')
    expect(mockClient.query).toHaveBeenCalledWith('COMMIT')
    expect(mockClient.release).toHaveBeenCalled()
  })

  it('switchVersion rolls back on error', async () => {
    const mockClient = {
      query: vi.fn(),
      release: vi.fn(),
    }
    mockConnect.mockResolvedValue(mockClient)

    mockClient.query
      .mockResolvedValueOnce(undefined) // BEGIN
      .mockResolvedValueOnce({ rowCount: 0 }) // version not found

    await expect(chatService.switchVersion('s-1', 'bad-v')).rejects.toThrow('Version not found in session')
    expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK')
    expect(mockClient.release).toHaveBeenCalled()
  })

  it('listVersions returns ordered versions', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: 'v-1', session_id: 's-1', version_number: 1, title: 'v1', description: null, base_message_id: null, is_active: false, created_at: '2026-05-04T00:00:00Z', updated_at: '2026-05-04T00:00:00Z' },
        { id: 'v-2', session_id: 's-1', version_number: 2, title: 'v2', description: null, base_message_id: null, is_active: true, created_at: '2026-05-04T00:00:00Z', updated_at: '2026-05-04T00:00:00Z' },
      ],
    })

    const versions = await chatService.listVersions('s-1')
    expect(versions).toHaveLength(2)
    expect(versions[0].versionNumber).toBe(1)
    expect(versions[1].isActive).toBe(true)
  })
})

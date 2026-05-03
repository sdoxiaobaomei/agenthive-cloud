// Chat Controller 单元测试
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../src/utils/logger.js', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

vi.mock('../../src/services/credits.js', () => ({
  checkBalance: vi.fn().mockResolvedValue({ sufficient: true, balance: 100, estimatedCost: 10 }),
}))

const mockApproveTask = vi.fn()
const mockSelectRecommend = vi.fn()
const mockCreateVersion = vi.fn()
const mockSwitchVersion = vi.fn()
const mockListVersions = vi.fn()
const mockGetSession = vi.fn()
const mockAddMessage = vi.fn()
const mockClassifyIntent = vi.fn()
const mockExecuteAgentTask = vi.fn()
const mockGenerateReply = vi.fn()

vi.mock('../../src/chat-controller/service.js', () => ({
  chatService: {
    getSession: (...args: any[]) => mockGetSession(...args),
    addMessage: (...args: any[]) => mockAddMessage(...args),
    classifyIntent: (...args: any[]) => mockClassifyIntent(...args),
    executeAgentTask: (...args: any[]) => mockExecuteAgentTask(...args),
    generateReply: (...args: any[]) => mockGenerateReply(...args),
    approveTask: (...args: any[]) => mockApproveTask(...args),
    selectRecommend: (...args: any[]) => mockSelectRecommend(...args),
    createVersion: (...args: any[]) => mockCreateVersion(...args),
    switchVersion: (...args: any[]) => mockSwitchVersion(...args),
    listVersions: (...args: any[]) => mockListVersions(...args),
  },
}))

const mockPoolQuery = vi.fn()
vi.mock('../../src/config/database.js', () => ({
  pool: { query: (...args: any[]) => mockPoolQuery(...args) },
}))

import {
  createSession,
  sendMessage,
  approveTask,
  selectRecommend,
  dismissRecommend,
  listVersions,
  createVersion,
  switchVersion,
} from '../../src/chat-controller/controller.js'

function mockReq(options: { body?: any; params?: any; query?: any; userId?: string } = {}) {
  return {
    body: options.body || {},
    params: options.params || {},
    query: options.query || {},
    userId: 'userId' in options ? options.userId : 'test-user',
  } as any
}

function mockRes() {
  const jsonFn = vi.fn()
  const statusFn = vi.fn().mockReturnThis()
  return {
    status: statusFn,
    json: jsonFn,
  } as any
}

beforeEach(() => {
  vi.clearAllMocks()
  mockApproveTask.mockReset()
  mockSelectRecommend.mockReset()
  mockCreateVersion.mockReset()
  mockSwitchVersion.mockReset()
  mockListVersions.mockReset()
  mockGetSession.mockReset()
  mockAddMessage.mockReset()
  mockClassifyIntent.mockReset()
  mockExecuteAgentTask.mockReset()
  mockGenerateReply.mockReset()
  mockPoolQuery.mockReset()
})

// ========== createSession ==========
describe('createSession', () => {
  it('returns 401 without userId', async () => {
    const req = mockReq({ body: { title: 'Test' }, userId: undefined })
    const res = mockRes()
    await createSession(req, res)
    expect(res.status).toHaveBeenCalledWith(401)
  })

  it('returns 400 on invalid body', async () => {
    const req = mockReq({ body: { projectId: 'not-a-uuid' } })
    const res = mockRes()
    await createSession(req, res)
    expect(res.status).toHaveBeenCalledWith(400)
  })
})

// ========== sendMessage ==========
describe('sendMessage', () => {
  it('returns 404 when session not found', async () => {
    mockGetSession.mockResolvedValue(undefined)
    const req = mockReq({ params: { id: 'sess-1' }, body: { content: 'hi' } })
    const res = mockRes()
    await sendMessage(req, res)
    expect(res.status).toHaveBeenCalledWith(404)
  })

  it('returns 401 without userId', async () => {
    const req = mockReq({ params: { id: 'sess-1' }, body: { content: 'hi' }, userId: undefined })
    const res = mockRes()
    await sendMessage(req, res)
    expect(res.status).toHaveBeenCalledWith(401)
  })

  it('handles recommend messageType without agent task', async () => {
    mockGetSession.mockResolvedValue({ id: 'sess-1', currentVersionId: 'v-1' })
    mockAddMessage.mockResolvedValue({ id: 'm-rec', messageType: 'recommend' })

    const req = mockReq({ params: { id: 'sess-1' }, body: { content: 'choose', messageType: 'recommend', metadata: { recommendOptions: [{ id: '1', label: 'A', prompt: 'do A' }] } } })
    const res = mockRes()
    await sendMessage(req, res)

    expect(mockAddMessage).toHaveBeenCalledWith('sess-1', 'user', 'choose', expect.objectContaining({ messageType: 'recommend', versionId: 'v-1' }))
    expect(mockAddMessage).toHaveBeenCalledWith('sess-1', 'assistant', '', expect.objectContaining({ messageType: 'recommend', isVisibleInHistory: false }))
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 200 }))
  })

  it('triggers agent task for non-chat intent', async () => {
    mockGetSession.mockResolvedValue({ id: 'sess-1', currentVersionId: undefined })
    mockAddMessage.mockResolvedValue({ id: 'm-1' })
    mockClassifyIntent.mockResolvedValue({ intent: 'create_project' })
    mockExecuteAgentTask.mockResolvedValue([{ ticketId: 'T-1', workerRole: 'backend', status: 'pending' }])
    mockGenerateReply.mockResolvedValue('Creating project...')

    const req = mockReq({ params: { id: 'sess-1' }, body: { content: 'create a project' } })
    const res = mockRes()
    await sendMessage(req, res)

    expect(mockClassifyIntent).toHaveBeenCalledWith('create a project')
    expect(mockExecuteAgentTask).toHaveBeenCalled()
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 200,
      data: expect.objectContaining({ intent: 'create_project' }),
    }))
  })

  it('returns 402 when credits insufficient', async () => {
    mockGetSession.mockResolvedValue({ id: 'sess-1' })
    mockAddMessage.mockResolvedValue({ id: 'm-1' })
    mockClassifyIntent.mockResolvedValue({ intent: 'create_project' })
    const { checkBalance } = await import('../../src/services/credits.js')
    vi.mocked(checkBalance).mockResolvedValueOnce({ sufficient: false, balance: 0, estimatedCost: 50 })

    const req = mockReq({ params: { id: 'sess-1' }, body: { content: 'create a project' } })
    const res = mockRes()
    await sendMessage(req, res)

    expect(res.status).toHaveBeenCalledWith(402)
  })
})

// ========== approveTask ==========
describe('approveTask', () => {
  it('approves a task successfully', async () => {
    mockApproveTask.mockResolvedValue({ id: 'm-1', metadata: { approvalStatus: 'approved' } })
    const req = mockReq({ params: { id: 'sess-1', messageId: 'm-1' }, body: { action: 'approve', reason: 'go ahead' } })
    const res = mockRes()
    await approveTask(req, res)

    expect(mockApproveTask).toHaveBeenCalledWith('m-1', 'approve', 'go ahead')
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 200 }))
  })

  it('returns 401 without userId', async () => {
    const req = mockReq({ params: { id: 'sess-1', messageId: 'm-1' }, body: { action: 'approve' }, userId: undefined })
    const res = mockRes()
    await approveTask(req, res)
    expect(res.status).toHaveBeenCalledWith(401)
  })
})

// ========== selectRecommend ==========
describe('selectRecommend', () => {
  it('selects an option', async () => {
    mockSelectRecommend.mockResolvedValue({ id: 'm-rec', metadata: { selectedOptionId: 'opt-1' } })
    const req = mockReq({ params: { id: 'sess-1', messageId: 'm-rec' }, body: { optionId: 'opt-1' } })
    const res = mockRes()
    await selectRecommend(req, res)

    expect(mockSelectRecommend).toHaveBeenCalledWith('m-rec', 'opt-1')
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 200 }))
  })
})

// ========== dismissRecommend ==========
describe('dismissRecommend', () => {
  it('marks recommend as invisible', async () => {
    mockPoolQuery.mockResolvedValue({ rowCount: 1 })
    const req = mockReq({ params: { id: 'sess-1', messageId: 'm-rec' } })
    const res = mockRes()
    await dismissRecommend(req, res)

    expect(mockPoolQuery).toHaveBeenCalledWith(
      'UPDATE chat_messages SET is_visible_in_history = FALSE WHERE id = $1 AND message_type = $2',
      ['m-rec', 'recommend'],
    )
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 200 }))
  })
})

// ========== Version Management ==========
describe('Version Management', () => {
  it('listVersions returns versions', async () => {
    mockListVersions.mockResolvedValue([{ id: 'v-1', versionNumber: 1 }])
    const req = mockReq({ params: { id: 'sess-1' } })
    const res = mockRes()
    await listVersions(req, res)

    expect(mockListVersions).toHaveBeenCalledWith('sess-1')
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 200 }))
  })

  it('createVersion validates input', async () => {
    const req = mockReq({ params: { id: 'sess-1' }, body: { title: '' } })
    const res = mockRes()
    await createVersion(req, res)
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('createVersion succeeds with valid input', async () => {
    mockCreateVersion.mockResolvedValue({ id: 'v-2', versionNumber: 2, title: 'feat-1' })
    const req = mockReq({ params: { id: 'sess-1' }, body: { title: 'feat-1' } })
    const res = mockRes()
    await createVersion(req, res)

    expect(mockCreateVersion).toHaveBeenCalledWith('sess-1', { title: 'feat-1' }, 'test-user')
    expect(res.status).toHaveBeenCalledWith(201)
  })

  it('switchVersion activates version', async () => {
    mockSwitchVersion.mockResolvedValue({ id: 'v-3', isActive: true })
    const req = mockReq({ params: { id: 'sess-1', versionId: 'v-3' } })
    const res = mockRes()
    await switchVersion(req, res)

    expect(mockSwitchVersion).toHaveBeenCalledWith('sess-1', 'v-3')
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 200 }))
  })
})

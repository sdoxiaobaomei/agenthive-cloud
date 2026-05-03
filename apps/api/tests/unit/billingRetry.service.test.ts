// billingRetry.service unit tests
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../src/utils/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

// Redis mock — hoisted via vi.hoisted so it's available inside vi.mock factory
const { mockRedis } = vi.hoisted(() => ({
  mockRedis: {
    xgroup: vi.fn(),
    xadd: vi.fn(),
    xreadgroup: vi.fn(),
    xack: vi.fn(),
    xrevrange: vi.fn(),
  },
}))

vi.mock('../../src/config/redis', () => ({ redis: mockRedis }))

// credits mock — same pattern, hoisted to avoid TDZ
const { mockDebit } = vi.hoisted(() => ({
  mockDebit: vi.fn(),
}))

vi.mock('../../src/services/credits', () => ({ debitCredits: mockDebit }))

import {
  initBillingRetryQueue,
  enqueueBillingRetry,
  runBillingRetryConsumer,
  BillingRetryWorker,
} from '../../src/services/billingRetry'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('initBillingRetryQueue', () => {
  it('creates consumer group on first run', async () => {
    mockRedis.xgroup.mockResolvedValue('OK')
    await initBillingRetryQueue()
    expect(mockRedis.xgroup).toHaveBeenCalledWith(
      'CREATE',
      expect.stringContaining('billing'),
      expect.stringContaining('workers'),
      '$',
      'MKSTREAM'
    )
  })

  it('is idempotent when BUSYGROUP error occurs', async () => {
    mockRedis.xgroup.mockRejectedValue(
      Object.assign(new Error('BUSYGROUP'), { message: 'BUSYGROUP Consumer Group name already exists' })
    )
    await expect(initBillingRetryQueue()).resolves.not.toThrow()
  })

  it('throws on unexpected Redis error', async () => {
    mockRedis.xgroup.mockRejectedValue(new Error('connection refused'))
    await expect(initBillingRetryQueue()).rejects.toThrow('connection refused')
  })
})

describe('enqueueBillingRetry', () => {
  it('adds entry to stream with attempt=1 and returns stream ID', async () => {
    mockRedis.xadd.mockResolvedValue('1234567890-0')
    const id = await enqueueBillingRetry({
      taskId: 'task-1',
      userId: 'user-1',
      workerRole: 'backend',
      tokensUsed: 500,
    })
    expect(id).toBe('1234567890-0')
    expect(mockRedis.xadd).toHaveBeenCalledWith(
      expect.stringContaining('billing'), '*',
      expect.any(String), 'task-1',
      expect.any(String), 'user-1',
      expect.any(String), expect.any(String),  // sessionId
      expect.any(String), 'backend',
      expect.any(String), expect.any(String),  // tokensUsed
      expect.any(String), '1',  // attempt
      expect.any(String), expect.any(String),  // originalError
      expect.any(String), expect.any(String),  // createdAt
    )
  })

  it('throws when XADD returns null', async () => {
    mockRedis.xadd.mockResolvedValue(null)
    await expect(enqueueBillingRetry({
      taskId: 'task-1',
      userId: 'user-1',
      workerRole: 'backend',
    })).rejects.toThrow('XADD returned null')
  })
})

describe('runBillingRetryConsumer', () => {
  function makeEntry(attempt = '1', tokensUsed = '100', extraFields: Record<string, string> = {}) {
    return [
      'taskId', 'task-1',
      'userId', 'user-1',
      'sessionId', '',
      'workerRole', 'backend',
      'tokensUsed', tokensUsed,
      'attempt', attempt,
      'originalError', '',
      'createdAt', String(Date.now()),
      ...Object.entries(extraFields).flat(),
    ]
  }

  it('returns 0 when queue is empty', async () => {
    mockRedis.xreadgroup.mockResolvedValue(null)
    expect(await runBillingRetryConsumer()).toBe(0)
  })

  it('processes entry, calls debitCredits, and acks message', async () => {
    const streamId = '1234567890-0'
    mockRedis.xreadgroup.mockResolvedValue([['key', [[streamId, makeEntry()]]]])
    mockDebit.mockResolvedValue({ success: true, creditsDeducted: 5, creditsRemaining: 995, errorCode: undefined })
    mockRedis.xack.mockResolvedValue(1)

    const count = await runBillingRetryConsumer()
    expect(count).toBe(1)
    expect(mockDebit).toHaveBeenCalledWith(expect.objectContaining({
      taskId: 'task-1',
      userId: 'user-1',
      workerRole: 'backend',
      tokensUsed: 100,
    }))
    expect(mockRedis.xack).toHaveBeenCalledWith(
      expect.stringContaining('billing'),
      expect.stringContaining('workers'),
      streamId
    )
  })

  it('re-enqueues with attempt+1 when debit fails and attempt < 3', async () => {
    const streamId = '1234567890-0'
    mockRedis.xreadgroup.mockResolvedValue([['key', [[streamId, makeEntry('1')]]]])
    mockDebit.mockResolvedValue({ success: false, errorCode: 'TIMEOUT', message: 'timeout' })
    mockRedis.xadd.mockResolvedValue('1234567890-1')
    mockRedis.xrevrange.mockResolvedValue([['1234567890-1', []]])
    mockRedis.xack.mockResolvedValue(1)

    const count = await runBillingRetryConsumer()
    expect(count).toBe(1)
    // Verify re-enqueue call has attempt = 2
    // xadd 调用格式: (streamKey, id, field1, val1, field2, val2, ...)
    const xaddCall = mockRedis.xadd.mock.calls.find((c: string[]) => {
      const attemptIdx = c.indexOf('attempt')
      return attemptIdx !== -1 && c[attemptIdx + 1] === '2'
    })
    expect(xaddCall).toBeDefined()
  })

  it('does NOT re-enqueue when attempt >= 3 (max retries exceeded)', async () => {
    const streamId = '1234567890-0'
    mockRedis.xreadgroup.mockResolvedValue([['key', [[streamId, makeEntry('3')]]]])
    mockDebit.mockResolvedValue({ success: false, errorCode: 'TIMEOUT', message: 'timeout' })
    mockRedis.xack.mockResolvedValue(1)

    const count = await runBillingRetryConsumer()
    expect(count).toBe(1)
    // Should NOT call xadd for re-enqueue
    const requeueCalls = mockRedis.xadd.mock.calls.filter(c => c[1] !== streamId)
    expect(requeueCalls.length).toBe(0)
  })

  it('MOCK_FALLBACK is treated as failure and re-enqueues', async () => {
    // 代码逻辑: success && errorCode !== 'MOCK_FALLBACK' → MOCK_FALLBACK 不算成功，走重试入队
    const streamId = '1234567890-0'
    mockRedis.xreadgroup.mockResolvedValue([['key', [[streamId, makeEntry()]]]])
    mockDebit.mockResolvedValue({ success: true, errorCode: 'MOCK_FALLBACK', message: 'mock' })
    mockRedis.xadd.mockResolvedValue('1234567890-1')
    mockRedis.xrevrange.mockResolvedValue([['1234567890-1', []]])
    mockRedis.xack.mockResolvedValue(1)

    const count = await runBillingRetryConsumer()
    expect(count).toBe(1)
    // MOCK_FALLBACK 不走成功分支，会走重试入队
    expect(mockRedis.xadd.mock.calls.length).toBeGreaterThan(0)
  })
})

describe('BillingRetryWorker', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('starts and stops without error', async () => {
    mockRedis.xgroup.mockResolvedValue('OK')
    mockRedis.xreadgroup.mockResolvedValue(null)

    const worker = new BillingRetryWorker()
    await worker.start(60000)
    await worker.stop()
    await worker.stop() // second stop is safe
  })

  it('does not start twice', async () => {
    mockRedis.xgroup.mockResolvedValue('OK')
    mockRedis.xreadgroup.mockResolvedValue(null)

    const worker = new BillingRetryWorker()
    await worker.start()
    await worker.start() // should be no-op
    await worker.stop()
  })
})

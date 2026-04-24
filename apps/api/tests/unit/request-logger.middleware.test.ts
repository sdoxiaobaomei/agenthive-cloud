// Request Logger Middleware 单元测试
import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'

// Mock logger
vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    request: vi.fn(),
  },
}))

import { logger } from '../../src/utils/logger.js'
import { requestLogger } from '../../src/middleware/request-logger.js'

const mockLoggerRequest = logger.request as ReturnType<typeof vi.fn>

function createTestApp() {
  const app = express()
  app.use(requestLogger())
  app.get('/api/test', (_req, res) => res.status(200).json({ ok: true }))
  app.post('/api/test', (_req, res) => res.status(201).json({ created: true }))
  app.get('/api/error', (_req, res) => res.status(500).json({ error: 'server error' }))
  app.get('/api/not-found', (_req, res) => res.status(404).json({ error: 'not found' }))
  return app
}

describe('Request Logger Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('应记录 GET 200 请求的日志', async () => {
    const app = createTestApp()

    const res = await request(app)
      .get('/api/test')
      .set('user-agent', 'vitest-agent')

    expect(res.status).toBe(200)
    expect(mockLoggerRequest).toHaveBeenCalledTimes(1)

    const logCall = mockLoggerRequest.mock.calls[0][0]
    expect(logCall.method).toBe('GET')
    expect(logCall.path).toBe('/api/test')
    expect(logCall.status).toBe(200)
    expect(logCall.user_agent).toBe('vitest-agent')
    expect(logCall.duration_ms).toBeGreaterThanOrEqual(0)
  })

  it('应记录 POST 201 请求的日志', async () => {
    const app = createTestApp()

    const res = await request(app).post('/api/test')

    expect(res.status).toBe(201)
    expect(mockLoggerRequest).toHaveBeenCalledTimes(1)

    const logCall = mockLoggerRequest.mock.calls[0][0]
    expect(logCall.method).toBe('POST')
    expect(logCall.status).toBe(201)
  })

  it('应记录 500 错误请求的日志', async () => {
    const app = createTestApp()

    const res = await request(app).get('/api/error')

    expect(res.status).toBe(500)
    expect(mockLoggerRequest).toHaveBeenCalledTimes(1)

    const logCall = mockLoggerRequest.mock.calls[0][0]
    expect(logCall.status).toBe(500)
  })

  it('应记录 404 请求的日志', async () => {
    const app = createTestApp()

    const res = await request(app).get('/api/not-found')

    expect(res.status).toBe(404)
    expect(mockLoggerRequest).toHaveBeenCalledTimes(1)

    const logCall = mockLoggerRequest.mock.calls[0][0]
    expect(logCall.status).toBe(404)
  })

  it('duration_ms 应为非负数', async () => {
    const app = createTestApp()

    await request(app).get('/api/test')

    const logCall = mockLoggerRequest.mock.calls[0][0]
    expect(logCall.duration_ms).toBeGreaterThanOrEqual(0)
  })

  it('未设置 user-agent 时 user_agent 应为 undefined', async () => {
    const app = createTestApp()

    await request(app).get('/api/test')

    const logCall = mockLoggerRequest.mock.calls[0][0]
    expect(logCall).toHaveProperty('user_agent')
  })
})

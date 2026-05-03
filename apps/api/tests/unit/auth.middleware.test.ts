// Auth Middleware 单元测试 — 匹配 Gateway 透传认证架构
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import express, { Request, Response, NextFunction } from 'express'

// Mock 依赖模块
vi.mock('../../src/services/userMapping', () => ({
  resolveLocalUser: vi.fn(),
}))

vi.mock('../../src/db/index', () => ({
  userDb: {
    create: vi.fn(),
    getAll: vi.fn().mockResolvedValue([]),
  },
}))

vi.mock('../../src/utils/logger', () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    request: vi.fn(),
  },
}))

import { authMiddleware, optionalAuthMiddleware } from '../../src/middleware/auth'
import { resolveLocalUser } from '../../src/services/userMapping'

const mockResolveLocalUser = resolveLocalUser as ReturnType<typeof vi.fn>

function createTestApp(middleware: (req: Request, res: Response, next: NextFunction) => void) {
  const app = express()
  app.use(express.json())
  app.use(middleware)
  app.get('/api/protected', (_req, res) => res.json({ ok: true }))
  app.get('/health', (_req, res) => res.json({ status: 'up' }))
  app.get('/demo/test', (_req, res) => res.json({ ok: true }))
  app.get('/visitor-status', (_req, res) => res.json({ ok: true }))
  return app
}

describe('Auth Middleware', () => {
  const originalEnv = process.env.NODE_ENV

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NODE_ENV = 'development'
  })

  afterEach(() => {
    process.env.NODE_ENV = originalEnv
  })

  describe('白名单路径', () => {
    it('应该直接放行 /health 请求', async () => {
      const app = createTestApp(authMiddleware)
      const res = await request(app).get('/health')

      expect(res.status).toBe(200)
      expect(res.body.status).toBe('up')
    })

    it('应该直接放行 /demo/ 路径请求', async () => {
      const app = createTestApp(authMiddleware)
      const res = await request(app).get('/demo/test')

      expect(res.status).toBe(200)
    })

    it('应该直接放行 /visitor-status 请求', async () => {
      const app = createTestApp(authMiddleware)
      const res = await request(app).get('/visitor-status')

      expect(res.status).toBe(200)
    })
  })

  describe('测试环境自动认证', () => {
    it('测试环境下应自动设置 test-user-id 并放行', async () => {
      process.env.NODE_ENV = 'test'
      const app = createTestApp(authMiddleware)
      const res = await request(app).get('/api/protected')

      expect(res.status).toBe(200)
      expect(res.body.ok).toBe(true)
    })
  })

  describe('Gateway 透传模式', () => {
    it('应通过 x-user-id 头解析用户并放行', async () => {
      // 必须设为非开发、非测试环境，才能走到 Gateway 逻辑
      process.env.NODE_ENV = 'production'
      const app = createTestApp(authMiddleware)
      mockResolveLocalUser.mockResolvedValue({
        id: 'local-uuid-123',
        username: 'alice',
        role: 'admin',
      })

      const res = await request(app)
        .get('/api/protected')
        .set('x-user-id', '42')
        .set('x-user-name', 'alice')
        .set('x-user-role', 'admin')

      expect(res.status).toBe(200)
      expect(mockResolveLocalUser).toHaveBeenCalledWith({
        externalId: '42',
        username: 'alice',
        role: 'admin',
      })
    })

    it('Gateway header 存在但解析失败时应返回 401', async () => {
      process.env.NODE_ENV = 'production'
      const app = createTestApp(authMiddleware)
      mockResolveLocalUser.mockRejectedValue(new Error('DB error'))

      const res = await request(app)
        .get('/api/protected')
        .set('x-user-id', '99')

      expect(res.status).toBe(401)
    })
  })

  describe('开发环境模拟用户', () => {
    it('开发环境下应注入模拟用户并放行', async () => {
      process.env.NODE_ENV = 'development'
      const app = createTestApp(authMiddleware)
      mockResolveLocalUser.mockResolvedValue({
        id: 'dev-uuid',
        username: 'Developer',
        role: 'admin',
      })

      const res = await request(app).get('/api/protected')

      expect(res.status).toBe(200)
    })
  })

  describe('无认证信息（非测试/非开发环境）', () => {
    it('无 gateway header 应返回 401', async () => {
      process.env.NODE_ENV = 'production'
      const app = createTestApp(authMiddleware)

      const res = await request(app).get('/api/protected')

      expect(res.status).toBe(401)
    })
  })

  describe('optionalAuthMiddleware', () => {
    it('Gateway 模式下应解析用户但始终放行', async () => {
      process.env.NODE_ENV = 'production'
      const app = createTestApp(optionalAuthMiddleware)
      mockResolveLocalUser.mockResolvedValue({
        id: 'local-uuid-789',
        username: 'dave',
        role: 'user',
      })

      const res = await request(app)
        .get('/api/protected')
        .set('x-user-id', '100')

      expect(res.status).toBe(200)
      expect(mockResolveLocalUser).toHaveBeenCalled()
    })

    it('无认证信息也应放行', async () => {
      process.env.NODE_ENV = 'production'
      const app = createTestApp(optionalAuthMiddleware)

      const res = await request(app).get('/api/protected')

      expect(res.status).toBe(200)
    })
  })
})

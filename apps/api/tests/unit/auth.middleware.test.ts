// Auth Middleware 单元测试
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import express, { Request, Response, NextFunction } from 'express'
import cookieParser from 'cookie-parser'

// Mock 依赖模块
vi.mock('../../src/services/userMapping.js', () => ({
  resolveLocalUser: vi.fn(),
}))

vi.mock('../../src/utils/jwt.js', () => ({
  jwt: {
    sign: vi.fn(),
    verify: vi.fn(),
    decode: vi.fn(),
  },
}))

vi.mock('../../src/utils/logger.js', () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    request: vi.fn(),
  },
}))

import { authMiddleware, optionalAuthMiddleware } from '../../src/middleware/auth.js'
import { resolveLocalUser } from '../../src/services/userMapping.js'
import { jwt } from '../../src/utils/jwt.js'

const mockResolveLocalUser = resolveLocalUser as ReturnType<typeof vi.fn>
const mockJwtVerify = jwt.verify as ReturnType<typeof vi.fn>

function createTestApp(middleware: (req: Request, res: Response, next: NextFunction) => void) {
  const app = express()
  app.use(express.json())
  app.use(cookieParser())
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

    it('x-user-id 存在但解析失败时应返回 401', async () => {
      const app = createTestApp(authMiddleware)
      mockResolveLocalUser.mockRejectedValue(new Error('DB error'))

      const res = await request(app)
        .get('/api/protected')
        .set('x-user-id', '99')

      expect(res.status).toBe(401)
      expect(res.body.error).toContain('Invalid gateway user identity')
    })
  })

  describe('本地 JWT 模式', () => {
    it('有效 Bearer token 应解析并放行', async () => {
      const app = createTestApp(authMiddleware)
      mockJwtVerify.mockResolvedValue({
        userId: 'user-123',
        username: 'bob',
        role: 'developer',
      })

      const res = await request(app)
        .get('/api/protected')
        .set('Authorization', 'Bearer valid-token-abc')

      expect(res.status).toBe(200)
      expect(mockJwtVerify).toHaveBeenCalledWith('valid-token-abc')
    })

    it('无效 token 应返回 401', async () => {
      const app = createTestApp(authMiddleware)
      mockJwtVerify.mockResolvedValue(null)

      const res = await request(app)
        .get('/api/protected')
        .set('Authorization', 'Bearer invalid-token')

      expect(res.status).toBe(401)
      expect(res.body.error).toBe('Unauthorized')
    })

    it('Authorization 格式不是 Bearer 应返回 401', async () => {
      const app = createTestApp(authMiddleware)
      mockJwtVerify.mockResolvedValue(null)

      const res = await request(app)
        .get('/api/protected')
        .set('Authorization', 'Basic dXNlcjpwYXNz')

      expect(res.status).toBe(401)
      // Basic token replace('Bearer ', '') 后仍传入 jwt.verify，verify 返回 null
      expect(mockJwtVerify).toHaveBeenCalledWith('Basic dXNlcjpwYXNz')
    })

    it('应从 cookie 中读取 token', async () => {
      const app = createTestApp(authMiddleware)
      mockJwtVerify.mockResolvedValue({
        userId: 'user-456',
        username: 'charlie',
        role: 'user',
      })

      const res = await request(app)
        .get('/api/protected')
        .set('Cookie', ['token=cookie-token-xyz'])

      expect(res.status).toBe(200)
      expect(mockJwtVerify).toHaveBeenCalledWith('cookie-token-xyz')
    })
  })

  describe('无认证信息', () => {
    it('无 token 且无 gateway header 应返回 401', async () => {
      const app = createTestApp(authMiddleware)

      const res = await request(app).get('/api/protected')

      expect(res.status).toBe(401)
      expect(res.body.error).toBe('Unauthorized')
    })
  })

  describe('optionalAuthMiddleware', () => {
    it('Gateway 模式下应解析用户但始终放行', async () => {
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

    it('JWT 模式下应解析用户并放行', async () => {
      const app = createTestApp(optionalAuthMiddleware)
      mockJwtVerify.mockResolvedValue({
        userId: 'user-789',
        username: 'eve',
        role: 'user',
      })

      const res = await request(app)
        .get('/api/protected')
        .set('Authorization', 'Bearer optional-token')

      expect(res.status).toBe(200)
    })

    it('无认证信息也应放行', async () => {
      const app = createTestApp(optionalAuthMiddleware)

      const res = await request(app).get('/api/protected')

      expect(res.status).toBe(200)
      expect(mockResolveLocalUser).not.toHaveBeenCalled()
      expect(mockJwtVerify).not.toHaveBeenCalled()
    })
  })
})

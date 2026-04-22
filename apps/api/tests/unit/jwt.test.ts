import { describe, it, expect } from 'vitest'
import { jwt, generateToken } from '../../src/utils/jwt.js'

describe('JWT Utils', () => {
  describe('jwt.sign', () => {
    it('应该生成有效的 JWT token', async () => {
      const payload = {
        userId: 'user-123',
        username: 'testuser',
        role: 'user',
      }

      const token = await jwt.sign(payload)

      expect(token).toBeDefined()
      expect(typeof token).toBe('string')
      expect(token.split('.')).toHaveLength(3)
    })
  })

  describe('jwt.verify', () => {
    it('应该验证有效的 token', async () => {
      const payload = {
        userId: 'user-123',
        username: 'testuser',
        role: 'user',
      }

      const token = await jwt.sign(payload)
      const decoded = await jwt.verify(token)

      expect(decoded).toBeDefined()
      expect(decoded?.userId).toBe(payload.userId)
      expect(decoded?.username).toBe(payload.username)
      expect(decoded?.role).toBe(payload.role)
    })

    it('应该返回 null 对于无效的 token', async () => {
      const result = await jwt.verify('invalid-token')
      expect(result).toBeNull()
    })

    it('应该返回 null 对于篡改的 token', async () => {
      const payload = {
        userId: 'user-123',
        username: 'testuser',
        role: 'user',
      }

      const token = await jwt.sign(payload)
      const tamperedToken = token.slice(0, -5) + 'xxxxx'

      const result = await jwt.verify(tamperedToken)
      expect(result).toBeNull()
    })

    it('应该返回 null 对于过期的 token', async () => {
      // 使用已知的过期 token（构造一个过期签名）
      const { SignJWT } = await import('jose')
      const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'agenthive-secret-key-change-in-production')
      const expiredToken = await new SignJWT({ userId: 'user-123', username: 'testuser', role: 'user' })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(0) // 已经过期
        .sign(secret)

      const result = await jwt.verify(expiredToken)
      expect(result).toBeNull()
    })
  })

  describe('jwt.decode', () => {
    it('应该解码 token payload（不验证签名）', async () => {
      const payload = {
        userId: 'user-123',
        username: 'testuser',
        role: 'user',
      }

      const token = await jwt.sign(payload)
      const decoded = jwt.decode(token)

      expect(decoded).toBeDefined()
      expect(decoded?.userId).toBe(payload.userId)
      expect(decoded?.username).toBe(payload.username)
    })

    it('应该返回 null 对于无效的 token', () => {
      const result = jwt.decode('invalid')
      expect(result).toBeNull()
    })
  })

  describe('generateToken', () => {
    it('应该生成随机 token', () => {
      const token1 = generateToken()
      const token2 = generateToken()

      expect(token1).toBeDefined()
      expect(token2).toBeDefined()
      expect(token1).not.toBe(token2)
      expect(token1.length).toBe(64) // 32 bytes hex = 64 chars
    })
  })

  describe('测试环境 JWT_SECRET', () => {
    it('测试环境应该使用与生产默认值不同的密钥', () => {
      const testSecret = process.env.JWT_SECRET
      const defaultSecret = 'agenthive-secret-key-change-in-production'

      // 测试环境必须显式设置了 JWT_SECRET
      expect(testSecret).toBeDefined()
      expect(testSecret).not.toBe('')
      // 且不能与生产默认值相同
      expect(testSecret).not.toBe(defaultSecret)
    })
  })
})

import { describe, it, expect } from 'vitest'
import { jwt, generateToken } from '../../src/utils/jwt.js'

describe('JWT Utils', () => {
  describe('jwt.sign', () => {
    it('应该生成有效的 JWT token', () => {
      const payload = {
        userId: 'user-123',
        username: 'testuser',
        role: 'user',
      }

      const token = jwt.sign(payload)

      expect(token).toBeDefined()
      expect(token.split('.')).toHaveLength(3)
    })
  })

  describe('jwt.verify', () => {
    it('应该验证有效的 token', () => {
      const payload = {
        userId: 'user-123',
        username: 'testuser',
        role: 'user',
      }

      const token = jwt.sign(payload)
      const decoded = jwt.verify(token)

      expect(decoded).toBeDefined()
      expect(decoded?.userId).toBe(payload.userId)
      expect(decoded?.username).toBe(payload.username)
      expect(decoded?.role).toBe(payload.role)
    })

    it('应该返回 null 对于无效的 token', () => {
      const result = jwt.verify('invalid-token')
      expect(result).toBeNull()
    })

    it('应该返回 null 对于篡改的 token', () => {
      const payload = {
        userId: 'user-123',
        username: 'testuser',
        role: 'user',
      }

      const token = jwt.sign(payload)
      const tamperedToken = token.slice(0, -5) + 'xxxxx'

      const result = jwt.verify(tamperedToken)
      expect(result).toBeNull()
    })
  })

  describe('jwt.decode', () => {
    it('应该解码 token payload', () => {
      const payload = {
        userId: 'user-123',
        username: 'testuser',
        role: 'user',
      }

      const token = jwt.sign(payload)
      const decoded = jwt.decode(token)

      expect(decoded).toBeDefined()
      expect(decoded?.userId).toBe(payload.userId)
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
})

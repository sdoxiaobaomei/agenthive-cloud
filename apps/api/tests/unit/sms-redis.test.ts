// Redis 版短信服务测试
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock must be at top level and use factory function
vi.mock('../../src/services/redis-cache.js', () => {
  const mockRedisCache = {
    setSmsCode: vi.fn(),
    getSmsCode: vi.fn(),
    delSmsCode: vi.fn(),
    incrementSmsAttempts: vi.fn(),
  }
  return {
    redisCache: mockRedisCache,
    __mockRedisCache: mockRedisCache,
  }
})

// Import after mock
import { smsServiceRedis } from '../../src/services/sms-redis.js'
import { redisCache } from '../../src/services/redis-cache.js'

const mockCache = redisCache as any

// 等待函数
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

describe('SMS Service (Redis)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('sendCode', () => {
    it('应该成功发送验证码', async () => {
      mockCache.setSmsCode.mockResolvedValue(undefined)
      
      const result = await smsServiceRedis.sendCode('13800138000')
      
      expect(result.success).toBe(true)
      expect(result.message).toBe('验证码发送成功')
      expect(result.requestId).toBeDefined()
      expect(result.devCode).toBeDefined()
      expect(result.devCode).toHaveLength(6)
      expect(mockCache.setSmsCode).toHaveBeenCalled()
    })

    it('应该限制发送频率', async () => {
      // 第一次发送
      mockCache.setSmsCode.mockResolvedValue(undefined)
      await smsServiceRedis.sendCode('13800138001')
      
      // 第二次立即发送应该被限制
      const result = await smsServiceRedis.sendCode('13800138001')
      
      expect(result.success).toBe(false)
      expect(result.message).toContain('发送过于频繁')
    })

    it('应该生成 6 位验证码', async () => {
      mockCache.setSmsCode.mockResolvedValue(undefined)
      
      const result = await smsServiceRedis.sendCode('13800138002')
      
      expect(result.devCode).toHaveLength(6)
      expect(result.devCode).toMatch(/^\d{6}$/)
    })
  })

  describe('verifyCode', () => {
    it('应该验证正确的验证码', async () => {
      mockCache.getSmsCode.mockResolvedValue({
        code: '123456',
        attempts: 0,
        createdAt: Date.now(),
      })
      mockCache.delSmsCode.mockResolvedValue(undefined)
      
      const result = await smsServiceRedis.verifyCode('13800138000', '123456')
      
      expect(result.success).toBe(true)
      expect(result.message).toBe('验证成功')
      expect(mockCache.delSmsCode).toHaveBeenCalledWith('13800138000')
    })

    it('应该拒绝错误的验证码', async () => {
      mockCache.getSmsCode.mockResolvedValue({
        code: '123456',
        attempts: 0,
        createdAt: Date.now(),
      })
      mockCache.incrementSmsAttempts.mockResolvedValue(1)
      
      const result = await smsServiceRedis.verifyCode('13800138000', '000000')
      
      expect(result.success).toBe(false)
      expect(result.message).toContain('验证码错误')
    })

    it('应该处理不存在的验证码', async () => {
      mockCache.getSmsCode.mockResolvedValue(null)
      
      const result = await smsServiceRedis.verifyCode('13800999999', '123456')
      
      expect(result.success).toBe(false)
      expect(result.message).toContain('验证码不存在')
    })

    it('应该限制尝试次数', async () => {
      mockCache.getSmsCode.mockResolvedValue({
        code: '123456',
        attempts: 3,
        createdAt: Date.now(),
      })
      mockCache.delSmsCode.mockResolvedValue(undefined)
      
      const result = await smsServiceRedis.verifyCode('13800138000', '000000')
      
      expect(result.success).toBe(false)
      expect(result.message).toContain('验证次数过多')
    })
  })

  describe('sendNotification', () => {
    it('应该发送通知短信', async () => {
      const result = await smsServiceRedis.sendNotification(
        '13800138000',
        'SMS_TEMPLATE',
        { name: 'Test' }
      )
      
      expect(result.success).toBe(true)
      expect(result.message).toBe('短信发送成功')
      expect(result.requestId).toBeDefined()
    })
  })

  describe('getCodeStatus', () => {
    it('应该返回验证码状态', async () => {
      mockCache.getSmsCode.mockResolvedValue({
        code: '123456',
        attempts: 1,
        createdAt: Date.now(),
      })
      
      const result = await smsServiceRedis.getCodeStatus('13800138000')
      
      expect(result).not.toBeNull()
      expect(result?.exists).toBe(true)
      expect(result?.expired).toBe(false)
      expect(result?.attempts).toBe(1)
    })

    it('应该返回 null 当验证码不存在', async () => {
      mockCache.getSmsCode.mockResolvedValue(null)
      
      const result = await smsServiceRedis.getCodeStatus('13800138000')
      
      expect(result).toBeNull()
    })
  })
})

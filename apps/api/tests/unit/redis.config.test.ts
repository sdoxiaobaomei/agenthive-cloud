// Redis 配置测试
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock ioredis
const mockRedis = {
  ping: vi.fn(),
  quit: vi.fn(),
  on: vi.fn(),
}

vi.mock('ioredis', () => ({
  Redis: vi.fn(() => mockRedis),
}))

describe('Redis Config', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.REDIS_HOST = 'localhost'
    process.env.REDIS_PORT = '6379'
    process.env.REDIS_PASSWORD = ''
    process.env.REDIS_DB = '0'
  })

  afterEach(() => {
    vi.resetModules()
  })

  describe('Redis Connection', () => {
    it('应该使用默认配置创建 Redis 实例', async () => {
      const { redis } = await import('../../src/config/redis.js')
      
      const Redis = (await import('ioredis')).Redis
      expect(Redis).toHaveBeenCalledWith({
        host: 'localhost',
        port: 6379,
        password: undefined,
        db: 0,
        retryStrategy: expect.any(Function),
        maxRetriesPerRequest: 3,
      })
    })

    it('应该使用环境变量配置', async () => {
      process.env.REDIS_HOST = 'redis.example.com'
      process.env.REDIS_PORT = '6380'
      process.env.REDIS_PASSWORD = 'secret'
      process.env.REDIS_DB = '1'
      
      vi.resetModules()
      const { redis } = await import('../../src/config/redis.js')
      
      const Redis = (await import('ioredis')).Redis
      expect(Redis).toHaveBeenCalledWith(expect.objectContaining({
        host: 'redis.example.com',
        port: 6380,
        password: 'secret',
        db: 1,
      }))
    })
  })

  describe('testRedisConnection', () => {
    it('应该成功连接 Redis', async () => {
      mockRedis.ping.mockResolvedValue('PONG')
      
      const { testRedisConnection } = await import('../../src/config/redis.js')
      const result = await testRedisConnection()
      
      expect(result).toBe(true)
      expect(mockRedis.ping).toHaveBeenCalled()
    })

    it('应该处理连接失败', async () => {
      mockRedis.ping.mockRejectedValue(new Error('Connection refused'))
      
      const { testRedisConnection } = await import('../../src/config/redis.js')
      const result = await testRedisConnection()
      
      expect(result).toBe(false)
    })
  })

  describe('closeRedis', () => {
    it('应该关闭所有 Redis 连接', async () => {
      mockRedis.quit.mockResolvedValue(undefined)
      
      const { closeRedis } = await import('../../src/config/redis.js')
      await closeRedis()
      
      expect(mockRedis.quit).toHaveBeenCalledTimes(3) // redis, redisPub, redisSub
    })
  })

  describe('key generator', () => {
    it('应该生成带前缀的键', async () => {
      const { key } = await import('../../src/config/redis.js')
      
      const result = key('sms', '13800138000')
      expect(result).toBe('agenthive:sms:13800138000')
    })
  })
})

// Redis 缓存服务测试
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock must be at top level and use factory function - everything inside
vi.mock('../../src/config/redis.js', () => {
  // Create mock client inside factory
  const mockClient = {
    get: vi.fn(),
    setex: vi.fn(),
    del: vi.fn(),
    exists: vi.fn(),
    expire: vi.fn(),
    ttl: vi.fn(),
    keys: vi.fn(),
    lpush: vi.fn(),
    ltrim: vi.fn(),
    lrange: vi.fn(),
    incr: vi.fn(),
    expireat: vi.fn(),
    pipeline: vi.fn(),
    publish: vi.fn(),
    subscribe: vi.fn(),
    flushdb: vi.fn(),
    on: vi.fn(),
    quit: vi.fn(),
    ping: vi.fn(),
  }

  // Mock pipeline
  const mockPipeline = {
    incr: vi.fn().mockReturnThis(),
    expireat: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue([[null, 1], [null, 1]]),
  }

  mockClient.pipeline.mockReturnValue(mockPipeline)

  return {
    redis: mockClient,
    redisPub: mockClient,
    redisSub: mockClient,
    key: (namespace: string, id: string) => `agenthive:${namespace}:${id}`,
    KEY_PREFIX: 'agenthive:',
    default: mockClient,
  }
})

// Import after mock - need to access the mocked module
import * as redisModule from '../../src/config/redis.js'
import { redisCache } from '../../src/services/redis-cache.js'

const mockRedis = redisModule.redis as any

describe('Redis Cache Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('通用缓存', () => {
    it('应该设置缓存', async () => {
      mockRedis.setex.mockResolvedValue('OK')
      
      await redisCache.set('test', 'key', { data: 'value' }, 300)
      
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'agenthive:test:key',
        300,
        JSON.stringify({ data: 'value' })
      )
    })

    it('应该获取缓存', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({ data: 'value' }))
      
      const result = await redisCache.get('test', 'key')
      
      expect(result).toEqual({ data: 'value' })
      expect(mockRedis.get).toHaveBeenCalledWith('agenthive:test:key')
    })

    it('应该返回 null 当缓存不存在', async () => {
      mockRedis.get.mockResolvedValue(null)
      
      const result = await redisCache.get('test', 'key')
      
      expect(result).toBeNull()
    })

    it('应该删除缓存', async () => {
      mockRedis.del.mockResolvedValue(1)
      
      await redisCache.del('test', 'key')
      
      expect(mockRedis.del).toHaveBeenCalledWith('agenthive:test:key')
    })

    it('应该检查键是否存在', async () => {
      mockRedis.exists.mockResolvedValue(1)
      
      const result = await redisCache.exists('test', 'key')
      
      expect(result).toBe(true)
    })

    it('应该设置过期时间', async () => {
      mockRedis.expire.mockResolvedValue(1)
      
      await redisCache.expire('test', 'key', 600)
      
      expect(mockRedis.expire).toHaveBeenCalledWith('agenthive:test:key', 600)
    })
  })

  describe('会话缓存', () => {
    it('应该保存会话', async () => {
      mockRedis.setex.mockResolvedValue('OK')
      
      await redisCache.setSession('token123', 'user456', { name: 'Test' })
      
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'agenthive:session:token123',
        86400,
        expect.stringContaining('user456')
      )
    })

    it('应该获取会话并刷新 TTL', async () => {
      const sessionData = JSON.stringify({ userId: 'user456', userData: { name: 'Test' }, createdAt: Date.now() })
      mockRedis.get.mockResolvedValue(sessionData)
      mockRedis.expire.mockResolvedValue(1)
      
      const result = await redisCache.getSession('token123')
      
      expect(result?.userId).toBe('user456')
      expect(mockRedis.expire).toHaveBeenCalled()
    })
  })

  describe('Agent 状态缓存', () => {
    it('应该设置 Agent 状态', async () => {
      mockRedis.setex.mockResolvedValue('OK')
      
      await redisCache.setAgentStatus('agent-123', 'working', { progress: 50 })
      
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'agenthive:agent:status:agent-123',
        60,
        expect.stringContaining('working')
      )
    })

    it('应该获取 Agent 状态', async () => {
      const statusData = JSON.stringify({ status: 'working', metadata: {}, updatedAt: Date.now() })
      mockRedis.get.mockResolvedValue(statusData)
      
      const result = await redisCache.getAgentStatus('agent-123')
      
      expect(result?.status).toBe('working')
    })

    it('应该获取所有在线 Agent', async () => {
      mockRedis.keys.mockResolvedValue([
        'agenthive:agent:status:agent-1',
        'agenthive:agent:status:agent-2',
      ])
      
      const result = await redisCache.getOnlineAgents()
      
      expect(result).toEqual(['agent-1', 'agent-2'])
    })

    it('应该检查 Agent 是否在线', async () => {
      mockRedis.exists.mockResolvedValue(1)
      
      const result = await redisCache.isAgentOnline('agent-123')
      
      expect(result).toBe(true)
    })
  })

  describe('任务进度缓存', () => {
    it('应该设置任务进度', async () => {
      mockRedis.setex.mockResolvedValue('OK')
      
      await redisCache.setTaskProgress('task-123', 75)
      
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'agenthive:task:progress:task-123',
        300,
        expect.stringContaining('75')
      )
    })

    it('应该获取任务进度', async () => {
      const progressData = JSON.stringify({ progress: 75, updatedAt: Date.now() })
      mockRedis.get.mockResolvedValue(progressData)
      
      const result = await redisCache.getTaskProgress('task-123')
      
      expect(result?.progress).toBe(75)
    })
  })

  describe('日志缓存', () => {
    it('应该添加日志', async () => {
      mockRedis.lpush.mockResolvedValue(1)
      mockRedis.ltrim.mockResolvedValue('OK')
      mockRedis.expire.mockResolvedValue(1)
      
      await redisCache.addLog('agent-123', 'Log message', 100)
      
      expect(mockRedis.lpush).toHaveBeenCalledWith('agenthive:agent:logs:agent-123', 'Log message')
      expect(mockRedis.ltrim).toHaveBeenCalledWith('agenthive:agent:logs:agent-123', 0, 99)
    })

    it('应该获取日志列表', async () => {
      mockRedis.lrange.mockResolvedValue(['log3', 'log2', 'log1'])
      
      const result = await redisCache.getLogs('agent-123', 10)
      
      expect(result).toEqual(['log3', 'log2', 'log1'])
    })
  })

  describe('速率限制', () => {
    it('应该允许请求在限制内', async () => {
      mockRedis.get.mockResolvedValue(null)
      
      const result = await redisCache.checkRateLimit('ip:127.0.0.1', 10, 60)
      
      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(9)
    })

    it('应该拒绝超出限制的请求', async () => {
      mockRedis.get.mockResolvedValue('10')
      mockRedis.ttl.mockResolvedValue(30)
      
      const result = await redisCache.checkRateLimit('ip:127.0.0.1', 10, 60)
      
      expect(result.allowed).toBe(false)
      expect(result.remaining).toBe(0)
    })
  })

  describe('发布/订阅', () => {
    it('应该发布消息', async () => {
      mockRedis.publish.mockResolvedValue(1)
      
      await redisCache.publish('channel', { data: 'test' })
      
      expect(mockRedis.publish).toHaveBeenCalledWith('channel', JSON.stringify({ data: 'test' }))
    })
  })

  describe('清理', () => {
    it('应该清空所有缓存', async () => {
      mockRedis.flushdb.mockResolvedValue('OK')
      
      await redisCache.flushAll()
      
      expect(mockRedis.flushdb).toHaveBeenCalled()
    })

    it('应该按模式删除键', async () => {
      mockRedis.keys.mockResolvedValue(['agenthive:test:1', 'agenthive:test:2'])
      mockRedis.del.mockResolvedValue(2)
      
      await redisCache.deletePattern('test')
      
      expect(mockRedis.del).toHaveBeenCalledWith('agenthive:test:1', 'agenthive:test:2')
    })
  })
})

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../../src/config/redis.js', () => ({
  redis: {
    pipeline: vi.fn().mockReturnValue({
      incr: vi.fn().mockReturnThis(),
      expire: vi.fn().mockReturnThis(),
      sadd: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([]),
    }),
    get: vi.fn().mockResolvedValue(null),
    smembers: vi.fn().mockResolvedValue([]),
    keys: vi.fn().mockResolvedValue([]),
    del: vi.fn().mockResolvedValue(0),
  },
  key: (ns: string, id: string) => `agenthive:${ns}:${id}`,
}))

vi.mock('../../src/utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}))

vi.mock('../../src/project/hosting-service.js', () => ({
  notifyJavaTraffic: vi.fn().mockResolvedValue(true),
  fetchTrafficTrendFromJava: vi.fn().mockResolvedValue(null),
  fetchRealtimeTrafficFromJava: vi.fn().mockResolvedValue(null),
  MOCK_JAVA_API: false,
}))

import { redis } from '../../src/config/redis.js'
import {
  recordPageView,
  getRealtimeTraffic,
  getTrafficTrend,
  getRealtimeTrafficWithFallback,
  runBatchReport,
  startBatchReporter,
  stopBatchReporter,
} from '../../src/project/traffic-service.js'

describe('Traffic Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    stopBatchReporter()
  })

  afterEach(() => {
    stopBatchReporter()
  })

  describe('recordPageView', () => {
    it('应通过 pipeline 增加 PV 和 UV', async () => {
      const mockPipeline = {
        incr: vi.fn().mockReturnThis(),
        expire: vi.fn().mockReturnThis(),
        sadd: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([]),
      }
      vi.mocked(redis.pipeline).mockReturnValue(mockPipeline as any)

      await recordPageView('proj-1', '192.168.1.1', 'Mozilla/5.0')

      expect(mockPipeline.incr).toHaveBeenCalledWith(expect.stringContaining('traffic:pv:proj-1:'))
      expect(mockPipeline.sadd).toHaveBeenCalledWith(expect.stringContaining('traffic:uv:proj-1:'), expect.any(String))
      expect(mockPipeline.exec).toHaveBeenCalled()
    })

    it('Redis 失败时不应抛异常', async () => {
      vi.mocked(redis.pipeline).mockReturnValueOnce({
        incr: vi.fn().mockReturnThis(),
        expire: vi.fn().mockReturnThis(),
        sadd: vi.fn().mockReturnThis(),
        exec: vi.fn().mockRejectedValue(new Error('Redis down')),
      } as any)

      await expect(recordPageView('proj-1', '192.168.1.1', 'Mozilla/5.0')).resolves.not.toThrow()
    })
  })

  describe('getRealtimeTraffic', () => {
    it('应从 Redis 读取 PV 和 UV', async () => {
      vi.mocked(redis.get).mockResolvedValue('42')
      vi.mocked(redis.smembers).mockResolvedValue(['fp1', 'fp2', 'fp3'])

      const result = await getRealtimeTraffic('proj-1')

      expect(result.pv).toBe(42)
      expect(result.uv).toBe(3)
    })

    it('Redis 为空时应返回 0', async () => {
      vi.mocked(redis.get).mockResolvedValue(null)
      vi.mocked(redis.smembers).mockResolvedValue([])

      const result = await getRealtimeTraffic('proj-1')

      expect(result.pv).toBe(0)
      expect(result.uv).toBe(0)
    })
  })

  describe('getTrafficTrend', () => {
    it('Java API 不可用时回退到 Redis / mock', async () => {
      const trend = await getTrafficTrend('proj-1', 7)

      expect(trend).toHaveLength(7)
      expect(trend[0]).toHaveProperty('date')
      expect(trend[0]).toHaveProperty('pv')
      expect(trend[0]).toHaveProperty('uv')
    })
  })

  describe('getRealtimeTrafficWithFallback', () => {
    it('Java API 返回数据时应优先使用', async () => {
      const { fetchRealtimeTrafficFromJava } = await import('../../src/project/hosting-service.js')
      vi.mocked(fetchRealtimeTrafficFromJava).mockResolvedValueOnce({ pv: 100, uv: 50 })

      const result = await getRealtimeTrafficWithFallback('proj-1')

      expect(result.pv).toBe(100)
      expect(result.uv).toBe(50)
    })
  })

  describe('runBatchReport', () => {
    it('无数据时不应调用 Java API', async () => {
      vi.mocked(redis.keys).mockResolvedValue([])

      await runBatchReport()

      const { notifyJavaTraffic } = await import('../../src/project/hosting-service.js')
      expect(notifyJavaTraffic).not.toHaveBeenCalled()
    })

    it('应聚合并上报数据', async () => {
      const today = new Date().toISOString().slice(0, 10)
      const hourBucket = new Date().toISOString().slice(0, 13)

      vi.mocked(redis.keys).mockImplementation(async (pattern: string) => {
        if (pattern.includes('pv')) return [`agenthive:traffic:pv:proj-1:${today}`]
        if (pattern.includes('uv')) return [`agenthive:traffic:uv:proj-1:${hourBucket}`]
        return []
      })
      vi.mocked(redis.get).mockResolvedValue('99')
      vi.mocked(redis.smembers).mockResolvedValue(['fp1', 'fp2'])

      const { notifyJavaTraffic } = await import('../../src/project/hosting-service.js')
      vi.mocked(notifyJavaTraffic).mockResolvedValueOnce(true)

      await runBatchReport()

      expect(notifyJavaTraffic).toHaveBeenCalledWith(
        'proj-1',
        expect.objectContaining({ pvCount: 99, uvCount: 2 })
      )
    })
  })

  describe('startBatchReporter / stopBatchReporter', () => {
    it('应启动和停止定时器', () => {
      startBatchReporter()
      // 重复调用不应创建多个定时器
      startBatchReporter()

      stopBatchReporter()
      // 重复停止不应抛异常
      stopBatchReporter()
    })
  })
})

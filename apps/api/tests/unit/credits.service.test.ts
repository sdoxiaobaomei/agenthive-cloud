// credits.service unit tests
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.stubEnv('CREDITS_MOCK_MODE', 'true')

vi.mock('../../src/utils/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

vi.mock('../../src/config/redis', () => ({
  redis: {
    get: vi.fn(),
    set: vi.fn(),
    incr: vi.fn(),
    decr: vi.fn(),
    expire: vi.fn(),
    keys: vi.fn().mockResolvedValue([]),
    del: vi.fn(),
  },
}))

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import {
  estimateCost,
  getPricingList,
  checkBalance,
  debitCredits,
  getUserBalance,
  getUserTransactions,
} from '../../src/services/credits'

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('CREDITS_MOCK_MODE', 'true')
})

// estimateCost: baseCost + tokens * 2/1000, ceiling
describe('estimateCost', () => {
  it('returns base cost for known role with zero tokens', () => {
    expect(estimateCost('backend', 0)).toBe(15)
    expect(estimateCost('qa', 0)).toBe(10)
  })

  it('returns default base for unknown role', () => {
    expect(estimateCost('unknown_role', 0)).toBe(10)
  })

  it('scales linearly with token count (ceil)', () => {
    expect(estimateCost('backend', 1000)).toBe(17)
    expect(estimateCost('backend', 2000)).toBe(19)
    expect(estimateCost('backend', 2000) - estimateCost('backend', 1000)).toBe(2)
  })
})

describe('getPricingList', () => {
  it('returns an array with entries for each known role', () => {
    const list = getPricingList()
    expect(Array.isArray(list)).toBe(true)
    expect(list.length).toBeGreaterThanOrEqual(4)
  })

  it('each item has workerRole, baseCost, tokenPricePer1k fields', () => {
    for (const item of getPricingList()) {
      expect(item).toHaveProperty('workerRole')
      expect(item).toHaveProperty('baseCost')
      expect(item).toHaveProperty('tokenPricePer1k')
      expect(typeof item.baseCost).toBe('number')
      expect(typeof item.tokenPricePer1k).toBe('number')
    }
  })

  it('includes backend role with baseCost 15', () => {
    const item = getPricingList().find(i => i.workerRole === 'backend')
    expect(item?.baseCost).toBe(15)
    expect(item?.tokenPricePer1k).toBe(2)
  })
})

// checkBalance: MOCK_MODE 始终生效（模块级常量，import 后不可更改）
describe('checkBalance', () => {
  it('returns mock result with sufficient=true when balance >= cost', async () => {
    const result = await checkBalance('user-1', 'backend', 0)
    expect(result.sufficient).toBe(true)
    expect(result.balance).toBe(1000)
    expect(result.estimatedCost).toBe(15)
  })

  it('returns insufficient when cost exceeds mock balance', async () => {
    // mockBalance = 1000, backend baseCost = 15, TOKEN_PRICE_PER_1K = 2
    // 需要 estimatedCost > 1000: ceil(15 + N*2/1000) > 1000 → N > 498500
    const result = await checkBalance('user-1', 'backend', 500000)
    expect(result.sufficient).toBe(false)
    expect(result.balance).toBe(1000)
  })
})

// debitCredits: MOCK_MODE 始终生效
describe('debitCredits', () => {
  it('returns success in MOCK_MODE without calling fetch', async () => {
    const result = await debitCredits({ userId: 'user-1', taskId: 'task-1', workerRole: 'backend', tokensUsed: 0 })
    expect(result.success).toBe(true)
    expect(result.creditsDeducted).toBe(15)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('calculates correct cost including tokens in MOCK_MODE', async () => {
    const result = await debitCredits({ userId: 'user-1', taskId: 'task-1', workerRole: 'backend', tokensUsed: 1000 })
    expect(result.success).toBe(true)
    expect(result.creditsDeducted).toBe(17)
  })
})

// 以下测试验证 Java API 集成路径，需要 MOCK_MODE=false
// 由于 MOCK_MODE 是模块级常量，这些测试需要单独的测试文件或动态 import
// 暂时跳过，待重构 credits.ts 使 MOCK_MODE 可动态切换后启用
describe.skip('debitCredits — Java API 集成（需动态 MOCK_MODE）', () => {
  it('calls Java API when MOCK_MODE=false', async () => {
    // 需要 credits.ts 改为动态读取 process.env.CREDITS_MOCK_MODE
  })

  it('returns MOCK_FALLBACK when Java API fails', async () => {
    // 代码行为：Java API 失败 → callAgentDebit 返回 BILLING_API_ERROR
    // → debitCredits 检测到后降级为 { success: true, errorCode: 'MOCK_FALLBACK' }
  })

  it('passes sessionId and tokensUsed to Java API', async () => {
    // 验证请求体格式
  })
})

describe('getUserBalance', () => {
  it('returns mock balance object in MOCK_MODE', async () => {
    const result = await getUserBalance('user-1')
    expect(result.balance).toBe(1000)
    expect(result.currency).toBe('CREDITS')
  })
})

describe('getUserTransactions', () => {
  it('returns empty array (mock implementation)', async () => {
    const txns = await getUserTransactions('user-1')
    expect(Array.isArray(txns)).toBe(true)
    expect(txns.length).toBe(0)
  })
})

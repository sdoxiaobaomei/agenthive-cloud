import { describe, it, expect, beforeEach } from 'vitest'
import { _useMockCreditsImpl as useMockCredits, useMockCreator } from '../useMockApi'

describe('useMockCredits', () => {
  beforeEach(() => {
    // Composables are stateless per-call, no pinia needed
  })

  it('returns mock account with expected balance', () => {
    const { account } = useMockCredits()
    expect(account.value).toBeDefined()
    expect(account.value.balance).toBe(1234.5678)
    expect(account.value.status).toBe('active')
  })

  it('returns at least 10 transactions', () => {
    const { transactions } = useMockCredits()
    expect(transactions.value.length).toBeGreaterThanOrEqual(10)
  })

  it('transactions include various types', () => {
    const { transactions } = useMockCredits()
    const types = new Set(transactions.value.map(t => t.type))
    expect(types.has('income')).toBe(true)
    expect(types.has('expense')).toBe(true)
    expect(types.has('fee')).toBe(true)
  })

  it('returns 30-day earnings distribution', () => {
    const { earnings } = useMockCredits()
    expect(earnings.value).toHaveLength(30)
    expect(earnings.value[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(typeof earnings.value[0].amount).toBe('number')
  })

  it('totalIncome sums income transactions', () => {
    const { transactions, totalIncome } = useMockCredits()
    const expected = transactions.value
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0)
    expect(totalIncome.value).toBe(expected)
  })

  it('totalExpense sums absolute expense amounts', () => {
    const { transactions, totalExpense } = useMockCredits()
    const expected = transactions.value
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + Math.abs(t.amount), 0)
    expect(totalExpense.value).toBe(expected)
  })

  it('refresh updates account timestamp', async () => {
    const { account, refresh } = useMockCredits()
    const before = account.value.updatedAt
    await refresh()
    expect(account.value.updatedAt).not.toBe(before)
  })

  it('sets loading during refresh', async () => {
    const { loading, refresh } = useMockCredits()
    const promise = refresh()
    expect(loading.value).toBe(true)
    await promise
    expect(loading.value).toBe(false)
  })
})

describe('useMockCreator', () => {
  it('returns at least 5 products', () => {
    const { products } = useMockCreator()
    expect(products.value.length).toBeGreaterThanOrEqual(5)
  })

  it('returns at least 20 sales records', () => {
    const { sales } = useMockCreator()
    expect(sales.value.length).toBeGreaterThanOrEqual(20)
  })

  it('sales include platform fee deduction', () => {
    const { sales } = useMockCreator()
    const firstSale = sales.value[0]
    expect(firstSale.platformFee).toBeGreaterThan(0)
    expect(firstSale.netEarning).toBeLessThan(firstSale.price)
    expect(firstSale.netEarning).toBeCloseTo(firstSale.price - firstSale.platformFee, 2)
  })

  it('stats reflect products count', () => {
    const { products, stats } = useMockCreator()
    expect(stats.value.totalProducts).toBe(products.value.length)
  })

  it('stats totalEarnings is positive', () => {
    const { stats } = useMockCreator()
    expect(stats.value.totalEarnings).toBeGreaterThan(0)
  })

  it('returns 30-day earnings trend', () => {
    const { earnings } = useMockCreator()
    expect(earnings.value).toHaveLength(30)
    expect(earnings.value[0]).toHaveProperty('salesAmount')
    expect(earnings.value[0]).toHaveProperty('platformFee')
  })

  it('refresh completes without error', async () => {
    const { loading, error, refresh } = useMockCreator()
    await refresh()
    expect(loading.value).toBe(false)
    expect(error.value).toBeNull()
  })
})

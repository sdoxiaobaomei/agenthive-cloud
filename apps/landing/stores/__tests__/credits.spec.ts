import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useCreditsStore } from '../credits'

describe('useCreditsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('getters', () => {
    it('returns correct exchange rate', () => {
      const store = useCreditsStore()
      expect(store.exchangeRate).toBe(0.1)
    })

    it('returns correct withdraw fee rate', () => {
      const store = useCreditsStore()
      expect(store.withdrawFeeRate).toBe(0.1)
    })

    it('returns correct minimum withdraw amount', () => {
      const store = useCreditsStore()
      expect(store.minWithdrawAmount).toBe(100)
    })

    it('totalIncome sums all income transactions', () => {
      const store = useCreditsStore()
      const expected = store.transactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0)
      expect(store.totalIncome).toBe(expected)
    })

    it('totalExpense sums absolute values of expense transactions', () => {
      const store = useCreditsStore()
      const expected = store.transactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + Math.abs(t.amount), 0)
      expect(store.totalExpense).toBe(expected)
    })

    it('withdrawableBalance equals current balance', () => {
      const store = useCreditsStore()
      expect(store.withdrawableBalance).toBe(store.balance)
    })

    it('filteredTransactions returns all when filter is "all"', () => {
      const store = useCreditsStore()
      store.setTransactionFilter('all')
      expect(store.filteredTransactions).toHaveLength(store.transactions.length)
    })

    it('filteredTransactions returns only income', () => {
      const store = useCreditsStore()
      store.setTransactionFilter('income')
      expect(store.filteredTransactions.every(t => t.type === 'income')).toBe(true)
    })

    it('filteredTransactions returns only expense', () => {
      const store = useCreditsStore()
      store.setTransactionFilter('expense')
      expect(store.filteredTransactions.every(t => t.type === 'expense')).toBe(true)
    })
  })

  describe('recharge', () => {
    it('increases balance and adds transaction', async () => {
      const store = useCreditsStore()
      const initialBalance = store.balance
      const initialTxCount = store.transactions.length

      await store.recharge(100, 'alipay')

      expect(store.balance).toBe(initialBalance + 100)
      expect(store.transactions).toHaveLength(initialTxCount + 1)
      expect(store.transactions[0].type).toBe('income')
      expect(store.transactions[0].source).toBe('recharge')
      expect(store.transactions[0].amount).toBe(100)
    })

    it('sets loading state during recharge', async () => {
      const store = useCreditsStore()
      const promise = store.recharge(50, 'wechat')
      expect(store.loading).toBe(true)
      await promise
      expect(store.loading).toBe(false)
    })
  })

  describe('withdraw', () => {
    it('decreases balance and adds fee + withdraw transactions', async () => {
      const store = useCreditsStore()
      const initialBalance = store.balance
      const initialTxCount = store.transactions.length
      const initialWdCount = store.withdrawals.length

      await store.withdraw(100, 'alipay', '188****8888')

      expect(store.balance).toBe(initialBalance - 100)
      // Adds 2 transactions: fee + withdraw
      expect(store.transactions).toHaveLength(initialTxCount + 2)
      expect(store.withdrawals).toHaveLength(initialWdCount + 1)
      expect(store.withdrawals[0].status).toBe('pending')
      expect(store.withdrawals[0].fee).toBe(10) // 10% of 100
      expect(store.withdrawals[0].netAmount).toBe(90)
    })

    it('calculates fee correctly for different amounts', async () => {
      const store = useCreditsStore()
      await store.withdraw(500, 'alipay', '188****8888')
      expect(store.withdrawals[0].fee).toBe(50)
      expect(store.withdrawals[0].netAmount).toBe(450)
    })

    it('sets loading state during withdraw', async () => {
      const store = useCreditsStore()
      const promise = store.withdraw(200, 'alipay', '188****8888')
      expect(store.loading).toBe(true)
      await promise
      expect(store.loading).toBe(false)
    })
  })

  describe('clearError', () => {
    it('clears error state', () => {
      const store = useCreditsStore()
      store.error = 'Something went wrong'
      store.clearError()
      expect(store.error).toBeNull()
    })
  })
})

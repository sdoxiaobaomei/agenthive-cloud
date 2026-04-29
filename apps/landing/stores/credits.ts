import { defineStore } from 'pinia'

/** 流水类型 */
export type TransactionType = 'income' | 'expense' | 'fee'

/** 流水记录 */
export interface Transaction {
  id: string
  type: TransactionType
  amount: number
  balance: number
  source: string
  description: string
  createdAt: string
}

/** 提现记录 */
export interface Withdrawal {
  id: string
  amount: number
  fee: number
  netAmount: number
  accountType: 'alipay' | 'wechat' | 'bank'
  accountInfo: string
  status: 'pending' | 'approved' | 'rejected'
  createdAt: string
}

/** Credits 状态 */
interface CreditsState {
  balance: number
  transactions: Transaction[]
  withdrawals: Withdrawal[]
  loading: boolean
  error: string | null
  transactionFilter: 'all' | 'income' | 'expense'
}

const EXCHANGE_RATE = 0.1 // 1 credit = 0.1 CNY
const WITHDRAW_FEE_RATE = 0.1 // 10% fee
const MIN_WITHDRAW = 100 // minimum withdrawal amount

// Mock transactions
const mockTransactions: Transaction[] = [
  { id: 'tx-1', type: 'income', amount: 239.2, balance: 1239.2000, source: 'sale', description: 'Sale: Vue Admin Dashboard', createdAt: '2026-04-27T10:00:00Z' },
  { id: 'tx-2', type: 'income', amount: 239.2, balance: 1000.0000, source: 'sale', description: 'Sale: Vue Admin Dashboard', createdAt: '2026-04-26T14:00:00Z' },
  { id: 'tx-3', type: 'expense', amount: -299, balance: 760.8000, source: 'purchase', description: 'Purchase: React E-commerce Template', createdAt: '2026-04-25T09:00:00Z' },
  { id: 'tx-4', type: 'income', amount: 79.2, balance: 1059.8000, source: 'sale', description: 'Sale: Chat Component Library', createdAt: '2026-04-24T16:00:00Z' },
  { id: 'tx-5', type: 'expense', amount: -99, balance: 980.6000, source: 'purchase', description: 'Purchase: API Dashboard', createdAt: '2026-04-23T11:00:00Z' },
  { id: 'tx-6', type: 'income', amount: 500, balance: 1079.6000, source: 'recharge', description: 'Recharge via Alipay', createdAt: '2026-04-20T08:00:00Z' },
  { id: 'tx-7', type: 'fee', amount: -10, balance: 579.6000, source: 'fee', description: 'Withdrawal fee', createdAt: '2026-04-18T15:00:00Z' },
  { id: 'tx-8', type: 'expense', amount: -500, balance: 589.6000, source: 'withdraw', description: 'Withdrawal to Alipay', createdAt: '2026-04-18T15:00:00Z' },
  { id: 'tx-9', type: 'income', amount: 100, balance: 1089.6000, source: 'recharge', description: 'Recharge via WeChat', createdAt: '2026-04-15T10:00:00Z' },
  { id: 'tx-10', type: 'income', amount: 239.2, balance: 989.6000, source: 'sale', description: 'Sale: Vue Admin Dashboard', createdAt: '2026-04-10T12:00:00Z' },
]

// Mock withdrawals
const mockWithdrawals: Withdrawal[] = [
  { id: 'wd-1', amount: 500, fee: 50, netAmount: 450, accountType: 'alipay', accountInfo: '188****8888', status: 'approved', createdAt: '2026-04-18T15:00:00Z' },
  { id: 'wd-2', amount: 200, fee: 20, netAmount: 180, accountType: 'alipay', accountInfo: '188****8888', status: 'approved', createdAt: '2026-03-15T09:00:00Z' },
]

export const useCreditsStore = defineStore('credits', {
  state: (): CreditsState => ({
    balance: 1089.6000,
    transactions: mockTransactions,
    withdrawals: mockWithdrawals,
    loading: false,
    error: null,
    transactionFilter: 'all',
  }),

  getters: {
    filteredTransactions: (state): Transaction[] => {
      if (state.transactionFilter === 'all') return state.transactions
      return state.transactions.filter(t => t.type === state.transactionFilter)
    },

    totalIncome: (state): number => {
      return state.transactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0)
    },

    totalExpense: (state): number => {
      return state.transactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + Math.abs(t.amount), 0)
    },

    /** 可提现余额 = 当前余额 */
    withdrawableBalance: (state): number => state.balance,

    exchangeRate: (): number => EXCHANGE_RATE,
    withdrawFeeRate: (): number => WITHDRAW_FEE_RATE,
    minWithdrawAmount: (): number => MIN_WITHDRAW,
  },

  actions: {
    setTransactionFilter(filter: 'all' | 'income' | 'expense'): void {
      this.transactionFilter = filter
    },

    async fetchBalance(): Promise<void> {
      try {
        const { credits } = useApi()
        const result = await credits.getBalance()
        if (result.success && result.data) {
          this.balance = result.data.balance
        }
      } catch (err: any) {
        // 失败时保持现有余额
        if (import.meta.dev) {
          console.warn('[CreditsStore] fetchBalance failed:', err.message)
        }
      }
    },

    async fetchTransactions(page?: number, pageSize?: number): Promise<void> {
      this.loading = true
      try {
        const { credits } = useApi()
        const result = await credits.getTransactions(page, pageSize)
        if (result.success && result.data) {
          this.transactions = result.data.items
        }
      } catch (err: any) {
        this.error = err.message || '获取流水失败'
      } finally {
        this.loading = false
      }
    },

    async recharge(amount: number, method: 'alipay' | 'wechat'): Promise<void> {
      this.loading = true
      try {
        await new Promise(resolve => setTimeout(resolve, 2000))
        this.balance += amount
        this.transactions.unshift({
          id: `tx-${Date.now()}`,
          type: 'income',
          amount,
          balance: this.balance,
          source: 'recharge',
          description: `Recharge via ${method === 'alipay' ? 'Alipay' : 'WeChat'}`,
          createdAt: new Date().toISOString(),
        })
      } finally {
        this.loading = false
      }
    },

    async withdraw(amount: number, accountType: 'alipay' | 'wechat' | 'bank', accountInfo: string): Promise<void> {
      this.loading = true
      try {
        await new Promise(resolve => setTimeout(resolve, 1000))
        const fee = amount * WITHDRAW_FEE_RATE
        const netAmount = amount - fee
        this.balance -= amount
        this.transactions.unshift(
          {
            id: `tx-${Date.now()}-fee`,
            type: 'fee',
            amount: -fee,
            balance: this.balance + netAmount,
            source: 'fee',
            description: 'Withdrawal fee',
            createdAt: new Date().toISOString(),
          },
          {
            id: `tx-${Date.now()}`,
            type: 'expense',
            amount: -netAmount,
            balance: this.balance,
            source: 'withdraw',
            description: `Withdrawal to ${accountType}`,
            createdAt: new Date().toISOString(),
          }
        )
        this.withdrawals.unshift({
          id: `wd-${Date.now()}`,
          amount,
          fee,
          netAmount,
          accountType,
          accountInfo,
          status: 'pending',
          createdAt: new Date().toISOString(),
        })
      } finally {
        this.loading = false
      }
    },

    clearError(): void {
      this.error = null
    },
  },
})

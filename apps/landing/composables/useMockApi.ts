/**
 * 经济系统 Mock API 组合式函数
 * Economy System Mock API Composables
 *
 * 设计原则：
 * - interface 与实现分离：返回统一的响应式数据结构
 * - 后端 API 就绪时，只需替换此文件中的实现，无需修改组件
 * - 所有数据为 Mock，不调用真实后端
 * - 模拟网络延迟，便于测试 loading 状态
 */

import { ref, computed, shallowRef } from 'vue'
import type {
  ICreditsAccount,
  ICreditsTransaction,
  ICreditsEarningPoint,
  ICreditsWithdrawal,
  ICreatorProduct,
  ICreatorSale,
  ICreatorEarning,
  ICreatorStats,
} from '~/types/economy'

// ============================================
// Mock 数据生成器
// ============================================

const MOCK_DELAY_MS = 600

/** 模拟异步延迟 */
const mockDelay = (ms: number = MOCK_DELAY_MS): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms))

/** 生成 ISO 日期字符串 */
const formatDate = (date: Date): string => date.toISOString()
const formatDateOnly = (date: Date): string => date.toISOString().split('T')[0]

// --- Credits Mock Data ---

const mockAccount: ICreditsAccount = {
  userId: 'user-mock-001',
  balance: 1234.5678,
  frozenAmount: 100.0000,
  availableBalance: 1134.5678,
  totalRecharged: 2500.0000,
  totalWithdrawn: 800.0000,
  exchangeRate: 0.1,
  currency: 'CNY',
  status: 'active',
  updatedAt: '2026-04-27T12:00:00Z',
}

const mockTransactions: ICreditsTransaction[] = [
  { id: 'tx-001', type: 'income', amount: 239.2000, balance: 1234.5678, source: 'sale', description: 'Sale: Vue Admin Dashboard', orderId: 'ord-001', createdAt: '2026-04-27T10:30:00Z' },
  { id: 'tx-002', type: 'income', amount: 79.2000, balance: 995.3678, source: 'sale', description: 'Sale: Chat Component Library', orderId: 'ord-002', createdAt: '2026-04-26T14:15:00Z' },
  { id: 'tx-003', type: 'expense', amount: -299.0000, balance: 916.1678, source: 'purchase', description: 'Purchase: React E-commerce Template', orderId: 'ord-003', createdAt: '2026-04-25T09:00:00Z' },
  { id: 'tx-004', type: 'income', amount: 500.0000, balance: 1215.1678, source: 'recharge', description: 'Recharge via Alipay', createdAt: '2026-04-24T08:30:00Z' },
  { id: 'tx-005', type: 'expense', amount: -99.0000, balance: 715.1678, source: 'purchase', description: 'Purchase: API Dashboard Pro', orderId: 'ord-004', createdAt: '2026-04-23T11:20:00Z' },
  { id: 'tx-006', type: 'income', amount: 150.0000, balance: 814.1678, source: 'reward', description: 'Daily check-in reward', createdAt: '2026-04-22T00:00:00Z' },
  { id: 'tx-007', type: 'expense', amount: -500.0000, balance: 664.1678, source: 'withdraw', description: 'Withdrawal to Alipay', createdAt: '2026-04-20T15:00:00Z' },
  { id: 'tx-008', type: 'fee', amount: -50.0000, balance: 1164.1678, source: 'fee', description: 'Withdrawal fee (10%)', createdAt: '2026-04-20T15:00:00Z' },
  { id: 'tx-009', type: 'income', amount: 299.0000, balance: 1214.1678, source: 'sale', description: 'Sale: Nuxt 3 Starter Kit', orderId: 'ord-005', createdAt: '2026-04-18T16:45:00Z' },
  { id: 'tx-010', type: 'income', amount: 199.0000, balance: 915.1678, source: 'refund', description: 'Refund: API Dashboard Pro', orderId: 'ord-004', createdAt: '2026-04-17T10:00:00Z' },
  { id: 'tx-011', type: 'expense', amount: -49.9000, balance: 716.1678, source: 'purchase', description: 'Purchase: Icon Set Bundle', orderId: 'ord-006', createdAt: '2026-04-15T13:30:00Z' },
  { id: 'tx-012', type: 'income', amount: 1000.0000, balance: 766.0678, source: 'transfer', description: 'Transfer from Team Account', createdAt: '2026-04-10T09:00:00Z' },
  { id: 'tx-013', type: 'income', amount: 88.5000, balance: 854.5678, source: 'sale', description: 'Sale: Minimalist Portfolio Template', orderId: 'ord-007', createdAt: '2026-04-08T11:00:00Z' },
  { id: 'tx-014', type: 'expense', amount: -199.0000, balance: 655.5678, source: 'purchase', description: 'Purchase: AI Chatbot Integration', orderId: 'ord-008', createdAt: '2026-04-05T14:20:00Z' },
  { id: 'tx-015', type: 'fee', amount: -15.0000, balance: 640.5678, source: 'fee', description: 'Platform service fee', createdAt: '2026-04-01T09:00:00Z' },
  { id: 'tx-016', type: 'income', amount: 250.0000, balance: 890.5678, source: 'recharge', description: 'Recharge via WeChat Pay', createdAt: '2026-03-28T10:00:00Z' },
]

const mockWithdrawals: ICreditsWithdrawal[] = [
  { id: 'wd-001', amount: 500.0000, fee: 50.0000, netAmount: 450.0000, accountType: 'alipay', accountInfo: '188****8888', status: 'approved', createdAt: '2026-04-20T15:00:00Z', processedAt: '2026-04-21T10:00:00Z' },
  { id: 'wd-002', amount: 200.0000, fee: 20.0000, netAmount: 180.0000, accountType: 'wechat', accountInfo: 'wx***zhang', status: 'approved', createdAt: '2026-03-15T09:00:00Z', processedAt: '2026-03-16T10:00:00Z' },
  { id: 'wd-003', amount: 1000.0000, fee: 100.0000, netAmount: 900.0000, accountType: 'bank', accountInfo: '6222****1234', status: 'pending', createdAt: '2026-04-27T08:00:00Z' },
]

/** 生成 30 天收益分布 */
const generateEarningDistribution = (days: number = 30): ICreditsEarningPoint[] => {
  const points: ICreditsEarningPoint[] = []
  const baseAmounts = [120, 80, 200, 150, 300, 50, 180, 220, 90, 160, 240, 110, 190, 70, 130, 210, 140, 260, 100, 170, 230, 60, 200, 120, 250, 180, 90, 140, 220, 160]
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    points.push({
      date: formatDateOnly(d),
      amount: Number((baseAmounts[(days - 1 - i) % baseAmounts.length] + Math.random() * 50).toFixed(2)),
    })
  }
  return points
}

// --- Creator Mock Data ---

const mockProducts: ICreatorProduct[] = [
  {
    id: 'prod-001',
    name: 'Vue Admin Dashboard',
    description: 'A modern admin dashboard built with Vue 3, Element Plus, and Tailwind CSS.',
    type: 'template',
    category: 'Dashboard',
    tags: ['vue', 'admin', 'dashboard'],
    price: 29.99,
    creditsPrice: 299,
    currency: 'credits',
    rating: 4.8,
    reviewCount: 124,
    salesCount: 856,
    sellerId: 'current-user',
    sellerName: 'You',
    previewImages: ['https://picsum.photos/seed/admin1/800/600'],
    demoUrl: 'https://demo.example.com/admin',
    techStack: ['Vue 3', 'Element Plus', 'Tailwind CSS'],
    status: 'active',
    createdAt: '2026-03-15T10:00:00Z',
    updatedAt: '2026-04-20T08:30:00Z',
  },
  {
    id: 'prod-002',
    name: 'Chat Component Library',
    description: 'Reusable chat UI components for React and Vue.',
    type: 'component',
    category: 'UI Components',
    tags: ['chat', 'components', 'react', 'vue'],
    price: 9.99,
    creditsPrice: 99,
    currency: 'credits',
    rating: 4.4,
    reviewCount: 56,
    salesCount: 432,
    sellerId: 'current-user',
    sellerName: 'You',
    previewImages: ['https://picsum.photos/seed/chat1/800/600'],
    techStack: ['React', 'TypeScript'],
    status: 'active',
    createdAt: '2026-03-01T11:00:00Z',
    updatedAt: '2026-04-10T10:00:00Z',
  },
  {
    id: 'prod-003',
    name: 'Nuxt 3 Starter Kit',
    description: 'Production-ready Nuxt 3 starter with SSR, i18n, and auth.',
    type: 'template',
    category: 'Starter',
    tags: ['nuxt', 'starter', 'ssr'],
    price: 19.99,
    creditsPrice: 199,
    currency: 'credits',
    rating: 4.9,
    reviewCount: 89,
    salesCount: 645,
    sellerId: 'current-user',
    sellerName: 'You',
    previewImages: ['https://picsum.photos/seed/nuxt1/800/600'],
    demoUrl: 'https://demo.example.com/nuxt-starter',
    techStack: ['Nuxt 3', 'TypeScript', 'Pinia'],
    status: 'active',
    createdAt: '2026-02-20T09:00:00Z',
    updatedAt: '2026-04-15T14:00:00Z',
  },
  {
    id: 'prod-004',
    name: 'API Dashboard Pro',
    description: 'Beautiful API documentation and management dashboard.',
    type: 'template',
    category: 'Dashboard',
    tags: ['api', 'dashboard', 'docs'],
    price: 39.99,
    creditsPrice: 399,
    currency: 'credits',
    rating: 4.6,
    reviewCount: 42,
    salesCount: 312,
    sellerId: 'current-user',
    sellerName: 'You',
    previewImages: ['https://picsum.photos/seed/api1/800/600'],
    techStack: ['Vue 3', 'Element Plus'],
    status: 'inactive',
    createdAt: '2026-01-10T08:00:00Z',
    updatedAt: '2026-03-01T10:00:00Z',
  },
  {
    id: 'prod-005',
    name: 'Vue Form Builder',
    description: 'Drag-and-drop form builder with validation rules.',
    type: 'plugin',
    category: 'Form',
    tags: ['form', 'builder', 'vue'],
    price: 14.99,
    creditsPrice: 149,
    currency: 'credits',
    rating: 4.7,
    reviewCount: 35,
    salesCount: 198,
    sellerId: 'current-user',
    sellerName: 'You',
    previewImages: ['https://picsum.photos/seed/form1/800/600'],
    techStack: ['Vue 3', 'Vite'],
    status: 'active',
    createdAt: '2026-04-01T10:00:00Z',
    updatedAt: '2026-04-25T16:00:00Z',
  },
]

const mockSales: ICreatorSale[] = [
  { id: 'sale-001', productId: 'prod-001', productName: 'Vue Admin Dashboard', buyerId: 'u-001', buyerName: 'Alice Chen', price: 299.00, platformFee: 59.80, netEarning: 239.20, createdAt: '2026-04-27T10:00:00Z' },
  { id: 'sale-002', productId: 'prod-001', productName: 'Vue Admin Dashboard', buyerId: 'u-002', buyerName: 'Bob Wang', price: 299.00, platformFee: 59.80, netEarning: 239.20, createdAt: '2026-04-26T14:00:00Z' },
  { id: 'sale-003', productId: 'prod-002', productName: 'Chat Component Library', buyerId: 'u-003', buyerName: 'Carol Liu', price: 99.00, platformFee: 19.80, netEarning: 79.20, createdAt: '2026-04-26T09:00:00Z' },
  { id: 'sale-004', productId: 'prod-001', productName: 'Vue Admin Dashboard', buyerId: 'u-004', buyerName: 'David Zhang', price: 299.00, platformFee: 59.80, netEarning: 239.20, createdAt: '2026-04-25T16:00:00Z' },
  { id: 'sale-005', productId: 'prod-003', productName: 'Nuxt 3 Starter Kit', buyerId: 'u-005', buyerName: 'Eva Li', price: 199.00, platformFee: 39.80, netEarning: 159.20, createdAt: '2026-04-25T11:00:00Z' },
  { id: 'sale-006', productId: 'prod-002', productName: 'Chat Component Library', buyerId: 'u-006', buyerName: 'Frank Zhao', price: 99.00, platformFee: 19.80, netEarning: 79.20, createdAt: '2026-04-24T15:00:00Z' },
  { id: 'sale-007', productId: 'prod-005', productName: 'Vue Form Builder', buyerId: 'u-007', buyerName: 'Grace Wu', price: 149.00, platformFee: 29.80, netEarning: 119.20, createdAt: '2026-04-24T10:00:00Z' },
  { id: 'sale-008', productId: 'prod-001', productName: 'Vue Admin Dashboard', buyerId: 'u-008', buyerName: 'Henry Zhou', price: 299.00, platformFee: 59.80, netEarning: 239.20, createdAt: '2026-04-23T14:00:00Z' },
  { id: 'sale-009', productId: 'prod-003', productName: 'Nuxt 3 Starter Kit', buyerId: 'u-009', buyerName: 'Ivy Yang', price: 199.00, platformFee: 39.80, netEarning: 159.20, createdAt: '2026-04-22T09:00:00Z' },
  { id: 'sale-010', productId: 'prod-001', productName: 'Vue Admin Dashboard', buyerId: 'u-010', buyerName: 'Jack Ma', price: 299.00, platformFee: 59.80, netEarning: 239.20, createdAt: '2026-04-21T11:00:00Z' },
  { id: 'sale-011', productId: 'prod-002', productName: 'Chat Component Library', buyerId: 'u-011', buyerName: 'Kate Sun', price: 99.00, platformFee: 19.80, netEarning: 79.20, createdAt: '2026-04-20T16:00:00Z' },
  { id: 'sale-012', productId: 'prod-005', productName: 'Vue Form Builder', buyerId: 'u-012', buyerName: 'Leo He', price: 149.00, platformFee: 29.80, netEarning: 119.20, createdAt: '2026-04-19T10:00:00Z' },
  { id: 'sale-013', productId: 'prod-003', productName: 'Nuxt 3 Starter Kit', buyerId: 'u-013', buyerName: 'Mia Xu', price: 199.00, platformFee: 39.80, netEarning: 159.20, createdAt: '2026-04-18T14:00:00Z' },
  { id: 'sale-014', productId: 'prod-001', productName: 'Vue Admin Dashboard', buyerId: 'u-014', buyerName: 'Noah Lin', price: 299.00, platformFee: 59.80, netEarning: 239.20, createdAt: '2026-04-17T09:00:00Z' },
  { id: 'sale-015', productId: 'prod-002', productName: 'Chat Component Library', buyerId: 'u-015', buyerName: 'Olivia Gao', price: 99.00, platformFee: 19.80, netEarning: 79.20, createdAt: '2026-04-16T11:00:00Z' },
  { id: 'sale-016', productId: 'prod-005', productName: 'Vue Form Builder', buyerId: 'u-016', buyerName: 'Peter Chen', price: 149.00, platformFee: 29.80, netEarning: 119.20, createdAt: '2026-04-15T15:00:00Z' },
  { id: 'sale-017', productId: 'prod-003', productName: 'Nuxt 3 Starter Kit', buyerId: 'u-017', buyerName: 'Quinn Huang', price: 199.00, platformFee: 39.80, netEarning: 159.20, createdAt: '2026-04-14T10:00:00Z' },
  { id: 'sale-018', productId: 'prod-001', productName: 'Vue Admin Dashboard', buyerId: 'u-018', buyerName: 'Ryan Li', price: 299.00, platformFee: 59.80, netEarning: 239.20, createdAt: '2026-04-13T14:00:00Z' },
  { id: 'sale-019', productId: 'prod-002', productName: 'Chat Component Library', buyerId: 'u-019', buyerName: 'Sophia Wang', price: 99.00, platformFee: 19.80, netEarning: 79.20, createdAt: '2026-04-12T09:00:00Z' },
  { id: 'sale-020', productId: 'prod-005', productName: 'Vue Form Builder', buyerId: 'u-020', buyerName: 'Tom Zhang', price: 149.00, platformFee: 29.80, netEarning: 119.20, createdAt: '2026-04-11T11:00:00Z' },
]

/** 生成创作者收益趋势 */
const generateCreatorEarnings = (days: number = 30): ICreatorEarning[] => {
  const points: ICreatorEarning[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const salesAmount = Math.floor(Math.random() * 800) + 200
    const platformFee = Math.round(salesAmount * 0.2 * 100) / 100
    points.push({
      date: formatDateOnly(d),
      amount: Math.round((salesAmount - platformFee) * 100) / 100,
      salesAmount,
      platformFee,
    })
  }
  return points
}

// ============================================
// Composables
// ============================================

/** Mock Credits API 组合式函数 */
export function _useMockCreditsImpl() {
  const loading = ref(false)
  const error = ref<string | null>(null)

  // shallowRef for large arrays to avoid deep reactivity overhead
  const account = shallowRef<ICreditsAccount>({ ...mockAccount })
  const transactions = shallowRef<ICreditsTransaction[]>([...mockTransactions])
  const withdrawals = shallowRef<ICreditsWithdrawal[]>([...mockWithdrawals])
  const earnings = shallowRef<ICreditsEarningPoint[]>(generateEarningDistribution(30))

  /** 刷新数据（模拟 API 调用） */
  const refresh = async (): Promise<void> => {
    loading.value = true
    error.value = null
    try {
      await mockDelay()
      // 模拟数据微小变化，体现刷新效果
      const updated = { ...account.value }
      updated.balance = Number((updated.balance + (Math.random() - 0.5) * 10).toFixed(4))
      updated.availableBalance = Number((updated.balance - updated.frozenAmount).toFixed(4))
      updated.updatedAt = new Date().toISOString()
      account.value = updated

      earnings.value = generateEarningDistribution(30)
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Unknown error'
    } finally {
      loading.value = false
    }
  }

  /** 计算属性：总收益 */
  const totalIncome = computed((): number =>
    transactions.value
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0)
  )

  /** 计算属性：总支出 */
  const totalExpense = computed((): number =>
    transactions.value
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + Math.abs(t.amount), 0)
  )

  /** 计算属性：净收益 */
  const netAmount = computed((): number => totalIncome.value - totalExpense.value)

  return {
    account,
    transactions,
    withdrawals,
    earnings,
    loading,
    error,
    refresh,
    totalIncome,
    totalExpense,
    netAmount,
  }
}

/** Mock Creator API 组合式函数 */
export function useMockCreator() {
  const loading = ref(false)
  const error = ref<string | null>(null)

  const isSeller = ref(true) // Mock permission: toggle to test guidance page

  const products = shallowRef<ICreatorProduct[]>([...mockProducts])
  const sales = shallowRef<ICreatorSale[]>([...mockSales])
  const earnings = shallowRef<ICreatorEarning[]>(generateCreatorEarnings(30))

  /** 刷新数据（模拟 API 调用） */
  const refresh = async (): Promise<void> => {
    loading.value = true
    error.value = null
    try {
      await mockDelay()
      earnings.value = generateCreatorEarnings(30)
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Unknown error'
    } finally {
      loading.value = false
    }
  }

  /** 计算属性：创作者统计 */
  const stats = computed((): ICreatorStats => ({
    totalProducts: products.value.length,
    totalSales: products.value.reduce((sum, p) => sum + p.salesCount, 0),
    totalEarnings: sales.value.reduce((sum, s) => sum + s.netEarning, 0),
    monthlyEarnings: (() => {
      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      return sales.value
        .filter(s => new Date(s.createdAt) >= monthStart)
        .reduce((sum, s) => sum + s.netEarning, 0)
    })(),
    platformFeeRate: 0.2,
  }))

  return {
    products,
    sales,
    earnings,
    stats,
    isSeller,
    loading,
    error,
    refresh,
  }
}

// ============================================
// 未来真实 API 替换接口（类型契约）
// ============================================

/** Credits API 接口契约 */
export interface ICreditsApi {
  getAccount: () => Promise<ICreditsAccount>
  getTransactions: (params?: { page?: number; pageSize?: number; type?: string }) => Promise<ICreditsTransaction[]>
  getWithdrawals: () => Promise<ICreditsWithdrawal[]>
  getEarnings: (days?: number) => Promise<ICreditsEarningPoint[]>
}

/** Creator API 接口契约 */
export interface ICreatorApi {
  getProducts: () => Promise<ICreatorProduct[]>
  getSales: (params?: { page?: number; pageSize?: number }) => Promise<ICreatorSale[]>
  getEarnings: (days?: number) => Promise<ICreatorEarning[]>
  getStats: () => Promise<ICreatorStats>
}

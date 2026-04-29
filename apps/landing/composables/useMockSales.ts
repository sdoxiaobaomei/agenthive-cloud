/**
 * Mock Sales API Composable
 *
 * Provides sales data with date range filtering and CSV export.
 * Backend API ready时，只需替换此 composable 的实现。
 */

import { ref, computed, shallowRef } from 'vue'
import type { ICreatorSale } from '~/types/economy'

/** Date range filter type */
export type SalesDateRange = '7d' | '30d' | '90d' | 'custom'

/** Mock permission check - toggle to test non-seller guidance page */
const MOCK_IS_SELLER = true

/** Parse ISO date to Date object */
const parseDate = (dateStr: string): Date => new Date(dateStr)

/** Format date as YYYY-MM-DD */
const formatDateOnly = (date: Date): string => date.toISOString().split('T')[0]

/** Generate mock sales data (20+ records, 5+ products) */
const generateMockSales = (): ICreatorSale[] => {
  const products = [
    { id: 'prod-001', name: 'Vue Admin Dashboard', price: 299 },
    { id: 'prod-002', name: 'Chat Component Library', price: 99 },
    { id: 'prod-003', name: 'Nuxt 3 Starter Kit', price: 199 },
    { id: 'prod-004', name: 'API Dashboard Pro', price: 399 },
    { id: 'prod-005', name: 'Vue Form Builder', price: 149 },
    { id: 'prod-006', name: 'React E-commerce Template', price: 249 },
  ]

  const buyers = [
    'Alice Chen', 'Bob Wang', 'Carol Liu', 'David Zhang', 'Eva Li',
    'Frank Zhao', 'Grace Wu', 'Henry Zhou', 'Ivy Yang', 'Jack Ma',
    'Kate Sun', 'Leo He', 'Mia Xu', 'Noah Lin', 'Olivia Gao',
    'Peter Chen', 'Quinn Huang', 'Ryan Li', 'Sophia Wang', 'Tom Zhang',
    'Uma Patel', 'Victor Kim', 'Wendy Liu', 'Xander Chen',
  ]

  const sales: ICreatorSale[] = []
  const now = new Date()
  const platformFeeRate = 0.2

  for (let i = 0; i < 30; i++) {
    const d = new Date(now)
    d.setDate(d.getDate() - (i % 25)) // Spread across ~25 days
    const product = products[i % products.length]
    const buyer = buyers[i % buyers.length]
    const platformFee = Math.round(product.price * platformFeeRate * 100) / 100
    const netEarning = Math.round((product.price - platformFee) * 100) / 100

    sales.push({
      id: `sale-${String(i + 1).padStart(3, '0')}`,
      productId: product.id,
      productName: product.name,
      buyerId: `u-${String(i + 1).padStart(3, '0')}`,
      buyerName: buyer,
      price: product.price,
      platformFee,
      netEarning,
      createdAt: d.toISOString(),
    })
  }

  return sales.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

const allSales = generateMockSales()

/**
 * Mock Sales composable
 */
export function useMockSales() {
  const loading = ref(false)
  const error = ref<string | null>(null)
  const isSeller = ref(MOCK_IS_SELLER)

  const sales = shallowRef<ICreatorSale[]>([...allSales])

  const dateRange = ref<SalesDateRange>('30d')
  const customStartDate = ref<string>('')
  const customEndDate = ref<string>('')

  /** Compute filter start date based on range */
  const filterStartDate = computed((): Date | null => {
    const now = new Date()
    switch (dateRange.value) {
      case '7d':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      case '30d':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      case '90d':
        return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
      case 'custom':
        return customStartDate.value ? parseDate(customStartDate.value) : null
      default:
        return null
    }
  })

  const filterEndDate = computed((): Date | null => {
    if (dateRange.value === 'custom' && customEndDate.value) {
      return parseDate(customEndDate.value)
    }
    return null
  })

  /** Filtered sales by date range */
  const filteredSales = computed((): ICreatorSale[] => {
    const start = filterStartDate.value
    const end = filterEndDate.value
    if (!start && !end) return sales.value

    return sales.value.filter((s) => {
      const saleDate = parseDate(s.createdAt)
      if (start && saleDate < start) return false
      if (end && saleDate > end) return false
      return true
    })
  })

  /** Total earnings from filtered sales */
  const totalEarnings = computed((): number =>
    filteredSales.value.reduce((sum, s) => sum + s.price, 0)
  )

  /** Total platform fees from filtered sales */
  const totalPlatformFees = computed((): number =>
    filteredSales.value.reduce((sum, s) => sum + s.platformFee, 0)
  )

  /** Total net earnings from filtered sales */
  const totalNetEarnings = computed((): number =>
    filteredSales.value.reduce((sum, s) => sum + s.netEarning, 0)
  )

  /** Set date range filter */
  const setDateRange = (range: SalesDateRange, start?: string, end?: string): void => {
    dateRange.value = range
    if (range === 'custom') {
      customStartDate.value = start || ''
      customEndDate.value = end || ''
    } else {
      customStartDate.value = ''
      customEndDate.value = ''
    }
  }

  /** Export filtered sales to CSV and trigger download */
  const exportToCSV = (): void => {
    if (typeof document === 'undefined') return
    const headers = ['Date', 'Product', 'Buyer', 'Price (credits)', 'Platform Fee', 'Net Earning']
    const rows = filteredSales.value.map((s) => [
      s.createdAt,
      s.productName,
      s.buyerName,
      s.price.toFixed(2),
      s.platformFee.toFixed(2),
      s.netEarning.toFixed(2),
    ])
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `sales-export-${formatDateOnly(new Date())}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  /** Simulate async refresh */
  const refresh = async (): Promise<void> => {
    loading.value = true
    error.value = null
    try {
      await new Promise((resolve) => setTimeout(resolve, 400))
      sales.value = [...allSales]
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Unknown error'
    } finally {
      loading.value = false
    }
  }

  return {
    sales,
    filteredSales,
    isSeller,
    loading,
    error,
    dateRange,
    customStartDate,
    customEndDate,
    totalEarnings,
    totalPlatformFees,
    totalNetEarnings,
    setDateRange,
    exportToCSV,
    refresh,
  }
}

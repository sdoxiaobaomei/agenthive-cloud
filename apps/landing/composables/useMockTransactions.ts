/**
 * 流水 Mock API 组合式函数
 * Mock Transactions API Composable
 *
 * 对接点预留：后端 API 就绪时，替换此文件中的实现为真实 API 调用
 */

import { ref, computed, shallowRef } from 'vue'
import type {
  ICreditsTransaction,
  IEconomyPaginatedResponse,
} from '~/types/economy'
import { useMockCredits } from './useMockCredits'

export interface IUseMockTransactionsOptions {
  pageSize?: number
}

export function useMockTransactions(options: IUseMockTransactionsOptions = {}) {
  const mockCredits = useMockCredits()

  const loading = ref(false)
  const error = ref<string | null>(null)

  // Filter state
  const filterType = ref<'all' | 'income' | 'expense'>('all')

  // Pagination state
  const page = ref(1)
  const pageSize = ref(options.pageSize || 10)

  // Raw transactions from mock credits
  const allTransactions = shallowRef<ICreditsTransaction[]>([
    ...mockCredits.transactions.value,
  ])

  /** 刷新数据 */
  const refresh = async (): Promise<void> => {
    loading.value = true
    error.value = null
    try {
      await mockCredits.refresh()
      allTransactions.value = [...mockCredits.transactions.value]
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Unknown error'
    } finally {
      loading.value = false
    }
  }

  /** 过滤后的流水 */
  const filteredTransactions = computed((): ICreditsTransaction[] => {
    let list = allTransactions.value
    if (filterType.value !== 'all') {
      list = list.filter(t => t.type === filterType.value)
    }
    return list
  })

  /** 分页后的流水 */
  const paginatedTransactions = computed((): ICreditsTransaction[] => {
    const start = (page.value - 1) * pageSize.value
    return filteredTransactions.value.slice(start, start + pageSize.value)
  })

  /** 总数 */
  const total = computed((): number => filteredTransactions.value.length)

  /** 总页数 */
  const totalPages = computed((): number =>
    Math.ceil(total.value / pageSize.value)
  )

  /** 分页响应对象（适配 DataTable） */
  const pagination = computed(
    (): IEconomyPaginatedResponse<ICreditsTransaction> => ({
      items: paginatedTransactions.value,
      total: total.value,
      page: page.value,
      pageSize: pageSize.value,
      totalPages: totalPages.value,
    })
  )

  /** 设置筛选条件 */
  const setFilter = (type: 'all' | 'income' | 'expense') => {
    filterType.value = type
    page.value = 1
  }

  /** 设置页码 */
  const setPage = (p: number) => {
    page.value = p
  }

  /** 设置每页条数 */
  const setPageSize = (size: number) => {
    pageSize.value = size
    page.value = 1
  }

  return {
    transactions: paginatedTransactions,
    allTransactions,
    filteredTransactions,
    pagination,
    loading,
    error,
    refresh,
    filterType,
    page,
    pageSize,
    total,
    totalPages,
    setFilter,
    setPage,
    setPageSize,
  }
}

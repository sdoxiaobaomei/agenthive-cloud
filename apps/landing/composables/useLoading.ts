/**
 * 全局 Loading 状态管理
 * 
 * 使用 Nuxt 的 useState 实现全局状态共享
 * 支持多个并发请求，只有所有请求完成后才关闭 loading
 */

export interface LoadingOptions {
  /** 是否静默模式（不显示 loading） */
  silent?: boolean
  /** 自定义 loading 文本 */
  text?: string
}

export const useLoading = () => {
  // 是否显示全局 loading
  const isLoading = useState<boolean>('global-loading', () => false)
  // loading 提示文本
  const loadingText = useState<string>('loading-text', () => '加载中...')
  // 当前正在进行的请求计数
  const requestCount = useState<number>('request-count', () => 0)

  /**
   * 开始 loading
   * @param text 可选的自定义提示文本
   */
  const startLoading = (text?: string) => {
    if (text) {
      loadingText.value = text
    }
    requestCount.value++
    isLoading.value = true
  }

  /**
   * 停止 loading
   * 使用计数器确保多个并发请求时，只有所有请求完成后才真正关闭
   */
  const stopLoading = () => {
    requestCount.value = Math.max(0, requestCount.value - 1)
    if (requestCount.value === 0) {
      isLoading.value = false
      // 重置为默认文本
      loadingText.value = '加载中...'
    }
  }

  /**
   * 强制停止所有 loading
   * 用于错误处理或页面切换时重置状态
   */
  const forceStopLoading = () => {
    requestCount.value = 0
    isLoading.value = false
    loadingText.value = '加载中...'
  }

  /**
   * 设置 loading 文本
   */
  const setLoadingText = (text: string) => {
    loadingText.value = text
  }

  return {
    isLoading,
    loadingText,
    requestCount: readonly(requestCount),
    startLoading,
    stopLoading,
    forceStopLoading,
    setLoadingText,
  }
}

/**
 * 在请求执行期间自动管理 loading 状态
 * 
 * @param fn 要执行的异步函数
 * @param options loading 选项
 * @returns 原函数的返回值
 * 
 * 示例:
 * const data = await withLoading(() => fetchData(), { text: '正在加载数据...' })
 */
export async function withLoading<T>(
  fn: () => Promise<T>,
  options?: LoadingOptions
): Promise<T> {
  const { startLoading, stopLoading } = useLoading()

  if (!options?.silent) {
    startLoading(options?.text)
  }

  try {
    return await fn()
  } finally {
    if (!options?.silent) {
      stopLoading()
    }
  }
}

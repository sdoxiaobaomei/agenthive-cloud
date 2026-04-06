/**
 * useClientOnly - 客户端安全执行的组合式函数
 * 
 * 使用场景:
 * 需要在客户端执行且需要返回值的操作
 * 
 * 示例:
 * const token = useClientOnly(() => localStorage.getItem('token'), '')
 * const screenWidth = useClientOnly(() => window.innerWidth, 1024)
 */

export function useClientOnly<T>(
  clientFn: () => T,
  defaultValue: T
): Ref<T> {
  const result = ref<T>(defaultValue) as Ref<T>
  
  onMounted(() => {
    result.value = clientFn()
  })
  
  return result
}

/**
 * useClientEffect - 只在客户端执行的副作用
 * 
 * 示例:
 * useClientEffect(() => {
 *   const handler = () => console.log('resize')
 *   window.addEventListener('resize', handler)
 *   return () => window.removeEventListener('resize', handler)
 * })
 */
export function useClientEffect(
  effect: () => void | (() => void)
): void {
  onMounted(() => {
    const cleanup = effect()
    if (cleanup) {
      onUnmounted(cleanup)
    }
  })
}

/**
 * useBrowserStorage - SSR 安全的 localStorage/sessionStorage
 * 
 * 示例:
 * const token = useBrowserStorage('token', '', 'local')
 * const tempData = useBrowserStorage('temp', {}, 'session')
 */
export function useBrowserStorage<T>(
  key: string,
  defaultValue: T,
  type: 'local' | 'session' = 'local'
): Ref<T> {
  const storage = ref<T>(defaultValue) as Ref<T>
  const storageKey = `agenthive:${key}`
  
  onMounted(() => {
    try {
      const store = type === 'local' ? localStorage : sessionStorage
      const saved = store.getItem(storageKey)
      if (saved) {
        try {
          storage.value = JSON.parse(saved)
        } catch {
          storage.value = saved as unknown as T
        }
      }
    } catch (e) {
      console.error(`Failed to access ${type}Storage:`, e)
    }
  })
  
  watch(storage, (newVal) => {
    if (process.client) {
      try {
        const store = type === 'local' ? localStorage : sessionStorage
        if (newVal === null || newVal === undefined) {
          store.removeItem(storageKey)
        } else {
          store.setItem(storageKey, JSON.stringify(newVal))
        }
      } catch (e) {
        console.error(`Failed to save to ${type}Storage:`, e)
      }
    }
  }, { deep: true })
  
  return storage
}

/**
 * useWindowEvent - SSR 安全的 window 事件监听
 * 
 * 示例:
 * useWindowEvent('scroll', handleScroll)
 * useWindowEvent('resize', handleResize, { passive: true })
 */
export function useWindowEvent(
  event: string,
  handler: EventListener,
  options?: AddEventListenerOptions
): void {
  onMounted(() => {
    window.addEventListener(event, handler, options)
  })
  
  onUnmounted(() => {
    window.removeEventListener(event, handler, options)
  })
}

/**
 * useDocumentEvent - SSR 安全的 document 事件监听
 */
export function useDocumentEvent(
  event: string,
  handler: EventListener,
  options?: AddEventListenerOptions
): void {
  onMounted(() => {
    document.addEventListener(event, handler, options)
  })
  
  onUnmounted(() => {
    document.removeEventListener(event, handler, options)
  })
}

/**
 * isClient - 判断是否在客户端
 */
export const isClient = typeof window !== 'undefined'

/**
 * isServer - 判断是否在服务端
 */
export const isServer = typeof window === 'undefined'

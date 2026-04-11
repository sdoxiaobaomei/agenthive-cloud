import { ref } from 'vue'

export interface ToastMessage {
  id: string
  type: 'success' | 'error' | 'info' | 'warning'
  message: string
  duration?: number
}

const toasts = ref<ToastMessage[]>([])

export function useToast() {
  const add = (message: string, type: ToastMessage['type'] = 'info', duration = 3000) => {
    const id = Math.random().toString(36).slice(2)
    toasts.value.push({ id, type, message, duration })
    setTimeout(() => {
      toasts.value = toasts.value.filter((t) => t.id !== id)
    }, duration)
  }

  return {
    toasts,
    success: (msg: string, duration?: number) => add(msg, 'success', duration),
    error: (msg: string, duration?: number) => add(msg, 'error', duration),
    info: (msg: string, duration?: number) => add(msg, 'info', duration),
    warning: (msg: string, duration?: number) => add(msg, 'warning', duration),
  }
}

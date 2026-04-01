import type { AgentRole, AgentStatus } from '@/types'

// 格式化角色显示名称
export function formatRole(role: AgentRole): string {
  const roleMap: Record<AgentRole, string> = {
    director: '导演',
    scrum_master: 'Scrum Master',
    tech_lead: '技术负责人',
    backend_dev: '后端开发',
    frontend_dev: '前端开发',
    qa_engineer: 'QA工程师',
    devops_engineer: 'DevOps工程师',
    custom: '自定义',
  }
  return roleMap[role] || role
}

// 格式化状态显示名称
export function formatStatus(status: AgentStatus): string {
  const statusMap: Record<AgentStatus, string> = {
    idle: '空闲',
    starting: '启动中',
    working: '工作中',
    paused: '已暂停',
    error: '错误',
    completed: '已完成',
  }
  return statusMap[status] || status
}

// 获取状态对应的 Element Plus 类型
export function getStatusType(status: AgentStatus): 'info' | 'success' | 'warning' | 'danger' | 'primary' {
  const typeMap: Record<AgentStatus, 'info' | 'success' | 'warning' | 'danger' | 'primary'> = {
    idle: 'info',
    starting: 'warning',
    working: 'primary',
    paused: 'warning',
    error: 'danger',
    completed: 'success',
  }
  return typeMap[status] || 'info'
}

// 获取角色对应的图标
export function getRoleIcon(role: AgentRole): string {
  const iconMap: Record<AgentRole, string> = {
    director: 'VideoCamera',
    scrum_master: 'Management',
    tech_lead: 'Cpu',
    backend_dev: 'Monitor',
    frontend_dev: 'Picture',
    qa_engineer: 'CircleCheck',
    devops_engineer: 'Cloudy',
    custom: 'User',
  }
  return iconMap[role] || 'User'
}

// 格式化日期时间
export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// 格式化相对时间
export function formatRelativeTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  
  if (seconds < 60) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  if (hours < 24) return `${hours}小时前`
  if (days < 7) return `${days}天前`
  return formatDateTime(date)
}

// 格式化时长
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}秒`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟`
  if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    return `${hours}小时${mins}分钟`
  }
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  return `${days}天${hours}小时`
}

// 格式化文件大小
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// 截断文本
export function truncate(text: string, maxLength: number, suffix = '...'): string {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength - suffix.length) + suffix
}

// 生成唯一ID
export function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15)
}

// 防抖函数
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | null = null
  return function (...args: Parameters<T>) {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }
}

// 节流函数
export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false
  return function (...args: Parameters<T>) {
    if (!inThrottle) {
      fn(...args)
      inThrottle = true
      setTimeout(() => (inThrottle = false), limit)
    }
  }
}

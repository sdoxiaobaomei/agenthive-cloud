import type { AgentStatus, TaskStatus } from '@agenthive/types'

type WorkerRole = string
type TicketStatus = string

export function formatStatus(status: AgentStatus | TaskStatus | TicketStatus | string): string {
  const statusMap: Record<string, string> = {
    idle: '空闲',
    active: '活跃',
    busy: '忙碌',
    offline: '离线',
    error: '错误',
    pending: '待处理',
    running: '进行中',
    doing: '进行中',
    completed: '已完成',
    done: '已完成',
    failed: '失败',
    cancelled: '已取消',
    review: '审查中',
  }
  return statusMap[status] || status
}

export function formatRelativeTime(date: string | Date): string {
  const now = new Date()
  const target = new Date(date)
  const diff = now.getTime() - target.getTime()
  
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  
  if (days > 0) return `${days}天前`
  if (hours > 0) return `${hours}小时前`
  if (minutes > 0) return `${minutes}分钟前`
  return '刚刚'
}

export function truncate(text: string, length: number): string {
  if (!text) return ''
  if (text.length <= length) return text
  return text.slice(0, length) + '...'
}

export function formatDate(date: string | Date): string {
  const d = new Date(date)
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatDateTime(date: string | Date): string {
  return formatDate(date)
}

export function formatRole(role: WorkerRole): string {
  const roleMap: Record<string, string> = {
    frontend_dev: '前端开发',
    backend_dev: '后端开发',
    qa_engineer: 'QA工程师',
    orchestrator: '协调者',
  }
  return roleMap[role] || role
}

export function getStatusType(status: string): 'success' | 'warning' | 'info' | 'danger' {
  const typeMap: Record<string, 'success' | 'warning' | 'info' | 'danger'> = {
    idle: 'info',
    active: 'success',
    busy: 'warning',
    offline: 'info',
    pending: 'info',
    running: 'warning',
    completed: 'success',
    failed: 'danger',
    cancelled: 'info',
  }
  return typeMap[status] || 'info'
}

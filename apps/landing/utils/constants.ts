export const TASK_STATUS = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
} as const

export const TASK_PRIORITIES = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  URGENT: 'urgent',
} as const

export const AGENT_STATUS = {
  IDLE: 'idle',
  ACTIVE: 'active',
  BUSY: 'busy',
  OFFLINE: 'offline',
  ERROR: 'error',
} as const

export const AGENT_ROLES = {
  FRONTEND: 'frontend_dev',
  BACKEND: 'backend_dev',
  QA: 'qa_engineer',
  ORCHESTRATOR: 'orchestrator',
} as const

export const PRIORITY_COLORS: Record<string, string> = {
  low: '#67C23A',
  medium: '#E6A23C',
  high: '#F56C6C',
  urgent: '#FF0000',
}

export const STATUS_COLORS: Record<string, string> = {
  idle: '#909399',
  active: '#67C23A',
  busy: '#E6A23C',
  offline: '#C0C4CC',
  error: '#F56C6C',
  pending: '#909399',
  running: '#409EFF',
  completed: '#67C23A',
  failed: '#F56C6C',
  cancelled: '#C0C4CC',
}

export const STORAGE_KEYS = {
  SETTINGS: 'agenthive_settings',
  AGENTS: 'agenthive_agents',
  TASKS: 'agenthive_tasks',
} as const

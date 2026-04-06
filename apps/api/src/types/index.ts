// 类型定义

export type AgentRole = 
  | 'director' 
  | 'scrum_master' 
  | 'tech_lead'
  | 'backend_dev'
  | 'frontend_dev'
  | 'qa_engineer'
  | 'devops_engineer'
  | 'custom'

export type AgentStatus = 
  | 'idle'
  | 'starting'
  | 'working'
  | 'paused'
  | 'error'
  | 'completed'

export interface Agent {
  id: string
  name: string
  role: AgentRole
  status: AgentStatus
  avatar?: string
  description?: string
  currentTask?: {
    id: string
    title: string
    progress: number
  }
  podIp?: string
  lastHeartbeatAt: string
  createdAt: string
  updatedAt: string
}

export type TaskStatus = 
  | 'pending'
  | 'assigned'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'

export type TaskPriority = 'low' | 'medium' | 'high' | 'critical'

export interface Task {
  id: string
  type: string
  status: TaskStatus
  priority: TaskPriority
  title: string
  description?: string
  assignedTo?: string
  input: Record<string, unknown>
  output?: Record<string, unknown>
  progress: number
  createdAt: string
  startedAt?: string
  completedAt?: string
  parentId?: string
  subtasks?: Task[]
}

export interface User {
  id: string
  username: string
  email?: string
  phone?: string
  role: string
  avatar?: string
  createdAt: string
  updatedAt: string
}

export interface CodeFile {
  path: string
  name: string
  content: string
  language: string
  lastModified: string
  isDirectory?: boolean
}

export interface Message {
  id: string
  senderType: 'user' | 'agent' | 'system'
  senderId?: string
  senderName?: string
  senderRole?: AgentRole
  content: string
  contentType: 'text' | 'code' | 'image' | 'file' | 'command'
  language?: string
  metadata?: Record<string, unknown>
  createdAt: string
  taskId?: string
}

// API 响应类型
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// 短信验证码存储
export interface SmsCode {
  phone: string
  code: string
  expiresAt: number
  attempts: number
}

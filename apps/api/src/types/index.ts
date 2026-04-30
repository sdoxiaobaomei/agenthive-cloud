// 共享类型定义

// 用户类型
export interface User {
  id: string
  username: string
  email?: string
  phone?: string
  password_hash?: string
  role: string
  avatar?: string
  external_user_id?: string
  externalUserId?: string
  created_at: string
  updated_at: string
}

// Agent 角色类型
export type AgentRole = 
  | 'director' 
  | 'scrum_master' 
  | 'tech_lead'
  | 'backend_dev'
  | 'frontend_dev'
  | 'qa_engineer'
  | 'devops_engineer'
  | 'custom'

// Agent 状态类型
export type AgentStatus = 
  | 'idle'
  | 'starting'
  | 'working'
  | 'paused'
  | 'error'
  | 'completed'

// Agent 类型
export interface Agent {
  id: string
  name: string
  role: AgentRole
  status: AgentStatus
  avatar?: string
  description?: string
  pod_ip?: string
  podIp?: string
  current_task_id?: string
  currentTask?: {
    id: string
    title: string
    progress: number
  }
  config?: Record<string, unknown>
  last_heartbeat_at?: string
  lastHeartbeatAt?: string
  created_at: string
  updated_at: string
}

// 任务状态类型
export type TaskStatus = 
  | 'pending' 
  | 'assigned' 
  | 'running' 
  | 'completed' 
  | 'failed' 
  | 'cancelled'

// 任务优先级类型
export type TaskPriority = 
  | 'low' 
  | 'medium' 
  | 'high' 
  | 'critical'

// 任务类型
export interface Task {
  id: string
  title: string
  description?: string
  type: string
  status: TaskStatus
  priority: TaskPriority
  progress: number
  assigned_to?: string
  assignedTo?: string
  parent_id?: string
  parentId?: string
  subtasks?: Task[]
  input: Record<string, unknown>
  output?: Record<string, unknown>
  created_at: string
  started_at?: string
  completed_at?: string
}

// 代码文件类型
export interface CodeFile {
  id?: string
  path: string
  name: string
  content: string
  language: string
  is_directory?: boolean
  isDirectory?: boolean
  last_modified?: string
}

// API 响应类型
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

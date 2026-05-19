// 共享类型定义

import type { Request } from 'express'

// ============ Express 请求类型扩展 ============

/** 认证用户信息 */
export interface AuthUser {
  userId: string
  username: string
  role: string
}

/** 扩展 Express Request，携带认证用户信息 */
export interface AuthenticatedRequest extends Request {
  /** 本地用户 ID（数据库内部 ID） */
  userId: string
  /** 外部用户 ID（Gateway 透传） */
  externalUserId?: string
  /** 认证用户详情 */
  user: AuthUser
}

/**
 * 从 Request 中安全获取用户 ID
 * 用于逐步替换 (req as any).userId 模式
 */
export function getUserId(req: Request): string | undefined {
  return (req as AuthenticatedRequest).userId
}

/**
 * 从 Request 中获取用户 ID，如不存在则返回 'anonymous'
 */
export function getUserIdOrAnonymous(req: Request): string {
  return (req as AuthenticatedRequest).userId || 'anonymous'
}

// 用户类型
export interface User {
  id: string
  username: string
  email?: string
  phone?: string
  password_hash?: string
  role: string
  status?: string
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
  owner_id?: string
  project_id?: string
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
  user_id?: string
  userId?: string
  project_id?: string
  projectId?: string
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

/**
 * Agent 相关类型定义
 */

/** Agent 角色类型 */
export type AgentRole =
  | 'director'
  | 'scrum_master'
  | 'tech_lead'
  | 'backend_dev'
  | 'frontend_dev'
  | 'qa_engineer'
  | 'devops_engineer'
  | 'custom'

/** Agent 状态 */
export type AgentStatus =
  | 'idle'
  | 'starting'
  | 'running'
  | 'working'
  | 'paused'
  | 'error'
  | 'completed'
  | 'stopped'

/** Agent 信息 */
export interface Agent {
  id: string
  name: string
  role: AgentRole
  type: string
  status: AgentStatus
  avatar?: string
  description?: string
  config?: Record<string, unknown>
  metadata?: Record<string, unknown>
  currentTask?: {
    id: string
    title: string
    progress: number
  }
  podIp?: string
  lastHeartbeatAt?: string
  lastRunAt?: string
  createdAt: string
  updatedAt: string
}

/** Agent 日志 */
export interface AgentLog {
  id: string
  agentId: string
  level: 'info' | 'warn' | 'error' | 'debug'
  message: string
  metadata?: Record<string, unknown>
  timestamp: string
}

/** 创建 Agent 参数 */
export interface CreateAgentParams {
  name: string
  description?: string
  type: string
  role?: AgentRole
  config?: Record<string, unknown>
  metadata?: Record<string, unknown>
}

/** 更新 Agent 参数 */
export interface UpdateAgentParams {
  name?: string
  description?: string
  role?: AgentRole
  config?: Record<string, unknown>
  metadata?: Record<string, unknown>
  status?: AgentStatus
}

/** Agent 操作类型 */
export type AgentAction = 'start' | 'stop' | 'pause' | 'resume'

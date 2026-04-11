/**
 * 任务相关类型定义
 */

/** 任务状态 */
export type TaskStatus =
  | 'pending'
  | 'assigned'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'

/** 任务优先级 */
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical' | 'urgent'

/** 任务信息 */
export interface Task {
  id: string
  title: string
  type?: string
  description?: string
  status: TaskStatus
  priority: TaskPriority
  agentId?: string
  assignedTo?: string
  input?: Record<string, unknown>
  output?: Record<string, unknown>
  progress: number
  tags?: string[]
  metadata?: Record<string, unknown>
  dueDate?: string
  parentId?: string
  subtasks?: Task[]
  createdAt: string
  updatedAt: string
  startedAt?: string
  completedAt?: string
}

/** 创建任务参数 */
export interface CreateTaskParams {
  title: string
  type?: string
  description?: string
  agentId?: string
  priority?: TaskPriority
  dueDate?: string
  tags?: string[]
  input?: Record<string, unknown>
  metadata?: Record<string, unknown>
  parentId?: string
}

/** 更新任务参数 */
export interface UpdateTaskParams {
  title?: string
  description?: string
  agentId?: string
  priority?: TaskPriority
  dueDate?: string
  tags?: string[]
  status?: TaskStatus
  input?: Record<string, unknown>
  output?: Record<string, unknown>
  progress?: number
  metadata?: Record<string, unknown>
}

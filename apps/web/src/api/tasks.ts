import { localStorageApi } from './localStorage'

export interface TasksResponse {
  tasks: import('@/types').Task[]
  total: number
  page: number
  pageSize: number
}

export interface CreateTaskRequest {
  title: string
  description?: string
  type: string
  priority?: import('@/types').TaskPriority
  input?: Record<string, unknown>
  assignedTo?: string
}

export interface UpdateTaskRequest {
  title?: string
  description?: string
  priority?: import('@/types').TaskPriority
  status?: import('@/types').TaskStatus
  input?: Record<string, unknown>
  assignedTo?: string
}

// Task API - 使用 LocalStorage
export const tasksApi = localStorageApi.tasks

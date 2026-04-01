import { localStorageApi } from './localStorage'
import type { Agent, Task } from '@/types'

export interface AgentsResponse {
  agents: Agent[]
  total: number
}

export interface AgentDetailResponse {
  agent: Agent
  tasks: Task[]
  stats: {
    totalTasks: number
    completedTasks: number
    failedTasks: number
    avgCompletionTime: number
  }
}

export interface CreateAgentRequest {
  name: string
  role: string
  description?: string
  config?: Record<string, unknown>
}

export interface UpdateAgentRequest {
  name?: string
  description?: string
  config?: Record<string, unknown>
}

export interface CommandRequest {
  type: string
  payload: Record<string, unknown>
}

// Agent API - 使用 LocalStorage
export const agentsApi = localStorageApi.agents

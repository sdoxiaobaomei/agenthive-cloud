// Agent Runtime 类型定义

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
  | 'shutdown'

export type TaskStatus = 
  | 'pending'
  | 'assigned'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'

export interface AgentConfig {
  id: string
  name: string
  role: AgentRole
  description?: string
  supervisorUrl: string
  workspacePath: string
  capabilities: string[]
  maxConcurrentTasks: number
  heartbeatInterval: number
}

export interface Task {
  id: string
  type: string
  status: TaskStatus
  priority: 'low' | 'medium' | 'high' | 'critical'
  title: string
  description?: string
  input: Record<string, unknown>
  output?: Record<string, unknown>
  progress: number
  createdAt: string
  startedAt?: string
  completedAt?: string
}

export interface Command {
  type: string
  payload: Record<string, unknown>
  timestamp: string
}

export interface LogEntry {
  timestamp: string
  level: 'info' | 'warn' | 'error' | 'debug'
  message: string
  metadata?: Record<string, unknown>
}

// WebSocket 消息类型
export interface WSMessage {
  type: string
  payload: unknown
  timestamp: string
}

export interface AgentRegistrationMessage extends WSMessage {
  type: 'agent:register'
  payload: {
    id: string
    name: string
    role: AgentRole
    capabilities: string[]
    status: AgentStatus
  }
}

export interface HeartbeatMessage extends WSMessage {
  type: 'agent:heartbeat'
  payload: {
    agentId: string
    status: AgentStatus
    currentTask?: string
    progress?: number
    memory: number
    cpu: number
  }
}

export interface TaskAssignedMessage extends WSMessage {
  type: 'task:assigned'
  payload: Task
}

export interface TaskProgressMessage extends WSMessage {
  type: 'task:progress'
  payload: {
    taskId: string
    progress: number
    message?: string
  }
}

export interface TaskCompletedMessage extends WSMessage {
  type: 'task:completed'
  payload: {
    taskId: string
    status: TaskStatus
    output?: Record<string, unknown>
    logs: string[]
  }
}

export interface LogOutputMessage extends WSMessage {
  type: 'log:output'
  payload: {
    agentId: string
    taskId?: string
    data: string
    isError: boolean
  }
}

// 执行器接口
export interface TaskExecutor {
  name: string
  canExecute(taskType: string): boolean
  execute(task: Task, context: ExecutionContext): Promise<ExecutionResult>
}

export interface ExecutionContext {
  agentId: string
  workspacePath: string
  sendLog: (message: string, isError?: boolean) => void
  updateProgress: (progress: number, message?: string) => void
}

export interface ExecutionResult {
  success: boolean
  output?: Record<string, unknown>
  error?: string
  logs: string[]
}

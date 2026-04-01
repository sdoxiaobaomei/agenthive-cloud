// Agent 类型定义
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

// Task 类型定义
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

// Message 类型定义
export type MessageType = 'text' | 'code' | 'image' | 'file' | 'command'
export type SenderType = 'user' | 'agent' | 'system'

export interface Message {
  id: string
  senderType: SenderType
  senderId?: string
  senderName?: string
  senderRole?: AgentRole
  content: string
  contentType: MessageType
  language?: string
  metadata?: Record<string, unknown>
  createdAt: string
  taskId?: string
}

// 代码相关类型
export interface CodeFile {
  path: string
  name: string
  content: string
  language: string
  lastModified: string
  isDirectory?: boolean
}

export interface CodeDiff {
  oldPath: string
  newPath: string
  oldContent?: string
  newContent?: string
  additions: number
  deletions: number
}

// 终端相关类型
export interface TerminalOutput {
  agentId: string
  data: string
  isError: boolean
  timestamp: string
}

// Sprint 相关类型
export interface Sprint {
  id: string
  name: string
  goal: string
  status: 'planning' | 'active' | 'completed' | 'cancelled'
  startDate: string
  endDate: string
  tasks: Task[]
}

// WebSocket 事件类型
export interface WebSocketEvent {
  type: string
  payload: unknown
  timestamp: string
}

export interface AgentStateChangeEvent extends WebSocketEvent {
  type: 'agent_state_change'
  payload: {
    agentId: string
    oldState: AgentStatus
    newState: AgentStatus
    progress?: number
    message?: string
  }
}

export interface CodeUpdateEvent extends WebSocketEvent {
  type: 'code_update'
  payload: {
    agentId: string
    file: string
    content: string
    language: string
  }
}

export interface LogOutputEvent extends WebSocketEvent {
  type: 'log_output'
  payload: {
    agentId: string
    data: string
    isError: boolean
  }
}

export interface NewMessageEvent extends WebSocketEvent {
  type: 'new_message'
  payload: Message
}

// UI 状态类型
export interface UIState {
  sidebarCollapsed: boolean
  activePanel: 'agents' | 'tasks' | 'code' | 'terminal' | 'chat' | 'settings'
  theme: 'light' | 'dark' | 'auto'
  codeEditorLayout: 'horizontal' | 'vertical'
}

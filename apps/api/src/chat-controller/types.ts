/**
 * Chat Controller types
 */

export type ChatIntent =
  | 'create_project'
  | 'modify_code'
  | 'code_review'
  | 'run_tests'
  | 'fix_bug'
  | 'deploy'
  | 'explain'
  | 'chat'

export interface ChatSession {
  id: string
  userId: string
  projectId?: string
  title?: string
  status: 'active' | 'archived'
  createdAt: string
  updatedAt: string
}

export interface ChatMessage {
  id: string
  sessionId: string
  role: 'user' | 'assistant' | 'system' | 'agent'
  content: string
  metadata?: {
    intent?: ChatIntent
    tickets?: TicketRef[]
    progress?: number
    agentLogs?: AgentLogRef[]
  }
  createdAt: string
}

export interface TicketRef {
  id: string
  role: string
  task: string
  status: string
}

export interface AgentLogRef {
  agentId: string
  message: string
  timestamp: string
}

export interface AgentTask {
  id: string
  sessionId: string
  ticketId: string
  workerRole: 'frontend' | 'backend' | 'qa'
  status: 'pending' | 'running' | 'completed' | 'failed'
  workspacePath: string
  result?: Record<string, unknown>
  startedAt?: string
  completedAt?: string
  createdAt: string
}

export interface CreateSessionInput {
  userId: string
  projectId?: string
  title?: string
}

export interface SendMessageInput {
  content: string
}

export interface IntentClassificationResult {
  intent: ChatIntent
  confidence: number
}

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

export type MessageType = 'message' | 'think' | 'task' | 'recommend' | 'system_event'

export type SessionType = 'default' | 'review' | 'debug' | 'template'

export type ApprovalStatus = 'pending' | 'approved' | 'declined'

export interface ChatSession {
  id: string
  userId: string
  workspaceId?: string
  projectId?: string
  title?: string
  status: 'active' | 'archived'
  sessionType: SessionType
  currentVersionId?: string
  createdAt: string
  updatedAt: string
}

export interface ChatMessage {
  id: string
  sessionId: string
  versionId?: string
  role: 'user' | 'assistant' | 'system' | 'agent'
  messageType: MessageType
  content: string
  isVisibleInHistory: boolean
  metadata?: {
    intent?: ChatIntent
    estimatedCost?: number
    thinkContent?: string
    thinkSummary?: string
    taskPayload?: {
      title: string
      description: string
      actions: Array<{
        id: string
        label: string
        type: 'approve' | 'decline' | 'run'
      }>
    }
    approvalStatus?: ApprovalStatus
    approvalReason?: string
    recommendOptions?: Array<{
      id: string
      label: string
      prompt: string
      icon?: string
    }>
    selectedOptionId?: string
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

export interface Workspace {
  id: string
  userId: string
  name: string
  settings?: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface ChatVersion {
  id: string
  sessionId: string
  versionNumber: number
  title: string
  description?: string
  baseMessageId?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateSessionInput {
  userId: string
  workspaceId?: string
  projectId?: string
  title?: string
  sessionType?: SessionType
}

export interface SendMessageInput {
  content: string
  messageType?: MessageType
  metadata?: Record<string, unknown>
}

export interface ApproveTaskInput {
  action: 'approve' | 'decline'
  reason?: string
}

export interface SelectRecommendInput {
  optionId: string
}

export interface CreateVersionInput {
  title: string
  description?: string
  baseMessageId?: string
}

export interface SwitchVersionInput {
  versionId: string
}

export interface IntentClassificationResult {
  intent: ChatIntent
  confidence: number
}

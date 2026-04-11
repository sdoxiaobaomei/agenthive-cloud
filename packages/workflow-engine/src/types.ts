/**
 * Core types and interfaces for the Workflow Engine.
 * Protocol-first design: Ticket is the universal communication unit.
 */

// ───────────────────────────────────────────────────────────────
// Protocol Layer
// ───────────────────────────────────────────────────────────────

export interface Ticket {
  id: string
  role: 'frontend_dev' | 'backend_dev' | 'qa_engineer' | 'orchestrator'
  task: string
  prompt: string
  model?: string
  parent_ticket?: string | null
  retry_count: number
  created_at: string
  completed_at?: string
  changed_files?: string[]
  context: {
    relevant_files?: string[]
    constraints?: string[]
    depends_on?: string[]
    [key: string]: unknown
  }
}

export interface WorkflowSession {
  session_id: string
  requirement: string
  project_id?: string
  status: 'planning' | 'running' | 'qa' | 'fixing' | 'completed' | 'failed'
  tickets: Ticket[]
  current_ticket_id?: string
  created_at: string
  updated_at: string
}

export interface Plan {
  plan_summary: string
  tickets: Ticket[]
  notes?: string
}

export interface QAIssue {
  severity: 'critical' | 'warning' | 'suggestion'
  file: string
  line?: number
  description: string
  suggestion: string
}

// ───────────────────────────────────────────────────────────────
// Agent Runtime Layer
// ───────────────────────────────────────────────────────────────

export type AgentEvent =
  | { type: 'log'; level: 'info' | 'warn' | 'error'; message: string }
  | { type: 'file_created'; path: string }
  | { type: 'file_modified'; path: string }
  | { type: 'progress'; percent: number }

export interface ExecutionResult {
  ticket_id: string
  status: 'success' | 'error'
  diff?: string
  changed_files: string[]
  llm_output?: unknown
  error?: string
}

export interface SessionContext {
  requirement: string
  project_id?: string
  source_repo: string
  [key: string]: unknown
}

export interface AgentRuntime {
  readonly name: string
  plan(requirement: string, context: SessionContext): Promise<Plan>
  execute(
    ticket: Ticket,
    workspacePath: string,
    sourceRepoPath: string,
    onEvent: (event: AgentEvent) => void
  ): Promise<ExecutionResult>
}

// ───────────────────────────────────────────────────────────────
// State Store Layer
// ───────────────────────────────────────────────────────────────

export interface StateStore {
  createSession(session: WorkflowSession): Promise<void>
  getSession(sessionId: string): Promise<WorkflowSession | null>
  updateSession(sessionId: string, patch: Partial<WorkflowSession>): Promise<void>
  listSessions(projectId?: string): Promise<WorkflowSession[]>

  saveTicket(sessionId: string, ticket: Ticket): Promise<void>
  loadTicket(sessionId: string, ticketId: string): Promise<Ticket | null>

  saveResult(sessionId: string, ticketId: string, result: ExecutionResult): Promise<void>
  loadResult(sessionId: string, ticketId: string): Promise<ExecutionResult | null>
}

// ───────────────────────────────────────────────────────────────
// Event Bus Layer
// ───────────────────────────────────────────────────────────────

export type WorkflowEvent =
  | { type: 'session.started'; requirement: string }
  | { type: 'ticket.assigned'; ticket_id: string; role: string }
  | { type: 'ticket.completed'; ticket_id: string; changed_files: string[] }
  | { type: 'ticket.failed'; ticket_id: string; error: string }
  | { type: 'qa.started'; ticket_id: string }
  | { type: 'qa.approved'; summary: string }
  | { type: 'qa.rejected'; issues: QAIssue[]; fix_tickets: Ticket[] }
  | { type: 'session.completed' }
  | { type: 'session.failed'; reason: string }

export interface EventBus {
  emit(sessionId: string, event: WorkflowEvent): Promise<void>
  subscribe(sessionId: string, handler: (event: WorkflowEvent) => void): () => void
}

// ───────────────────────────────────────────────────────────────
// Executor Layer
// ───────────────────────────────────────────────────────────────

export interface Executor {
  prepareWorkspace(ticketId: string, sourceRepo: string): Promise<string>
  run(
    ticket: Ticket,
    runtime: AgentRuntime,
    workspacePath: string,
    sourceRepoPath: string,
    onEvent: (event: AgentEvent) => void
  ): Promise<ExecutionResult>
}

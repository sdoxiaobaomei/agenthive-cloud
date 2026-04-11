import type {
  AgentRuntime,
  StateStore,
  EventBus,
  Executor,
  WorkflowSession,
  Ticket,
  Plan,
  WorkflowEvent,
  ExecutionResult,
  QAIssue,
} from './types.js'
import { executeTicketsInParallel, type TicketExecutionResult } from './scheduler.js'

export interface WorkflowEngineOptions {
  runtime: AgentRuntime
  store: StateStore
  eventBus: EventBus
  executor: Executor
  maxRetries?: number
  onTicketCompleted?: (ticket: Ticket, result: ExecutionResult) => Promise<void>
}

export class WorkflowEngine {
  private runtime: AgentRuntime
  private store: StateStore
  private eventBus: EventBus
  private executor: Executor
  private maxRetries: number
  private onTicketCompleted?: (ticket: Ticket, result: ExecutionResult) => Promise<void>
  private ticketToFiles = new Map<string, string[]>()

  constructor(options: WorkflowEngineOptions) {
    this.runtime = options.runtime
    this.store = options.store
    this.eventBus = options.eventBus
    this.executor = options.executor
    this.maxRetries = options.maxRetries ?? 3
    this.onTicketCompleted = options.onTicketCompleted
  }

  async createSession(requirement: string, projectId?: string): Promise<string> {
    const sessionId = `session-${Date.now()}`
    const now = new Date().toISOString()
    const session: WorkflowSession = {
      session_id: sessionId,
      requirement,
      project_id: projectId,
      status: 'planning',
      tickets: [],
      created_at: now,
      updated_at: now,
    }
    await this.store.createSession(session)
    await this.emit(sessionId, { type: 'session.started', requirement })
    return sessionId
  }

  async runSession(sessionId: string): Promise<void> {
    const session = await this.store.getSession(sessionId)
    if (!session) throw new Error(`Session ${sessionId} not found`)

    // Plan phase: if no tickets yet, ask runtime to plan
    if (session.tickets.length === 0) {
      await this.plan(session)
    }

    // Execution + QA loop
    let attempt = 0
    let success = false

    while (attempt <= this.maxRetries && !success) {
      attempt++
      await this.executePendingTickets(session)
      const qaResult = await this.runQA(session)

      if (qaResult.approved) {
        success = true
        session.status = 'completed'
        await this.store.updateSession(sessionId, { status: 'completed', updated_at: new Date().toISOString() })
        await this.emit(sessionId, { type: 'session.completed' })
        break
      }

      if (attempt > this.maxRetries) {
        session.status = 'failed'
        await this.store.updateSession(sessionId, { status: 'failed', updated_at: new Date().toISOString() })
        await this.emit(sessionId, { type: 'session.failed', reason: 'Max retries exceeded' })
        throw new Error(`Session ${sessionId} failed after ${this.maxRetries} retries`)
      }

      // Generate fix tickets and continue loop
      session.status = 'fixing'
      await this.store.updateSession(sessionId, { status: 'fixing', updated_at: new Date().toISOString() })
      const fixTickets = await this.generateFixTickets(session, qaResult.result!)
      await this.emit(sessionId, { type: 'qa.rejected', issues: qaResult.issues, fix_tickets: fixTickets })
    }
  }

  async resumeSession(sessionId: string): Promise<void> {
    const session = await this.store.getSession(sessionId)
    if (!session) throw new Error(`Session ${sessionId} not found`)

    // Reset incomplete tickets so they will be re-executed
    for (const ticket of session.tickets) {
      if (!ticket.completed_at) {
        ticket.completed_at = undefined
        ticket.changed_files = undefined
      }
    }

    await this.store.updateSession(sessionId, { tickets: session.tickets, updated_at: new Date().toISOString() })
    await this.runSession(sessionId)
  }

  private async plan(session: WorkflowSession): Promise<void> {
    session.status = 'planning'
    await this.store.updateSession(session.session_id, { status: 'planning', updated_at: new Date().toISOString() })

    const plan = await this.runtime.plan(session.requirement, {
      requirement: session.requirement,
      project_id: session.project_id,
      source_repo: process.cwd(), // TODO: make configurable
    })

    const tickets = plan.tickets.map((t, idx) => ({
      ...t,
      id: t.id || `T-${String(idx + 1).padStart(3, '0')}`,
      prompt: t.prompt || session.requirement,
      model: t.model || this.runtime.name,
      retry_count: 0,
      created_at: new Date().toISOString(),
      context: t.context || { relevant_files: [], constraints: [], depends_on: [] },
    }))

    session.tickets = tickets
    for (const ticket of tickets) {
      await this.store.saveTicket(session.session_id, ticket)
    }
    await this.store.updateSession(session.session_id, { tickets, updated_at: new Date().toISOString() })
  }

  private async executePendingTickets(session: WorkflowSession): Promise<void> {
    session.status = 'running'
    await this.store.updateSession(session.session_id, { status: 'running', updated_at: new Date().toISOString() })

    const pending = session.tickets.filter(t => t.role !== 'qa_engineer' && !t.completed_at)
    if (pending.length === 0) return

    const results = await executeTicketsInParallel(pending, async (ticket) => {
      await this.emit(session.session_id, { type: 'ticket.assigned', ticket_id: ticket.id, role: ticket.role })

      const workspacePath = await this.executor.prepareWorkspace(ticket.id, process.cwd())
      const result = await this.executor.run(
        ticket,
        this.runtime,
        workspacePath,
        process.cwd(),
        (event) => this.onAgentEvent(session.session_id, ticket.id, event)
      )

      ticket.completed_at = new Date().toISOString()
      ticket.changed_files = result.changed_files
      this.ticketToFiles.set(ticket.id, result.changed_files)
      await this.store.saveTicket(session.session_id, ticket)
      await this.store.saveResult(session.session_id, ticket.id, result)
      if (this.onTicketCompleted) {
        await this.onTicketCompleted(ticket, result)
      }
      await this.emit(session.session_id, {
        type: 'ticket.completed',
        ticket_id: ticket.id,
        changed_files: result.changed_files,
      })

      return { ticket_id: ticket.id, changed_files: result.changed_files }
    })

    // Attach results to session (optional)
    await this.store.updateSession(session.session_id, { updated_at: new Date().toISOString() })
  }

  private async runQA(session: WorkflowSession): Promise<{ approved: boolean; result?: ExecutionResult; issues: QAIssue[] }> {
    const qaTickets = session.tickets.filter(t => t.role === 'qa_engineer' && !t.completed_at)
    if (qaTickets.length === 0) {
      // No QA ticket means auto-pass (or skip)
      return { approved: true, issues: [] }
    }

    const qaTicket = qaTickets[qaTickets.length - 1]
    await this.emit(session.session_id, { type: 'qa.started', ticket_id: qaTicket.id })

    const workspacePath = await this.executor.prepareWorkspace(qaTicket.id, process.cwd())
    const result = await this.executor.run(
      qaTicket,
      this.runtime,
      workspacePath,
      process.cwd(),
      (event) => this.onAgentEvent(session.session_id, qaTicket.id, event)
    )

    qaTicket.completed_at = new Date().toISOString()
    await this.store.saveTicket(session.session_id, qaTicket)
    await this.store.saveResult(session.session_id, qaTicket.id, result)

    const approved = (result.llm_output as any)?.status === 'approved'
    const issues: QAIssue[] = (result.llm_output as any)?.issues || []
    if (approved) {
      await this.emit(session.session_id, { type: 'qa.approved', summary: (result.llm_output as any)?.review_summary || '' })
    }

    return { approved, result, issues }
  }

  private async generateFixTickets(session: WorkflowSession, qaResult: ExecutionResult): Promise<Ticket[]> {
    const issues: QAIssue[] = (qaResult.llm_output as any)?.issues || []
    if (issues.length === 0) return []

    // Build file -> original ticket mapping
    const fileToTicket = new Map<string, string>()
    for (const [ticketId, files] of this.ticketToFiles.entries()) {
      for (const file of files) {
        fileToTicket.set(file, ticketId)
      }
    }

    // Group issues by responsible ticket
    const grouped = new Map<string, QAIssue[]>()
    for (const issue of issues) {
      const rawFile = issue.file.replace(/\\/g, '/')
      const relFile = rawFile.includes('apps/')
        ? rawFile.split('apps/').slice(1).join('apps/')
        : rawFile

      const responsibleTicket = fileToTicket.get(relFile) ||
        Array.from(fileToTicket.entries()).find(([f]) => rawFile.endsWith(f))?.[1]

      if (!responsibleTicket) {
        // eslint-disable-next-line no-console
        console.warn(`   Unable to map issue to ticket: ${issue.file}`)
        continue
      }

      if (!grouped.has(responsibleTicket)) {
        grouped.set(responsibleTicket, [])
      }
      grouped.get(responsibleTicket)!.push(issue)
    }

    const fixTickets: Ticket[] = []
    let idx = 1
    for (const [originalTicketId, ticketIssues] of grouped.entries()) {
      const originalTicket = session.tickets.find(t => t.id === originalTicketId)
      if (!originalTicket) continue

      const files = [...new Set(ticketIssues.map(i => i.file))]
      const fixTicket: Ticket = {
        id: `FIX-${originalTicketId}-${idx++}`,
        role: originalTicket.role,
        task: `修复 ${originalTicketId} 引入的问题: ${ticketIssues[0].description}${ticketIssues.length > 1 ? ` 等 ${ticketIssues.length} 项` : ''}`,
        prompt: originalTicket.prompt || '',
        model: originalTicket.model || this.runtime.name,
        parent_ticket: originalTicketId,
        retry_count: (originalTicket.retry_count || 0) + 1,
        created_at: new Date().toISOString(),
        context: {
          relevant_files: files,
          constraints: [
            '最小改动修复',
            `原始任务: ${originalTicket.task}`,
            `QA 反馈: ${ticketIssues.map(i => `[${i.severity}] ${i.suggestion || i.description}`).join('; ')}`,
          ],
          depends_on: [],
        },
      }
      fixTickets.push(fixTicket)
      await this.store.saveTicket(session.session_id, fixTicket)
    }

    // Append a new QA ticket for the next round
    const nextQANum = session.tickets.filter(t => t.role === 'qa_engineer').length + 1
    const basePrompt = session.tickets[0]?.prompt || '自动修复后的QA审查'
    const newQATicket: Ticket = {
      id: `TQA-${nextQANum}`,
      role: 'qa_engineer',
      task: `重新审查修复后的代码（第 ${nextQANum} 轮 QA）`,
      prompt: basePrompt,
      model: this.runtime.name,
      parent_ticket: null,
      retry_count: 0,
      created_at: new Date().toISOString(),
      context: {
        constraints: ['审查所有修改', '确保之前的问题已修复'],
        depends_on: fixTickets.map(t => t.id),
      },
    }
    fixTickets.push(newQATicket)
    await this.store.saveTicket(session.session_id, newQATicket)

    session.tickets.push(...fixTickets)
    await this.store.updateSession(session.session_id, { tickets: session.tickets, updated_at: new Date().toISOString() })

    return fixTickets
  }

  private async emit(sessionId: string, event: WorkflowEvent): Promise<void> {
    await this.eventBus.emit(sessionId, event)
  }

  private onAgentEvent(sessionId: string, ticketId: string, event: any): void {
    // Bridge low-level agent events to workflow events if needed
    // For now, we rely on the executor/runtime to handle logging
  }
}

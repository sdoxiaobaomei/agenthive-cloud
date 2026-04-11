import fs from 'fs/promises'
import path from 'path'
import type { StateStore, WorkflowSession, Ticket, ExecutionResult } from '../types.js'

/**
 * File-system based StateStore for CLI mode.
 * Mirrors the original agents/workspace/ layout.
 */
export class FileSystemStore implements StateStore {
  private baseDir: string

  constructor(baseDir: string) {
    this.baseDir = baseDir
  }

  private sessionDir(sessionId: string): string {
    return path.join(this.baseDir, sessionId)
  }

  private ticketPath(sessionId: string, ticketId: string): string {
    return path.join(this.sessionDir(sessionId), `${ticketId}.json`)
  }

  private resultPath(sessionId: string, ticketId: string): string {
    return path.join(this.sessionDir(sessionId), `${ticketId}-result.json`)
  }

  private sessionPath(sessionId: string): string {
    return path.join(this.sessionDir(sessionId), `session.json`)
  }

  async createSession(session: WorkflowSession): Promise<void> {
    await fs.mkdir(this.sessionDir(session.session_id), { recursive: true })
    await fs.writeFile(this.sessionPath(session.session_id), JSON.stringify(session, null, 2))
  }

  async getSession(sessionId: string): Promise<WorkflowSession | null> {
    try {
      const data = await fs.readFile(this.sessionPath(sessionId), 'utf-8')
      return JSON.parse(data) as WorkflowSession
    } catch {
      return null
    }
  }

  async updateSession(sessionId: string, patch: Partial<WorkflowSession>): Promise<void> {
    const session = await this.getSession(sessionId)
    if (!session) throw new Error(`Session ${sessionId} not found`)
    const updated = { ...session, ...patch, updated_at: new Date().toISOString() }
    await fs.writeFile(this.sessionPath(sessionId), JSON.stringify(updated, null, 2))
  }

  async listSessions(_projectId?: string): Promise<WorkflowSession[]> {
    const entries = await fs.readdir(this.baseDir).catch(() => [] as string[])
    const sessions: WorkflowSession[] = []
    for (const entry of entries) {
      const session = await this.getSession(entry)
      if (session) sessions.push(session)
    }
    return sessions.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  }

  async saveTicket(sessionId: string, ticket: Ticket): Promise<void> {
    await fs.writeFile(this.ticketPath(sessionId, ticket.id), JSON.stringify(ticket, null, 2))
    // Sync into session.json as well
    const session = await this.getSession(sessionId)
    if (session) {
      const idx = session.tickets.findIndex(t => t.id === ticket.id)
      if (idx >= 0) session.tickets[idx] = ticket
      else session.tickets.push(ticket)
      await fs.writeFile(this.sessionPath(sessionId), JSON.stringify(session, null, 2))
    }
  }

  async loadTicket(sessionId: string, ticketId: string): Promise<Ticket | null> {
    try {
      const data = await fs.readFile(this.ticketPath(sessionId, ticketId), 'utf-8')
      return JSON.parse(data) as Ticket
    } catch {
      return null
    }
  }

  async saveResult(sessionId: string, ticketId: string, result: ExecutionResult): Promise<void> {
    await fs.writeFile(this.resultPath(sessionId, ticketId), JSON.stringify(result, null, 2))
  }

  async loadResult(sessionId: string, ticketId: string): Promise<ExecutionResult | null> {
    try {
      const data = await fs.readFile(this.resultPath(sessionId, ticketId), 'utf-8')
      return JSON.parse(data) as ExecutionResult
    } catch {
      return null
    }
  }
}

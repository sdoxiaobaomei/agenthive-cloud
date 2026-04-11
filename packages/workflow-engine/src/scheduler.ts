import type { Ticket } from './types.js'

export interface TicketExecutionResult {
  ticket_id: string
  changed_files: string[]
}

export class FileLockManager {
  private locks = new Map<string, string>() // file -> ticketId

  getConflicts(files: string[], excludeTicketId?: string): { file: string; lockedBy: string }[] {
    const conflicts: { file: string; lockedBy: string }[] = []
    for (const file of files) {
      const lockedBy = this.locks.get(file)
      if (lockedBy && lockedBy !== excludeTicketId) {
        conflicts.push({ file, lockedBy })
      }
    }
    return conflicts
  }

  acquire(ticketId: string, files: string[]): void {
    for (const file of files) {
      this.locks.set(file, ticketId)
    }
  }

  release(ticketId: string): void {
    for (const [file, id] of Array.from(this.locks.entries())) {
      if (id === ticketId) {
        this.locks.delete(file)
      }
    }
  }
}

export function normalizeFilePath(filePath: string): string {
  // Normalize Windows paths and strip optional repo prefix
  return filePath.replace(/^apps\//, '').replace(/\\/g, '/')
}

/**
 * Execute a list of tickets in parallel where there are no file conflicts
 * and all dependencies are satisfied.
 */
export async function executeTicketsInParallel(
  tickets: Ticket[],
  executeTicket: (ticket: Ticket) => Promise<TicketExecutionResult>
): Promise<TicketExecutionResult[]> {
  const pending = tickets.filter(t => t.role !== 'qa_engineer')
  const completed = new Set<string>()
  const lockManager = new FileLockManager()
  const results: TicketExecutionResult[] = []

  while (pending.length > 0) {
    const eligible: Ticket[] = []
    const stillPending: Ticket[] = []

    for (const ticket of pending) {
      const depsMet = (ticket.context.depends_on || []).every(dep => completed.has(dep))
      if (!depsMet) {
        stillPending.push(ticket)
        continue
      }

      const files = (ticket.context?.relevant_files || []).map(normalizeFilePath)
      const conflicts = lockManager.getConflicts(files)
      if (conflicts.length > 0) {
        stillPending.push(ticket)
        continue
      }

      eligible.push(ticket)
    }

    pending.length = 0
    pending.push(...stillPending)

    if (eligible.length === 0 && stillPending.length > 0) {
      // Deadlock detection
      const lockedByPending = new Map<string, string[]>()
      for (const t of stillPending) {
        const files = (t.context?.relevant_files || []).map(normalizeFilePath)
        for (const f of files) {
          const conflicts = lockManager.getConflicts([f])
          for (const c of conflicts) {
            if (!lockedByPending.has(c.lockedBy)) lockedByPending.set(c.lockedBy, [])
            lockedByPending.get(c.lockedBy)!.push(t.id)
          }
        }
      }
      throw new Error(
        'File lock deadlock: all pending tickets are blocked by file locks. ' +
        'Please check relevant_files for circular dependencies or overlaps.'
      )
    }

    if (eligible.length > 0) {
      const promises = eligible.map(async ticket => {
        const files = (ticket.context?.relevant_files || []).map(normalizeFilePath)
        lockManager.acquire(ticket.id, files)

        try {
          const result = await executeTicket(ticket)
          results.push(result)
        } finally {
          lockManager.release(ticket.id)
          completed.add(ticket.id)
        }
      })

      await Promise.all(promises)
    }
  }

  return results
}

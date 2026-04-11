import type { EventBus, WorkflowEvent } from '../types.js'

/**
 * Simple EventBus that prints events to the console.
 * Used in CLI mode.
 */
export class ConsoleEventBus implements EventBus {
  async emit(_sessionId: string, event: WorkflowEvent): Promise<void> {
    switch (event.type) {
      case 'session.started':
        console.log(`🚀 Session started: ${event.requirement}`)
        break
      case 'ticket.assigned':
        console.log(`🎫 Ticket assigned [${event.ticket_id}] → ${event.role}`)
        break
      case 'ticket.completed':
        console.log(`✅ Ticket completed [${event.ticket_id}] (${event.changed_files.length} files)`)
        break
      case 'ticket.failed':
        console.log(`❌ Ticket failed [${event.ticket_id}]: ${event.error}`)
        break
      case 'qa.started':
        console.log(`🔍 QA started [${event.ticket_id}]`)
        break
      case 'qa.approved':
        console.log(`🎉 QA approved: ${event.summary}`)
        break
      case 'qa.rejected':
        console.log(`⚠️ QA rejected: ${event.issues.length} issues found`)
        break
      case 'session.completed':
        console.log('🏁 Session completed')
        break
      case 'session.failed':
        console.log(`💥 Session failed: ${event.reason}`)
        break
      default:
        console.log('📡 Event:', (event as any).type)
    }
  }

  subscribe(_sessionId: string, _handler: (event: WorkflowEvent) => void): () => void {
    // Console bus does not support subscriptions
    return () => {}
  }
}

import type { Executor, AgentRuntime, Ticket, AgentEvent, ExecutionResult } from '../types.js'

/**
 * Executor that prepares a workspace directory and delegates execution
 * to the provided AgentRuntime.
 *
 * In the future this can be swapped for a Docker-based or remote executor.
 */
export class LocalProcessExecutor implements Executor {
  private baseDir: string

  constructor(baseDir: string) {
    this.baseDir = baseDir
  }

  async prepareWorkspace(ticketId: string, sourceRepo: string): Promise<string> {
    // TODO: implement workspace preparation (e.g. copy sourceRepo to workspace)
    // For now, return a deterministic path
    const pathModule = await import('path')
    return pathModule.join(this.baseDir, ticketId, 'repo')
  }

  async run(
    ticket: Ticket,
    runtime: AgentRuntime,
    workspacePath: string,
    sourceRepoPath: string,
    onEvent: (event: AgentEvent) => void
  ): Promise<ExecutionResult> {
    // Delegate directly to the runtime
    return runtime.execute(ticket, workspacePath, sourceRepoPath, onEvent)
  }
}

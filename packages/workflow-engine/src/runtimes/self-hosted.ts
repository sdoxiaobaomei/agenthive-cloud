import type { AgentRuntime, Ticket, AgentEvent, ExecutionResult, SessionContext, Plan } from '../types.js'

/**
 * SelfHostedRuntime wraps the existing agents/workers/ logic.
 *
 * It spawns local worker processes (frontend-dev.ts, backend-dev.ts, qa-engineer.ts)
 * via LLMClient HTTP calls. This is the production-ready default when kimi-cli
 * is not available on the server.
 */
export class SelfHostedRuntime implements AgentRuntime {
  name = 'self-hosted'
  private model: string

  constructor(model = 'qwen-coder-plus-latest') {
    this.model = model
  }

  async plan(_requirement: string, _context: SessionContext): Promise<Plan> {
    // TODO: integrate with agents/tools/llm-client.js and shared prompts
    throw new Error('SelfHostedRuntime.plan() not yet implemented. Migrate logic from agents/orchestrator.ts Plan phase.')
  }

  async execute(
    _ticket: Ticket,
    _workspacePath: string,
    _sourceRepoPath: string,
    _onEvent: (event: AgentEvent) => void
  ): Promise<ExecutionResult> {
    // TODO: integrate with agents/workers/_base.ts
    throw new Error('SelfHostedRuntime.execute() not yet implemented. Migrate logic from agents/workers/*.ts.')
  }
}

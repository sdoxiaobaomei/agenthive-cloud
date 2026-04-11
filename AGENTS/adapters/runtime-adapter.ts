import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'
import type {
  AgentRuntime,
  Ticket,
  AgentEvent,
  ExecutionResult,
  SessionContext,
  Plan,
} from '../../packages/workflow-engine/src/types.js'
import { LLMClient } from '../tools/llm-client.js'
import { readFile } from '../tools/file-tools.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WORKSPACE = path.join(__dirname, '..', 'workspace')

export class SelfHostedRuntimeAdapter implements AgentRuntime {
  name = 'self-hosted'
  private llm: LLMClient

  constructor() {
    this.llm = new LLMClient()
  }

  async plan(requirement: string, _context: SessionContext): Promise<Plan> {
    const promptPath = path.join(__dirname, '../shared/prompts/system-orchestrator.md')
    const systemPrompt = await readFile(promptPath)
    return this.llm.chatJson<Plan>([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: requirement },
    ])
  }

  async execute(
    ticket: Ticket,
    _workspacePath: string,
    sourceRepoPath: string,
    _onEvent: (event: AgentEvent) => void
  ): Promise<ExecutionResult> {
    const ticketPath = path.join(WORKSPACE, `${ticket.id}.json`)
    const fs = await import('fs/promises')
    await fs.writeFile(ticketPath, JSON.stringify(ticket, null, 2))

    const workerName =
      ticket.role === 'frontend_dev'
        ? 'frontend-dev.ts'
        : ticket.role === 'backend_dev'
        ? 'backend-dev.ts'
        : ticket.role === 'qa_engineer'
        ? 'qa-engineer.ts'
        : null

    if (!workerName) {
      throw new Error(`Unknown role: ${ticket.role}`)
    }

    await runWorkerLegacy(workerName, ticketPath, sourceRepoPath)

    const result = await readResultLegacy(ticket.id)
    const changed_files = extractChangedFiles(result)

    return {
      ticket_id: ticket.id,
      status: result.status,
      diff: result.diff,
      changed_files,
      llm_output: result.llm_output,
      error: result.error,
    }
  }
}

function runWorkerLegacy(workerName: string, ticketPath: string, sourceRepo: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const workerPath = path.join(__dirname, '..', 'workers', workerName)
    const cmd = process.platform === 'win32' ? 'npx.cmd' : 'npx'
    const child = spawn(cmd, ['tsx', workerPath, ticketPath], {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit',
      env: {
        ...process.env,
        TARGET_REPO: sourceRepo,
      },
    })
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`Worker ${workerName} exited with code ${code}`))
    })
    child.on('error', reject)
  })
}

async function readResultLegacy(ticketId: string): Promise<any> {
  const fs = await import('fs/promises')
  const resultPath = path.join(WORKSPACE, ticketId, 'result.json')
  return JSON.parse(await fs.readFile(resultPath, 'utf-8'))
}

function extractChangedFiles(result: any): string[] {
  const files: string[] = []
  if (result.llm_output?.files_modified) {
    files.push(...result.llm_output.files_modified.map((f: any) => f.path))
  }
  if (result.llm_output?.files_created) {
    files.push(...result.llm_output.files_created.map((f: any) => f.path))
  }
  return [...new Set(files)]
}

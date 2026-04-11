import path from 'path'
import { fileURLToPath } from 'url'
import { LLMClient } from '../tools/llm-client.js'
import { copyDir, readFile, writeFile } from '../tools/file-tools.js'
import { gitDiff, gitStatus } from '../tools/git-tools.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '../..')
const TARGET_REPO = process.env.TARGET_REPO || path.join(ROOT, 'apps')

export interface Ticket {
  id: string
  role: string
  task: string
  context: {
    relevant_files?: string[]
    constraints?: string[]
    depends_on?: string[]
    [key: string]: any
  }
}

export interface WorkerResult {
  ticket_id: string
  role: string
  status: 'success' | 'error'
  diff: string
  git_status: string
  llm_output: any
  error?: string
}

export async function runWorker(
  ticketPath: string,
  promptPath: string,
  processFn: (client: LLMClient, ticket: Ticket, workspaceRepo: string, systemPrompt: string) => Promise<any>,
  sourceRepo: string = TARGET_REPO
): Promise<void> {
  const client = new LLMClient()
  const ticket: Ticket = JSON.parse(await readFile(ticketPath))
  const workspaceDir = path.join(ROOT, 'agents', 'workspace', ticket.id)
  const workspaceRepo = path.join(workspaceDir, 'repo')

  // 1. Prepare workspace
  console.log(`[${ticket.id}] Preparing workspace from ${sourceRepo}...`)
  await copyDir(sourceRepo, workspaceRepo)

  // 2. Load system prompt
  const systemPrompt = await readFile(promptPath)

  // 3. Call LLM
  console.log(`[${ticket.id}] Calling LLM...`)
  let llmOutput: any
  try {
    llmOutput = await processFn(client, ticket, workspaceRepo, systemPrompt)
  } catch (e: any) {
    const result: WorkerResult = {
      ticket_id: ticket.id,
      role: ticket.role,
      status: 'error',
      diff: '',
      git_status: '',
      llm_output: null,
      error: e.message,
    }
    await writeFile(path.join(workspaceDir, 'result.json'), JSON.stringify(result, null, 2))
    console.error(`[${ticket.id}] Error:`, e.message)
    process.exit(1)
  }

  // 4. Generate diff
  const diff = gitDiff(workspaceRepo)
  const status = gitStatus(workspaceRepo)

  const result: WorkerResult = {
    ticket_id: ticket.id,
    role: ticket.role,
    status: 'success',
    diff,
    git_status: status,
    llm_output: llmOutput,
  }

  await writeFile(path.join(workspaceDir, 'result.json'), JSON.stringify(result, null, 2))
  console.log(`[${ticket.id}] Done. Diff ${diff.length} chars.`)
}

export { TARGET_REPO, ROOT }

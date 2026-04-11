#!/usr/bin/env node
import path from 'path'
import { fileURLToPath } from 'url'
import { runWorker } from './_base.js'
import { writeFile } from '../tools/file-tools.js'
import type { LLMClient } from '../tools/llm-client.js'
import type { Ticket } from './_base.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const promptPath = path.join(__dirname, '../shared/prompts/system-backend-dev.md')
const ticketPath = process.argv[2]

if (!ticketPath) {
  console.error('Usage: tsx workers/backend-dev.ts <ticket.json>')
  process.exit(1)
}

interface BEResult {
  reasoning: string
  files_modified: { path: string; content: string }[]
  files_created: { path: string; content: string }[]
  summary: string
}

runWorker(ticketPath, promptPath, async (client, ticket, workspaceRepo, systemPrompt) => {
  const res = await client.chatJson<BEResult>([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: buildUserPrompt(ticket, workspaceRepo) },
  ])

  const allFiles = [...(res.files_modified || []), ...(res.files_created || [])]
  for (const file of allFiles) {
    const dest = path.isAbsolute(file.path)
      ? file.path
      : path.join(workspaceRepo, file.path)
    await writeFile(dest, file.content)
  }

  return res
})

function buildUserPrompt(ticket: Ticket, workspaceRepo: string): string {
  return `## Task\n${ticket.task}\n\n## Constraints\n${(ticket.context.constraints || []).join('\n') || 'None'}`
}

#!/usr/bin/env node
import path from 'path'
import { fileURLToPath } from 'url'
import {
  WorkflowEngine,
  FileSystemStore,
  ConsoleEventBus,
  LocalProcessExecutor,
} from '../packages/workflow-engine/src/index.js'
import { SelfHostedRuntimeAdapter } from './adapters/runtime-adapter.js'
import { initStagingBranch, applyTicketToStaging, syncStagingToMaster } from './tools/git-staging.js'
import type { ExecutionResult } from '../packages/workflow-engine/src/types.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const TARGET_REPO = process.env.TARGET_REPO || path.join(ROOT, 'apps')
const WORKSPACE = path.join(__dirname, 'workspace')

async function main() {
  const args = process.argv.slice(2)
  const resumeIndex = args.indexOf('--resume')
  const resumeSessionId = resumeIndex >= 0 ? args[resumeIndex + 1] : undefined
  const requirement = resumeSessionId ? undefined : args[0]

  if (!requirement && !resumeSessionId) {
    console.error('Usage: npx tsx orchestrator-v2.ts "你的需求"')
    console.error('   or: npx tsx orchestrator-v2.ts --resume <session-id>')
    process.exit(1)
  }

  const runtime = new SelfHostedRuntimeAdapter()
  const store = new FileSystemStore(path.join(WORKSPACE, 'sessions'))
  const eventBus = new ConsoleEventBus()
  const executor = new LocalProcessExecutor(WORKSPACE)

  const engine = new WorkflowEngine({
    runtime,
    store,
    eventBus,
    executor,
    maxRetries: 3,
    async onTicketCompleted(ticket, result) {
      if (result.status === 'success' && result.changed_files.length > 0) {
        const workerRepo = path.join(WORKSPACE, ticket.id, 'repo')
        const changed = await applyTicketToStaging(workerRepo, TARGET_REPO, ticket.id)
        console.log(`   [${ticket.id}] 应用到 staging: ${changed.length} 个文件`)
      }
    },
  })

  console.log('🐕 柴犬装修队开始工作 (v2)...')

  if (resumeSessionId) {
    console.log(`🔄 恢复执行: ${resumeSessionId}`)
    await engine.resumeSession(resumeSessionId)
  } else {
    console.log(`需求: ${requirement}`)
    initStagingBranch(TARGET_REPO)
    const sessionId = await engine.createSession(requirement!)
    console.log(`📋 Session: ${sessionId}`)
    await engine.runSession(sessionId)
  }

  syncStagingToMaster(TARGET_REPO)
  console.log('\n🎉 所有修改已合并到 agenthive-cloud。')
}

main().catch((err) => {
  console.error('💥 Orchestrator error:', err.message)
  process.exit(1)
})

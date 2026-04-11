#!/usr/bin/env node
/**
 * Orchestrator (阿黄 / Tech Lead)
 *
 * 演进版特性：
 * 1. 文件锁：Plan 阶段检测 relevant_files 冲突
 * 2. 并行 Worker：无冲突且依赖满足的任务并行执行
 * 3. 自动修复循环：QA rejected 后自动生成 Fix Ticket 并重新指派
 * 4. TICKET.yaml：支持 Prompt-Replay 和离线恢复
 *
 * Usage:
 *   npx tsx orchestrator.ts "给 agenthive-cloud 的 Dashboard 增加一个导出按钮"
 *   npx tsx orchestrator.ts --resume T001
 */

import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs/promises'
import { LLMClient } from './tools/llm-client.js'
import { readFile, writeFile } from './tools/file-tools.js'
import { initStagingBranch, applyTicketToStaging, syncStagingToMaster } from './tools/git-staging.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const TARGET_REPO = process.env.TARGET_REPO || ROOT
const WORKSPACE = path.join(__dirname, 'workspace')

interface Ticket {
  id: string
  role: 'frontend_dev' | 'backend_dev' | 'qa_engineer'
  task: string
  prompt?: string
  model?: string
  parent_ticket?: string | null
  qa_result?: any | null
  created_at?: string
  retry_count?: number
  changed_files?: string[]
  completed_at?: string
  context: {
    relevant_files?: string[]
    constraints?: string[]
    depends_on?: string[]
    [key: string]: any
  }
}

interface TicketYaml {
  ticket_id: string
  role: 'frontend_dev' | 'backend_dev' | 'qa_engineer'
  task: string
  prompt: string
  model: string
  relevant_files: string[]
  constraints: string[]
  depends_on: string[]
  parent_ticket: string | null
  qa_result: any | null
  created_at: string
  retry_count: number
  changed_files?: string[]
  completed_at?: string
  [key: string]: any
}

interface Plan {
  plan_summary: string
  tickets: Ticket[]
  notes: string
}

interface QAIssue {
  severity: 'critical' | 'warning' | 'suggestion'
  file: string
  line?: number
  description: string
  suggestion: string
}

// ───────────────────────────────────────────────────────────────
// YAML helpers
// ───────────────────────────────────────────────────────────────

async function getYamlModule(): Promise<any> {
  try {
    return await import('js-yaml')
  } catch (e) {
    throw new Error('js-yaml is required but not installed. Please run: npm install js-yaml')
  }
}

function ticketToYaml(ticket: Ticket): TicketYaml {
  const { relevant_files, constraints, depends_on, ...restContext } = ticket.context || {}
  return {
    ticket_id: ticket.id,
    role: ticket.role,
    task: ticket.task,
    prompt: ticket.prompt || '',
    model: ticket.model || 'kimi-cli',
    relevant_files: relevant_files || [],
    constraints: constraints || [],
    depends_on: depends_on || [],
    parent_ticket: ticket.parent_ticket ?? null,
    qa_result: ticket.qa_result ?? null,
    created_at: ticket.created_at || new Date().toISOString(),
    retry_count: ticket.retry_count ?? 0,
    changed_files: ticket.changed_files,
    completed_at: ticket.completed_at,
    ...restContext,
  }
}

function yamlToTicket(yaml: TicketYaml): Ticket {
  const {
    ticket_id,
    role,
    task,
    prompt,
    model,
    relevant_files,
    constraints,
    depends_on,
    parent_ticket,
    qa_result,
    created_at,
    retry_count,
    changed_files,
    completed_at,
    ...extraContext
  } = yaml
  return {
    id: ticket_id,
    role,
    task,
    prompt,
    model,
    parent_ticket,
    qa_result,
    created_at,
    retry_count,
    changed_files,
    completed_at,
    context: {
      relevant_files: relevant_files || [],
      constraints: constraints || [],
      depends_on: depends_on || [],
      ...extraContext,
    },
  }
}

async function loadTicketFromYaml(ticketPath: string): Promise<Ticket> {
  const content = await readFile(ticketPath)
  if (ticketPath.endsWith('.yaml') || ticketPath.endsWith('.yml')) {
    const yaml = await getYamlModule()
    const data = yaml.load(content) as TicketYaml
    return yamlToTicket(data)
  }
  return JSON.parse(content) as Ticket
}

async function saveTicketAsYaml(ticket: Ticket, ticketPath: string): Promise<void> {
  const yaml = await getYamlModule()
  const ticketId = ticket.id || path.basename(ticketPath, path.extname(ticketPath))
  const yamlPath = path.join(WORKSPACE, ticketId, 'TICKET.yaml')
  const data = ticketToYaml(ticket)
  const yamlContent = yaml.dump(data, { sortKeys: false, lineWidth: -1 })
  await writeFile(yamlPath, yamlContent)
}

async function loadAllTicketsFromWorkspace(): Promise<Ticket[]> {
  const tickets: Ticket[] = []
  const entries = await fs.readdir(WORKSPACE, { withFileTypes: true }).catch(() => [] as fs.Dirent[])

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const yamlPath = path.join(WORKSPACE, entry.name, 'TICKET.yaml')
      try {
        const ticket = await loadTicketFromYaml(yamlPath)
        tickets.push(ticket)
        continue
      } catch (e) {
        // ignore missing or invalid YAML
      }
    }

    if (entry.isFile() && entry.name.endsWith('.json')) {
      try {
        const jsonPath = path.join(WORKSPACE, entry.name)
        const ticket = await loadTicketFromYaml(jsonPath)
        tickets.push(ticket)
      } catch (e) {
        // ignore invalid JSON
      }
    }
  }

  return tickets.sort((a, b) => {
    const timeA = a.created_at ? new Date(a.created_at).getTime() : 0
    const timeB = b.created_at ? new Date(b.created_at).getTime() : 0
    return timeA - timeB
  })
}

// ───────────────────────────────────────────────────────────────
// Step 1 & 2: 文件锁 + 并行调度器
// ───────────────────────────────────────────────────────────────

class FileLockManager {
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

function normalizeFilePath(filePath: string): string {
  // 统一去掉 agenthive-cloud/ 前缀，按仓库内相对路径处理
  return filePath.replace(/^agenthive-cloud\//, '').replace(/\\/g, '/')
}

// ───────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2)
  const resumeIndex = args.indexOf('--resume')
  const resumeTicketId = resumeIndex >= 0 ? args[resumeIndex + 1] : process.env.RESUME_TICKET_ID
  const requirement = resumeTicketId ? undefined : args[0]

  if (!requirement && !resumeTicketId) {
    console.error('Usage: npx tsx orchestrator.ts "你的需求"')
    console.error('   or: npx tsx orchestrator.ts --resume <ticket_id>')
    process.exit(1)
  }

  let plan: Plan
  let allTickets: Ticket[]

  if (resumeTicketId) {
    console.log(`🔄 恢复执行: ${resumeTicketId}`)
    allTickets = await loadAllTicketsFromWorkspace()
    const resumedTicket = allTickets.find(t => t.id === resumeTicketId)
    if (!resumedTicket) {
      console.error(`❌ 未找到 Ticket ${resumeTicketId} 的元数据，无法恢复执行`)
      console.error(`   请检查 agents/workspace/${resumeTicketId}/TICKET.yaml 是否存在`)
      process.exit(1)
    }
    console.log(`📋 从 workspace 加载了 ${allTickets.length} 个 Ticket`)
  } else {
    console.log('🐕 柴犬装修队开始工作...')
    console.log(`需求: ${requirement}\n`)

    // 1. Plan
    const client = new LLMClient()
    const promptPath = path.join(__dirname, 'shared/prompts/system-orchestrator.md')
    plan = await client.chatJson<Plan>([
      { role: 'system', content: await readFile(promptPath) },
      { role: 'user', content: requirement! },
    ])

    console.log(`📋 阿黄制定计划: ${plan.plan_summary}`)
    if (plan.notes) {
      console.log(`💡 备注: ${plan.notes}`)
    }

    // Pre-check: 检测 Ticket 之间的文件冲突（在 Plan 阶段给出警告）
    const planLockManager = new FileLockManager()
    for (const ticket of plan.tickets) {
      const files = (ticket.context?.relevant_files || []).map(normalizeFilePath)
      const conflicts = planLockManager.getConflicts(files, ticket.id)
      if (conflicts.length > 0) {
        console.warn(`\n⚠️  Plan 阶段检测到文件冲突: Ticket [${ticket.id}] 与先前 Ticket 冲突`)
        for (const c of conflicts) {
          console.warn(`   文件: ${c.file} (已被 ${c.lockedBy} 占用)`)
        }
        console.warn('   Orchestrator 将在执行阶段通过文件锁自动串行化这些任务。')
      }
      planLockManager.acquire(ticket.id, files)
    }

    // Persist initial TICKET.yaml for all tickets
    for (const ticket of plan.tickets) {
      ticket.prompt = requirement!
      ticket.model = 'kimi-cli'
      ticket.created_at = new Date().toISOString()
      ticket.retry_count = 0
      await saveTicketAsYaml(ticket, path.join(WORKSPACE, `${ticket.id}.json`))
    }

    allTickets = [...plan.tickets]
  }

  // 2. Init staging branch
  console.log('\n📦 初始化 staging branch...')
  initStagingBranch(TARGET_REPO)

  const changedFiles = new Set<string>()
  const ticketToFiles = new Map<string, string[]>()

  // Pre-populate state when resuming
  if (resumeTicketId) {
    for (const ticket of allTickets) {
      if (ticket.changed_files) {
        ticketToFiles.set(ticket.id, ticket.changed_files)
        ticket.changed_files.forEach(f => changedFiles.add(f))
      }
    }
  }

  // Step 4: 自动修复循环
  const maxRetries = 3
  let attempt = 0
  let qaResult: any = null
  let success = false

  while (attempt <= maxRetries && !success) {
    attempt++
    if (attempt > 1) {
      console.log(`\n🔄 自动修复尝试 ${attempt - 1}/${maxRetries}`)
    }

    // 过滤出尚未执行的 Ticket（包括原始 Ticket 和新生成的 Fix Ticket）
    const executionTickets = allTickets.filter(t => t.role !== 'qa_engineer' && !t.completed_at)
    const qaTickets = allTickets.filter(t => t.role === 'qa_engineer')

    if (executionTickets.length > 0) {
      await executeTicketsInParallel(executionTickets, changedFiles, ticketToFiles)
    }

    if (qaTickets.length > 0) {
      // 取最后一个 QA ticket（通常只应该有一个活跃的）
      const qaTicket = qaTickets[qaTickets.length - 1]
      if (qaTicket.qa_result) {
        qaResult = qaTicket.qa_result
      } else {
        qaTicket.context = {
          ...qaTicket.context,
          relevant_files: Array.from(changedFiles).map(f => path.join(TARGET_REPO, f)),
        }
        const qaTicketPath = path.join(WORKSPACE, `${qaTicket.id}.json`)
        await writeFile(qaTicketPath, JSON.stringify(qaTicket, null, 2))
        await runWorker('qa-engineer.ts', qaTicketPath, TARGET_REPO)
        qaResult = await readResult(qaTicket.id)
        qaTicket.qa_result = qaResult
        await saveTicketAsYaml(qaTicket, qaTicketPath)
      }
    } else {
      console.warn('⚠️  没有 QA 审查 Ticket，跳过 QA。')
      break
    }

    if (qaResult?.llm_output?.status === 'approved') {
      console.log('✅ QA 审批通过！')
      console.log(`   ${qaResult.llm_output.review_summary}`)
      success = true
      break
    }

    if (attempt > maxRetries) {
      console.error('\n❌ QA 审批未通过，已达最大自动修复次数。')
      printQAIssues(qaResult)
      process.exit(1)
    }

    // 生成 Fix Tickets
    const fixTickets = generateFixTickets(qaResult, allTickets, ticketToFiles)
    if (fixTickets.length === 0) {
      console.error('\n❌ QA 审批未通过，但无法生成自动修复 Ticket。')
      printQAIssues(qaResult)
      process.exit(1)
    }

    console.log(`\n📝 生成 ${fixTickets.length} 个修复 Ticket，重新调度...`)
    for (const fixTicket of fixTickets) {
      await saveTicketAsYaml(fixTicket, path.join(WORKSPACE, `${fixTicket.id}.json`))
    }
    allTickets.push(...fixTickets)

    // 为 Fix Tickets 追加一个新的 QA Ticket
    const nextQANum = allTickets.filter(t => t.role === 'qa_engineer').length + 1
    const basePrompt = allTickets[0]?.prompt || '自动修复后的QA审查'
    const newQATicket: Ticket = {
      id: `TQA-${nextQANum}`,
      role: 'qa_engineer',
      task: `重新审查修复后的代码（第 ${nextQANum} 轮 QA）`,
      prompt: basePrompt,
      model: 'kimi-cli',
      parent_ticket: null,
      created_at: new Date().toISOString(),
      retry_count: 0,
      context: {
        constraints: ['审查所有修改', '确保之前的问题已修复'],
        depends_on: fixTickets.map(t => t.id),
      },
    }
    await saveTicketAsYaml(newQATicket, path.join(WORKSPACE, `${newQATicket.id}.json`))
    allTickets.push(newQATicket)
  }

  // Finalize
  console.log('\n📤 最终结果:')
  if (success) {
    syncStagingToMaster(TARGET_REPO)
    console.log('\n🎉 所有修改已合并到 agenthive-cloud。')
  } else {
    console.warn('⚠️  没有成功的 QA 审批，未合并到主仓库。')
    process.exit(1)
  }
}

// ───────────────────────────────────────────────────────────────
// Step 2: 并行执行无冲突且依赖满足的 Tickets
// ───────────────────────────────────────────────────────────────

async function executeTicketsInParallel(
  tickets: Ticket[],
  changedFiles: Set<string>,
  ticketToFiles: Map<string, string[]>
): Promise<void> {
  const pending = tickets.filter(t => t.role !== 'qa_engineer')
  const completed = new Set<string>()
  const lockManager = new FileLockManager()

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
        console.log(`⏳ Ticket [${ticket.id}] 等待文件锁释放: ${conflicts.map(c => `${c.file}(${c.lockedBy})`).join(', ')}`)
        stillPending.push(ticket)
        continue
      }

      eligible.push(ticket)
    }

    pending.length = 0
    pending.push(...stillPending)

    if (eligible.length === 0 && stillPending.length > 0) {
      // 死锁检测
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
        '文件锁死锁：所有待执行 Ticket 都被文件锁阻塞。' +
        '请检查 Plan 中的 relevant_files 是否有循环依赖或不合理的重叠。'
      )
    }

    if (eligible.length > 0) {
      console.log(`\n⚡ 并行执行 ${eligible.length} 个 Ticket: [${eligible.map(t => t.id).join(', ')}]`)

      const promises = eligible.map(async ticket => {
        const files = (ticket.context?.relevant_files || []).map(normalizeFilePath)
        lockManager.acquire(ticket.id, files)

        try {
          const ticketPath = path.join(WORKSPACE, `${ticket.id}.json`)
          await writeFile(ticketPath, JSON.stringify(ticket, null, 2))

          if (ticket.role === 'frontend_dev') {
            await runWorker('frontend-dev.ts', ticketPath)
          } else if (ticket.role === 'backend_dev') {
            await runWorker('backend-dev.ts', ticketPath)
          }

          const ticketChanges = await applyWorkerChanges(ticket.id)
          ticketToFiles.set(ticket.id, ticketChanges)
          ticketChanges.forEach(f => changedFiles.add(f))

          // Update TICKET.yaml with completion info
          ticket.changed_files = ticketChanges
          ticket.completed_at = new Date().toISOString()
          await saveTicketAsYaml(ticket, ticketPath)
        } finally {
          lockManager.release(ticket.id)
          completed.add(ticket.id)
        }
      })

      await Promise.all(promises)
    }
  }
}

// ───────────────────────────────────────────────────────────────

function runWorker(workerName: string, ticketPath: string, sourceRepo: string = TARGET_REPO): Promise<void> {
  return new Promise((resolve, reject) => {
    const workerPath = path.join(__dirname, 'workers', workerName)
    const cmd = process.platform === 'win32' ? 'npx.cmd' : 'npx'

    console.log(`   启动 worker: ${workerName} (ticket: ${path.basename(ticketPath)})`)
    const child = spawn(cmd, ['tsx', workerPath, ticketPath], {
      cwd: __dirname,
      stdio: 'inherit',
      env: {
        ...process.env,
        TARGET_REPO: sourceRepo,
      },
    })

    child.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`Worker ${workerName} exited with code ${code} for ${path.basename(ticketPath)}`))
      }
    })

    child.on('error', (err) => {
      reject(err)
    })
  })
}

async function applyWorkerChanges(ticketId: string): Promise<string[]> {
  const workerRepo = path.join(WORKSPACE, ticketId, 'repo')
  const changed = await applyTicketToStaging(workerRepo, TARGET_REPO, ticketId)
  console.log(`   [${ticketId}] 应用到 staging: ${changed.length} 个文件`)
  return changed
}

async function readResult(ticketId: string): Promise<any> {
  const resultPath = path.join(WORKSPACE, ticketId, 'result.json')
  return JSON.parse(await readFile(resultPath))
}

// Step 4: 自动生成 Fix Tickets
function generateFixTickets(qaResult: any, allTickets: Ticket[], ticketToFiles: Map<string, string[]>): Ticket[] {
  const issues: QAIssue[] = qaResult?.llm_output?.issues || []
  if (issues.length === 0) return []

  // 建立文件 -> 原始 Ticket 的映射
  const fileToTicket = new Map<string, string>()
  for (const [ticketId, files] of ticketToFiles.entries()) {
    for (const file of files) {
      fileToTicket.set(file, ticketId)
    }
  }

  // 按原始 Ticket 分组 issues
  const grouped = new Map<string, QAIssue[]>()
  for (const issue of issues) {
    // issue.file 可能是绝对路径，需要转换
    const rawFile = issue.file.replace(/\\/g, '/')
    const relFile = rawFile.includes('agenthive-cloud/')
      ? rawFile.split('agenthive-cloud/').slice(1).join('agenthive-cloud/')
      : rawFile

    const responsibleTicket = fileToTicket.get(relFile) ||
      Array.from(fileToTicket.entries()).find(([f]) => rawFile.endsWith(f))?.[1]

    if (!responsibleTicket) {
      console.warn(`   无法将 issue 映射到具体 Ticket: ${issue.file}`)
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
    const originalTicket = allTickets.find(t => t.id === originalTicketId)
    if (!originalTicket) continue

    const files = [...new Set(ticketIssues.map(i => i.file))]
    fixTickets.push({
      id: `FIX-${originalTicketId}-${idx++}`,
      role: originalTicket.role,
      task: `修复 ${originalTicketId} 引入的问题: ${ticketIssues[0].description}${ticketIssues.length > 1 ? ` 等 ${ticketIssues.length} 项` : ''}`,
      prompt: originalTicket.prompt || '',
      model: originalTicket.model || 'kimi-cli',
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
    })
  }

  return fixTickets
}

function printQAIssues(qaResult: any) {
  console.error(`   ${qaResult?.llm_output?.review_summary || '未知原因'}`)
  if (qaResult?.llm_output?.issues?.length) {
    console.error('\n发现问题:')
    for (const issue of qaResult.llm_output.issues) {
      console.error(`   [${issue.severity}] ${issue.file}:${issue.line || '-'} - ${issue.description}`)
    }
  }
}

main().catch(err => {
  console.error('💥 Orchestrator error:', err.message)
  process.exit(1)
})

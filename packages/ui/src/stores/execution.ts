import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  ExecutionSession,
  ExecutionPlan,
  ExecutionTicket,
  SessionLogEntry,
  QAResult,
  WorkerChecklist,
  WorkerChecklistItem,
  WorkerRole,
  FileConflict,
  TicketStatus,
} from '@agenthive/types'

const STORAGE_KEY = 'agenthive:execution-sessions'

// ───────────────────────────────────────────────────────────────
// 默认 SOP 检查清单
// ───────────────────────────────────────────────────────────────

const defaultChecklists: Record<WorkerRole, WorkerChecklistItem[]> = {
  frontend_dev: [
    { id: 'fe-1', label: '已读取相关文件，确认上下文', required: true, checked: false },
    { id: 'fe-2', label: 'relevant_files 无重叠冲突', required: true, checked: false },
    { id: 'fe-3', label: '使用了正确的 base URL (/app/)', required: true, checked: false, detail: '静态资源、API 路由、路由跳转都要注意 base: "/app/"' },
    { id: 'fe-4', label: 'Element Plus 图标在白名单中', required: true, checked: false, detail: '参考 KNOWLEDGE_BASE/element-plus/icon-whitelist.md' },
    { id: 'fe-5', label: 'watch 在 ref 定义之后', required: true, checked: false },
    { id: 'fe-6', label: '运行过 npm run type-check', required: true, checked: false },
    { id: 'fe-7', label: '运行过 npm run test:unit', required: false, checked: false },
  ],
  backend_dev: [
    { id: 'be-1', label: '已读取相关文件，确认上下文', required: true, checked: false },
    { id: 'be-2', label: '修改的是 workspace staging 而非直接改 target repo', required: true, checked: false, detail: '必须走 agents/workspace/<ticket>/repo/ 路径' },
    { id: 'be-3', label: 'npm run type-check 通过', required: true, checked: false },
    { id: 'be-4', label: 'npm run test:unit 通过', required: false, checked: false },
  ],
  qa_engineer: [
    { id: 'qa-1', label: '已拉取 staging 最新代码', required: true, checked: false },
    { id: 'qa-2', label: '运行 npm run type-check', required: true, checked: false },
    { id: 'qa-3', label: '运行 npm run test:unit', required: true, checked: false },
    { id: 'qa-4', label: 'LLM Review 结合测试输出综合判断', required: true, checked: false },
    { id: 'qa-5', label: '若测试失败，强制拒绝（覆盖 LLM 的 approved）', required: true, checked: false },
  ],
  orchestrator: [
    { id: 'tl-1', label: '拆 Ticket 时 relevant_files 尽量互不重叠', required: true, checked: false },
    { id: 'tl-2', label: '依赖关系 (depends_on) 已正确声明', required: true, checked: false },
    { id: 'tl-3', label: 'Plan 前已检查 git 状态与当前分支', required: true, checked: false },
    { id: 'tl-4', label: 'QA 通过后同步回 target repo 并 git commit', required: true, checked: false },
  ],
}

// ───────────────────────────────────────────────────────────────
// Helper functions
// ───────────────────────────────────────────────────────────────

function generateId(prefix = 'id'): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`
}

function now(): string {
  return new Date().toISOString()
}

function loadSessions(): ExecutionSession[] {
  // SSR guard: localStorage only available in browser
  if (typeof window === 'undefined' || !window.localStorage) {
    return []
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const sessions: ExecutionSession[] = raw ? JSON.parse(raw) : []
    // 归一化 order 字段
    sessions.forEach(s => {
      s.plan.tickets.forEach((t, idx) => {
        if (typeof t.order !== 'number') t.order = idx
      })
    })
    return sessions
  } catch {
    return []
  }
}

function saveSessions(sessions: ExecutionSession[]) {
  // SSR guard: localStorage only available in browser
  if (typeof window === 'undefined' || !window.localStorage) {
    return
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions))
  } catch {
    // ignore
  }
}

// ───────────────────────────────────────────────────────────────
// Store
// ───────────────────────────────────────────────────────────────

export const useExecutionStore = defineStore('execution', () => {
  // State - lazy load to avoid SSR issues
  const sessions = ref<ExecutionSession[]>([])
  const currentSessionId = ref<string | null>(null)
  
  // Load sessions on client only
  const isLoaded = ref(false)
  function ensureLoaded() {
    if (!isLoaded.value && typeof window !== 'undefined') {
      sessions.value = loadSessions()
      isLoaded.value = true
    }
  }

  // Getters
  const currentSession = computed(() =>
    sessions.value.find(s => s.id === currentSessionId.value) || null
  )

  const currentTickets = computed(() => currentSession.value?.plan.tickets || [])

  const ticketsByStatus = computed(() => {
    const map: Record<string, ExecutionTicket[]> = {
      pending: [],
      doing: [],
      review: [],
      done: [],
      failed: [],
    }
    currentTickets.value.forEach(t => {
      map[t.status].push(t)
    })
    Object.keys(map).forEach(k => {
      map[k].sort((a, b) => (a.order || 0) - (b.order || 0))
    })
    return map
  })

  const activeTicket = computed(() => {
    if (!currentSession.value) return null
    const id = currentSession.value.activeTicketId
    return currentSession.value.plan.tickets.find(t => t.id === id) || null
  })

  const canStartTicket = computed(() => {
    if (!activeTicket.value) return false
    const t = activeTicket.value
    if (t.status !== 'pending') return false
    // 依赖必须都 done
    const deps = t.context.depends_on || []
    const doneIds = new Set(
      currentTickets.value.filter(x => x.status === 'done').map(x => x.id)
    )
    return deps.every(d => doneIds.has(d))
  })

  const fileConflictsForActiveTicket = computed(() => {
    if (!activeTicket.value) return []
    const files = activeTicket.value.context.relevant_files || []
    const doingFiles = new Map<string, string>()
    currentTickets.value
      .filter(t => t.status === 'doing' && t.id !== activeTicket.value!.id)
      .forEach(t => {
        t.context.relevant_files?.forEach(f => doingFiles.set(f, t.id))
      })
    const conflicts: FileConflict[] = []
    files.forEach(f => {
      const lockedBy = doingFiles.get(f)
      if (lockedBy) conflicts.push({ file: f, lockedBy })
    })
    return conflicts
  })

  // Actions

  function createSession(plan: Omit<ExecutionPlan, 'id' | 'createdAt'>): ExecutionSession {
    ensureLoaded()
    const ticketsWithOrder = plan.tickets.map((t, idx) => ({ ...t, order: typeof t.order === 'number' ? t.order : idx }))
    const session: ExecutionSession = {
      id: generateId('session'),
      name: plan.name || `Session ${sessions.value.length + 1}`,
      plan: {
        ...plan,
        tickets: ticketsWithOrder,
        id: generateId('plan'),
        createdAt: now(),
      },
      logs: [
        {
          id: generateId('log'),
          timestamp: now(),
          level: 'info',
          actor: 'orchestrator',
          actorName: '阿黄',
          message: `创建执行会话: ${plan.summary}`,
        },
      ],
      isCompleted: false,
      createdAt: now(),
      updatedAt: now(),
    }
    sessions.value.unshift(session)
    currentSessionId.value = session.id
    saveSessions(sessions.value)
    return session
  }

  function setActiveTicket(ticketId: string | null) {
    ensureLoaded()
    if (!currentSession.value) return
    currentSession.value.activeTicketId = ticketId ?? undefined
    currentSession.value.updatedAt = now()
    saveSessions(sessions.value)
  }

  function updateTicketStatus(ticketId: string, status: ExecutionTicket['status']) {
    ensureLoaded()
    const ticket = currentTickets.value.find(t => t.id === ticketId)
    if (!ticket) return
    ticket.status = status
    if (status === 'doing' && !ticket.startedAt) ticket.startedAt = now()
    if (['done', 'failed', 'review'].includes(status)) ticket.completedAt = now()

    addLog({
      level: status === 'failed' ? 'error' : 'info',
      actor: ticket.role,
      actorName: roleToName(ticket.role),
      message: `Ticket [${ticket.id}] 状态变更为 ${status}`,
      ticketId,
    })
    saveSessions(sessions.value)
  }

  function setTicketQAResult(ticketId: string, result: QAResult) {
    ensureLoaded()
    const ticket = currentTickets.value.find(t => t.id === ticketId)
    if (!ticket) return
    ticket.qaResult = result
    addLog({
      level: result.status === 'approved' ? 'success' : 'warn',
      actor: 'qa_engineer',
      actorName: '阿镜',
      message: `QA 结果: ${result.status} — ${result.review_summary}`,
      ticketId,
    })
    saveSessions(sessions.value)
  }

  function addFixTickets(originalTicketId: string, fixTickets: Omit<ExecutionTicket, 'id' | 'createdAt'>[]) {
    ensureLoaded()
    if (!currentSession.value) return
    const newTickets = fixTickets.map(t => ({
      ...t,
      id: generateId('fix'),
      createdAt: now(),
      fixForTicketId: originalTicketId,
      retryCount: (currentTickets.value.find(x => x.id === originalTicketId)?.retryCount || 0) + 1,
    }))
    currentSession.value.plan.tickets.push(...newTickets)
    addLog({
      level: 'warn',
      actor: 'orchestrator',
      actorName: '阿黄',
      message: `为 [${originalTicketId}] 生成 ${newTickets.length} 个 FIX Ticket`,
    })
    saveSessions(sessions.value)
  }

  function addLog(entry: Omit<SessionLogEntry, 'id' | 'timestamp'>) {
    ensureLoaded()
    if (!currentSession.value) return
    currentSession.value.logs.push({
      ...entry,
      id: generateId('log'),
      timestamp: now(),
    })
    currentSession.value.updatedAt = now()
    saveSessions(sessions.value)
  }

  function setTicketChangedFiles(ticketId: string, files: string[]) {
    ensureLoaded()
    const ticket = currentTickets.value.find(t => t.id === ticketId)
    if (ticket) {
      ticket.changedFiles = files
      saveSessions(sessions.value)
    }
  }

  function setFileConflicts(ticketId: string, conflicts: FileConflict[]) {
    ensureLoaded()
    const ticket = currentTickets.value.find(t => t.id === ticketId)
    if (ticket) {
      ticket.fileConflicts = conflicts
      saveSessions(sessions.value)
    }
  }

  function reorderTicketWithinColumn(ticketId: string, newIndex: number, columnStatus: TicketStatus) {
    ensureLoaded()
    if (!currentSession.value) return
    const ticketsInColumn = currentSession.value.plan.tickets.filter(t => t.status === columnStatus)
    const ticket = ticketsInColumn.find(t => t.id === ticketId)
    if (!ticket) return

    // 移除当前 ticket
    const others = ticketsInColumn.filter(t => t.id !== ticketId)
    // 插入到新位置
    others.splice(newIndex, 0, ticket)
    // 重新分配 order（步长 10，留间隙）
    others.forEach((t, idx) => {
      t.order = idx * 10
    })

    saveSessions(sessions.value)
  }

  function completeSession() {
    ensureLoaded()
    if (!currentSession.value) return
    currentSession.value.isCompleted = true
    currentSession.value.updatedAt = now()
    addLog({
      level: 'success',
      actor: 'orchestrator',
      actorName: '阿黄',
      message: '会话执行完毕，所有修改已合并到 target repo',
    })
    saveSessions(sessions.value)
  }

  function deleteSession(sessionId: string) {
    ensureLoaded()
    sessions.value = sessions.value.filter(s => s.id !== sessionId)
    if (currentSessionId.value === sessionId) {
      currentSessionId.value = sessions.value[0]?.id || null
    }
    saveSessions(sessions.value)
  }

  function exportSessionMarkdown(sessionId?: string): string {
    const s = sessions.value.find(x => x.id === (sessionId || currentSessionId.value))
    if (!s) return ''

    const lines: string[] = [
      `# Way A 执行记录: ${s.name}`,
      ``,
      `> Plan: ${s.plan.summary}`,
      `> 时间: ${s.createdAt}`,
      ``,
      `## Tickets`,
      ``,
      ...s.plan.tickets.map(t => {
        const changed = t.changedFiles?.length ? ` (修改: ${t.changedFiles.join(', ')})` : ''
        return `- [${t.status}] **${t.id}** | ${t.role} | ${t.task}${changed}`
      }),
      ``,
      `## 执行日志`,
      ``,
      ...s.logs.map(l => `- **${l.actorName}** [${l.level}] ${l.message}`),
      ``,
      `## QA 结果`,
      ``,
      ...s.plan.tickets
        .filter(t => t.qaResult)
        .map(t => {
          const r = t.qaResult!
          const issues = r.issues.map(i => `  - [${i.severity}] ${i.file}: ${i.description}`).join('\n')
          return `- **${t.id}**: ${r.status}\n${issues}`
        }),
      ``,
      `---`,
      `_导出时间: ${now()}_`,
    ]

    return lines.join('\n')
  }

  return {
    sessions,
    currentSessionId,
    currentSession,
    currentTickets,
    ticketsByStatus,
    activeTicket,
    canStartTicket,
    fileConflictsForActiveTicket,
    createSession,
    setActiveTicket,
    updateTicketStatus,
    setTicketQAResult,
    addFixTickets,
    addLog,
    setTicketChangedFiles,
    setFileConflicts,
    reorderTicketWithinColumn,
    completeSession,
    deleteSession,
    exportSessionMarkdown,
  }
})

// ───────────────────────────────────────────────────────────────
// Utilities
// ───────────────────────────────────────────────────────────────

export function roleToName(role: WorkerRole): string {
  const map: Record<WorkerRole, string> = {
    frontend_dev: '小花',
    backend_dev: '阿铁',
    qa_engineer: '阿镜',
    orchestrator: '阿黄',
  }
  return map[role]
}

export function getDefaultChecklist(role: WorkerRole): WorkerChecklist {
  return {
    role,
    items: defaultChecklists[role].map(item => ({ ...item })),
  }
}

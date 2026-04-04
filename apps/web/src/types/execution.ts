/**
 * Way A 执行控制台 (Execution HUD) 类型定义
 * 与 agents/orchestrator.ts 概念对齐
 */

// ───────────────────────────────────────────────────────────────
// 基础枚举
// ───────────────────────────────────────────────────────────────

export type WorkerRole =
  | 'frontend_dev'
  | 'backend_dev'
  | 'qa_engineer'
  | 'orchestrator'

export type TicketStatus =
  | 'pending'    // 等待依赖满足 / 文件锁释放
  | 'doing'      // 正在执行
  | 'review'     // 待 QA 审查
  | 'done'       // 已完成
  | 'failed'     // 执行失败或 QA 未通过且重试耗尽

export type LogLevel = 'info' | 'warn' | 'error' | 'success'

// ───────────────────────────────────────────────────────────────
// Ticket 与 Plan
// ───────────────────────────────────────────────────────────────

export interface ExecutionTicket {
  id: string
  role: WorkerRole
  task: string
  status: TicketStatus
  context: {
    relevant_files?: string[]
    constraints?: string[]
    depends_on?: string[]
    [key: string]: any
  }
  /** 该 Ticket 实际修改过的文件（执行后填充） */
  changedFiles?: string[]
  /** 文件锁冲突信息（预检时填充） */
  fileConflicts?: FileConflict[]
  /** QA 结果 */
  qaResult?: QAResult
  /** 若是 FIX ticket，指向原始 ticket id */
  fixForTicketId?: string
  /** 自动修复重试次数记录 */
  retryCount?: number
  /** 执行开始/结束时间 */
  startedAt?: string
  completedAt?: string
  /** 同列排序权重 */
  order?: number
  createdAt: string
}

export interface FileConflict {
  file: string
  lockedBy: string
}

export interface ExecutionPlan {
  id: string
  name: string
  summary: string
  notes?: string
  tickets: ExecutionTicket[]
  createdAt: string
}

// ───────────────────────────────────────────────────────────────
// QA 相关
// ───────────────────────────────────────────────────────────────

export type QASeverity = 'critical' | 'warning' | 'suggestion'
export type QAStatus = 'approved' | 'rejected' | 'pending'

export interface QAIssue {
  severity: QASeverity
  file: string
  line?: number
  description: string
  suggestion: string
}

export interface QAResult {
  status: QAStatus
  review_summary: string
  issues: QAIssue[]
  testOutput?: string      // type-check / test:unit 的原始输出
  createdAt: string
}

// ───────────────────────────────────────────────────────────────
// Worker 执行检查清单 (SOP 交互式约束)
// ───────────────────────────────────────────────────────────────

export interface WorkerChecklistItem {
  id: string
  label: string
  /** 更详细的提示，点击可展开 */
  detail?: string
  /** 是否必填 */
  required: boolean
  /** 是否已勾选 */
  checked: boolean
}

export interface WorkerChecklist {
  role: WorkerRole
  items: WorkerChecklistItem[]
}

// ───────────────────────────────────────────────────────────────
// Session 日志 (时间轴)
// ───────────────────────────────────────────────────────────────

export interface SessionLogEntry {
  id: string
  timestamp: string
  level: LogLevel
  actor: WorkerRole | 'system'
  actorName?: string        // e.g. "阿黄", "小花", "阿铁", "阿镜"
  message: string
  /** 关联的 ticket id */
  ticketId?: string
  /** 附加数据，如文件路径、diff 摘要 */
  metadata?: Record<string, unknown>
}

// ───────────────────────────────────────────────────────────────
// 执行会话 (Session)
// ───────────────────────────────────────────────────────────────

export interface ExecutionSession {
  id: string
  name: string
  plan: ExecutionPlan
  /** 当前活跃 ticket id（前端选中态） */
  activeTicketId?: string
  /** 日志时间轴 */
  logs: SessionLogEntry[]
  /** 执行是否已结束 */
  isCompleted: boolean
  createdAt: string
  updatedAt: string
}

// ───────────────────────────────────────────────────────────────
// UI 状态扩展
// ───────────────────────────────────────────────────────────────

export interface ExecutionUIState {
  /** 看板过滤条件 */
  boardFilter: 'all' | WorkerRole
  /** 是否显示已完成 ticket */
  showDone: boolean
  /** 日志面板是否展开 */
  logPanelExpanded: boolean
  /** 当前打开的侧边栏 tab */
  detailTab: 'checklist' | 'qa' | 'diff' | 'log'
}

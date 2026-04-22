<template>
  <div class="ticket-detail-panel">
    <div v-if="!ticket" class="detail-empty">
      <el-empty description="在左侧看板选择一个 Ticket 查看详情" :image-size="80" />
    </div>

    <template v-else>
      <!-- Header -->
      <div class="detail-header">
        <div class="detail-actor">
          <AgentAvatar :role="avatarRole" :size="36" />
          <div>
            <div class="detail-id">{{ ticket.id }}</div>
            <div class="detail-role">{{ roleLabel }} · {{ actorName }}</div>
          </div>
        </div>
        <el-tag :type="statusTagType" size="small">{{ statusLabel }}</el-tag>
      </div>

      <div class="detail-task">{{ ticket.task }}</div>

      <!-- 文件冲突 -->
      <div v-if="conflicts.length" class="detail-conflicts">
        <el-alert
          title="文件锁冲突"
          :description="conflictDesc"
          type="error"
          :closable="false"
          show-icon
        />
      </div>

      <!-- 操作按钮 -->
      <div class="detail-actions">
        <el-button
          v-if="ticket.status === 'pending'"
          type="primary"
          size="small"
          :disabled="!canStart"
          @click="startTicket"
        >
          开始执行
        </el-button>
        <el-button
          v-if="ticket.status === 'doing'"
          type="success"
          size="small"
          @click="completeTicket"
        >
          标记完成
        </el-button>
        <el-button
          v-if="ticket.status === 'doing' && ticket.role !== 'qa_engineer'"
          size="small"
          @click="toReview"
        >
          提交 QA
        </el-button>
        <el-button
          v-if="ticket.status === 'review' && ticket.role === 'qa_engineer'"
          type="warning"
          size="small"
          @click="openQADialog"
        >
          录入 QA 结果
        </el-button>
      </div>

      <!-- 检查清单 -->
      <div class="detail-section">
        <div class="section-title">SOP 检查清单</div>
        <div class="checklist">
          <label
            v-for="item in checklist"
            :key="item.id"
            class="checklist-item"
            :class="{ required: item.required }"
          >
            <el-checkbox v-model="item.checked" :disabled="ticket.status === 'done' || ticket.status === 'failed'">
              <span :class="{ checked: item.checked }">{{ item.label }}</span>
            </el-checkbox>
            <el-tooltip v-if="item.detail" :content="item.detail" placement="top">
              <el-icon class="checklist-tip"><QuestionFilled /></el-icon>
            </el-tooltip>
          </label>
        </div>
      </div>

      <!-- 相关文件 -->
      <div v-if="files.length" class="detail-section">
        <div class="section-title">相关文件</div>
        <div class="file-list">
          <div v-for="f in files" :key="f" class="file-item">
            <el-icon><Document /></el-icon>
            <span class="file-name">{{ f }}</span>
          </div>
        </div>
      </div>

      <!-- 依赖 -->
      <div v-if="deps.length" class="detail-section">
        <div class="section-title">依赖 Ticket</div>
        <div class="dep-list">
          <el-tag v-for="d in deps" :key="d" size="small" type="info">{{ d }}</el-tag>
        </div>
      </div>

      <!-- QA 结果 -->
      <div v-if="ticket.qaResult" class="detail-section">
        <div class="section-title">QA 结果</div>
        <el-alert
          :title="ticket.qaResult.status === 'approved' ? 'QA 通过' : 'QA 未通过'"
          :type="ticket.qaResult.status === 'approved' ? 'success' : 'error'"
          :closable="false"
          show-icon
        />
        <div class="qa-summary">{{ ticket.qaResult.review_summary }}</div>
        <div v-if="ticket.qaResult.issues.length" class="qa-issues">
          <div v-for="(issue, idx) in ticket.qaResult.issues" :key="idx" class="qa-issue">
            <el-tag :type="issueSeverityType(issue.severity)" size="small">{{ issue.severity }}</el-tag>
            <span class="issue-file">{{ issue.file }}</span>
            <p class="issue-desc">{{ issue.description }}</p>
          </div>
        </div>
      </div>

      <!-- 日志摘要 -->
      <div class="detail-section">
        <div class="section-title">最近日志</div>
        <div class="mini-logs">
          <div
            v-for="log in recentLogs"
            :key="log.id"
            class="mini-log"
            :class="`log-${log.level}`"
          >
            <span class="log-time">{{ formatTime(log.timestamp) }}</span>
            <span class="log-actor">{{ log.actorName }}</span>
            <span class="log-msg">{{ log.message }}</span>
          </div>
          <div v-if="!recentLogs.length" class="no-logs">暂无日志</div>
        </div>
      </div>

      <!-- Log Stream -->
      <div class="detail-section">
        <el-collapse v-model="logStreamExpanded">
          <el-collapse-item name="log-stream">
            <template #title>
              <span class="section-title" style="margin-bottom: 0;">Log Stream</span>
            </template>
            <div ref="logStreamRef" class="log-stream">
              <div
                v-for="log in ticketLogs"
                :key="log.id"
                class="log-stream-item"
              >
                <span class="log-stream-time">{{ formatTime(log.timestamp) }}</span>
                <el-tag :type="logLevelTagType(log.level)" size="small" class="log-stream-level">{{ log.level }}</el-tag>
                <span class="log-stream-msg">{{ log.message }}</span>
              </div>
              <div v-if="!ticketLogs.length" class="no-logs">暂无日志</div>
            </div>
          </el-collapse-item>
        </el-collapse>
      </div>
    </template>

    <!-- QA Dialog -->
    <el-dialog v-model="qaDialogVisible" title="录入 QA 结果" width="520px">
      <el-form label-position="top">
        <el-form-item label="总体结论">
          <el-radio-group v-model="qaForm.status">
            <el-radio label="approved">通过</el-radio>
            <el-radio label="rejected">拒绝</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="Review 摘要">
          <el-input v-model="qaForm.review_summary" type="textarea" :rows="2" />
        </el-form-item>
        <el-form-item label="Issues">
          <div v-for="(issue, idx) in qaForm.issues" :key="idx" class="qa-issue-row">
            <el-select v-model="issue.severity" size="small" style="width: 100px">
              <el-option label="critical" value="critical" />
              <el-option label="warning" value="warning" />
              <el-option label="suggestion" value="suggestion" />
            </el-select>
            <el-input v-model="issue.file" size="small" placeholder="文件" style="width: 120px" />
            <el-input v-model="issue.description" size="small" placeholder="描述" style="flex: 1" />
            <el-button size="small" type="danger" text @click="removeIssue(idx)">删</el-button>
          </div>
          <el-button size="small" type="primary" text @click="addIssue">+ 添加 Issue</el-button>
        </el-form-item>
        <el-form-item label="测试输出 (可选)">
          <el-input v-model="qaForm.testOutput" type="textarea" :rows="3" placeholder="type-check / test:unit 的输出" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button size="small" @click="qaDialogVisible = false">取消</el-button>
        <el-button size="small" type="primary" @click="submitQA">提交</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import type { ExecutionTicket, WorkerRole, QAResult, LogLevel } from '@agenthive/types'
import { useExecutionStore, roleToName, getDefaultChecklist } from '../../stores/execution'
import AgentAvatar from '../atoms/AgentAvatar.vue'
import { QuestionFilled, Document } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

const props = defineProps<{
  ticket: ExecutionTicket | null
}>()

const store = useExecutionStore()

const avatarRole = computed(() => {
  const map: Record<WorkerRole, any> = {
    frontend_dev: 'frontend_dev',
    backend_dev: 'backend_dev',
    qa_engineer: 'qa_engineer',
    orchestrator: 'tech_lead',
  }
  return props.ticket ? map[props.ticket.role] : undefined
})

const actorName = computed(() => props.ticket ? roleToName(props.ticket.role) : '')

const roleLabel = computed(() => {
  const map: Record<WorkerRole, string> = {
    frontend_dev: '前端开发',
    backend_dev: '后端开发',
    qa_engineer: 'QA',
    orchestrator: 'Orchestrator',
  }
  return props.ticket ? map[props.ticket.role] : ''
})

const statusLabel = computed(() => {
  const map: Record<string, string> = {
    pending: '待执行', doing: '进行中', review: '待审查', done: '已完成', failed: '失败',
  }
  return props.ticket ? (map[props.ticket.status] || props.ticket.status) : ''
})

const statusTagType = computed(() => {
  const map: Record<string, any> = {
    pending: 'info', doing: 'warning', review: '', done: 'success', failed: 'danger',
  }
  return props.ticket ? map[props.ticket.status] : 'info'
})

const conflicts = computed(() => {
  if (!props.ticket) return []
  return props.ticket.fileConflicts || []
})

const conflictDesc = computed(() => {
  return conflicts.value.map(c => `${c.file} 被 ${c.lockedBy} 占用`).join('；')
})

const files = computed(() => props.ticket?.context.relevant_files || [])
const deps = computed(() => props.ticket?.context.depends_on || [])

const canStart = computed(() => {
  if (!props.ticket) return false
  if (props.ticket.status !== 'pending') return false
  const depsList = props.ticket.context.depends_on || []
  const doneIds = new Set(store.currentTickets.filter(t => t.status === 'done').map(t => t.id))
  return depsList.every(d => doneIds.has(d))
})

const recentLogs = computed(() => {
  if (!props.ticket || !store.currentSession) return []
  return store.currentSession.logs
    .filter(l => l.ticketId === props.ticket!.id)
    .slice(-5)
    .reverse()
})

const ticketLogs = computed(() => {
  if (!props.ticket || !store.currentSession) return []
  return store.currentSession.logs.filter(l => l.ticketId === props.ticket!.id)
})

const logStreamExpanded = ref<string[]>(['log-stream'])
const logStreamRef = ref<HTMLElement | null>(null)

watch(ticketLogs, async () => {
  await nextTick()
  if (logStreamRef.value && logStreamExpanded.value.includes('log-stream')) {
    logStreamRef.value.scrollTop = logStreamRef.value.scrollHeight
  }
}, { deep: true })

function formatTime(iso: string) {
  const d = new Date(iso)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`
}

function issueSeverityType(s: string) {
  const map: Record<string, any> = { critical: 'danger', warning: 'warning', suggestion: 'info' }
  return map[s] || 'info'
}

function logLevelTagType(level: LogLevel): string {
  const map: Record<LogLevel, string> = {
    info: 'info',
    warn: 'warning',
    error: 'danger',
    success: 'success',
  }
  return map[level] || 'info'
}

// Checklist (local state per ticket)
const checklist = ref(getDefaultChecklist('orchestrator').items)

watch(() => props.ticket?.id, (id) => {
  if (id && props.ticket) {
    const saved = localStorage.getItem(`checklist:${id}`)
    if (saved) {
      checklist.value = JSON.parse(saved)
    } else {
      checklist.value = getDefaultChecklist(props.ticket.role).items.map(i => ({ ...i }))
    }
  }
}, { immediate: true })

watch(checklist, (val) => {
  if (props.ticket) {
    localStorage.setItem(`checklist:${props.ticket.id}`, JSON.stringify(val))
  }
}, { deep: true })

// Actions
function startTicket() {
  if (!props.ticket) return
  store.updateTicketStatus(props.ticket.id, 'doing')
  ElMessage.success(`Ticket ${props.ticket.id} 开始执行`)
}

function completeTicket() {
  if (!props.ticket) return
  store.updateTicketStatus(props.ticket.id, 'done')
}

function toReview() {
  if (!props.ticket) return
  store.updateTicketStatus(props.ticket.id, 'review')
}

// QA Dialog
const qaDialogVisible = ref(false)
const qaForm = ref<Omit<QAResult, 'createdAt'>>({
  status: 'approved',
  review_summary: '',
  issues: [],
  testOutput: '',
})

function openQADialog() {
  if (props.ticket?.qaResult) {
    qaForm.value = {
      status: props.ticket.qaResult.status,
      review_summary: props.ticket.qaResult.review_summary,
      issues: props.ticket.qaResult.issues.map(i => ({ ...i })),
      testOutput: props.ticket.qaResult.testOutput || '',
    }
  } else {
    qaForm.value = { status: 'approved', review_summary: '', issues: [], testOutput: '' }
  }
  qaDialogVisible.value = true
}

function addIssue() {
  qaForm.value.issues.push({ severity: 'warning', file: '', description: '', suggestion: '' })
}

function removeIssue(idx: number) {
  qaForm.value.issues.splice(idx, 1)
}

function submitQA() {
  if (!props.ticket) return
  const result: QAResult = {
    ...qaForm.value,
    createdAt: new Date().toISOString(),
  }
  store.setTicketQAResult(props.ticket.id, result)
  qaDialogVisible.value = false
  ElMessage.success('QA 结果已录入')
}
</script>

<style scoped>
.ticket-detail-panel {
  height: 100%;
  overflow-y: auto;
  padding: 12px;
}
.detail-empty {
  padding-top: 40px;
}
.detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.detail-actor {
  display: flex;
  align-items: center;
  gap: 10px;
}
.detail-id {
  font-weight: 600;
  font-size: 14px;
}
.detail-role {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.detail-task {
  font-size: 13px;
  color: var(--el-text-color-primary);
  line-height: 1.5;
  margin-bottom: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.detail-conflicts {
  margin-bottom: 12px;
}
.detail-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}
.detail-section {
  margin-bottom: 14px;
}
.section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-regular);
  margin-bottom: 8px;
}
.checklist {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.checklist-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}
.checklist-item.required :deep(.el-checkbox__label) {
  font-weight: 500;
}
.checklist-item .checked {
  color: var(--el-text-color-secondary);
  text-decoration: line-through;
}
.checklist-tip {
  color: var(--el-color-info);
  cursor: help;
}
.file-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.file-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--el-text-color-secondary);
  word-break: break-all;
}
.dep-list {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.qa-summary {
  font-size: 12px;
  color: var(--el-text-color-regular);
  margin-top: 8px;
}
.qa-issues {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.qa-issue {
  background: var(--el-fill-color-lighter);
  border-radius: 6px;
  padding: 8px;
  font-size: 12px;
}
.issue-file {
  margin-left: 6px;
  color: var(--el-text-color-secondary);
}
.issue-desc {
  margin: 4px 0 0;
  color: var(--el-text-color-primary);
}
.mini-logs {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.mini-log {
  font-size: 11px;
  line-height: 1.4;
  padding: 4px 6px;
  border-radius: 4px;
  background: var(--el-fill-color-lighter);
}
.log-info { border-left: 3px solid var(--el-color-info); }
.log-success { border-left: 3px solid var(--el-color-success); }
.log-warn { border-left: 3px solid var(--el-color-warning); }
.log-error { border-left: 3px solid var(--el-color-danger); }
.log-time { color: var(--el-text-color-secondary); margin-right: 6px; }
.log-actor { font-weight: 500; margin-right: 6px; }
.no-logs {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  text-align: center;
  padding: 8px;
}
.qa-issue-row {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 6px;
}
.log-stream {
  max-height: 200px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  background: var(--el-fill-color-lighter);
  border-radius: 6px;
}
.log-stream-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 11px;
  line-height: 1.4;
}
.log-stream-time {
  color: var(--el-text-color-secondary);
  white-space: nowrap;
  font-family: monospace;
}
.log-stream-level {
  flex-shrink: 0;
}
.log-stream-msg {
  color: var(--el-text-color-primary);
  word-break: break-all;
}
</style>

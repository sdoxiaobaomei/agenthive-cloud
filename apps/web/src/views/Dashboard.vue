<template>
  <div class="dashboard-page">
    <div class="page-header">
      <div>
        <h1 class="page-title">仪表板</h1>
        <p class="page-subtitle">实时监控您的 AI Agent 团队状态</p>
      </div>
      <div class="header-actions">
        <el-tooltip content="自动刷新" placement="bottom">
          <el-switch
            v-model="autoRefresh"
            active-text="自动"
            class="auto-refresh-switch"
          />
        </el-tooltip>
        <el-button :icon="Refresh" @click="refreshData" :loading="loading">
          刷新
        </el-button>
        <el-button type="primary" :icon="Plus" @click="showCreateDialog = true">
          新建 Agent
        </el-button>
      </div>
    </div>
    
    <!-- 错误提示 -->
    <el-alert
      v-if="error"
      :title="error"
      type="error"
      closable
      @close="clearError"
      class="error-alert"
    />
    
    <!-- 统计卡片 -->
    <div class="stats-grid">
      <el-card class="stat-card" shadow="hover" @click="navigateTo('/agents')">
        <div class="stat-content">
          <div class="stat-icon working">
            <el-icon :size="28"><Loading class="animate-spin" /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ activeAgents.length }}</div>
            <div class="stat-label">工作中</div>
          </div>
        </div>
        <el-progress 
          :percentage="activeAgentsPercentage" 
          :show-text="false"
          :stroke-width="4"
          class="stat-progress"
        />
      </el-card>
      
      <el-card class="stat-card" shadow="hover" @click="navigateTo('/agents')">
        <div class="stat-content">
          <div class="stat-icon idle">
            <el-icon :size="28"><Timer /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ idleAgents.length }}</div>
            <div class="stat-label">空闲</div>
          </div>
        </div>
        <el-progress 
          :percentage="idleAgentsPercentage" 
          :show-text="false"
          :stroke-width="4"
          status="success"
          class="stat-progress"
        />
      </el-card>
      
      <el-card class="stat-card" shadow="hover" @click="navigateTo('/agents')">
        <div class="stat-content">
          <div class="stat-icon error">
            <el-icon :size="28"><Warning /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ errorAgents.length }}</div>
            <div class="stat-label">异常</div>
          </div>
        </div>
        <el-progress 
          :percentage="errorAgentsPercentage" 
          :show-text="false"
          :stroke-width="4"
          status="exception"
          class="stat-progress"
        />
      </el-card>
      
      <el-card class="stat-card" shadow="hover" @click="navigateTo('/tasks')">
        <div class="stat-content">
          <div class="stat-icon tasks">
            <el-icon :size="28"><List /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ runningTasks.length }}</div>
            <div class="stat-label">进行中任务</div>
          </div>
        </div>
        <el-progress 
          :percentage="taskProgressPercentage" 
          :show-text="false"
          :stroke-width="4"
          status="warning"
          class="stat-progress"
        />
      </el-card>
    </div>
    
    <!-- 主要内容区 -->
    <div class="dashboard-content">
      <div class="content-left">
        <el-card class="agent-overview" shadow="hover" v-loading="loading">
          <template #header>
            <div class="card-header">
              <div class="header-title">
                <el-icon><UserFilled /></el-icon>
                <span>Agent 概览</span>
                <el-tag size="small" type="info">{{ agents.length }}</el-tag>
              </div>
              <el-button link type="primary" @click="navigateTo('/agents')">
                查看全部
                <el-icon class="el-icon--right"><ArrowRight /></el-icon>
              </el-button>
            </div>
          </template>
          
          <div v-if="loading && agents.length === 0" class="loading-wrapper">
            <el-skeleton :rows="3" animated />
          </div>
          
          <div v-else-if="agents.length === 0" class="empty-wrapper">
            <el-empty description="暂无 Agent">
              <el-button type="primary" @click="showCreateDialog = true">
                创建第一个 Agent
              </el-button>
            </el-empty>
          </div>
          
          <div v-else class="agent-mini-list">
            <div 
              v-for="agent in displayedAgents" 
              :key="agent.id"
              class="agent-mini-item"
              :class="agent.status"
              @click="selectAgent(agent)"
            >
              <AgentAvatar :role="agent.role" :status="agent.status" :size="40" />
              <div class="mini-info">
                <div class="mini-name">{{ agent.name }}</div>
                <div class="mini-status" :class="agent.status">
                  {{ formatStatus(agent.status) }}
                  <span v-if="agent.currentTask" class="mini-task">
                    · {{ truncate(agent.currentTask.title, 20) }}
                  </span>
                </div>
              </div>
              <div class="mini-progress" v-if="agent.currentTask && agent.currentTask.progress > 0">
                <el-progress 
                  :percentage="agent.currentTask.progress" 
                  :stroke-width="3"
                  :show-text="false"
                />
              </div>
              <el-icon class="mini-arrow"><ArrowRight /></el-icon>
            </div>
          </div>
        </el-card>
        
        <el-card class="recent-tasks" shadow="hover" v-loading="taskStore.loading">
          <template #header>
            <div class="card-header">
              <div class="header-title">
                <el-icon><List /></el-icon>
                <span>最近任务</span>
                <el-tag size="small" type="info">{{ tasks.length }}</el-tag>
              </div>
              <el-button link type="primary" @click="navigateTo('/tasks')">
                查看全部
                <el-icon class="el-icon--right"><ArrowRight /></el-icon>
              </el-button>
            </div>
          </template>
          
          <div v-if="taskStore.loading && tasks.length === 0" class="loading-wrapper">
            <el-skeleton :rows="3" animated />
          </div>
          
          <div v-else-if="recentTasks.length === 0" class="empty-wrapper">
            <el-empty description="暂无任务" />
          </div>
          
          <div v-else class="task-mini-list">
            <div 
              v-for="task in recentTasks" 
              :key="task.id"
              class="task-mini-item"
            >
              <div class="task-status-dot" :class="task.status"></div>
              <div class="mini-info">
                <div class="mini-name" :title="task.title">{{ truncate(task.title, 30) }}</div>
                <div class="mini-meta">
                  <el-tag size="small" :type="getTaskStatusType(task.status)">
                    {{ task.status }}
                  </el-tag>
                  <el-tag size="small" :type="getPriorityType(task.priority)">
                    {{ task.priority }}
                  </el-tag>
                  <span>{{ formatRelativeTime(task.createdAt) }}</span>
                </div>
              </div>
              <el-progress 
                v-if="task.progress > 0"
                :percentage="task.progress" 
                :stroke-width="3"
                :show-text="false"
                style="width: 60px"
              />
            </div>
          </div>
        </el-card>
      </div>
      
      <div class="content-right">
        <el-card class="system-status" shadow="hover">
          <template #header>
            <div class="card-header">
              <div class="header-title">
                <el-icon><Monitor /></el-icon>
                <span>系统状态</span>
              </div>
              <el-tag 
                :type="wsStore.isConnected ? 'success' : 'danger'" 
                size="small"
                effect="dark"
              >
                <el-icon v-if="wsStore.isConnected"><CircleCheck /></el-icon>
                <el-icon v-else><CircleClose /></el-icon>
                {{ wsStore.isConnected ? '在线' : '离线' }}
              </el-tag>
            </div>
          </template>
          
          <div class="status-list">
            <div class="status-item">
              <span class="status-label">
                <el-icon><Connection /></el-icon>
                WebSocket 连接
              </span>
              <el-switch 
                :model-value="wsStore.isConnected" 
                @change="toggleConnection"
                :loading="wsStore.isConnecting"
              />
            </div>
            <div class="status-item">
              <span class="status-label">
                <el-icon><User /></el-icon>
                Agent 总数
              </span>
              <span class="status-value">{{ agents.length }}</span>
            </div>
            <div class="status-item">
              <span class="status-label">
                <el-icon><Document /></el-icon>
                任务总数
              </span>
              <span class="status-value">{{ tasks.length }}</span>
            </div>
            <div class="status-item">
              <span class="status-label">
                <el-icon><Refresh /></el-icon>
                重连次数
              </span>
              <span class="status-value" :class="{ 'text-warning': wsStore.reconnectAttempts > 0 }">
                {{ wsStore.reconnectAttempts }}
              </span>
            </div>
            <div class="status-item" v-if="wsStore.lastError">
              <span class="status-label">
                <el-icon><Warning /></el-icon>
                最后错误
              </span>
              <el-tooltip :content="wsStore.lastError" placement="top">
                <span class="status-value text-error">{{ truncate(wsStore.lastError, 15) }}</span>
              </el-tooltip>
            </div>
          </div>
        </el-card>
        
        <el-card class="activity-log" shadow="hover">
          <template #header>
            <div class="card-header">
              <div class="header-title">
                <el-icon><Bell /></el-icon>
                <span>活动日志</span>
              </div>
              <el-button link type="primary" @click="clearLogs">
                清空
              </el-button>
            </div>
          </template>
          
          <el-scrollbar height="300px">
            <div v-if="activityLogs.length === 0" class="empty-wrapper">
              <el-empty description="暂无活动" />
            </div>
            
            <div v-else class="log-list">
              <TransitionGroup name="log-fade">
                <div 
                  v-for="(log, index) in activityLogs" 
                  :key="log.id || index"
                  class="log-item"
                  :class="[log.type, { 'is-new': index === 0 }]"
                >
                  <div class="log-time">
                    <el-icon><Clock /></el-icon>
                    {{ log.time }}
                  </div>
                  <div class="log-content">
                    <el-icon :size="14" class="log-icon">
                      <component :is="getLogIcon(log.type)" />
                    </el-icon>
                    {{ log.message }}
                  </div>
                </div>
              </TransitionGroup>
            </div>
          </el-scrollbar>
        </el-card>
        
        <!-- 快速操作 -->
        <el-card class="quick-actions" shadow="hover">
          <template #header>
            <div class="card-header">
              <span>快速操作</span>
            </div>
          </template>
          
          <div class="action-list">
            <el-button 
              v-for="action in quickActions" 
              :key="action.path"
              text
              class="action-item"
              @click="navigateTo(action.path)"
            >
              <el-icon :size="18"><component :is="action.icon" /></el-icon>
              <span>{{ action.label }}</span>
            </el-button>
          </div>
        </el-card>
      </div>
    </div>
    
    <!-- 创建 Agent 对话框 -->
    <CreateAgentDialog v-model="showCreateDialog" @created="handleAgentCreated" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  Refresh, Plus, Loading, Timer, Warning, List, ArrowRight,
  UserFilled, CircleCheck, CircleClose, Connection, User,
  Document, Monitor, Bell, Clock, ChatDotRound,
  Calendar, Setting
} from '@element-plus/icons-vue'
import { useAgentStore } from '@/stores/agent'
import { useTaskStore } from '@/stores/task'
import { useWebSocketStore } from '@/stores/websocket'
import AgentAvatar from '@/components/agent/AgentAvatar.vue'
import CreateAgentDialog from '@/components/agent/CreateAgentDialog.vue'
import type { Agent } from '@/types'
import { formatStatus, formatRelativeTime, truncate } from '@/utils/format'
import { TASK_STATUS, TASK_PRIORITIES } from '@/utils/constants'

const router = useRouter()
const agentStore = useAgentStore()
const taskStore = useTaskStore()
const wsStore = useWebSocketStore()

const loading = ref(false)
const showCreateDialog = ref(false)
const autoRefresh = ref(false)
let refreshTimer: ReturnType<typeof setInterval> | null = null

// 计算属性
const agents = computed(() => agentStore.agents)
const tasks = computed(() => taskStore.tasks)
const activeAgents = computed(() => agentStore.activeAgents)
const idleAgents = computed(() => agentStore.idleAgents)
const errorAgents = computed(() => agentStore.errorAgents)
const runningTasks = computed(() => taskStore.runningTasks)
const recentTasks = computed(() => tasks.value.slice(0, 5))
const displayedAgents = computed(() => agents.value.slice(0, 6))
const error = computed(() => agentStore.error || taskStore.error)

// 百分比计算
const activeAgentsPercentage = computed(() => {
  if (agents.value.length === 0) return 0
  return Math.round((activeAgents.value.length / agents.value.length) * 100)
})

const idleAgentsPercentage = computed(() => {
  if (agents.value.length === 0) return 0
  return Math.round((idleAgents.value.length / agents.value.length) * 100)
})

const errorAgentsPercentage = computed(() => {
  if (agents.value.length === 0) return 0
  return Math.round((errorAgents.value.length / agents.value.length) * 100)
})

const taskProgressPercentage = computed(() => {
  const total = tasks.value.length
  if (total === 0) return 0
  const running = runningTasks.value.length
  return Math.round((running / total) * 100)
})

// 活动日志
interface ActivityLog {
  id: string
  time: string
  message: string
  type: 'success' | 'info' | 'warning' | 'error'
}

const activityLogs = ref<ActivityLog[]>([
  { id: '1', time: '10:23', message: 'Frontend Dev 完成了任务', type: 'success' },
  { id: '2', time: '10:20', message: 'Backend Dev 开始新任务', type: 'info' },
  { id: '3', time: '10:15', message: 'Director 创建了 Sprint', type: 'info' },
])

// 快速操作
const quickActions = [
  { label: '查看代码', icon: Document, path: '/code' },
  { label: '打开终端', icon: Monitor, path: '/terminal' },
  { label: '团队对话', icon: ChatDotRound, path: '/chat' },
  { label: 'Sprint 管理', icon: Calendar, path: '/sprints' },
  { label: '系统设置', icon: Setting, path: '/settings' },
]

// 方法
const refreshData = async () => {
  loading.value = true
  try {
    await Promise.all([
      agentStore.fetchAgents(),
      taskStore.fetchTasks(),
    ])
    addActivityLog('数据已刷新', 'info')
  } catch (err) {
    console.error('Failed to refresh data:', err)
  } finally {
    loading.value = false
  }
}

const clearError = () => {
  agentStore.clearError()
}

const navigateTo = (path: string) => {
  router.push(path)
}

const selectAgent = (agent: Agent) => {
  router.push(`/agents/${agent.id}`)
}

const toggleConnection = (val: boolean) => {
  if (val) {
    wsStore.connect()
    addActivityLog('正在连接 WebSocket...', 'info')
  } else {
    wsStore.disconnect()
    addActivityLog('WebSocket 已断开', 'warning')
  }
}

const clearLogs = () => {
  activityLogs.value = []
}

const handleAgentCreated = () => {
  refreshData()
  addActivityLog('新 Agent 创建成功', 'success')
}

const getTaskStatusType = (status: string) => {
  return TASK_STATUS[status as keyof typeof TASK_STATUS]?.type || 'info'
}

const getPriorityType = (priority: string) => {
  const priorityConfig = TASK_PRIORITIES.find(p => p.value === priority)
  return priorityConfig ? 
    (priority === 'low' ? 'info' : priority === 'medium' ? 'primary' : priority === 'high' ? 'warning' : 'danger')
    : 'info'
}

const getLogIcon = (type: string) => {
  const icons: Record<string, string> = {
    success: 'CircleCheck',
    info: 'InfoFilled',
    warning: 'Warning',
    error: 'CircleClose',
  }
  return icons[type] || 'InfoFilled'
}

const addActivityLog = (message: string, type: ActivityLog['type'] = 'info') => {
  const now = new Date()
  const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
  activityLogs.value.unshift({
    id: Date.now().toString(),
    time,
    message,
    type,
  })
  // 只保留最近 50 条
  if (activityLogs.value.length > 50) {
    activityLogs.value = activityLogs.value.slice(0, 50)
  }
}

// 监听 WebSocket 事件
watch(() => wsStore.isConnected, (connected, prevConnected) => {
  if (connected && !prevConnected) {
    addActivityLog('WebSocket 已连接', 'success')
  }
})

// 自动刷新
watch(autoRefresh, (enabled) => {
  if (enabled) {
    refreshTimer = setInterval(() => {
      refreshData()
    }, 30000) // 30秒刷新一次
  } else {
    if (refreshTimer) {
      clearInterval(refreshTimer)
      refreshTimer = null
    }
  }
})

onMounted(() => {
  refreshData()
  if (!wsStore.isConnected) {
    wsStore.connect()
  }
})

onUnmounted(() => {
  if (refreshTimer) {
    clearInterval(refreshTimer)
  }
})
</script>

<style scoped>
.dashboard-page {
  padding: 8px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
}

.page-title {
  margin: 0 0 8px 0;
  font-size: 24px;
  font-weight: 600;
}

.page-subtitle {
  margin: 0;
  color: var(--el-text-color-secondary);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.auto-refresh-switch {
  margin-right: 8px;
}

.error-alert {
  margin-bottom: 16px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}

.stat-card :deep(.el-card__body) {
  padding: 16px;
}

.stat-content {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.stat-icon.working {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.stat-icon.idle {
  background: var(--el-color-success-light-9);
  color: var(--el-color-success);
}

.stat-icon.error {
  background: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
}

.stat-icon.tasks {
  background: var(--el-color-warning-light-9);
  color: var(--el-color-warning);
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  line-height: 1;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.stat-progress {
  margin-top: 8px;
}

.dashboard-content {
  display: grid;
  grid-template-columns: 1fr 380px;
  gap: 16px;
}

.content-left {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.content-right {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
}

.loading-wrapper {
  padding: 20px;
}

.empty-wrapper {
  padding: 40px 0;
}

.agent-mini-list {
  display: flex;
  flex-direction: column;
}

.agent-mini-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background var(--transition-fast);
  position: relative;
}

.agent-mini-item::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 0;
  background: var(--el-color-primary);
  border-radius: 0 2px 2px 0;
  transition: height 0.2s;
}

.agent-mini-item:hover {
  background: var(--el-fill-color-light);
}

.agent-mini-item:hover::before {
  height: 60%;
}

.agent-mini-item.working::before {
  height: 60%;
  background: var(--agent-working);
}

.agent-mini-item.error::before {
  height: 60%;
  background: var(--agent-error);
}

.mini-info {
  flex: 1;
  min-width: 0;
}

.mini-name {
  font-weight: 500;
  margin-bottom: 4px;
}

.mini-status {
  font-size: 12px;
}

.mini-status.working {
  color: var(--agent-working);
}

.mini-status.idle {
  color: var(--agent-idle);
}

.mini-status.error {
  color: var(--agent-error);
}

.mini-task {
  color: var(--el-text-color-secondary);
}

.mini-progress {
  width: 60px;
}

.mini-arrow {
  color: var(--el-text-color-secondary);
}

.task-mini-list {
  display: flex;
  flex-direction: column;
}

.task-mini-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-bottom: 1px solid var(--el-border-color-light);
}

.task-mini-item:last-child {
  border-bottom: none;
}

.task-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.task-status-dot.running { background: var(--agent-working); }
.task-status-dot.completed { background: var(--agent-completed); }
.task-status-dot.failed { background: var(--agent-error); }
.task-status-dot.pending { background: var(--agent-idle); }

.mini-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.status-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.status-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.status-label {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--el-text-color-secondary);
}

.status-value {
  font-weight: 500;
  font-family: var(--font-mono);
}

.text-warning {
  color: var(--el-color-warning);
}

.text-error {
  color: var(--el-color-danger);
}

.log-list {
  display: flex;
  flex-direction: column;
}

.log-item {
  padding: 10px 12px;
  border-bottom: 1px solid var(--el-border-color-light);
  font-size: 13px;
  transition: background 0.2s;
}

.log-item:hover {
  background: var(--el-fill-color-light);
}

.log-item.is-new {
  animation: highlight 2s ease-out;
}

@keyframes highlight {
  0% { background: var(--el-color-primary-light-9); }
  100% { background: transparent; }
}

.log-item:last-child {
  border-bottom: none;
}

.log-time {
  font-size: 11px;
  color: var(--el-text-color-placeholder);
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.log-content {
  display: flex;
  align-items: center;
  gap: 6px;
}

.log-content.success {
  color: var(--el-color-success);
}

.log-content.error {
  color: var(--el-color-danger);
}

.log-content.warning {
  color: var(--el-color-warning);
}

.log-icon {
  flex-shrink: 0;
}

/* 快速操作 */
.quick-actions :deep(.el-card__body) {
  padding: 12px;
}

.action-list {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.action-item {
  height: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  border-radius: var(--radius-md);
}

.action-item:hover {
  background: var(--el-fill-color-light);
}

/* 日志动画 */
.log-fade-enter-active,
.log-fade-leave-active {
  transition: all 0.3s ease;
}

.log-fade-enter-from {
  opacity: 0;
  transform: translateX(-20px);
}

.log-fade-leave-to {
  opacity: 0;
  transform: translateX(20px);
}

/* 响应式布局 */
@media (max-width: 1200px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .dashboard-content {
    grid-template-columns: 1fr;
  }
  
  .content-right {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
  
  .page-header {
    flex-direction: column;
    gap: 16px;
  }
  
  .header-actions {
    width: 100%;
    justify-content: flex-end;
  }
  
  .content-right {
    grid-template-columns: 1fr;
  }
  
  .action-list {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 480px) {
  .action-list {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>

<template>
  <div class="agent-panel" v-if="agent">
    <div class="panel-header">
      <div class="agent-profile">
        <AgentAvatar :role="agent.role" :status="agent.status" :size="56" />
        <div class="profile-info">
          <h3 class="agent-name">{{ agent.name }}</h3>
          <div class="agent-meta">
            <el-tag :type="statusType" size="small">{{ statusText }}</el-tag>
            <span class="role-text">
              <el-icon><component :is="roleIcon" /></el-icon>
              {{ roleText }}
            </span>
          </div>
        </div>
      </div>
      
      <div class="header-actions">
        <el-button-group>
          <el-button 
            v-if="agent.status === 'idle'" 
            type="primary" 
            :icon="VideoPlay"
            @click="handleAction('start')"
          >
            启动
          </el-button>
          <el-button 
            v-if="agent.status === 'working'" 
            type="warning" 
            :icon="VideoPause"
            @click="handleAction('pause')"
          >
            暂停
          </el-button>
          <el-button 
            v-if="agent.status === 'paused'" 
            type="success" 
            :icon="RefreshRight"
            @click="handleAction('resume')"
          >
            恢复
          </el-button>
          <el-button 
            v-if="agent.status !== 'idle'" 
            type="danger" 
            :icon="CircleClose"
            @click="handleAction('stop')"
          >
            停止
          </el-button>
        </el-button-group>
        
        <el-dropdown @command="handleDropdownCommand">
          <el-button :icon="More" circle />
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="edit">
                <el-icon><Edit /></el-icon> 编辑配置
              </el-dropdown-item>
              <el-dropdown-item command="logs">
                <el-icon><Document /></el-icon> 查看日志
              </el-dropdown-item>
              <el-dropdown-item command="terminal">
                <el-icon><Monitor /></el-icon> 打开终端
              </el-dropdown-item>
              <el-dropdown-item divided command="delete" class="text-danger">
                <el-icon><Delete /></el-icon> 删除 Agent
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>
    
    <el-scrollbar class="panel-body">
      <!-- 当前任务 -->
      <div v-if="agent.currentTask" class="section">
        <h4 class="section-title">
          <el-icon><Loading v-if="agent.status === 'working'" class="animate-spin" /></el-icon>
          当前任务
        </h4>
        <div class="task-card">
          <div class="task-header">
            <span class="task-title">{{ agent.currentTask.title }}</span>
            <el-tag size="small" type="primary">{{ agent.currentTask.id.slice(0, 8) }}</el-tag>
          </div>
          <div class="task-progress">
            <el-progress 
              :percentage="agent.currentTask.progress" 
              :stroke-width="8"
              :status="agent.status === 'error' ? 'exception' : undefined"
            />
          </div>
        </div>
      </div>
      
      <!-- 基本信息 -->
      <div class="section">
        <h4 class="section-title">
          <el-icon><InfoFilled /></el-icon>
          基本信息
        </h4>
        <div class="info-list">
          <div class="info-item">
            <span class="info-label">Agent ID</span>
            <span class="info-value">{{ agent.id }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Pod IP</span>
            <span class="info-value">{{ agent.podIp || '未分配' }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">创建时间</span>
            <span class="info-value">{{ formatDateTime(agent.createdAt) }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">最后心跳</span>
            <span class="info-value">{{ formatRelativeTime(agent.lastHeartbeatAt) }}</span>
          </div>
        </div>
      </div>
      
      <!-- 任务统计 -->
      <div class="section" v-if="stats">
        <h4 class="section-title">
          <el-icon><TrendCharts /></el-icon>
          任务统计
        </h4>
        <div class="stats-grid">
          <div class="stat-item">
            <div class="stat-value">{{ stats.totalTasks }}</div>
            <div class="stat-label">总任务</div>
          </div>
          <div class="stat-item success">
            <div class="stat-value">{{ stats.completedTasks }}</div>
            <div class="stat-label">已完成</div>
          </div>
          <div class="stat-item danger">
            <div class="stat-value">{{ stats.failedTasks }}</div>
            <div class="stat-label">失败</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">{{ formatDuration(stats.avgCompletionTime) }}</div>
            <div class="stat-label">平均耗时</div>
          </div>
        </div>
      </div>
      
      <!-- 最近任务 -->
      <div class="section" v-if="tasks && tasks.length > 0">
        <h4 class="section-title">
          <el-icon><List /></el-icon>
          最近任务
        </h4>
        <div class="task-list">
          <div 
            v-for="task in tasks.slice(0, 5)" 
            :key="task.id" 
            class="task-item"
            @click="handleTaskClick(task)"
          >
            <div class="task-item-status" :class="task.status"></div>
            <div class="task-item-content">
              <div class="task-item-title">{{ task.title }}</div>
              <div class="task-item-meta">
                <el-tag size="small" :type="getTaskStatusType(task.status)">
                  {{ task.status }}
                </el-tag>
                <span>{{ formatRelativeTime(task.createdAt) }}</span>
              </div>
            </div>
            <el-icon class="task-item-arrow"><ArrowRight /></el-icon>
          </div>
        </div>
      </div>
    </el-scrollbar>
  </div>
  
  <div v-else class="agent-panel-empty">
    <el-empty description="选择一个 Agent 查看详情">
      <template #image>
        <el-icon :size="64" color="var(--el-text-color-secondary)">
          <UserFilled />
        </el-icon>
      </template>
    </el-empty>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  VideoPlay, VideoPause, RefreshRight, CircleClose, More,
  Edit, Document, Delete, InfoFilled, TrendCharts, List,
  Loading, ArrowRight, UserFilled, Monitor
} from '@element-plus/icons-vue'
import AgentAvatar from '../atoms/AgentAvatar.vue'
import type { Agent, Task } from '@agenthive/types'
// 本地实现工具函数
function formatRole(role: string): string {
  const roleMap: Record<string, string> = {
    frontend_dev: '前端开发',
    backend_dev: '后端开发',
    qa_engineer: 'QA工程师',
    orchestrator: '协调者',
  }
  return roleMap[role] || role
}

function formatStatus(status: string): string {
  const statusMap: Record<string, string> = {
    idle: '空闲',
    active: '活跃',
    busy: '忙碌',
    offline: '离线',
    pending: '待处理',
    running: '进行中',
    completed: '已完成',
    failed: '失败',
    cancelled: '已取消',
  }
  return statusMap[status] || status
}

function getStatusType(status: string): any {
  const typeMap: Record<string, any> = {
    idle: 'info',
    active: 'success',
    busy: 'warning',
    offline: 'info',
    pending: 'info',
    running: 'warning',
    completed: 'success',
    failed: 'danger',
    cancelled: 'info',
  }
  return typeMap[status] || 'info'
}

function getRoleIcon(role: string): any {
  return 'User'
}

function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleString('zh-CN')
}

function formatRelativeTime(date: string | Date): string {
  const now = new Date()
  const target = new Date(date)
  const diff = now.getTime() - target.getTime()
  
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  if (hours < 24) return `${hours}小时前`
  return `${days}天前`
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${Math.floor(ms / 1000)}s`
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m`
  return `${Math.floor(ms / 3600000)}h`
}

const TASK_STATUS = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
} as const

const props = defineProps<{
  agent: Agent | null
  tasks?: Task[]
  stats?: {
    totalTasks: number
    completedTasks: number
    failedTasks: number
    avgCompletionTime: number
  }
}>()

const emit = defineEmits<{
  action: [action: string, agent: Agent]
  command: [command: string, agent: Agent]
  'task-click': [task: Task]
}>()

const statusType = computed(() => props.agent ? getStatusType(props.agent.status) : 'info')
const statusText = computed(() => props.agent ? formatStatus(props.agent.status) : '')
const roleText = computed(() => props.agent ? formatRole(props.agent.role) : '')
const roleIcon = computed(() => props.agent ? getRoleIcon(props.agent.role) : 'User')

const handleAction = (action: string) => {
  if (props.agent) {
    emit('action', action, props.agent)
  }
}

const handleDropdownCommand = (command: string) => {
  if (props.agent) {
    emit('command', command, props.agent)
  }
}

const handleTaskClick = (task: Task) => {
  emit('task-click', task)
}

const getTaskStatusType = (status: string) => {
  return TASK_STATUS[status as keyof typeof TASK_STATUS]?.type || 'info'
}
</script>

<style scoped>
.agent-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--el-bg-color);
}

.panel-header {
  padding: 20px;
  border-bottom: 1px solid var(--el-border-color-light);
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}

.agent-profile {
  display: flex;
  gap: 16px;
  flex: 1;
}

.profile-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.agent-name {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.agent-meta {
  display: flex;
  align-items: center;
  gap: 12px;
}

.role-text {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.header-actions {
  display: flex;
  gap: 8px;
}

.panel-body {
  flex: 1;
  padding: 20px;
}

.section {
  margin-bottom: 24px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin: 0 0 12px 0;
}

.task-card {
  background: var(--el-fill-color-light);
  border-radius: var(--radius-md);
  padding: 12px;
}

.task-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.task-title {
  font-weight: 500;
}

.info-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
}

.info-label {
  color: var(--el-text-color-secondary);
}

.info-value {
  color: var(--el-text-color-primary);
  font-family: var(--font-mono);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.stat-item {
  text-align: center;
  padding: 12px;
  background: var(--el-fill-color-light);
  border-radius: var(--radius-md);
}

.stat-item.success .stat-value {
  color: var(--el-color-success);
}

.stat-item.danger .stat-value {
  color: var(--el-color-danger);
}

.stat-value {
  font-size: 20px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.stat-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 4px;
}

.task-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.task-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--el-fill-color-light);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.task-item:hover {
  background: var(--el-fill-color);
}

.task-item-status {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.task-item-status.completed { background: var(--agent-completed); }
.task-item-status.running { background: var(--agent-working); }
.task-item-status.failed { background: var(--agent-error); }
.task-item-status.pending { background: var(--agent-idle); }

.task-item-content {
  flex: 1;
  min-width: 0;
}

.task-item-title {
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-item-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.task-item-arrow {
  color: var(--el-text-color-secondary);
}

.agent-panel-empty {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.text-danger {
  color: var(--el-color-danger);
}
</style>

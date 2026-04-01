<template>
  <div 
    class="agent-card" 
    :class="[statusClass, { 'is-selected': isSelected }]"
    @click="handleClick"
  >
    <div class="agent-avatar-wrapper">
      <AgentAvatar :role="agent.role" :status="agent.status" :size="48" />
      <div class="status-dot" :class="agent.status"></div>
    </div>
    
    <div class="agent-info">
      <div class="agent-header">
        <h4 class="agent-name">{{ agent.name }}</h4>
        <el-tag :type="statusType" size="small" effect="light">
          {{ statusText }}
        </el-tag>
      </div>
      
      <div class="agent-role">
        <el-icon><component :is="roleIcon" /></el-icon>
        <span>{{ roleText }}</span>
      </div>
      
      <div v-if="agent.currentTask" class="agent-task">
        <div class="task-name text-ellipsis">
          <el-icon><Loading v-if="agent.status === 'working'" class="animate-spin" /></el-icon>
          <span>{{ agent.currentTask.title }}</span>
        </div>
        <el-progress 
          :percentage="agent.currentTask.progress" 
          :stroke-width="4"
          :show-text="false"
          :class="{ 'is-active': agent.status === 'working' }"
        />
      </div>
      
      <div v-else class="agent-idle">
        <el-icon><Timer /></el-icon>
        <span>空闲 - {{ lastHeartbeat }}</span>
      </div>
    </div>
    
    <div class="agent-actions">
      <el-dropdown trigger="click" @command="handleCommand">
        <el-button :icon="MoreFilled" circle text />
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="view">
              <el-icon><View /></el-icon> 查看详情
            </el-dropdown-item>
            <el-dropdown-item v-if="agent.status === 'idle'" command="start">
              <el-icon><VideoPlay /></el-icon> 启动
            </el-dropdown-item>
            <el-dropdown-item v-if="agent.status === 'working'" command="pause">
              <el-icon><VideoPause /></el-icon> 暂停
            </el-dropdown-item>
            <el-dropdown-item v-if="agent.status === 'paused'" command="resume">
              <el-icon><RefreshRight /></el-icon> 恢复
            </el-dropdown-item>
            <el-dropdown-item v-if="agent.status !== 'idle'" command="stop">
              <el-icon><CircleClose /></el-icon> 停止
            </el-dropdown-item>
            <el-dropdown-item divided command="delete" class="text-danger">
              <el-icon><Delete /></el-icon> 删除
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { 
  MoreFilled, View, VideoPlay, VideoPause, 
  RefreshRight, CircleClose, Delete, Timer, Loading 
} from '@element-plus/icons-vue'
import AgentAvatar from './AgentAvatar.vue'
import type { Agent } from '@/types'
import { formatRole, formatStatus, getStatusType, getRoleIcon, formatRelativeTime } from '@/utils/format'

const props = defineProps<{
  agent: Agent
  isSelected?: boolean
}>()

const emit = defineEmits<{
  click: [agent: Agent]
  command: [command: string, agent: Agent]
}>()

const statusClass = computed(() => `agent-border-${props.agent.status}`)
const statusType = computed(() => getStatusType(props.agent.status))
const statusText = computed(() => formatStatus(props.agent.status))
const roleText = computed(() => formatRole(props.agent.role))
const roleIcon = computed(() => getRoleIcon(props.agent.role))
const lastHeartbeat = computed(() => formatRelativeTime(props.agent.lastHeartbeatAt))

const handleClick = () => {
  emit('click', props.agent)
}

const handleCommand = (command: string) => {
  emit('command', command, props.agent)
}
</script>

<style scoped>
.agent-card {
  display: flex;
  align-items: flex-start;
  padding: 16px;
  border-radius: var(--radius-md);
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  cursor: pointer;
  transition: all var(--transition-fast);
  gap: 12px;
}

.agent-card:hover {
  box-shadow: var(--shadow-md);
  border-color: var(--el-border-color);
}

.agent-card.is-selected {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

.agent-avatar-wrapper {
  position: relative;
  flex-shrink: 0;
}

.status-dot {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid var(--el-bg-color);
}

.status-dot.idle { background: var(--agent-idle); }
.status-dot.working { background: var(--agent-working); animation: pulse 2s infinite; }
.status-dot.error { background: var(--agent-error); }
.status-dot.completed { background: var(--agent-completed); }
.status-dot.starting { background: var(--agent-starting); }
.status-dot.paused { background: var(--agent-paused); }

.agent-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.agent-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.agent-name {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.agent-role {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.agent-task {
  margin-top: 4px;
}

.task-name {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--el-text-color-regular);
  margin-bottom: 4px;
}

.task-name .el-icon {
  font-size: 12px;
}

.agent-idle {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.agent-actions {
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.agent-card:hover .agent-actions {
  opacity: 1;
}

.text-danger {
  color: var(--el-color-danger);
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

:deep(.el-progress-bar__outer) {
  background-color: var(--el-fill-color-dark);
}

:deep(.el-progress.is-active .el-progress-bar__inner) {
  background-image: linear-gradient(
    45deg,
    rgba(255, 255, 255, 0.15) 25%,
    transparent 25%,
    transparent 50%,
    rgba(255, 255, 255, 0.15) 50%,
    rgba(255, 255, 255, 0.15) 75%,
    transparent 75%,
    transparent
  );
  background-size: 1rem 1rem;
  animation: progress-stripes 1s linear infinite;
}

@keyframes progress-stripes {
  from { background-position: 1rem 0; }
  to { background-position: 0 0; }
}
</style>

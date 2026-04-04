<template>
  <div class="workspace-page">
    <!-- 模式切换条 -->
    <div class="workspace-tabs">
      <div class="tabs-inner">
        <el-radio-group v-model="currentMode" size="small">
          <el-radio-button label="overview">
            <el-icon><Grid /></el-icon>
            概览
          </el-radio-button>
          <el-radio-button label="studio">
            <el-icon><Monitor /></el-icon>
            工作室
          </el-radio-button>
        </el-radio-group>
        <span v-if="currentMode === 'studio'" class="studio-hint">
          🐕 柴犬团队正在努力工作中
        </span>
      </div>
    </div>

    <!-- Overview -->
    <div v-if="currentMode === 'overview'" class="workspace-panel">
      <Dashboard />
    </div>

    <!-- Studio -->
    <div v-else class="workspace-panel studio-mode">
      <div class="studio-layout">
        <div class="studio-left">
          <ChatView embedded />
        </div>
        <div class="studio-center">
          <CodeViewer embedded />
        </div>
        <div class="studio-right">
          <el-card class="right-card" shadow="hover">
            <template #header>
              <div class="right-header">
                <el-icon><List /></el-icon>
                <span>最近任务</span>
              </div>
            </template>
            <div v-if="recentTasks.length === 0" class="empty-tiny">
              <el-empty description="暂无任务" :image-size="60" />
            </div>
            <div v-else class="tiny-task-list">
              <div
                v-for="task in recentTasks"
                :key="task.id"
                class="tiny-task-item"
              >
                <div class="tiny-dot" :class="task.status" />
                <div class="tiny-info">
                  <div class="tiny-title" :title="task.title">{{ truncate(task.title, 18) }}</div>
                  <div class="tiny-meta">
                    <el-tag size="small" :type="getTaskStatusType(task.status)">
                      {{ task.status }}
                    </el-tag>
                  </div>
                </div>
              </div>
            </div>
          </el-card>

          <el-card class="right-card" shadow="hover">
            <template #header>
              <div class="right-header">
                <el-icon><Monitor /></el-icon>
                <span>系统状态</span>
              </div>
            </template>
            <div class="tiny-status">
              <div class="tiny-status-row">
                <span>WebSocket</span>
                <el-tag :type="wsStore.isConnected ? 'success' : 'danger'" size="small">
                  {{ wsStore.isConnected ? '在线' : '离线' }}
                </el-tag>
              </div>
              <div class="tiny-status-row">
                <span>Agent 总数</span>
                <span class="num">{{ agents.length }}</span>
              </div>
              <div class="tiny-status-row">
                <span>任务总数</span>
                <span class="num">{{ tasks.length }}</span>
              </div>
            </div>
          </el-card>
        </div>
      </div>

      <!-- Terminal drawer -->
      <div class="terminal-drawer" :class="{ collapsed: !showTerminal }">
        <div class="terminal-bar" @click="showTerminal = !showTerminal">
          <div class="terminal-title">
            <el-icon><FullScreen /></el-icon>
            <span>终端</span>
          </div>
          <el-icon class="terminal-chevron"><ArrowDown /></el-icon>
        </div>
        <div class="terminal-body">
          <TerminalView embedded />
        </div>
      </div>

      <!-- Shiba Dock -->
      <div class="shiba-dock">
        <el-tooltip
          v-for="member in shibaTeam"
          :key="member.role"
          :content="`${member.label} ${member.name}`"
          placement="top"
        >
          <div
            class="dock-item"
            @click="currentMode = 'overview'"
          >
            <AgentAvatar :role="member.role" :size="44" />
          </div>
        </el-tooltip>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Grid, Monitor, List, FullScreen, ArrowDown } from '@element-plus/icons-vue'
import Dashboard from './Dashboard.vue'
import ChatView from './ChatView.vue'
import CodeViewer from './CodeViewer.vue'
import TerminalView from './TerminalView.vue'
import AgentAvatar from '@/components/agent/AgentAvatar.vue'
import { useAgentStore } from '@/stores/agent'
import { useTaskStore } from '@/stores/task'
import { useWebSocketStore } from '@/stores/websocket'
import { truncate } from '@/utils/format'
import { TASK_STATUS } from '@/utils/constants'

const currentMode = ref<'overview' | 'studio'>('overview')
const showTerminal = ref(false)

const agentStore = useAgentStore()
const taskStore = useTaskStore()
const wsStore = useWebSocketStore()

const agents = computed(() => agentStore.agents)
const tasks = computed(() => taskStore.tasks)
const recentTasks = computed(() => tasks.value.slice(0, 4))

const shibaTeam = [
  { role: 'tech_lead' as const, name: '阿黄', label: '技术负责人' },
  { role: 'frontend_dev' as const, name: '小花', label: '前端开发' },
  { role: 'backend_dev' as const, name: '阿铁', label: '后端开发' },
  { role: 'qa_engineer' as const, name: '阿镜', label: '质量保障' },
]

const getTaskStatusType = (status: string) => {
  return TASK_STATUS[status as keyof typeof TASK_STATUS]?.type || 'info'
}
</script>

<style scoped>
.workspace-page {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 60px);
  overflow: hidden;
}

.workspace-tabs {
  flex-shrink: 0;
  padding: 8px 16px 0;
  background: var(--el-bg-color);
  border-bottom: 1px solid var(--el-border-color-light);
}

.tabs-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.studio-hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.workspace-panel {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.workspace-panel.studio-mode {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

/* Studio Layout */
.studio-layout {
  flex: 1;
  display: grid;
  grid-template-columns: 320px 1fr 260px;
  min-height: 0;
  overflow: hidden;
}

.studio-left {
  border-right: 1px solid var(--el-border-color-light);
  overflow: hidden;
}

.studio-center {
  overflow: hidden;
}

.studio-right {
  border-left: 1px solid var(--el-border-color-light);
  background: var(--el-fill-color-light);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
}

.right-card :deep(.el-card__header) {
  padding: 10px 12px;
}

.right-card :deep(.el-card__body) {
  padding: 12px;
}

.right-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
  font-size: 13px;
}

.empty-tiny :deep(.el-empty__description) {
  font-size: 12px;
}

.tiny-task-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tiny-task-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  background: var(--el-bg-color);
  border-radius: var(--radius-sm);
}

.tiny-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.tiny-dot.running { background: var(--agent-working); }
.tiny-dot.completed { background: var(--agent-completed); }
.tiny-dot.failed { background: var(--agent-error); }
.tiny-dot.pending { background: var(--agent-idle); }

.tiny-info {
  flex: 1;
  min-width: 0;
}

.tiny-title {
  font-size: 12px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: 4px;
}

.tiny-meta {
  line-height: 1;
}

.tiny-status {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.tiny-status-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
}

.tiny-status-row .num {
  font-weight: 600;
  font-family: var(--font-mono);
}

/* Terminal Drawer */
.terminal-drawer {
  flex-shrink: 0;
  border-top: 1px solid var(--el-border-color-light);
  background: var(--el-bg-color);
  display: flex;
  flex-direction: column;
  transition: flex-basis 0.25s ease;
}

.terminal-drawer:not(.collapsed) {
  flex-basis: 260px;
}

.terminal-drawer.collapsed {
  flex-basis: 36px;
}

.terminal-bar {
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  background: var(--el-fill-color-light);
  cursor: pointer;
  user-select: none;
}

.terminal-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 500;
}

.terminal-chevron {
  transition: transform 0.2s ease;
}

.terminal-drawer.collapsed .terminal-chevron {
  transform: rotate(-90deg);
}

.terminal-body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

/* Shiba Dock */
.shiba-dock {
  position: absolute;
  bottom: 52px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 16px;
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid var(--el-border-color-light);
  border-radius: 999px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  backdrop-filter: blur(4px);
  z-index: 10;
}

.dock-item {
  cursor: pointer;
  transition: transform 0.2s ease;
}

.dock-item:hover {
  transform: scale(1.15) translateY(-4px);
}

/* Responsive */
@media (max-width: 1200px) {
  .studio-layout {
    grid-template-columns: 280px 1fr;
  }
  .studio-right {
    display: none;
  }
}

@media (max-width: 768px) {
  .studio-layout {
    grid-template-columns: 1fr;
    grid-template-rows: 1fr 1fr;
  }
  .studio-left {
    border-right: none;
    border-bottom: 1px solid var(--el-border-color-light);
  }
}
</style>

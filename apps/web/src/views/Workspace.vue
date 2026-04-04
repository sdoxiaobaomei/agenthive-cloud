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
      <ExecutionBoard />
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
          <TicketDetailPanel :ticket="activeTicket" />
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
import { Grid, Monitor, FullScreen, ArrowDown } from '@element-plus/icons-vue'
import ExecutionBoard from '@/components/execution/ExecutionBoard.vue'
import TicketDetailPanel from '@/components/execution/TicketDetailPanel.vue'
import ChatView from './ChatView.vue'
import CodeViewer from './CodeViewer.vue'
import TerminalView from './TerminalView.vue'
import AgentAvatar from '@/components/agent/AgentAvatar.vue'
import { useExecutionStore } from '@/stores/execution'

const currentMode = ref<'overview' | 'studio'>('overview')
const showTerminal = ref(false)

const executionStore = useExecutionStore()

const activeTicket = computed(() => executionStore.activeTicket)

const shibaTeam = [
  { role: 'tech_lead' as const, name: '阿黄', label: '技术负责人' },
  { role: 'frontend_dev' as const, name: '小花', label: '前端开发' },
  { role: 'backend_dev' as const, name: '阿铁', label: '后端开发' },
  { role: 'qa_engineer' as const, name: '阿镜', label: '质量保障' },
]
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

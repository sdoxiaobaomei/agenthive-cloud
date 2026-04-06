<template>
  <div class="agent-workflow-card">
    <div class="workflow-header">
      <AgentAvatar :role="agent.role as any" :size="40" :status="agent.status as any" />
      <div class="agent-info">
        <div class="agent-name">{{ agent.name }}</div>
        <div class="agent-role">{{ formatRole(agent.role) }}</div>
      </div>
      <el-tag :type="getStatusType(agent.status)" size="small">
        {{ formatStatus(agent.status) }}
      </el-tag>
    </div>
    
    <div v-if="agent.currentTask" class="workflow-task">
      <div class="task-header">
        <el-icon><Document /></el-icon>
        <span class="task-title" :title="agent.currentTask.title">
          {{ truncate(agent.currentTask.title, 30) }}
        </span>
      </div>
      <div class="task-progress">
        <el-progress 
          :percentage="agent.currentTask.progress || 0" 
          :stroke-width="4"
          :show-text="true"
        />
      </div>
    </div>
    
    <div v-else class="workflow-idle">
      <el-icon><Timer /></el-icon>
      <span>等待任务分配...</span>
    </div>
    
    <div class="workflow-steps">
      <div 
        v-for="(step, index) in workflowSteps" 
        :key="step.key"
        class="workflow-step"
        :class="{ 
          active: currentStep === index,
          completed: currentStep > index 
        }"
      >
        <div class="step-dot">
          <el-icon v-if="currentStep > index"><Check /></el-icon>
          <span v-else>{{ index + 1 }}</span>
        </div>
        <span class="step-label">{{ step.label }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Document, Timer, Check } from '@element-plus/icons-vue'
import type { Agent } from '@agenthive/types'

interface AgentWithTask {
  id: string
  name: string
  role: 'orchestrator' | 'tech_lead' | 'frontend_dev' | 'backend_dev' | 'qa_engineer' | string
  status: 'working' | 'idle' | 'error' | 'offline' | string
  currentTask?: {
    title: string
    progress: number
  }
}

const props = defineProps<{
  agent: AgentWithTask
}>()

const workflowSteps = [
  { key: 'analyze', label: '分析' },
  { key: 'design', label: '设计' },
  { key: 'implement', label: '实现' },
  { key: 'review', label: '审查' },
]

const currentStep = computed(() => {
  const progress = props.agent.currentTask?.progress ?? 0
  if (progress < 25) return 0
  if (progress < 50) return 1
  if (progress < 75) return 2
  if (progress < 100) return 3
  return 4
})

function formatRole(role: string) {
  const roleMap: Record<string, string> = {
    orchestrator: '架构师',
    tech_lead: '技术负责人',
    frontend_dev: '前端开发',
    backend_dev: '后端开发',
    qa_engineer: '质量保障',
  }
  return roleMap[role] || role
}

function formatStatus(status: string) {
  const statusMap: Record<string, string> = {
    working: '工作中',
    idle: '空闲',
    error: '异常',
    offline: '离线',
  }
  return statusMap[status] || status
}

function getStatusType(status: string) {
  const typeMap: Record<string, string> = {
    working: 'primary',
    idle: 'success',
    error: 'danger',
    offline: 'info',
  }
  return typeMap[status] || 'info'
}

function truncate(str: string, maxLength: number) {
  if (!str || str.length <= maxLength) return str
  return str.slice(0, maxLength) + '...'
}
</script>

<style scoped>
.agent-workflow-card {
  padding: 16px;
  border-radius: 12px;
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color-lighter);
}

.workflow-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.agent-info {
  flex: 1;
  min-width: 0;
}

.agent-name {
  font-weight: 500;
  font-size: 14px;
  color: var(--el-text-color-primary);
}

.agent-role {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.workflow-task {
  background: white;
  padding: 12px;
  border-radius: 8px;
  margin-bottom: 12px;
}

.task-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  color: var(--el-text-color-primary);
}

.task-title {
  font-size: 13px;
  font-weight: 500;
}

.task-progress {
  margin-top: 8px;
}

.workflow-idle {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px;
  background: white;
  border-radius: 8px;
  margin-bottom: 12px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.workflow-steps {
  display: flex;
  justify-content: space-between;
  gap: 4px;
}

.workflow-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  flex: 1;
}

.step-dot {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--el-fill-color);
  border: 1px solid var(--el-border-color);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  transition: all 0.3s;
}

.workflow-step.active .step-dot {
  background: var(--el-color-primary);
  border-color: var(--el-color-primary);
  color: white;
}

.workflow-step.completed .step-dot {
  background: var(--el-color-success);
  border-color: var(--el-color-success);
  color: white;
}

.step-label {
  font-size: 11px;
  color: var(--el-text-color-secondary);
}

.workflow-step.active .step-label {
  color: var(--el-color-primary);
  font-weight: 500;
}
</style>

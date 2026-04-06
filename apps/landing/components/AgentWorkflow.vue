<template>
  <div class="agent-workflow" :class="{ collapsed: isCollapsed }">
    <!-- Workflow Header -->
    <div class="workflow-header">
      <div class="header-info">
        <el-icon class="header-icon"><Connection /></el-icon>
        <span class="header-title">Workflow</span>
      </div>
      <div class="header-actions">
        <button class="header-btn" :class="{ active: autoMode }" @click="autoMode = !autoMode">
          <el-icon><Star /></el-icon>
          <span>Auto</span>
        </button>
        <button class="header-btn" @click="showHistory = !showHistory">
          <el-icon><Timer /></el-icon>
          <span>History</span>
        </button>
        <button class="header-btn" @click="$emit('toggle')">
          <el-icon><ArrowDown v-if="!isCollapsed" /><ArrowUp v-else /></el-icon>
        </button>
      </div>
    </div>

    <!-- Workflow Content -->
    <div v-if="!isCollapsed" class="workflow-content">
      <!-- Current Task -->
      <div v-if="currentTask" class="current-task">
        <div class="task-badge">Current</div>
        <div class="task-info">
          <span class="task-name">{{ currentTask.name }}</span>
          <span class="task-assignee">Assigned to {{ getAgentName(currentTask.agentId) }}</span>
        </div>
        <div class="task-progress">
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: currentTask.progress + '%' }"></div>
          </div>
          <span class="progress-text">{{ currentTask.progress }}%</span>
        </div>
      </div>

      <!-- Workflow Timeline -->
      <div class="workflow-timeline">
        <div
          v-for="(step, index) in workflowSteps"
          :key="step.id"
          class="timeline-step"
          :class="{
            completed: step.status === 'completed',
            active: step.status === 'active',
            pending: step.status === 'pending'
          }"
        >
          <!-- Connector Line -->
          <div v-if="index > 0" class="step-connector" :class="step.status"></div>

          <!-- Step Content -->
          <div class="step-content">
            <div class="step-icon-wrapper">
              <img
                v-if="step.agentId"
                :src="getAgentAvatar(step.agentId)"
                class="step-avatar"
                :alt="getAgentName(step.agentId)"
              />
              <div v-else class="step-icon">
                <el-icon><component :is="step.icon" /></el-icon>
              </div>
              <div v-if="step.status === 'active'" class="step-pulse"></div>
            </div>

            <div class="step-details">
              <div class="step-header">
                <span class="step-name">{{ step.name }}</span>
                <span class="step-status" :class="step.status">{{ step.status }}</span>
              </div>
              <p class="step-desc">{{ step.description }}</p>

              <!-- Active Step Details -->
              <div v-if="step.status === 'active' && step.subtasks" class="subtasks">
                <div
                  v-for="subtask in step.subtasks"
                  :key="subtask.id"
                  class="subtask"
                  :class="{ completed: subtask.completed }"
                >
                  <el-icon class="subtask-icon">
                    <CircleCheck v-if="subtask.completed" />
                    <Loading v-else class="is-loading" />
                  </el-icon>
                  <span class="subtask-name">{{ subtask.name }}</span>
                </div>
              </div>

              <!-- Step Metrics -->
              <div v-if="step.metrics" class="step-metrics">
                <div v-for="(value, key) in step.metrics" :key="key" class="metric">
                  <span class="metric-value">{{ value }}</span>
                  <span class="metric-label">{{ key }}</span>
                </div>
              </div>
            </div>

            <!-- Step Time -->
            <div class="step-time">
              <span v-if="step.status === 'completed'">{{ step.duration }}</span>
              <span v-else-if="step.status === 'active'">{{ step.eta }} remaining</span>
              <span v-else>Pending</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Agent Distribution -->
      <div class="agent-distribution">
        <div class="distribution-header">
          <span>Team Workload</span>
        </div>
        <div class="distribution-list">
          <div
            v-for="agent in agentWorkload"
            :key="agent.id"
            class="workload-item"
          >
            <img :src="agent.avatar" class="workload-avatar" :alt="agent.name" />
            <div class="workload-info">
              <span class="workload-name">{{ agent.name }}</span>
              <div class="workload-bar">
                <div
                  class="workload-fill"
                  :style="{ width: agent.load + '%' }"
                  :class="{ high: agent.load > 80, medium: agent.load > 50 }"
                ></div>
              </div>
            </div>
            <span class="workload-percent">{{ agent.load }}%</span>
          </div>
        </div>
      </div>

      <!-- Workflow Controls -->
      <div class="workflow-controls">
        <button class="control-btn" :disabled="!canPause" @click="pauseWorkflow">
          <el-icon><VideoPause /></el-icon>
          <span>Pause</span>
        </button>
        <button class="control-btn primary" :disabled="!canResume" @click="resumeWorkflow">
          <el-icon><VideoPlay /></el-icon>
          <span>Resume</span>
        </button>
        <button class="control-btn danger" @click="cancelWorkflow">
          <el-icon><CircleClose /></el-icon>
          <span>Cancel</span>
        </button>
      </div>
    </div>

    <!-- History Panel -->
    <div v-if="showHistory && !isCollapsed" class="history-panel">
      <div class="history-header">
        <span>Completed Workflows</span>
        <button class="close-btn" @click="showHistory = false">
          <el-icon><Close /></el-icon>
        </button>
      </div>
      <div class="history-list">
        <div
          v-for="item in workflowHistory"
          :key="item.id"
          class="history-item"
        >
          <div class="history-icon" :class="item.status">
            <el-icon>
              <CircleCheck v-if="item.status === 'success'" />
              <CircleClose v-else-if="item.status === 'failed'" />
              <Warning v-else />
            </el-icon>
          </div>
          <div class="history-info">
            <span class="history-name">{{ item.name }}</span>
            <span class="history-time">{{ item.time }}</span>
          </div>
          <button class="history-replay" @click="replayWorkflow(item)">
            <el-icon><RefreshRight /></el-icon>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  Connection,
  Star,
  Timer,
  ArrowDown,
  ArrowUp,
  CircleCheck,
  Loading,
  VideoPause,
  VideoPlay,
  CircleClose,
  Close,
  Warning,
  RefreshRight,
  Document,
  DocumentCopy,
  Upload,
  Search,
  DataLine
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

interface WorkflowStep {
  id: string
  name: string
  description: string
  agentId?: string
  icon?: any
  status: 'pending' | 'active' | 'completed'
  progress?: number
  duration?: string
  eta?: string
  subtasks?: { id: string; name: string; completed: boolean }[]
  metrics?: Record<string, string | number>
}

interface Agent {
  id: string
  name: string
  avatar: string
}

const props = defineProps<{
  isCollapsed?: boolean
}>()

const emit = defineEmits<['toggle', 'pause', 'resume', 'cancel', 'replay']>()

// Agent registry
const agents: Agent[] = [
  { id: 'iris', name: 'Iris', avatar: '/avatars/shiba_qa.png' },
  { id: 'emma', name: 'Emma', avatar: '/avatars/shiba_fe.png' },
  { id: 'bob', name: 'Bob', avatar: '/avatars/shiba_qa.png' },
  { id: 'alex', name: 'Alex', avatar: '/avatars/shiba_be.png' },
  { id: 'sarah', name: 'Sarah', avatar: '/avatars/shiba_tl.png' }
]

// State
const autoMode = ref(true)
const showHistory = ref(false)
const workflowStatus = ref<'running' | 'paused' | 'idle'>('running')

const currentTask = ref({
  name: 'Building UI Components',
  agentId: 'alex',
  progress: 65
})

const workflowSteps = ref<WorkflowStep[]>([
  {
    id: 'research',
    name: 'Market Research',
    description: 'Iris is analyzing market trends and competitor landscape',
    agentId: 'iris',
    status: 'completed',
    duration: '2m 15s',
    metrics: { insights: 12, sources: 8 }
  },
  {
    id: 'planning',
    name: 'Product Planning',
    description: 'Emma is defining features and user stories',
    agentId: 'emma',
    status: 'completed',
    duration: '3m 42s',
    metrics: { features: 8, stories: 24 }
  },
  {
    id: 'architecture',
    name: 'System Architecture',
    description: 'Bob is designing the technical architecture',
    agentId: 'bob',
    status: 'completed',
    duration: '4m 20s',
    metrics: { components: 12, apis: 6 }
  },
  {
    id: 'development',
    name: 'Development',
    description: 'Alex is building the frontend and backend',
    agentId: 'alex',
    status: 'active',
    eta: '5m',
    progress: 65,
    subtasks: [
      { id: '1', name: 'Setup project structure', completed: true },
      { id: '2', name: 'Build UI components', completed: true },
      { id: '3', name: 'Implement API endpoints', completed: false },
      { id: '4', name: 'Add authentication', completed: false }
    ],
    metrics: { files: 24, commits: 8 }
  },
  {
    id: 'seo',
    name: 'SEO Optimization',
    description: 'Sarah will optimize for search engines',
    agentId: 'sarah',
    status: 'pending'
  },
  {
    id: 'deploy',
    name: 'Deployment',
    description: 'Deploy to production environment',
    icon: Upload,
    status: 'pending'
  }
])

const agentWorkload = ref([
  { id: 'iris', name: 'Iris', avatar: '/avatars/shiba_qa.png', load: 0 },
  { id: 'emma', name: 'Emma', avatar: '/avatars/shiba_fe.png', load: 0 },
  { id: 'bob', name: 'Bob', avatar: '/avatars/shiba_qa.png', load: 0 },
  { id: 'alex', name: 'Alex', avatar: '/avatars/shiba_be.png', load: 75 },
  { id: 'sarah', name: 'Sarah', avatar: '/avatars/shiba_tl.png', load: 30 }
])

const workflowHistory = ref([
  { id: '1', name: 'Landing Page Generator', status: 'success', time: '2 hours ago' },
  { id: '2', name: 'E-commerce Dashboard', status: 'success', time: '5 hours ago' },
  { id: '3', name: 'Mobile App Prototype', status: 'failed', time: '1 day ago' },
  { id: '4', name: 'Blog Platform', status: 'success', time: '2 days ago' }
])

// Computed
const canPause = computed(() => workflowStatus.value === 'running')
const canResume = computed(() => workflowStatus.value === 'paused')

// Methods
const getAgentName = (id: string): string => {
  return agents.find(a => a.id === id)?.name || 'Unknown'
}

const getAgentAvatar = (id: string): string => {
  return agents.find(a => a.id === id)?.avatar || '/avatars/shiba_tl.png'
}

const pauseWorkflow = () => {
  workflowStatus.value = 'paused'
  ElMessage.info('Workflow paused')
  emit('pause')
}

const resumeWorkflow = () => {
  workflowStatus.value = 'running'
  ElMessage.success('Workflow resumed')
  emit('resume')
}

const cancelWorkflow = () => {
  workflowStatus.value = 'idle'
  ElMessage.warning('Workflow cancelled')
  emit('cancel')
}

const replayWorkflow = (item: any) => {
  ElMessage.info(`Replaying: ${item.name}`)
  emit('replay', item)
}
</script>

<style scoped>
.agent-workflow {
  background: #ffffff;
  border-top: 1px solid #f3f4f6;
}

.agent-workflow.collapsed {
  padding: 12px 16px;
}

/* Header */
.workflow-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
}

.header-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-icon {
  font-size: 16px;
  color: #4f46e5;
}

.header-title {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
}

.header-actions {
  display: flex;
  gap: 4px;
}

.header-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: transparent;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.15s ease;
}

.header-btn:hover {
  background: #f3f4f6;
  color: #374151;
}

.header-btn.active {
  background: #eef2ff;
  color: #4f46e5;
}

/* Workflow Content */
.workflow-content {
  padding: 0 16px 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Current Task */
.current-task {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%);
  border-radius: 10px;
}

.task-badge {
  align-self: flex-start;
  padding: 2px 8px;
  background: #4f46e5;
  color: white;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  border-radius: 4px;
}

.task-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.task-name {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
}

.task-assignee {
  font-size: 12px;
  color: #6b7280;
}

.task-progress {
  display: flex;
  align-items: center;
  gap: 8px;
}

.progress-bar {
  flex: 1;
  height: 4px;
  background: rgba(255, 255, 255, 0.5);
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #4f46e5;
  border-radius: 2px;
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 12px;
  font-weight: 500;
  color: #4f46e5;
}

/* Workflow Timeline */
.workflow-timeline {
  display: flex;
  flex-direction: column;
}

.timeline-step {
  position: relative;
  display: flex;
  flex-direction: column;
}

.step-connector {
  position: absolute;
  left: 16px;
  top: -12px;
  width: 2px;
  height: 24px;
}

.step-connector.completed {
  background: #22c55e;
}

.step-connector.active {
  background: linear-gradient(to bottom, #22c55e, #4f46e5);
}

.step-connector.pending {
  background: #e5e7eb;
}

.step-content {
  display: flex;
  gap: 12px;
  padding: 8px 0;
}

.step-icon-wrapper {
  position: relative;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
}

.step-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid #e5e7eb;
}

.step-icon {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #f3f4f6;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9ca3af;
}

.step-pulse {
  position: absolute;
  top: -2px;
  left: -2px;
  right: -2px;
  bottom: -2px;
  border-radius: 50%;
  border: 2px solid #4f46e5;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% {
    transform: scale(1);
    opacity: 1;
  }
  100% {
    transform: scale(1.2);
    opacity: 0;
  }
}

.step-details {
  flex: 1;
  min-width: 0;
}

.step-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 2px;
}

.step-name {
  font-size: 13px;
  font-weight: 500;
  color: #111827;
}

.step-status {
  padding: 1px 6px;
  font-size: 10px;
  font-weight: 500;
  text-transform: uppercase;
  border-radius: 4px;
}

.step-status.completed {
  background: #dcfce7;
  color: #16a34a;
}

.step-status.active {
  background: #eef2ff;
  color: #4f46e5;
}

.step-status.pending {
  background: #f3f4f6;
  color: #9ca3af;
}

.step-desc {
  font-size: 11px;
  color: #6b7280;
  margin: 0 0 6px;
  line-height: 1.4;
}

/* Subtasks */
.subtasks {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 8px;
}

.subtask {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #6b7280;
}

.subtask.completed {
  color: #16a34a;
}

.subtask-icon {
  font-size: 12px;
}

/* Step Metrics */
.step-metrics {
  display: flex;
  gap: 12px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #f3f4f6;
}

.metric {
  display: flex;
  align-items: baseline;
  gap: 2px;
}

.metric-value {
  font-size: 13px;
  font-weight: 600;
  color: #111827;
}

.metric-label {
  font-size: 10px;
  color: #9ca3af;
  text-transform: uppercase;
}

.step-time {
  font-size: 11px;
  color: #9ca3af;
  white-space: nowrap;
}

/* Agent Distribution */
.agent-distribution {
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  overflow: hidden;
}

.distribution-header {
  padding: 10px 12px;
  background: #f9fafb;
  font-size: 12px;
  font-weight: 500;
  color: #374151;
}

.distribution-list {
  padding: 8px;
}

.workload-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
}

.workload-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  object-fit: cover;
}

.workload-info {
  flex: 1;
  min-width: 0;
}

.workload-name {
  display: block;
  font-size: 12px;
  font-weight: 500;
  color: #374151;
  margin-bottom: 4px;
}

.workload-bar {
  height: 4px;
  background: #e5e7eb;
  border-radius: 2px;
  overflow: hidden;
}

.workload-fill {
  height: 100%;
  background: #22c55e;
  border-radius: 2px;
  transition: width 0.3s ease;
}

.workload-fill.medium {
  background: #f59e0b;
}

.workload-fill.high {
  background: #ef4444;
}

.workload-percent {
  font-size: 11px;
  font-weight: 500;
  color: #6b7280;
  min-width: 28px;
  text-align: right;
}

/* Workflow Controls */
.workflow-controls {
  display: flex;
  gap: 8px;
}

.control-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 12px;
  color: #374151;
  cursor: pointer;
  transition: all 0.15s ease;
}

.control-btn:hover:not(:disabled) {
  background: #f3f4f6;
  border-color: #d1d5db;
}

.control-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.control-btn.primary {
  background: #4f46e5;
  border-color: #4f46e5;
  color: white;
}

.control-btn.primary:hover:not(:disabled) {
  background: #4338ca;
}

.control-btn.danger {
  color: #ef4444;
}

.control-btn.danger:hover {
  background: #fef2f2;
  border-color: #fecaca;
}

/* History Panel */
.history-panel {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: #ffffff;
  border-top: 1px solid #e5e7eb;
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.1);
  z-index: 100;
  max-height: 400px;
  display: flex;
  flex-direction: column;
}

.history-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #f3f4f6;
  font-size: 14px;
  font-weight: 600;
  color: #111827;
}

.close-btn {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: #9ca3af;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  background: #f3f4f6;
  color: #6b7280;
}

.history-list {
  overflow-y: auto;
  padding: 8px;
}

.history-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.history-item:hover {
  background: #f9fafb;
}

.history-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.history-icon.success {
  background: #dcfce7;
  color: #16a34a;
}

.history-icon.failed {
  background: #fee2e2;
  color: #dc2626;
}

.history-icon.warning {
  background: #fef3c7;
  color: #d97706;
}

.history-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.history-name {
  font-size: 13px;
  font-weight: 500;
  color: #374151;
}

.history-time {
  font-size: 11px;
  color: #9ca3af;
}

.history-replay {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: #9ca3af;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.history-replay:hover {
  background: #f3f4f6;
  color: #4f46e5;
}
</style>

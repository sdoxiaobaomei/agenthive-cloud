<template>
  <div class="agent-detail-page">
    <div class="page-header">
      <div class="header-left">
        <el-button :icon="ArrowLeft" text @click="goBack">返回</el-button>
        <div v-if="agent" class="header-title">
          <AgentAvatar :role="agent.role" :status="agent.status" :size="40" />
          <div>
            <h1 class="page-title">{{ agent.name }}</h1>
            <p class="page-subtitle">{{ formatRole(agent.role) }} · {{ formatStatus(agent.status) }}</p>
          </div>
        </div>
      </div>
      <div class="header-actions" v-if="agent">
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
      </div>
    </div>
    
    <div v-if="loading" class="loading-wrapper">
      <el-skeleton :rows="10" animated />
    </div>
    
    <div v-else-if="!agent" class="empty-wrapper">
      <el-empty description="Agent 不存在" />
    </div>
    
    <div v-else class="detail-content">
      <el-tabs v-model="activeTab" type="border-card">
        <el-tab-pane label="概览" name="overview">
          <div class="overview-grid">
            <el-card class="info-card">
              <template #header>基本信息</template>
              <div class="info-list">
                <div class="info-item">
                  <span class="label">ID</span>
                  <span class="value">{{ agent.id }}</span>
                </div>
                <div class="info-item">
                  <span class="label">角色</span>
                  <span class="value">{{ formatRole(agent.role) }}</span>
                </div>
                <div class="info-item">
                  <span class="label">状态</span>
                  <el-tag :type="getStatusType(agent.status)" size="small">
                    {{ formatStatus(agent.status) }}
                  </el-tag>
                </div>
                <div class="info-item">
                  <span class="label">Pod IP</span>
                  <span class="value">{{ agent.podIp || '未分配' }}</span>
                </div>
                <div class="info-item">
                  <span class="label">创建时间</span>
                  <span class="value">{{ formatDateTime(agent.createdAt) }}</span>
                </div>
              </div>
            </el-card>
            
            <el-card class="stats-card">
              <template #header>任务统计</template>
              <div class="stats-grid">
                <div class="stat-item">
                  <div class="stat-value">{{ stats?.totalTasks || 0 }}</div>
                  <div class="stat-label">总任务</div>
                </div>
                <div class="stat-item success">
                  <div class="stat-value">{{ stats?.completedTasks || 0 }}</div>
                  <div class="stat-label">已完成</div>
                </div>
                <div class="stat-item danger">
                  <div class="stat-value">{{ stats?.failedTasks || 0 }}</div>
                  <div class="stat-label">失败</div>
                </div>
              </div>
            </el-card>
          </div>
        </el-tab-pane>
        
        <el-tab-pane label="任务" name="tasks">
          <TaskList :tasks="tasks" :agent-id="agent.id" />
        </el-tab-pane>
        
        <el-tab-pane label="终端" name="terminal">
          <Terminal 
            :agent-id="agent.id" 
            :show-input="true"
            @command="handleTerminalCommand"
          />
        </el-tab-pane>
        
        <el-tab-pane label="代码" name="code">
          <CodeEditor 
            v-model="codeContent"
            :file-name="currentFile || 'main.go'"
            :show-header="true"
          />
        </el-tab-pane>
        
        <el-tab-pane label="日志" name="logs">
          <div class="logs-container">
            <el-input
              v-model="logs"
              type="textarea"
              :rows="20"
              readonly
              class="logs-textarea"
            />
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ArrowLeft, VideoPlay, VideoPause, RefreshRight, CircleClose
} from '@element-plus/icons-vue'
import { useAgentStore } from '@/stores/agent'
import { useWebSocketStore } from '@/stores/websocket'
import AgentAvatar from '@/components/agent/AgentAvatar.vue'
import TaskList from '@/components/agent/TaskList.vue'
import Terminal from '@/components/terminal/Terminal.vue'
import CodeEditor from '@/components/code/CodeEditor.vue'
import { formatRole, formatStatus, getStatusType, formatDateTime } from '@/utils/format'
import { ElMessage } from 'element-plus'

const route = useRoute()
const router = useRouter()
const agentStore = useAgentStore()
const wsStore = useWebSocketStore()

const agentId = computed(() => route.params.id as string)
const agent = computed(() => agentStore.currentAgent)
const tasks = computed(() => agentStore.agentTasks)
const stats = computed(() => ({
  totalTasks: tasks.value.length,
  completedTasks: tasks.value.filter(t => t.status === 'completed').length,
  failedTasks: tasks.value.filter(t => t.status === 'failed').length,
  avgCompletionTime: 0,
}))

const loading = ref(false)
const activeTab = ref('overview')
const logs = ref('Loading logs...')
const codeContent = ref('// Agent code will appear here...')
const currentFile = ref('')

const fetchData = async () => {
  loading.value = true
  try {
    await agentStore.fetchAgentDetail(agentId.value)
  } finally {
    loading.value = false
  }
}

const goBack = () => {
  router.back()
}

const handleAction = async (action: string) => {
  try {
    switch (action) {
      case 'start':
        await agentStore.startAgent(agentId.value)
        ElMessage.success('Agent 已启动')
        break
      case 'stop':
        await agentStore.stopAgent(agentId.value)
        ElMessage.success('Agent 已停止')
        break
      case 'pause':
        await agentStore.pauseAgent(agentId.value)
        ElMessage.success('Agent 已暂停')
        break
      case 'resume':
        await agentStore.resumeAgent(agentId.value)
        ElMessage.success('Agent 已恢复')
        break
    }
  } catch (error) {
    ElMessage.error('操作失败')
  }
}

const handleTerminalCommand = (command: string) => {
  wsStore.sendCommand(agentId.value, {
    type: 'terminal',
    payload: { command },
  })
}

onMounted(() => {
  fetchData()
})
</script>

<style scoped>
.agent-detail-page {
  padding: 8px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 12px;
}

.page-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}

.page-subtitle {
  margin: 4px 0 0 0;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.loading-wrapper {
  padding: 40px;
}

.empty-wrapper {
  padding: 60px;
}

.detail-content {
  :deep(.el-tabs__content) {
    padding: 20px;
  }
}

.overview-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.info-card, .stats-card {
  :deep(.el-card__header) {
    font-weight: 600;
  }
}

.info-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.info-item .label {
  color: var(--el-text-color-secondary);
}

.info-item .value {
  font-family: var(--font-mono);
  color: var(--el-text-color-primary);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}

.stat-item {
  text-align: center;
  padding: 20px;
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
  font-size: 28px;
  font-weight: 700;
  margin-bottom: 8px;
}

.stat-label {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.logs-container {
  .logs-textarea :deep(textarea) {
    font-family: var(--font-mono);
    background: #1e1e1e;
    color: #d4d4d4;
  }
}

:deep(.el-tabs) {
  height: calc(100vh - 200px);
}

:deep(.el-tab-pane) {
  height: 100%;
}
</style>

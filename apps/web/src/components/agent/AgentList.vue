<template>
  <div class="agent-list">
    <div class="list-header">
      <div class="header-title">
        <h3>Agent 团队</h3>
        <el-tag type="info" size="small">{{ agents.length }} 个</el-tag>
      </div>
      <div class="header-actions">
        <el-input
          v-model="searchQuery"
          placeholder="搜索 Agent..."
          :prefix-icon="Search"
          clearable
          size="small"
          style="width: 160px"
        />
        <el-button 
          type="primary" 
          :icon="Plus"
          size="small"
          @click="handleCreate"
        >
          新建
        </el-button>
      </div>
    </div>
    
    <el-scrollbar class="list-content" v-loading="loading">
      <div v-if="filteredAgents.length === 0" class="empty-state">
        <el-empty :description="searchQuery ? '未找到匹配的 Agent' : '暂无 Agent'" />
      </div>
      
      <div v-else class="agents-grid">
        <AgentCard
          v-for="agent in filteredAgents"
          :key="agent.id"
          :agent="agent"
          :is-selected="selectedId === agent.id"
          @click="handleSelect(agent)"
          @command="handleCommand"
        />
      </div>
    </el-scrollbar>
    
    <div class="list-footer">
      <div class="status-summary">
        <span class="status-item">
          <span class="dot working"></span>
          <span>{{ activeCount }} 工作中</span>
        </span>
        <span class="status-item">
          <span class="dot idle"></span>
          <span>{{ idleCount }} 空闲</span>
        </span>
        <span class="status-item" v-if="errorCount > 0">
          <span class="dot error"></span>
          <span>{{ errorCount }} 错误</span>
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Search, Plus } from '@element-plus/icons-vue'
import AgentCard from './AgentCard.vue'
import type { Agent } from '@/types'

const props = defineProps<{
  agents: Agent[]
  loading?: boolean
  modelValue?: string | null
}>()

const emit = defineEmits<{
  'update:modelValue': [id: string | null]
  select: [agent: Agent]
  create: []
  command: [command: string, agent: Agent]
}>()

const searchQuery = ref('')

const selectedId = computed({
  get: () => props.modelValue ?? null,
  set: (val: string | null) => emit('update:modelValue', val)
})

const filteredAgents = computed(() => {
  if (!searchQuery.value) return props.agents
  const query = searchQuery.value.toLowerCase()
  return props.agents.filter(agent => 
    agent.name.toLowerCase().includes(query) ||
    agent.role.toLowerCase().includes(query)
  )
})

const activeCount = computed(() => 
  props.agents.filter(a => a.status === 'working').length
)

const idleCount = computed(() => 
  props.agents.filter(a => a.status === 'idle').length
)

const errorCount = computed(() => 
  props.agents.filter(a => a.status === 'error').length
)

const handleSelect = (agent: Agent) => {
  selectedId.value = agent.id
  emit('select', agent)
}

const handleCreate = () => {
  emit('create')
}

const handleCommand = (command: string, agent: Agent) => {
  emit('command', command, agent)
}
</script>

<style scoped>
.agent-list {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--el-bg-color);
  border-right: 1px solid var(--el-border-color-light);
}

.list-header {
  padding: 16px;
  border-bottom: 1px solid var(--el-border-color-light);
}

.header-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.header-title h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.list-content {
  flex: 1;
  padding: 12px;
  overflow: hidden;
}

.empty-state {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.agents-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.list-footer {
  padding: 12px 16px;
  border-top: 1px solid var(--el-border-color-light);
  background: var(--el-fill-color-light);
}

.status-summary {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.status-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.dot.working { background: var(--agent-working); }
.dot.idle { background: var(--agent-idle); }
.dot.error { background: var(--agent-error); }
</style>

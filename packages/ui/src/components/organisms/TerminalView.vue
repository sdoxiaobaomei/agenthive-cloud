<template>
  <div class="terminal-view-page" :class="{ embedded: props.embedded }">
    <div v-if="!embedded" class="page-header">
      <div>
        <h1 class="page-title">终端</h1>
        <p class="page-subtitle">实时查看 Agent 终端输出</p>
      </div>
    </div>
    
    <el-tabs v-model="activeTab" type="border-card" class="terminal-tabs">
      <el-tab-pane 
        v-for="agent in agents" 
        :key="agent.id"
        :label="agent.name"
        :name="agent.id"
      >
        <Terminal
          :agent-id="agent.id"
          :title="agent.name"
          :show-header="true"
          :show-input="true"
          @command="(cmd) => handleCommand(agent.id, cmd)"
        />
      </el-tab-pane>
      
      <el-tab-pane v-if="agents.length === 0" label="系统终端" name="system">
        <Terminal
          agent-id="system"
          title="系统终端"
          :show-header="true"
        />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAgentStore } from '../stores/agent'
import { useWebSocketStore } from '../stores/websocket'
import Terminal from '../organisms/Terminal.vue'

const props = withDefaults(defineProps<{
  embedded?: boolean
}>(), {
  embedded: false,
})

const agentStore = useAgentStore()
const wsStore = useWebSocketStore()

const agents = computed(() => agentStore.agents)
const activeTab = ref('')

const handleCommand = (agentId: string, command: string) => {
  wsStore.sendCommand(agentId, {
    type: 'terminal',
    payload: { command },
  })
}

onMounted(async () => {
  if (agents.value.length === 0) {
    await agentStore.fetchAgents()
  }
  if (agents.value.length > 0) {
    activeTab.value = agents.value[0].id
  } else {
    activeTab.value = 'system'
  }
})
</script>

<style scoped>
.terminal-view-page {
  padding: 8px;
  height: calc(100vh - 100px);
  display: flex;
  flex-direction: column;
}

.terminal-view-page.embedded {
  padding: 0;
  height: 100%;
}

.page-header {
  margin-bottom: 16px;
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

.terminal-tabs {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.terminal-tabs :deep(.el-tabs__content) {
  flex: 1;
  padding: 0;
}

.terminal-tabs :deep(.el-tab-pane) {
  height: 100%;
}
</style>

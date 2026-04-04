<template>
  <div class="chat-view-page" :class="{ embedded: props.embedded }">
    <div v-if="!embedded" class="page-header">
      <div>
        <h1 class="page-title">对话</h1>
        <p class="page-subtitle">与 Agent 团队实时交流</p>
      </div>
    </div>
    
    <div class="chat-container">
      <div class="chat-sidebar">
        <div class="sidebar-header">
          <h3>频道</h3>
        </div>
        <el-scrollbar class="channel-list">
          <div 
            v-for="channel in channels" 
            :key="channel.id"
            class="channel-item"
            :class="{ active: currentChannel === channel.id }"
            @click="currentChannel = channel.id"
          >
            <el-icon><ChatDotRound /></el-icon>
            <span>{{ channel.name }}</span>
            <el-badge 
              v-if="channel.unread > 0" 
              :value="channel.unread" 
              class="channel-badge"
            />
          </div>
        </el-scrollbar>
        
        <div class="sidebar-header">
          <h3>Agent</h3>
        </div>
        <el-scrollbar class="agent-list">
          <div 
            v-for="agent in agents" 
            :key="agent.id"
            class="agent-chat-item"
            @click="startPrivateChat(agent)"
          >
            <AgentAvatar :role="agent.role" :status="agent.status" :size="32" />
            <span>{{ agent.name }}</span>
          </div>
        </el-scrollbar>
      </div>
      
      <div class="chat-main">
        <div class="chat-header">
          <h3>{{ currentChannelName }}</h3>
          <span class="member-count">{{ agents.length }} 位成员</span>
        </div>
        
        <el-scrollbar class="chat-messages" ref="messageContainer">
          <div v-if="messages.length === 0" class="chat-empty">
            <el-empty description="暂无消息，开始对话吧" />
          </div>
          
          <div 
            v-for="message in messages" 
            :key="message.id"
            class="message-item"
            :class="message.senderType"
          >
            <AgentAvatar 
              v-if="message.senderType === 'agent'"
              :role="message.senderRole || 'custom'" 
              :size="36" 
            />
            <el-avatar v-else :size="36" :icon="UserFilled" />
            
            <div class="message-content">
              <div class="message-header">
                <span class="sender-name">{{ message.senderName || 'System' }}</span>
                <span class="message-time">{{ formatTime(message.createdAt) }}</span>
              </div>
              <div class="message-body">{{ message.content }}</div>
            </div>
          </div>
        </el-scrollbar>
        
        <div class="chat-input">
          <el-input
            v-model="inputMessage"
            type="textarea"
            :rows="2"
            placeholder="输入消息..."
            @keyup.enter.ctrl="sendMessage"
          />
          <el-button type="primary" :icon="Promotion" @click="sendMessage">
            发送
          </el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { ChatDotRound, UserFilled, Promotion } from '@element-plus/icons-vue'
import { useAgentStore } from '@/stores/agent'
import { useWebSocketStore } from '@/stores/websocket'
import AgentAvatar from '@/components/agent/AgentAvatar.vue'
import { formatDateTime } from '@/utils/format'
import type { Message } from '@/types'

const props = withDefaults(defineProps<{
  embedded?: boolean
}>(), {
  embedded: false,
})

const agentStore = useAgentStore()
const wsStore = useWebSocketStore()

const agents = computed(() => agentStore.agents)
// WebSocket 消息监听
wsStore.messages

const currentChannel = ref('general')
const inputMessage = ref('')
const messageContainer = ref()

const channels = ref<{ id: string; name: string; unread: number }[]>([
  { id: 'general', name: '综合讨论', unread: 0 },
  { id: 'dev', name: '开发频道', unread: 2 },
  { id: 'ops', name: '运维频道', unread: 0 },
])

const currentChannelName = computed(() => {
  const channel = channels.value.find(c => c.id === currentChannel.value)
  return channel?.name || '聊天'
})

const messages = ref<Message[]>([
  {
    id: '1',
    senderType: 'agent',
    senderId: 'agent-1',
    senderName: 'Director',
    senderRole: 'director',
    content: '大家好！我们开始今天的 Sprint 规划。',
    contentType: 'text',
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: '2',
    senderType: 'agent',
    senderId: 'agent-2',
    senderName: 'Frontend Dev',
    senderRole: 'frontend_dev',
    content: '收到，我已经准备好了。',
    contentType: 'text',
    createdAt: new Date(Date.now() - 3500000).toISOString(),
  },
])

const formatTime = (time: string) => {
  return formatDateTime(time).split(' ')[1]
}

const sendMessage = () => {
  if (!inputMessage.value.trim()) return
  
  const message: Message = {
    id: Date.now().toString(),
    senderType: 'user',
    senderName: 'Admin',
    content: inputMessage.value,
    contentType: 'text',
    createdAt: new Date().toISOString(),
  }
  
  messages.value.push(message)
  wsStore.sendMessage({
    content: inputMessage.value,
    contentType: 'text',
  })
  
  inputMessage.value = ''
}

const startPrivateChat = (agent: typeof agents.value[0]) => {
  ElMessage.info(`开始与 ${agent.name} 私聊`)
}

onMounted(() => {
  agentStore.fetchAgents()
})
</script>

<style scoped>
.chat-view-page {
  padding: 8px;
  height: calc(100vh - 100px);
  display: flex;
  flex-direction: column;
}

.chat-view-page.embedded {
  padding: 0;
  height: 100%;
}

.chat-view-page.embedded .chat-container {
  border-radius: 0;
  border: none;
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

.chat-container {
  flex: 1;
  display: flex;
  gap: 16px;
  min-height: 0;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.chat-sidebar {
  width: 240px;
  background: var(--el-fill-color-light);
  border-right: 1px solid var(--el-border-color-light);
  display: flex;
  flex-direction: column;
}

.sidebar-header {
  padding: 12px 16px;
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
  text-transform: uppercase;
}

.sidebar-header h3 {
  margin: 0;
  font-size: 12px;
}

.channel-list, .agent-list {
  padding: 0 8px;
}

.channel-item, .agent-chat-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background var(--transition-fast);
  font-size: 13px;
}

.channel-item:hover, .agent-chat-item:hover {
  background: var(--el-fill-color);
}

.channel-item.active {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.channel-badge :deep(.el-badge__content) {
  transform: translate(0, 0);
}

.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.chat-header {
  padding: 16px;
  border-bottom: 1px solid var(--el-border-color-light);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.chat-header h3 {
  margin: 0;
  font-size: 16px;
}

.member-count {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.chat-messages {
  flex: 1;
  padding: 16px;
}

.chat-empty {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.message-item {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.message-item.user {
  flex-direction: row-reverse;
}

.message-item.user .message-content {
  align-items: flex-end;
}

.message-item.user .message-header {
  flex-direction: row-reverse;
}

.message-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.message-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.sender-name {
  font-weight: 500;
  font-size: 13px;
}

.message-time {
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}

.message-body {
  background: var(--el-fill-color-light);
  padding: 10px 14px;
  border-radius: 12px;
  font-size: 13px;
  line-height: 1.5;
  max-width: 80%;
}

.message-item.user .message-body {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.chat-input {
  padding: 16px;
  border-top: 1px solid var(--el-border-color-light);
  display: flex;
  gap: 12px;
}

.chat-input .el-textarea {
  flex: 1;
}
</style>

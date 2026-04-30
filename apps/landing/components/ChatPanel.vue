<template>
  <div class="chat-panel" :class="{ collapsed: isCollapsed }">
    <!-- Header -->
    <div class="panel-header">
      <div class="agent-info">
        <div class="agent-avatar-wrapper">
          <img src="/avatars/shiba_tl.png" class="agent-avatar" alt="Agent" />
          <span class="status-dot" :class="wsConnected ? 'online' : 'offline'"></span>
        </div>
        <div v-if="!isCollapsed" class="agent-details">
          <span class="agent-name">AgentHive Team</span>
          <span class="agent-status">{{ wsConnected ? 'Online' : 'Connecting...' }}</span>
        </div>
      </div>
      <div v-if="!isCollapsed" class="header-actions">
        <div class="credit-badge">
          <el-icon><Coin /></el-icon>
          <span>{{ creditsBalance.toFixed(1) }}</span>
        </div>
        <button class="header-btn" title="Clear chat" @click="clearChat">
          <el-icon><Delete /></el-icon>
        </button>
        <button class="header-btn" title="New session" @click="createNewSession">
          <el-icon><ChatDotRound /></el-icon>
        </button>
      </div>
    </div>

    <!-- Messages -->
    <div v-if="!isCollapsed" class="messages-area" ref="messagesContainer">
      <!-- Empty State -->
      <div v-if="messages.length === 0" class="empty-state">
        <div class="empty-avatar">
          <img src="/avatars/shiba_tl.png" alt="Agent" />
        </div>
        <div class="empty-welcome">
          <p class="empty-title">AI Team is ready</p>
          <p class="empty-desc">Describe your idea and we'll build it together</p>
        </div>
      </div>

      <!-- Message List -->
      <div v-else class="message-list">
        <div
          v-for="(msg, index) in messages"
          :key="msg.id"
          class="message-wrapper"
          :class="msg.role"
        >
          <div class="message">
            <img
              v-if="msg.role === 'assistant' || msg.role === 'agent'"
              src="/avatars/shiba_be.png"
              class="message-avatar"
              alt="Agent"
            />
            <img
              v-else-if="msg.role === 'system'"
              src="/avatars/shiba_qa.png"
              class="message-avatar"
              alt="System"
            />
            <img
              v-else
              :src="user?.avatar || '/avatars/shiba_tl.png'"
              class="message-avatar"
              alt="User"
            />

            <div class="message-content">
              <div class="message-header">
                <span class="message-author">{{ authorName(msg.role) }}</span>
                <span class="message-time">{{ formatTime(msg.createdAt || msg.timestamp || '') }}</span>
              </div>

              <div class="message-bubble" :class="msg.role">
                <div v-if="msg.isLoading" class="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
                <div v-else class="message-body" v-html="renderMarkdown(msg.content)"></div>
              </div>

              <!-- Agent Progress Cards -->
              <div v-if="msg.metadata?.tasks?.length" class="task-cards">
                <div
                  v-for="task in msg.metadata.tasks"
                  :key="task.id"
                  class="task-card"
                  :class="task.status"
                >
                  <el-icon v-if="task.status === 'completed'"><CircleCheck /></el-icon>
                  <el-icon v-else-if="task.status === 'failed'"><CircleClose /></el-icon>
                  <el-icon v-else-if="task.status === 'running'"><Loading class="is-loading" /></el-icon>
                  <el-icon v-else><Timer /></el-icon>
                  <span class="task-name">{{ task.role }}: {{ task.id }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Real-time Progress Panel -->
      <div v-if="agentLogs.length > 0" class="progress-panel">
        <div class="progress-header">
          <el-icon><VideoPlay /></el-icon>
          <span>Agent Progress</span>
          <el-tag size="small" :type="agentStatus === 'completed' ? 'success' : agentStatus === 'failed' ? 'danger' : 'primary'">
            {{ agentStatus }}
          </el-tag>
        </div>
        <div class="progress-logs">
          <div v-for="(log, i) in agentLogs" :key="i" class="log-line">
            <span class="log-time">{{ formatTime(new Date()) }}</span>
            <span class="log-text">{{ log }}</span>
          </div>
        </div>
      </div>

      <!-- Scroll to bottom button -->
      <button v-if="showScrollBtn" class="scroll-btn" @click="scrollToBottom">
        <el-icon><ArrowDown /></el-icon>
      </button>
    </div>

    <!-- Input Area -->
    <div v-if="!isCollapsed" class="input-area">
      <div class="input-container">
        <div class="input-wrapper" :class="{ focused: isInputFocused }">
          <textarea
            v-model="inputText"
            :disabled="isLoading || (!props.projectId && !props.currentProject?.id)"
            :placeholder="(!props.projectId && !props.currentProject?.id) ? 'Select a project first...' : 'Describe what you want to build...'"
            class="message-input"
            rows="1"
            @keydown.enter.prevent="handleEnter"
            @input="autoResize"
            @focus="isInputFocused = true"
            @blur="isInputFocused = false"
            ref="inputRef"
          />
          <div class="input-actions">
            <button
              class="send-btn"
              :class="{ active: inputText.trim() && !isLoading }"
              :disabled="!inputText.trim() || isLoading"
              @click="sendMessage"
            >
              <el-icon v-if="isLoading" class="is-loading"><Loading /></el-icon>
              <el-icon v-else><Promotion /></el-icon>
            </button>
          </div>
        </div>
        <div class="input-meta">
          <p class="input-hint">Press Enter to send, Shift + Enter for new line</p>
          <span class="cost-hint">{{ estimatedCost > 0 ? `预计消耗 ${estimatedCost} credits` : '~0.5 credits/msg' }}</span>
        </div>
      </div>
    </div>

    <!-- Collapsed View -->
    <div v-else class="collapsed-view">
      <button class="collapsed-btn" @click="$emit('expand')">
        <img src="/avatars/shiba_tl.png" class="collapsed-avatar" alt="Agent" />
        <span class="collapsed-badge">AI</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted, watch } from 'vue'
import {
  Delete,
  ChatDotRound,
  Loading,
  Promotion,
  ArrowDown,
  CircleCheck,
  CircleClose,
  Timer,
  VideoPlay,
  Coin,
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { io, Socket } from 'socket.io-client'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system' | 'agent'
  content: string
  createdAt?: string
  timestamp?: string
  isLoading?: boolean
  metadata?: {
    intent?: string
    tasks?: Array<{ id: string; role: string; status: string }>
  }
}

import type { Project } from '~/stores/project'

const props = defineProps<{
  isCollapsed?: boolean
  currentProject?: Project | null
  projectId?: string
  embedded?: boolean
  chatId?: string
}>()

const emit = defineEmits<{
  expand: []
}>()

const { user } = useAuth()
const { chat: chatApi, baseUrl, get } = useApi()
const creditsStore = useCreditsStore()
const creditsBalance = computed(() => creditsStore.balance)

const messagesContainer = ref<HTMLDivElement>()
const inputRef = ref<HTMLTextAreaElement>()
const messages = ref<ChatMessage[]>([])
const inputText = ref('')
const isLoading = ref(false)
const isInputFocused = ref(false)
const showScrollBtn = ref(false)
const sessionId = ref<string | null>(null)
const wsConnected = ref(false)
const agentStatus = ref('idle')
const agentLogs = ref<string[]>([])
const estimatedCost = ref(0)
const resolvedProjectName = ref('')

let socket: Socket | null = null

const authorName = (role: string) => {
  switch (role) {
    case 'assistant': return 'AI Team'
    case 'system': return 'System'
    case 'agent': return 'Agent'
    default: return 'You'
  }
}

const renderMarkdown = (content: string): string => {
  content = content.replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre class="code-block"><code>$2</code></pre>')
  content = content.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
  content = content.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  content = content.replace(/\*([^*]+)\*/g, '<em>$1</em>')
  content = content.replace(/\n/g, '<br>')
  return content
}

const autoResize = () => {
  const textarea = inputRef.value
  if (!textarea) return
  textarea.style.height = 'auto'
  textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px'
}

const handleEnter = (e: KeyboardEvent) => {
  if (e.shiftKey) return
  sendMessage()
}

const scrollToBottom = () => {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

const checkScroll = () => {
  if (!messagesContainer.value) return
  const { scrollTop, scrollHeight, clientHeight } = messagesContainer.value
  showScrollBtn.value = scrollHeight - scrollTop - clientHeight > 100
}

const formatTime = (date: string | Date): string => {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(d)
}

const fetchProjectName = async () => {
  if (props.currentProject?.name) {
    resolvedProjectName.value = props.currentProject.name
    return
  }
  if (!props.projectId) {
    resolvedProjectName.value = ''
    return
  }
  try {
    const res = await get(`/api/projects/${props.projectId}`)
    if (res.success && res.data?.name) {
      resolvedProjectName.value = res.data.name
    }
  } catch (err: any) {
    if (import.meta.dev) console.debug('[ChatPanel] Failed to fetch project name:', err.message)
  }
}

const createNewSession = async () => {
  try {
    const resolvedProjectId = props.projectId || props.currentProject?.id
    const res = await chatApi.createSession({
      projectId: resolvedProjectId,
      title: resolvedProjectName.value || props.currentProject?.name || 'New Chat',
    })
    if (res.success && res.data) {
      sessionId.value = res.data.id
      messages.value = []
      agentLogs.value = []
      agentStatus.value = 'idle'
      connectWebSocket(res.data.id)
      ElMessage.success('New session created')
    }
  } catch (err: any) {
    ElMessage.error(err.message || 'Failed to create session')
  }
}

const connectWebSocket = (sid: string) => {
  wsConnected.value = false
  if (socket) {
    socket.disconnect()
  }

  const wsUrl = baseUrl.replace(/^http/, 'ws')
  socket = io(`${wsUrl}/chat`, {
    auth: { token: localStorage.getItem('agenthive:auth-token') || '' },
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  })

  socket.on('connect', () => {
    wsConnected.value = true
    socket?.emit('session:join', sid)
  })

  socket.on('disconnect', () => {
    wsConnected.value = false
  })

  socket.on('connect_error', (err: Error) => {
    wsConnected.value = false
    console.error('[WebSocket] connect_error:', err.message)
  })

  socket.on('error', () => {
    wsConnected.value = false
  })

  socket.on('reconnect_attempt', () => {
    // reconnecting state is implicitly offline
  })

  socket.on('session:state', (data: any) => {
    agentStatus.value = data.status || 'idle'
    if (data.logs?.length) {
      agentLogs.value = data.logs.slice(-20)
    }
  })

  socket.on('session:update', (data: any) => {
    agentStatus.value = data.status || agentStatus.value
    if (data.log) {
      agentLogs.value.push(data.log)
      if (agentLogs.value.length > 50) agentLogs.value.shift()
    }
  })

  socket.on('session:logs', (data: any) => {
    if (data.logs?.length) {
      agentLogs.value = data.logs.slice(-50)
    }
  })
}

const sendMessage = async () => {
  const text = inputText.value.trim()
  if (!text || isLoading.value) return

  if (!props.projectId && !props.currentProject?.id) {
    ElMessage.warning('Please select a project first')
    return
  }

  // Ensure session exists
  if (!sessionId.value) {
    await createNewSession()
    if (!sessionId.value) return
  }

  // Add user message
  const userMsg: ChatMessage = {
    id: `msg-${Date.now()}`,
    role: 'user',
    content: text,
    createdAt: new Date().toISOString(),
  }
  messages.value.push(userMsg)
  inputText.value = ''
  if (inputRef.value) inputRef.value.style.height = 'auto'
  nextTick(() => scrollToBottom())

  // Add loading message
  const loadingMsg: ChatMessage = {
    id: `msg-${Date.now() + 1}`,
    role: 'assistant',
    content: '',
    createdAt: new Date().toISOString(),
    isLoading: true,
  }
  messages.value.push(loadingMsg)
  isLoading.value = true
  nextTick(() => scrollToBottom())

  try {
    const res = await chatApi.sendMessage(sessionId.value, { content: text })

    // Remove loading message
    messages.value = messages.value.filter((m) => m.id !== loadingMsg.id)

    if (res.success && res.data) {
      const assistantMsg: ChatMessage = {
        id: res.data.message?.id || `msg-${Date.now() + 2}`,
        role: 'assistant',
        content: res.data.message?.content || 'Processing your request...',
        createdAt: new Date().toISOString(),
        metadata: {
          intent: res.data.intent,
          tasks: res.data.tasks as any,
        },
      }
      messages.value.push(assistantMsg)

      // If tasks were created, start polling progress
      if (res.data.tasks?.length) {
        agentStatus.value = 'running'
        pollProgress(sessionId.value)
      }
    } else {
      messages.value.push({
        id: `msg-${Date.now() + 2}`,
        role: 'assistant',
        content: 'Sorry, something went wrong. Please try again.',
        createdAt: new Date().toISOString(),
      })
    }
  } catch (error: any) {
    messages.value = messages.value.filter((m) => m.id !== loadingMsg.id)
    messages.value.push({
      id: `msg-${Date.now() + 2}`,
      role: 'assistant',
      content: `Error: ${error.message || 'Failed to get response'}`,
      createdAt: new Date().toISOString(),
    })
  } finally {
    isLoading.value = false
    nextTick(() => scrollToBottom())
  }
}

let pollInterval: ReturnType<typeof setInterval> | null = null

const pollProgress = (sid: string) => {
  if (pollInterval) clearInterval(pollInterval)
  pollInterval = setInterval(async () => {
    try {
      const res = await chatApi.getProgress(sid)
      if (res.success && res.data) {
        agentStatus.value = res.data.status
        if (res.data.logs?.length) {
          agentLogs.value = res.data.logs.slice(-50)
        }
        if (res.data.status === 'completed' || res.data.status === 'failed') {
          if (pollInterval) clearInterval(pollInterval)
        }
      }
    } catch {
      // ignore polling errors
    }
  }, 3000)
}

const clearChat = () => {
  messages.value = []
  agentLogs.value = []
  agentStatus.value = 'idle'
  sessionId.value = null
  if (socket) {
    socket.disconnect()
    socket = null
  }
  if (pollInterval) clearInterval(pollInterval)
  ElMessage.success('Chat cleared')
}

onMounted(() => {
  if (messagesContainer.value) {
    messagesContainer.value.addEventListener('scroll', checkScroll)
  }
  // 加载 credits 余额
  creditsStore.fetchBalance()
  // 解析项目名（仅 projectId 时）
  fetchProjectName()

  // 如果提供了 chatId，立即设置 session 并连接 WebSocket
  if (props.chatId) {
    sessionId.value = props.chatId
    connectWebSocket(props.chatId)
    // 加载该会话的消息历史
    loadSessionMessages(props.chatId)
  }
})

const loadSessionMessages = async (sid: string) => {
  try {
    const res = await chatApi.getMessages(sid)
    if (res.success && res.data?.messages) {
      messages.value = res.data.messages.map((msg: any) => ({
        id: msg.id || `msg-${Date.now()}`,
        role: msg.role as 'user' | 'assistant' | 'system' | 'agent',
        content: msg.content,
        createdAt: msg.timestamp || msg.createdAt,
        metadata: msg.metadata,
      }))
    }
  } catch (err: any) {
    if (import.meta.dev) {
      console.debug('[ChatPanel] Failed to load messages:', err.message)
    }
  }
}

watch(() => props.projectId, fetchProjectName)

onUnmounted(() => {
  if (socket) socket.disconnect()
  if (pollInterval) clearInterval(pollInterval)
  if (messagesContainer.value) {
    messagesContainer.value.removeEventListener('scroll', checkScroll)
  }
})
</script>

<style scoped>
.chat-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #ffffff;
}

.chat-panel.collapsed {
  align-items: center;
  justify-content: center;
}

/* Header */
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #f3f4f6;
  background: #ffffff;
}

.agent-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.agent-avatar-wrapper {
  position: relative;
  width: 32px;
  height: 32px;
}

.agent-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid #e5e7eb;
}

.status-dot {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 2px solid #ffffff;
}

.status-dot.online {
  background: #22c55e;
}

.status-dot.offline {
  background: #9ca3af;
}

.agent-details {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.agent-name {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
}

.agent-status {
  font-size: 11px;
  color: #6b7280;
}

.header-actions {
  display: flex;
  gap: 4px;
}

.header-btn {
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
  transition: all 0.15s ease;
}

.header-btn:hover {
  background: #f3f4f6;
  color: #6b7280;
}

.credit-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 12px;
  background: #fef3c7;
  color: #92400e;
  font-size: 12px;
  font-weight: 600;
  margin-right: 4px;
}

/* Messages Area */
.messages-area {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  position: relative;
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
  gap: 16px;
}

.empty-avatar img {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: 3px solid #e5e7eb;
}

.empty-title {
  font-size: 15px;
  font-weight: 600;
  color: #111827;
  margin: 0;
}

.empty-desc {
  font-size: 13px;
  color: #9ca3af;
  margin: 0;
}

/* Message List */
.message-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.message-wrapper {
  display: flex;
  flex-direction: column;
}

.message {
  display: flex;
  gap: 10px;
  padding: 8px 0;
}

.message-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid #e5e7eb;
  flex-shrink: 0;
  margin-top: 2px;
}

.message-content {
  flex: 1;
  min-width: 0;
}

.message-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.message-author {
  font-size: 13px;
  font-weight: 600;
  color: #111827;
}

.message-time {
  font-size: 11px;
  color: #9ca3af;
}

.message-bubble {
  padding: 10px 14px;
  border-radius: 12px;
  font-size: 13px;
  line-height: 1.6;
  color: #374151;
  background: #f3f4f6;
  word-break: break-word;
}

.message-bubble.user {
  background: #4f46e5;
  color: white;
  border-bottom-right-radius: 4px;
}

.message-bubble.assistant {
  background: #f3f4f6;
  color: #374151;
  border-bottom-left-radius: 4px;
}

.message-bubble.system {
  background: #fef3c7;
  color: #92400e;
  border-bottom-left-radius: 4px;
  font-size: 12px;
}

/* Task Cards */
.task-cards {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 8px;
}

.task-card {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 8px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  font-size: 12px;
  color: #374151;
}

.task-card.running {
  background: #eff6ff;
  border-color: #bfdbfe;
}

.task-card.completed {
  background: #f0fdf4;
  border-color: #bbf7d0;
}

.task-card.failed {
  background: #fef2f2;
  border-color: #fecaca;
}

/* Progress Panel */
.progress-panel {
  margin-top: 12px;
  padding: 12px;
  background: #f9fafb;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
}

.progress-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #111827;
}

.progress-logs {
  max-height: 160px;
  overflow-y: auto;
  font-family: 'Fira Code', 'Consolas', monospace;
  font-size: 11px;
  line-height: 1.5;
}

.log-line {
  display: flex;
  gap: 8px;
  padding: 2px 0;
}

.log-time {
  color: #9ca3af;
  flex-shrink: 0;
}

.log-text {
  color: #4b5563;
  word-break: break-word;
}

/* Typing Indicator */
.typing-indicator {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 4px;
}

.typing-indicator span {
  width: 6px;
  height: 6px;
  background: #9ca3af;
  border-radius: 50%;
  animation: typing 1.4s infinite ease-in-out both;
}

.typing-indicator span:nth-child(1) {
  animation-delay: -0.32s;
}

.typing-indicator span:nth-child(2) {
  animation-delay: -0.16s;
}

@keyframes typing {
  0%, 80%, 100% {
    transform: scale(0.6);
    opacity: 0.5;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
}

/* Scroll Button */
.scroll-btn {
  position: absolute;
  bottom: 80px;
  right: 20px;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid #e5e7eb;
  background: #ffffff;
  color: #6b7280;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: all 0.15s ease;
}

.scroll-btn:hover {
  background: #f9fafb;
  color: #374151;
}

/* Input Area */
.input-area {
  border-top: 1px solid #f3f4f6;
  background: #ffffff;
}

.input-container {
  padding: 12px 16px;
}

.input-wrapper {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 10px 12px;
  transition: all 0.2s ease;
}

.input-wrapper.focused {
  background: #ffffff;
  border-color: #4f46e5;
  box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.08);
}

.message-input {
  flex: 1;
  border: none;
  background: transparent;
  resize: none;
  font-size: 14px;
  line-height: 1.5;
  outline: none;
  font-family: inherit;
  min-height: 22px;
  max-height: 120px;
  color: #374151;
  padding: 0;
}

.message-input::placeholder {
  color: #9ca3af;
}

.input-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.send-btn {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  border: none;
  background: #e5e7eb;
  color: #9ca3af;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
  flex-shrink: 0;
}

.send-btn.active {
  background: #4f46e5;
  color: white;
}

.send-btn.active:hover {
  background: #4338ca;
}

.send-btn:disabled {
  cursor: not-allowed;
}

.input-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
}

.input-hint {
  font-size: 11px;
  color: #9ca3af;
  margin: 0;
}

.cost-hint {
  font-size: 11px;
  color: #f59e0b;
  font-weight: 500;
}

/* Collapsed View */
.collapsed-view {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 12px;
}

.collapsed-btn {
  position: relative;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  border: none;
  background: #f3f4f6;
  cursor: pointer;
  padding: 0;
}

.collapsed-avatar {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  object-fit: cover;
}

.collapsed-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  background: #4f46e5;
  color: white;
  font-size: 10px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 10px;
}

/* Markdown Styles */
:deep(.message-body strong) {
  font-weight: 600;
  color: inherit;
}

:deep(.message-body em) {
  font-style: italic;
}

:deep(.message-body code.inline-code) {
  background: rgba(0, 0, 0, 0.05);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Fira Code', monospace;
  font-size: 12px;
}

:deep(.message-bubble.user code.inline-code) {
  background: rgba(255, 255, 255, 0.2);
}

:deep(.message-body pre.code-block) {
  background: #1e1e1e;
  padding: 12px;
  border-radius: 8px;
  overflow-x: auto;
  margin: 8px 0;
}

:deep(.message-body pre.code-block code) {
  color: #d4d4d4;
  font-family: 'Fira Code', monospace;
  font-size: 12px;
  line-height: 1.5;
}
</style>

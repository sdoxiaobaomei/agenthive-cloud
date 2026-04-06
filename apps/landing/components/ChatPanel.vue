<template>
  <div class="chat-panel" :class="{ collapsed: isCollapsed }">
    <!-- Header -->
    <div class="panel-header">
      <div class="agent-info">
        <div class="agent-avatar-wrapper">
          <img src="/avatars/shiba_be.png" class="agent-avatar" alt="Alex" />
          <span class="status-dot"></span>
        </div>
        <div v-if="!isCollapsed" class="agent-details">
          <span class="agent-name">Alex</span>
          <span class="agent-status">Engineer · Online</span>
        </div>
      </div>
      <div v-if="!isCollapsed" class="header-actions">
        <button class="header-btn" title="Clear chat" @click="clearChat">
          <el-icon><Delete /></el-icon>
        </button>
        <button class="header-btn" title="Expand" @click="toggleExpand">
          <el-icon><FullScreen /></el-icon>
        </button>
      </div>
    </div>

    <!-- Messages -->
    <div v-if="!isCollapsed" class="messages-area" ref="messagesContainer">
      <!-- Empty State -->
      <div v-if="messages.length === 0" class="empty-state">
        <div class="empty-avatar">
          <img src="/avatars/shiba_be.png" alt="Alex" />
        </div>
        <div class="empty-welcome">
          <p class="empty-title">Alex is ready to help</p>
          <p class="empty-desc">Ask the team to bring your idea to life</p>
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
          <!-- Date Divider -->
          <div v-if="showDateDivider(index)" class="date-divider">
            <span>{{ formatDate(msg.timestamp) }}</span>
          </div>

          <div class="message">
            <img 
              v-if="msg.role === 'assistant'"
              src="/avatars/shiba_be.png" 
              class="message-avatar"
              alt="Alex"
            />
            <img 
              v-else
              :src="user?.avatar || '/avatars/shiba_tl.png'" 
              class="message-avatar"
              alt="User"
            />

            <div class="message-content">
              <div class="message-header">
                <span class="message-author">{{ msg.role === 'assistant' ? 'Alex' : 'You' }}</span>
                <span class="message-time">{{ formatTime(msg.timestamp) }}</span>
              </div>

              <div class="message-bubble" :class="msg.role">
                <!-- Loading State -->
                <div v-if="msg.isLoading" class="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
                <!-- Message Content with Markdown -->
                <div v-else class="message-body" v-html="renderMarkdown(msg.content)"></div>
              </div>

              <!-- Message Actions (hover only) -->
              <div v-if="msg.role === 'assistant' && !msg.isLoading" class="message-actions">
                <button class="action-btn" title="Copy" @click="copyMessage(msg.content)">
                  <el-icon><CopyDocument /></el-icon>
                </button>
                <button class="action-btn" :class="{ active: msg.liked }" title="Good response" @click="likeMessage(msg)">
                  <el-icon><CircleCheck /></el-icon>
                </button>
                <button class="action-btn" :class="{ active: msg.disliked }" title="Bad response" @click="dislikeMessage(msg)">
                  <el-icon><CircleClose /></el-icon>
                </button>
                <button class="action-btn" title="More options">
                  <el-icon><MoreFilled /></el-icon>
                </button>
              </div>

              <!-- Regenerate Button for AI messages -->
              <div v-if="msg.role === 'assistant' && index === messages.length - 1 && !isLoading" class="regenerate-wrapper">
                <button class="regenerate-btn" @click="regenerateMessage">
                  <el-icon><Refresh /></el-icon>
                  <span>Regenerate</span>
                </button>
              </div>
            </div>
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
            :disabled="isLoading"
            placeholder="Ask the team to bring your idea to life..."
            class="message-input"
            rows="1"
            @keydown.enter.prevent="handleEnter"
            @input="autoResize"
            @focus="isInputFocused = true"
            @blur="isInputFocused = false"
            ref="inputRef"
          />
          <div class="input-actions">
            <button class="attach-btn" title="Attach file">
              <el-icon><Paperclip /></el-icon>
            </button>
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
        <p class="input-hint">Press Enter to send, Shift + Enter for new line</p>
      </div>

      <!-- Credits Info -->
      <div class="credits-bar">
        <div class="credits-left">
          <el-icon><Coin /></el-icon>
          <span class="credits-text">{{ credits }} credits remaining</span>
        </div>
        <button class="upgrade-btn" @click="showUpgradeDialog = true">
          <el-icon><Star /></el-icon>
          <span>Upgrade</span>
        </button>
      </div>
    </div>

    <!-- Collapsed View -->
    <div v-else class="collapsed-view">
      <button class="collapsed-btn" @click="$emit('expand')">
        <img src="/avatars/shiba_be.png" class="collapsed-avatar" alt="Alex" />
        <span class="collapsed-badge">AI</span>
      </button>
    </div>

    <!-- Upgrade Dialog -->
    <el-dialog
      v-model="showUpgradeDialog"
      title="Upgrade Your Plan"
      width="420px"
      :close-on-click-modal="true"
      class="upgrade-dialog"
    >
      <div class="upgrade-content">
        <div class="plan-card">
          <h3>Pro</h3>
          <p class="plan-price">$20<span>/month</span></p>
          <ul class="plan-features">
            <li><el-icon><Check /></el-icon> Unlimited credits</li>
            <li><el-icon><Check /></el-icon> Priority support</li>
            <li><el-icon><Check /></el-icon> Advanced AI models</li>
          </ul>
          <button class="plan-btn primary">Upgrade to Pro</button>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted } from 'vue'
import { 
  FullScreen,
  Delete,
  CircleCheck,
  CircleClose,
  MoreFilled,
  Loading,
  Promotion,
  CopyDocument,
  Refresh,
  ArrowDown,
  Paperclip,
  Coin,
  Star,
  Check
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  isLoading?: boolean
  liked?: boolean
  disliked?: boolean
}

interface Project {
  id: string
  name: string
  description: string
}

const props = defineProps<{
  isCollapsed?: boolean
  currentProject?: Project | null
}>()

const emit = defineEmits<{
  expand: []
}>()

const { user } = useAuth()

const messagesContainer = ref<HTMLDivElement>()
const inputRef = ref<HTMLTextAreaElement>()
const messages = ref<ChatMessage[]>([])
const inputText = ref('')
const isLoading = ref(false)
const credits = ref(50)
const isExpanded = ref(false)
const isInputFocused = ref(false)
const showScrollBtn = ref(false)
const showUpgradeDialog = ref(false)

const toggleExpand = () => {
  isExpanded.value = !isExpanded.value
}

const clearChat = () => {
  messages.value = []
  ElMessage.success('Chat cleared')
}

// Simple markdown renderer
const renderMarkdown = (content: string): string => {
  // Code blocks
  content = content.replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre class="code-block"><code>$2</code></pre>')
  // Inline code
  content = content.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
  // Bold
  content = content.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  // Italic
  content = content.replace(/\*([^*]+)\*/g, '<em>$1</em>')
  // Line breaks
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

onMounted(() => {
  if (messagesContainer.value) {
    messagesContainer.value.addEventListener('scroll', checkScroll)
  }
})

const formatTime = (date: Date): string => {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(date)
}

const formatDate = (date: Date): string => {
  const today = new Date()
  const msgDate = new Date(date)
  
  if (today.toDateString() === msgDate.toDateString()) {
    return 'Today'
  }
  
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  if (yesterday.toDateString() === msgDate.toDateString()) {
    return 'Yesterday'
  }
  
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric'
  }).format(date)
}

const showDateDivider = (index: number): boolean => {
  if (index === 0) return true
  const curr = new Date(messages.value[index].timestamp)
  const prev = new Date(messages.value[index - 1].timestamp)
  return curr.toDateString() !== prev.toDateString()
}

const copyMessage = (content: string) => {
  navigator.clipboard.writeText(content)
  ElMessage.success('Copied to clipboard')
}

const likeMessage = (msg: ChatMessage) => {
  msg.liked = !msg.liked
  if (msg.liked) msg.disliked = false
}

const dislikeMessage = (msg: ChatMessage) => {
  msg.disliked = !msg.disliked
  if (msg.disliked) msg.liked = false
}

const regenerateMessage = async () => {
  // Remove last AI message and regenerate
  const lastUserMsg = messages.value.filter(m => m.role === 'user').pop()
  if (!lastUserMsg) return
  
  messages.value = messages.value.filter(m => m !== messages.value[messages.value.length - 1])
  
  isLoading.value = true
  
  try {
    await new Promise(resolve => setTimeout(resolve, 1500))
    
    const aiMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'assistant',
      content: `Here's an alternative approach for ${props.currentProject?.name || 'your project'}:\n\n**Key Features:**\n- Feature 1\n- Feature 2\n- Feature 3\n\nLet me know if you'd like me to elaborate on any of these points.`,
      timestamp: new Date()
    }
    messages.value.push(aiMsg)
    nextTick(() => scrollToBottom())
  } finally {
    isLoading.value = false
  }
}

const sendMessage = async () => {
  const text = inputText.value.trim()
  if (!text || isLoading.value) return

  // Add user message
  const userMsg: ChatMessage = {
    id: Date.now().toString(),
    role: 'user',
    content: text,
    timestamp: new Date()
  }
  messages.value.push(userMsg)
  inputText.value = ''

  if (inputRef.value) {
    inputRef.value.style.height = 'auto'
  }

  // Add loading message
  const loadingMsg: ChatMessage = {
    id: (Date.now() + 1).toString(),
    role: 'assistant',
    content: '',
    timestamp: new Date(),
    isLoading: true
  }
  messages.value.push(loadingMsg)
  isLoading.value = true
  
  nextTick(() => {
    scrollToBottom()
  })

  try {
    await new Promise(resolve => setTimeout(resolve, 1500))

    // Remove loading message and add real response
    messages.value = messages.value.filter(m => m.id !== loadingMsg.id)
    
    const aiMsg: ChatMessage = {
      id: (Date.now() + 2).toString(),
      role: 'assistant',
      content: `I'll help you with **${props.currentProject?.name || 'your project'}**.\n\nHere's my analysis:\n\n1. **Understanding your requirements** - You want to build a modern web application\n2. **Tech stack recommendation** - Vue 3 + TypeScript + Tailwind CSS\n3. **Architecture** - Component-based with proper state management\n\nWould you like me to start implementing any specific feature?`,
      timestamp: new Date()
    }
    messages.value.push(aiMsg)
    
    // Deduct credits
    credits.value = Math.max(0, credits.value - 1)
    
    nextTick(() => scrollToBottom())
  } catch (error) {
    messages.value = messages.value.filter(m => m.id !== loadingMsg.id)
    ElMessage.error('Failed to get response')
  } finally {
    isLoading.value = false
  }
}
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
  background: #22c55e;
  border-radius: 50%;
  border: 2px solid #ffffff;
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

.empty-avatar {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.empty-avatar img {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: 3px solid #e5e7eb;
}

.empty-welcome {
  display: flex;
  flex-direction: column;
  gap: 4px;
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

/* Date Divider */
.date-divider {
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 16px 0 12px;
}

.date-divider span {
  font-size: 11px;
  color: #9ca3af;
  background: #f9fafb;
  padding: 2px 10px;
  border-radius: 10px;
}

/* Message */
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

/* Message Actions */
.message-actions {
  display: flex;
  gap: 2px;
  margin-top: 6px;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.message:hover .message-actions {
  opacity: 1;
}

.action-btn {
  width: 26px;
  height: 26px;
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

.action-btn:hover {
  background: #f3f4f6;
  color: #6b7280;
}

.action-btn.active {
  color: #4f46e5;
  background: #eef2ff;
}

/* Regenerate Button */
.regenerate-wrapper {
  margin-top: 8px;
}

.regenerate-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #ffffff;
  color: #6b7280;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.regenerate-btn:hover {
  background: #f9fafb;
  border-color: #d1d5db;
  color: #374151;
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

.attach-btn {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: #9ca3af;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.attach-btn:hover {
  background: #f3f4f6;
  color: #6b7280;
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

.input-hint {
  font-size: 11px;
  color: #9ca3af;
  text-align: center;
  margin: 8px 0 0;
}

/* Credits Bar */
.credits-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background: #f9fafb;
  border-top: 1px solid #f3f4f6;
}

.credits-left {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #6b7280;
  font-size: 12px;
}

.credits-text {
  font-weight: 500;
}

.upgrade-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 5px 12px;
  background: #4f46e5;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.upgrade-btn:hover {
  background: #4338ca;
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
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.collapsed-btn:hover {
  background: #e5e7eb;
}

.collapsed-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  object-fit: cover;
}

.collapsed-badge {
  position: absolute;
  bottom: -2px;
  right: -2px;
  padding: 2px 6px;
  background: #4f46e5;
  color: white;
  font-size: 9px;
  font-weight: 600;
  border-radius: 10px;
  border: 2px solid #ffffff;
}

/* Upgrade Dialog */
:deep(.upgrade-dialog) {
  border-radius: 16px;
}

:deep(.upgrade-dialog .el-dialog__header) {
  padding: 20px 20px 0;
  border: none;
}

:deep(.upgrade-dialog .el-dialog__title) {
  font-size: 18px;
  font-weight: 600;
  color: #111827;
}

:deep(.upgrade-dialog .el-dialog__body) {
  padding: 20px;
}

.upgrade-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.plan-card {
  background: #f9fafb;
  border-radius: 12px;
  padding: 20px;
  border: 2px solid #4f46e5;
}

.plan-card h3 {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
  margin: 0 0 8px;
}

.plan-price {
  font-size: 28px;
  font-weight: 700;
  color: #111827;
  margin: 0 0 16px;
}

.plan-price span {
  font-size: 14px;
  font-weight: 400;
  color: #6b7280;
}

.plan-features {
  list-style: none;
  padding: 0;
  margin: 0 0 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.plan-features li {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #374151;
}

.plan-features li .el-icon {
  color: #22c55e;
}

.plan-btn {
  width: 100%;
  padding: 10px;
  border-radius: 8px;
  border: none;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.plan-btn.primary {
  background: #4f46e5;
  color: white;
}

.plan-btn.primary:hover {
  background: #4338ca;
}
</style>

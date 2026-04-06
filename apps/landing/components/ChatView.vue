<template>
  <div class="chat-view">
    <!-- 消息列表 -->
    <div ref="messagesContainer" class="messages-container">
      <div v-if="messages.length === 0" class="empty-state">
        <div class="empty-icon">💬</div>
        <h3>开始与 AI 团队对话</h3>
        <p>描述你的需求，让柴犬装修队帮你实现</p>
      </div>
      <div
        v-for="msg in messages"
        :key="msg.id"
        class="message"
        :class="msg.role"
      >
        <div class="message-avatar">
          <ShibaAvatar v-if="msg.role === 'assistant'" :role="(msg.agentRole as any) || 'orchestrator'" :size="36" />
          <div v-else class="user-avatar">
            {{ userInitial }}
          </div>
        </div>
        <div class="message-content">
          <div class="message-header">
            <span class="message-author">{{ msg.author }}</span>
            <span class="message-time">{{ formatTime(msg.timestamp) }}</span>
          </div>
          <div class="message-body">{{ msg.content }}</div>
        </div>
      </div>
    </div>

    <!-- 输入框 -->
    <div class="input-area">
      <div class="input-wrapper">
        <textarea
          v-model="inputText"
          :disabled="isLoading"
          :placeholder="isLoading ? '发送中...' : '输入消息...'"
          class="chat-input"
          rows="1"
          @keydown.enter.prevent="handleSubmit"
          @input="autoResize"
        />
        <button
          class="send-btn"
          :disabled="!inputText.trim() || isLoading"
          @click="handleSubmit"
        >
          <el-icon v-if="isLoading" class="animate-spin"><Loading /></el-icon>
          <el-icon v-else><Promotion /></el-icon>
        </button>
      </div>
      <div class="input-hint">
        按 Enter 发送，Shift + Enter 换行
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { Loading, Promotion } from '@element-plus/icons-vue'
import { ElMessage, ElIcon } from 'element-plus'
import ShibaAvatar from './ShibaAvatar.vue'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  author: string
  content: string
  timestamp: Date
  agentRole?: string
}

const router = useRouter()
const route = useRoute()
const { isAuthenticated, userInitial } = useAuth()

const messages = ref<ChatMessage[]>([])
const inputText = ref('')
const isLoading = ref(false)
const messagesContainer = ref<HTMLDivElement>()

// 从 sessionStorage 恢复待发送的消息
onMounted(() => {
  const pendingMessage = sessionStorage.getItem('chat:pending-message')
  if (pendingMessage) {
    inputText.value = pendingMessage
    sessionStorage.removeItem('chat:pending-message')
    // 自动发送
    nextTick(() => {
      handleSubmit()
    })
  }
})

function autoResize(e: Event) {
  const target = e.target as HTMLTextAreaElement
  target.style.height = 'auto'
  target.style.height = Math.min(target.scrollHeight, 200) + 'px'
}

function formatTime(date: Date) {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

async function handleSubmit() {
  const text = inputText.value.trim()
  if (!text || isLoading.value) return

  // 检查登录状态
  if (!isAuthenticated()) {
    // 保存输入内容到 sessionStorage
    sessionStorage.setItem('chat:pending-message', text)
    // 跳转到登录页，带上 redirect 参数
    router.push(`/login?redirect=${encodeURIComponent('/chat')}`)
    return
  }

  // 添加用户消息
  const userMsg: ChatMessage = {
    id: Date.now().toString(),
    role: 'user',
    author: '我',
    content: text,
    timestamp: new Date(),
  }
  messages.value.push(userMsg)
  inputText.value = ''
  isLoading.value = true

  // 滚动到底部
  nextTick(() => {
    scrollToBottom()
  })

  try {
    // TODO: 调用 API 发送消息
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // 模拟 AI 回复
    const assistantMsg: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      author: '阿黄',
      content: '收到！让我来分析一下你的需求...',
      timestamp: new Date(),
      agentRole: 'tech_lead',
    }
    messages.value.push(assistantMsg)
  } catch (error) {
    ElMessage.error('发送失败，请重试')
  } finally {
    isLoading.value = false
    nextTick(() => {
      scrollToBottom()
    })
  }
}

function scrollToBottom() {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}
</script>

<style scoped>
.chat-view {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 160px);
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  scroll-behavior: smooth;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #9ca3af;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.empty-state h3 {
  font-size: 18px;
  font-weight: 500;
  color: #374151;
  margin: 0 0 8px;
}

.empty-state p {
  font-size: 14px;
  margin: 0;
}

.message {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
}

.message.user {
  flex-direction: row-reverse;
}

.message-avatar {
  flex-shrink: 0;
}

.user-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #3b82f6;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 500;
}

.message-content {
  max-width: 70%;
  background: #f3f4f6;
  padding: 12px 16px;
  border-radius: 12px;
  border-top-left-radius: 4px;
}

.message.user .message-content {
  background: #3b82f6;
  color: white;
  border-top-left-radius: 12px;
  border-top-right-radius: 4px;
}

.message-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.message-author {
  font-size: 13px;
  font-weight: 500;
  color: #6b7280;
}

.message.user .message-author {
  color: rgba(255, 255, 255, 0.8);
}

.message-time {
  font-size: 11px;
  color: #9ca3af;
}

.message.user .message-time {
  color: rgba(255, 255, 255, 0.6);
}

.message-body {
  font-size: 14px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

.input-area {
  padding: 16px 24px 24px;
  border-top: 1px solid #e5e7eb;
}

.input-wrapper {
  display: flex;
  gap: 12px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 8px 12px;
  transition: border-color 0.2s;
}

.input-wrapper:focus-within {
  border-color: #3b82f6;
  background: #fff;
}

.chat-input {
  flex: 1;
  border: none;
  background: transparent;
  resize: none;
  font-size: 14px;
  line-height: 1.5;
  max-height: 200px;
  outline: none;
  font-family: inherit;
}

.chat-input::placeholder {
  color: #9ca3af;
}

.send-btn {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  border: none;
  background: #3b82f6;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  flex-shrink: 0;
  align-self: flex-end;
  margin-bottom: 2px;
}

.send-btn:hover:not(:disabled) {
  background: #2563eb;
}

.send-btn:disabled {
  background: #d1d5db;
  cursor: not-allowed;
}

.input-hint {
  text-align: center;
  font-size: 12px;
  color: #9ca3af;
  margin-top: 8px;
}
</style>

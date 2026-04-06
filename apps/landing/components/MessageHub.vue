<template>
  <el-card class="message-hub" shadow="hover">
    <template #header>
      <div class="card-header">
        <div class="header-title">
          <el-icon><ChatDotRound /></el-icon>
          <span>消息中心</span>
          <el-badge v-if="unreadCount > 0" :value="unreadCount" class="message-badge" />
        </div>
        <el-button v-if="messages.length > 0" link type="primary" @click="$emit('mark-all-read')">
          全部已读
        </el-button>
      </div>
    </template>
    
    <div v-if="messages.length === 0" class="empty-messages">
      <el-empty description="暂无消息" />
    </div>
    
    <el-scrollbar v-else height="250px">
      <div class="message-list">
        <div
          v-for="message in formattedMessages"
          :key="message.id"
          class="message-item"
          :class="{ unread: !message.read }"
          @click="$emit('mark-read', message.id)"
        >
          <div class="message-icon" :class="message.type">
            <el-icon>
              <component :is="getIcon(message.type)" />
            </el-icon>
          </div>
          <div class="message-content">
            <div class="message-title">{{ message.title }}</div>
            <div class="message-text">{{ message.content }}</div>
            <div class="message-time">{{ message.time }}</div>
          </div>
          <div class="message-actions">
            <el-button
              v-if="!message.read"
              link
              type="primary"
              size="small"
              @click.stop="$emit('mark-read', message.id)"
            >
              标记已读
            </el-button>
            <el-button
              link
              type="danger"
              size="small"
              @click.stop="$emit('delete', message.id)"
            >
              <el-icon><Delete /></el-icon>
            </el-button>
          </div>
        </div>
      </div>
    </el-scrollbar>
    
    <div v-if="messages.length > 0" class="message-footer">
      <el-button link type="primary" @click="$emit('clear')">
        <el-icon><Delete /></el-icon>
        清空消息
      </el-button>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ChatDotRound, Delete, InfoFilled, CircleCheck, Warning, CircleClose } from '@element-plus/icons-vue'

// 兼容 messageHub store 的 Message 类型
interface StoreMessage {
  id: string
  type: 'system' | 'agent' | 'task' | 'code' | 'error'
  source: string
  content: string
  timestamp: string
  read: boolean
  metadata?: Record<string, string>
}

const props = defineProps<{
  messages: StoreMessage[]
}>()

defineEmits<{
  'mark-read': [id: string]
  'mark-all-read': []
  'delete': [id: string]
  'clear': []
}>()

const unreadCount = computed(() => props.messages.filter(m => !m.read).length)

// 将 store message 格式化为组件需要的格式
const formattedMessages = computed(() => {
  return props.messages.map(msg => ({
    id: msg.id,
    title: msg.source,
    content: msg.content,
    type: mapMessageType(msg.type),
    read: msg.read,
    time: formatTime(msg.timestamp)
  }))
})

function mapMessageType(type: StoreMessage['type']): 'info' | 'success' | 'warning' | 'error' {
  const typeMap: Record<StoreMessage['type'], 'info' | 'success' | 'warning' | 'error'> = {
    system: 'info',
    agent: 'success',
    task: 'warning',
    code: 'info',
    error: 'error'
  }
  return typeMap[type] || 'info'
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

function getIcon(type: 'info' | 'success' | 'warning' | 'error') {
  const icons: Record<string, string> = {
    info: 'InfoFilled',
    success: 'CircleCheck',
    warning: 'Warning',
    error: 'CircleClose',
  }
  return icons[type] || 'InfoFilled'
}
</script>

<style scoped>
.message-hub :deep(.el-card__body) {
  padding: 0;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
}

.message-badge :deep(.el-badge__content) {
  transform: translate(50%, -30%);
}

.empty-messages {
  padding: 20px 0;
}

.message-list {
  padding: 8px;
}

.message-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.message-item:last-child {
  border-bottom: none;
}

.message-item:hover {
  background: var(--el-fill-color-light);
}

.message-item.unread {
  background: var(--el-color-primary-light-9);
}

.message-item.unread:hover {
  background: var(--el-color-primary-light-8);
}

.message-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.message-icon.info {
  background: var(--el-color-info-light-9);
  color: var(--el-color-info);
}

.message-icon.success {
  background: var(--el-color-success-light-9);
  color: var(--el-color-success);
}

.message-icon.warning {
  background: var(--el-color-warning-light-9);
  color: var(--el-color-warning);
}

.message-icon.error {
  background: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
}

.message-content {
  flex: 1;
  min-width: 0;
}

.message-title {
  font-weight: 500;
  font-size: 14px;
  margin-bottom: 4px;
  color: var(--el-text-color-primary);
}

.message-text {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-bottom: 4px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.message-time {
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}

.message-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s;
}

.message-item:hover .message-actions {
  opacity: 1;
}

.message-footer {
  padding: 12px;
  border-top: 1px solid var(--el-border-color-lighter);
  text-align: center;
}
</style>

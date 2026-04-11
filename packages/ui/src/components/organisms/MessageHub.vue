<template>
  <div class="message-hub">
    <div v-if="messages.length === 0" class="message-empty">
      <el-empty description="暂无消息" :image-size="60" />
    </div>
    <div v-else class="message-list">
      <div
        v-for="message in messages"
        :key="message.id"
        class="message-item"
        :class="{ unread: !message.read, [message.type]: true }"
        @click="$emit('mark-read', message.id)"
      >
        <div class="message-icon">
          <el-icon v-if="message.type === 'system'"><InfoFilled /></el-icon>
          <el-icon v-else-if="message.type === 'agent'"><UserFilled /></el-icon>
          <el-icon v-else-if="message.type === 'task'"><List /></el-icon>
          <el-icon v-else-if="message.type === 'code'"><Document /></el-icon>
          <el-icon v-else><WarningFilled /></el-icon>
        </div>
        <div class="message-content">
          <div class="message-header">
            <span class="message-source">{{ message.source }}</span>
            <span class="message-time">{{ formatTime(message.timestamp) }}</span>
          </div>
          <div class="message-body">{{ message.content }}</div>
        </div>
        <div v-if="!message.read" class="message-unread-dot" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { InfoFilled, UserFilled, List, Document, WarningFilled } from '@element-plus/icons-vue'

interface Message {
  id: string
  type: 'system' | 'agent' | 'task' | 'code' | 'error'
  source: string
  content: string
  timestamp: string
  read: boolean
}

const props = defineProps<{
  messages: Message[]
}>()

const emit = defineEmits<{
  'mark-read': [id: string]
}>()

function formatTime(timestamp: string): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  if (hours < 24) return `${hours}小时前`
  return `${days}天前`
}
</script>

<style scoped>
.message-hub {
  height: 100%;
  overflow-y: auto;
}

.message-empty {
  padding: 20px 0;
}

.message-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.message-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.message-item:hover {
  background-color: #f5f7fa;
}

.message-item.unread {
  background-color: #f0f9ff;
}

.message-icon {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #e4e7ed;
  color: #606266;
  flex-shrink: 0;
}

.message-item.system .message-icon {
  background-color: #e6f2ff;
  color: #409eff;
}

.message-item.agent .message-icon {
  background-color: #e6ffed;
  color: #67c23a;
}

.message-item.task .message-icon {
  background-color: #fff7e6;
  color: #e6a23c;
}

.message-item.code .message-icon {
  background-color: #f2e6ff;
  color: #9254de;
}

.message-item.error .message-icon {
  background-color: #ffe6e6;
  color: #f56c6c;
}

.message-content {
  flex: 1;
  min-width: 0;
}

.message-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.message-source {
  font-weight: 500;
  color: #303133;
  font-size: 14px;
}

.message-time {
  font-size: 12px;
  color: #909399;
}

.message-body {
  font-size: 13px;
  color: #606266;
  line-height: 1.5;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.message-unread-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: #409eff;
  flex-shrink: 0;
  margin-top: 4px;
}
</style>

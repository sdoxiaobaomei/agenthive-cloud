<template>
  <div class="message-hub">
    <div class="hub-header">
      <div class="header-title">
        <el-icon><ChatDotRound /></el-icon>
        <span>消息中心</span>
        <el-badge v-if="unreadCount > 0" :value="unreadCount" type="danger" />
      </div>
      <div class="header-actions">
        <el-tooltip content="全部标记为已读" placement="top">
          <el-button text size="small" @click="markAllAsRead">
            <el-icon><Check /></el-icon>
          </el-button>
        </el-tooltip>
        <el-tooltip content="清空消息" placement="top">
          <el-button text size="small" @click="clearMessages">
            <el-icon><Delete /></el-icon>
          </el-button>
        </el-tooltip>
      </div>
    </div>

    <div class="hub-filters">
      <el-input
        v-model="searchQuery"
        placeholder="搜索消息..."
        :prefix-icon="Search"
        size="small"
        clearable
      />
      <el-select v-model="filterType" size="small" placeholder="类型">
        <el-option label="全部" value="" />
        <el-option label="系统" value="system" />
        <el-option label="Agent" value="agent" />
        <el-option label="任务" value="task" />
        <el-option label="代码" value="code" />
      </el-select>
    </div>

    <el-scrollbar class="message-list" ref="messageListRef">
      <div v-if="filteredMessages.length === 0" class="empty-messages">
        <el-empty description="暂无消息" />
      </div>
      
      <div
        v-for="message in filteredMessages"
        :key="message.id"
        class="message-item"
        :class="{
          'is-unread': !message.read,
          [`type-${message.type}`]: true
        }"
        @click="selectMessage(message)"
      >
        <div class="message-icon">
          <el-icon :size="20">
            <component :is="getMessageIcon(message.type)" />
          </el-icon>
        </div>
        
        <div class="message-content">
          <div class="message-header">
            <span class="message-source">{{ message.source }}</span>
            <span class="message-time">{{ formatTime(message.timestamp) }}</span>
          </div>
          <div class="message-body">{{ message.content }}</div>
          <div v-if="message.metadata" class="message-meta">
            <el-tag
              v-for="(value, key) in message.metadata"
              :key="key"
              size="small"
              type="info"
            >
              {{ key }}: {{ value }}
            </el-tag>
          </div>
        </div>
        
        <div class="message-actions">
          <el-button
            v-if="!message.read"
            text
            size="small"
            @click.stop="markAsRead(message.id)"
          >
            标记已读
          </el-button>
          <el-button text size="small" @click.stop="deleteMessage(message.id)">
            <el-icon><Close /></el-icon>
          </el-button>
        </div>
      </div>
    </el-scrollbar>

    <div class="hub-footer">
      <el-pagination
        v-model:current-page="currentPage"
        :page-size="pageSize"
        :total="totalMessages"
        layout="prev, pager, next"
        size="small"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  ChatDotRound, Check, Delete, Search, Close,
  InfoFilled, Warning, CircleCheck, Document, Bell
} from '@element-plus/icons-vue'
import { formatDateTime } from '@/utils/format'

interface Message {
  id: string
  type: 'system' | 'agent' | 'task' | 'code' | 'error'
  source: string
  content: string
  timestamp: string
  read: boolean
  metadata?: Record<string, string>
}

const props = defineProps<{
  messages: Message[]
}>()

const emit = defineEmits<{
  'mark-read': [id: string]
  'mark-all-read': []
  'delete': [id: string]
  'clear': []
  'select': [message: Message]
}>()

const searchQuery = ref('')
const filterType = ref('')
const currentPage = ref(1)
const pageSize = ref(20)
const messageListRef = ref()

// 过滤消息
const filteredMessages = computed(() => {
  let result = [...props.messages]
  
  // 按类型过滤
  if (filterType.value) {
    result = result.filter(m => m.type === filterType.value)
  }
  
  // 按搜索词过滤
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(m => 
      m.content.toLowerCase().includes(query) ||
      m.source.toLowerCase().includes(query)
    )
  }
  
  // 分页
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return result.slice(start, end)
})

const totalMessages = computed(() => props.messages.length)

const unreadCount = computed(() => 
  props.messages.filter(m => !m.read).length
)

// 获取消息图标
const getMessageIcon = (type: string) => {
  const icons: Record<string, any> = {
    system: Bell,
    agent: ChatDotRound,
    task: CircleCheck,
    code: Document,
    error: Warning
  }
  return icons[type] || InfoFilled
}

// 格式化时间
const formatTime = (timestamp: string) => {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  
  // 1分钟内
  if (diff < 60000) {
    return '刚刚'
  }
  // 1小时内
  if (diff < 3600000) {
    return `${Math.floor(diff / 60000)}分钟前`
  }
  // 24小时内
  if (diff < 86400000) {
    return `${Math.floor(diff / 3600000)}小时前`
  }
  
  return formatDateTime(timestamp).split(' ')[0]
}

// 操作
const selectMessage = (message: Message) => {
  emit('select', message)
  if (!message.read) {
    emit('mark-read', message.id)
  }
}

const markAsRead = (id: string) => {
  emit('mark-read', id)
}

const markAllAsRead = () => {
  emit('mark-all-read')
}

const deleteMessage = (id: string) => {
  emit('delete', id)
}

const clearMessages = () => {
  emit('clear')
}

// 新消息自动滚动
watch(() => props.messages.length, (newLen, oldLen) => {
  if (newLen > oldLen) {
    // 有新消息，滚动到顶部
    messageListRef.value?.scrollTo({ top: 0, behavior: 'smooth' })
  }
})
</script>

<style scoped>
.message-hub {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color);
  border-radius: var(--radius-md);

  .hub-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid var(--el-border-color-light);

    .header-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 500;
    }

    .header-actions {
      display: flex;
      gap: 4px;
    }
  }

  .hub-filters {
    display: flex;
    gap: 8px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--el-border-color-light);
    background: var(--el-fill-color-lighter);

    :deep(.el-input) {
      flex: 1;
    }
  }

  .message-list {
    flex: 1;
    overflow: auto;

    .empty-messages {
      padding: 40px 0;
    }

    .message-item {
      display: flex;
      gap: 12px;
      padding: 12px 16px;
      border-bottom: 1px solid var(--el-border-color-light);
      cursor: pointer;
      transition: background 0.2s;

      &:hover {
        background: var(--el-fill-color-light);
      }

      &.is-unread {
        background: var(--el-color-primary-light-9);

        .message-content .message-body {
          font-weight: 500;
        }
      }

      &.type-error {
        border-left: 3px solid var(--el-color-danger);
      }

      &.type-warning {
        border-left: 3px solid var(--el-color-warning);
      }

      &.type-success {
        border-left: 3px solid var(--el-color-success);
      }

      .message-icon {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--el-fill-color);
        flex-shrink: 0;
      }

      .message-content {
        flex: 1;
        min-width: 0;

        .message-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 4px;

          .message-source {
            font-size: 13px;
            font-weight: 500;
            color: var(--el-text-color-primary);
          }

          .message-time {
            font-size: 12px;
            color: var(--el-text-color-secondary);
          }
        }

        .message-body {
          font-size: 13px;
          color: var(--el-text-color-regular);
          line-height: 1.5;
          word-break: break-word;
        }

        .message-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          margin-top: 8px;
        }
      }

      .message-actions {
        display: flex;
        gap: 4px;
        opacity: 0;
        transition: opacity 0.2s;
      }

      &:hover .message-actions {
        opacity: 1;
      }
    }
  }

  .hub-footer {
    padding: 12px 16px;
    border-top: 1px solid var(--el-border-color-light);
    display: flex;
    justify-content: center;
  }
}
</style>

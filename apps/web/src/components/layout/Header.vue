<template>
  <el-header class="main-header">
    <div class="header-left">
      <el-button 
        :icon="sidebarCollapsed ? Expand : Fold" 
        text
        @click="handleToggleSidebar"
      />
      
      <breadcrumb />
    </div>
    
    <div class="header-right">
      <!-- 返回官网 -->
      <a href="/" target="_self" class="back-to-site">
        <el-button text>官网</el-button>
      </a>
      
      <el-divider direction="vertical" />
      
      <!-- WebSocket 状态 -->
      <el-tooltip :content="wsStatusText" placement="bottom">
        <div class="ws-status" :class="wsStatus">
          <div class="status-indicator"></div>
          <span v-if="!isMobile">{{ wsStatusText }}</span>
        </div>
      </el-tooltip>
      
      <el-divider direction="vertical" />
      
      <!-- 主题切换 -->
      <el-tooltip content="切换主题" placement="bottom">
        <el-button 
          :icon="isDark ? Sunny : Moon" 
          text
          @click="toggleTheme"
        />
      </el-tooltip>
      
      <!-- 通知 -->
      <el-popover
        placement="bottom"
        :width="320"
        trigger="click"
      >
        <template #reference>
          <el-badge :value="unreadCount" :hidden="unreadCount === 0" class="notification-badge">
            <el-button :icon="Bell" text />
          </el-badge>
        </template>
        
        <div class="notification-popover">
          <div class="notification-header">
            <span>通知</span>
            <el-button type="primary" link size="small" @click="markAllRead">
              全部已读
            </el-button>
          </div>
          <el-scrollbar max-height="300px">
            <div v-if="notifications.length === 0" class="notification-empty">
              暂无通知
            </div>
            <div 
              v-for="notification in notifications" 
              :key="notification.id"
              class="notification-item"
              :class="{ unread: !notification.read }"
              @click="handleNotificationClick(notification)"
            >
              <div class="notification-title">{{ notification.title }}</div>
              <div class="notification-content">{{ notification.content }}</div>
              <div class="notification-time">{{ notification.time }}</div>
            </div>
          </el-scrollbar>
        </div>
      </el-popover>
      
      <el-divider direction="vertical" />
      
      <!-- 用户菜单 -->
      <el-dropdown @command="handleUserCommand">
        <div class="user-info">
          <el-avatar :size="32" :icon="UserFilled" />
          <span v-if="!isMobile" class="user-name">Admin</span>
          <el-icon><ArrowDown /></el-icon>
        </div>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="profile">
              <el-icon><User /></el-icon> 个人中心
            </el-dropdown-item>
            <el-dropdown-item command="settings">
              <el-icon><Setting /></el-icon> 系统设置
            </el-dropdown-item>
            <el-dropdown-item divided command="logout">
              <el-icon><SwitchButton /></el-icon> 退出登录
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
  </el-header>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import {
  Expand, Fold, Sunny, Moon, Bell, UserFilled,
  ArrowDown, User, Setting, SwitchButton
} from '@element-plus/icons-vue'
import { useWebSocketStore } from '@/stores/websocket'
import { ElMessage, ElMessageBox } from 'element-plus'

defineProps<{
  sidebarCollapsed: boolean
}>()

const emit = defineEmits<{
  'toggle-sidebar': []
}>()

const router = useRouter()
const wsStore = useWebSocketStore()

const isDark = ref(false)
const isMobile = ref(false)

// WebSocket 状态
const wsStatus = computed(() => {
  if (wsStore.isConnected) return 'connected'
  if (wsStore.isConnecting) return 'connecting'
  return 'disconnected'
})

const wsStatusText = computed(() => {
  switch (wsStatus.value) {
    case 'connected': return '已连接'
    case 'connecting': return '连接中...'
    default: return '未连接'
  }
})

// 通知
const notifications = ref([
  {
    id: '1',
    title: 'Agent 任务完成',
    content: 'Frontend Dev 完成了登录页面的开发',
    time: '2分钟前',
    read: false,
  },
  {
    id: '2',
    title: '新 Agent 加入',
    content: 'Backend Dev 已成功启动',
    time: '10分钟前',
    read: false,
  },
])

const unreadCount = computed(() => 
  notifications.value.filter(n => !n.read).length
)

// 方法
const handleToggleSidebar = () => {
  emit('toggle-sidebar')
}

const toggleTheme = () => {
  isDark.value = !isDark.value
  document.documentElement.classList.toggle('dark', isDark.value)
}

const markAllRead = () => {
  notifications.value.forEach(n => n.read = true)
}

const handleNotificationClick = (notification: typeof notifications.value[0]) => {
  notification.read = true
  ElMessage.info(`跳转到: ${notification.title}`)
}

const handleUserCommand = async (command: string) => {
  switch (command) {
    case 'profile':
      router.push('/settings')
      break
    case 'settings':
      router.push('/settings')
      break
    case 'logout':
      try {
        await ElMessageBox.confirm('确定要退出登录吗？', '提示', {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          type: 'warning',
        })
        ElMessage.success('已退出登录')
        router.push('/login')
      } catch {
        // 取消
      }
      break
  }
}
</script>

<style scoped>
.main-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: var(--header-height);
  background: var(--el-bg-color);
  border-bottom: 1px solid var(--el-border-color-light);
  padding: 0 16px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ws-status {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  font-size: 12px;
}

.ws-status.connected {
  color: var(--el-color-success);
  background: var(--el-color-success-light-9);
}

.ws-status.connecting {
  color: var(--el-color-warning);
  background: var(--el-color-warning-light-9);
}

.ws-status.disconnected {
  color: var(--el-color-danger);
  background: var(--el-color-danger-light-9);
}

.status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
}

.ws-status.connecting .status-indicator {
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.notification-badge :deep(.el-badge__content) {
  transform: translate(30%, -30%);
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.user-info:hover {
  background: var(--el-fill-color-light);
}

.user-name {
  font-size: 14px;
  font-weight: 500;
}

.notification-popover {
  padding: 8px 0;
}

.notification-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 12px 8px;
  border-bottom: 1px solid var(--el-border-color-light);
  margin-bottom: 8px;
}

.notification-empty {
  text-align: center;
  padding: 32px;
  color: var(--el-text-color-secondary);
}

.notification-item {
  padding: 12px;
  cursor: pointer;
  transition: background var(--transition-fast);
  border-left: 3px solid transparent;
}

.notification-item:hover {
  background: var(--el-fill-color-light);
}

.notification-item.unread {
  border-left-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

.notification-title {
  font-weight: 500;
  margin-bottom: 4px;
}

.notification-content {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-bottom: 4px;
}

.notification-time {
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}
</style>

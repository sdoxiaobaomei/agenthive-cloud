<template>
  <el-aside 
    class="sidebar" 
    :class="{ 'is-collapsed': collapsed, 'is-mobile': isMobile }"
    :width="collapsed ? '64px' : '260px'"
  >
    <div class="sidebar-header">
      <div class="logo">
        <el-icon :size="32" color="var(--el-color-primary)">
          <Orange />
        </el-icon>
        <span v-show="!collapsed" class="logo-text">AgentHive</span>
      </div>
    </div>
    
    <el-scrollbar class="sidebar-menu-wrapper">
      <el-menu
        :default-active="activeRoute"
        :collapse="collapsed"
        :collapse-transition="false"
        router
        class="sidebar-menu"
      >
        <el-menu-item index="/">
          <el-icon><Odometer /></el-icon>
          <template #title>工作区</template>
        </el-menu-item>
        
        <el-menu-item index="/agents">
          <el-icon><UserFilled /></el-icon>
          <template #title>Agent 管理</template>
        </el-menu-item>
        
        <el-menu-item index="/tasks">
          <el-icon><List /></el-icon>
          <template #title>任务看板</template>
        </el-menu-item>
        
        <el-menu-item index="/sprints">
          <el-icon><Calendar /></el-icon>
          <template #title>Sprint</template>
        </el-menu-item>
        
        <el-divider />

        <el-sub-menu index="/tools">
          <template #title>
            <el-icon><Tools /></el-icon>
            <span>工具箱</span>
          </template>
          <el-menu-item index="/code">
            <el-icon><Document /></el-icon>
            <template #title>代码查看</template>
          </el-menu-item>
          <el-menu-item index="/terminal">
            <el-icon><TerminalIcon /></el-icon>
            <template #title>终端</template>
          </el-menu-item>
          <el-menu-item index="/chat">
            <el-icon><ChatDotRound /></el-icon>
            <template #title>对话</template>
          </el-menu-item>
        </el-sub-menu>
      </el-menu>
    </el-scrollbar>
    
    <div class="sidebar-footer">
      <el-tooltip :content="collapsed ? '展开' : '收起'" placement="right">
        <el-button 
          :icon="collapsed ? Expand : Fold" 
          text
          class="collapse-btn"
          @click="handleToggle"
        />
      </el-tooltip>
      
      <el-menu
        :collapse="collapsed"
        :collapse-transition="false"
        router
        class="sidebar-menu"
      >
        <el-menu-item index="/settings">
          <el-icon><Setting /></el-icon>
          <template #title>设置</template>
        </el-menu-item>
      </el-menu>
    </div>
  </el-aside>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import {
  Orange, Odometer, UserFilled, List, Calendar,
  Document, ChatDotRound, Setting, Tools,
  Expand, Fold, Monitor as TerminalIcon
} from '@element-plus/icons-vue'

defineProps<{
  collapsed: boolean
}>()

const emit = defineEmits<{
  toggle: []
}>()

const route = useRoute()
const isMobile = ref(false)

const activeRoute = computed(() => route.path)

const handleToggle = () => {
  emit('toggle')
}

// 检测是否为移动端
const checkMobile = () => {
  isMobile.value = window.innerWidth <= 768
}

let resizeTimer: ReturnType<typeof setTimeout> | null = null
const handleResize = () => {
  if (resizeTimer) clearTimeout(resizeTimer)
  resizeTimer = setTimeout(checkMobile, 100)
}

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  if (resizeTimer) clearTimeout(resizeTimer)
})
</script>

<style scoped>
.sidebar {
  display: flex;
  flex-direction: column;
  background: var(--el-bg-color);
  border-right: 1px solid var(--el-border-color-light);
  transition: width 0.3s, transform 0.3s;
  z-index: 200;
}

.sidebar-header {
  padding: 16px;
  border-bottom: 1px solid var(--el-border-color-light);
  flex-shrink: 0;
}

.logo {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 32px;
}

.logo-text {
  font-size: 20px;
  font-weight: 700;
  color: var(--el-color-primary);
  background: linear-gradient(135deg, var(--el-color-primary) 0%, var(--el-color-primary-light-3) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  white-space: nowrap;
}

.sidebar-menu-wrapper {
  flex: 1;
  padding: 12px 0;
}

.sidebar-menu {
  border-right: none;
}

.sidebar-menu .el-menu-item {
  height: 44px;
  line-height: 44px;
  margin: 4px 8px;
  border-radius: var(--radius-md);
}

.sidebar-menu .el-menu-item.is-active {
  background: var(--el-color-primary-light-9);
}

.sidebar-menu .el-menu-item:hover {
  background: var(--el-fill-color-light);
}

.sidebar-footer {
  padding: 12px;
  border-top: 1px solid var(--el-border-color-light);
  flex-shrink: 0;
}

.collapse-btn {
  width: 100%;
  margin-bottom: 8px;
}

:deep(.el-divider) {
  margin: 8px 16px;
}

/* 移动端样式 */
@media (max-width: 768px) {
  .sidebar {
    position: fixed;
    left: 0;
    top: 0;
    bottom: 0;
    box-shadow: 2px 0 8px rgba(0, 0, 0, 0.1);
  }
  
  .sidebar.is-collapsed {
    transform: translateX(-100%);
    width: 260px !important;
  }
  
  .sidebar.is-mobile:not(.is-collapsed) {
    box-shadow: 4px 0 16px rgba(0, 0, 0, 0.2);
  }
  
  .collapse-btn {
    display: none;
  }
}
</style>

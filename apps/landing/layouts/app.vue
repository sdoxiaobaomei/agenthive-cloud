<template>
  <div class="app-layout">
    <!-- Unauthenticated: just render content -->
    <template v-if="!isAuthenticated">
      <div class="unauthenticated-content">
        <slot />
      </div>
    </template>

    <!-- Authenticated: sidebar + header + content -->
    <template v-else>
    <!-- Left Sidebar -->
    <aside class="left-sidebar" :class="{ collapsed: isSidebarCollapsed }">
      <!-- Collapse Toggle -->
      <div class="sidebar-toggle">
        <button
          class="toggle-btn"
          :title="isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'"
          @click="toggleSidebar"
        >
          <el-icon><Fold v-if="!isSidebarCollapsed" /><Expand v-else /></el-icon>
        </button>
      </div>

      <!-- Logo (visible when expanded) -->
      <div v-if="!isSidebarCollapsed" class="sidebar-logo">
        <NuxtLink to="/dashboard" class="logo-link">
          <div class="logo-icon">A</div>
          <span class="logo-text">AgentHive</span>
        </NuxtLink>
      </div>

      <!-- Navigation -->
      <nav class="sidebar-nav">
        <!-- Marketplace -->
        <NuxtLink
          to="/marketplace"
          class="nav-item"
          :class="{ active: route.path.startsWith('/marketplace') }"
        >
          <div class="nav-icon">
            <el-icon><Shop /></el-icon>
          </div>
          <span v-if="!isSidebarCollapsed" class="nav-label">Marketplace</span>
        </NuxtLink>

        <!-- My Projects -->
        <NuxtLink
          to="/projects"
          class="nav-item"
          :class="{ active: route.path === '/projects' || route.path.startsWith('/projects/') }"
        >
          <div class="nav-icon">
            <el-icon><FolderOpened /></el-icon>
          </div>
          <span v-if="!isSidebarCollapsed" class="nav-label">My Projects</span>
        </NuxtLink>

        <!-- New Project -->
        <NuxtLink
          to="/dashboard"
          class="nav-item"
          :class="{ active: route.path === '/dashboard' }"
        >
          <div class="nav-icon">
            <el-icon><Plus /></el-icon>
          </div>
          <span v-if="!isSidebarCollapsed" class="nav-label">New Project</span>
        </NuxtLink>
      </nav>

      <!-- Recents (max 3) -->
      <div v-if="!isSidebarCollapsed && recentProjects.length > 0" class="sidebar-recents">
        <div class="recents-label">Recents</div>
        <div class="project-icons">
          <div
            v-for="project in recentProjects"
            :key="project.id"
            class="project-icon-item"
            :class="{ active: currentProject?.id === project.id }"
            :title="project.name"
            @click="selectProject(project)"
          >
            <div class="project-icon-avatar">{{ project.name.charAt(0) }}</div>
            <span class="project-icon-name">{{ project.name }}</span>
          </div>
        </div>
        <NuxtLink
          v-if="recentProjects.length > 0"
          to="/projects"
          class="view-all-link"
        >
          View All 鈫?        </NuxtLink>
      </div>

      <!-- Sidebar Footer -->
      <div v-if="!isSidebarCollapsed" class="sidebar-footer">
        <NuxtLink to="/credits" class="footer-btn" title="Credits">
          <el-icon><Coin /></el-icon>
          <span class="footer-btn-label">{{ (mockCredits.account.value?.balance ?? 0).toFixed(0) }}</span>
        </NuxtLink>
        <NuxtLink to="/creator" class="footer-btn" title="Creator Center">
          <el-icon><ShoppingBag /></el-icon>
        </NuxtLink>
        <button class="footer-btn" title="Notifications" @click="showNotifications = true">
          <el-icon><Bell /></el-icon>
        </button>
        <button class="footer-btn" title="Settings" @click="showSettings = true">
          <el-icon><Setting /></el-icon>
        </button>
        <div class="footer-avatar" @click="showUserMenu = !showUserMenu">
          <img v-if="user?.avatar" :src="user.avatar" class="user-avatar-img" alt="user" />
          <div v-else class="user-avatar-fallback">{{ userInitial }}</div>
          <!-- User dropdown -->
          <div v-if="showUserMenu" class="user-dropdown">
            <div class="dropdown-item" @click="goHome">
              <el-icon><HomeFilled /></el-icon>
              <span>Home</span>
            </div>
            <div class="dropdown-divider"></div>
            <div class="dropdown-item danger" @click="logout">
              <el-icon><SwitchButton /></el-icon>
              <span>Logout</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Collapsed Footer -->
      <div v-else class="sidebar-footer-collapsed">
        <div class="footer-avatar-collapsed" @click="goHome">
          <img v-if="user?.avatar" :src="user.avatar" class="user-avatar-img" alt="user" />
          <div v-else class="user-avatar-fallback">{{ userInitial }}</div>
        </div>
      </div>
    </aside>

    <!-- Main Content Area -->
    <main class="main-area">
      <!-- Top Header Bar -->
      <header class="top-bar">
        <div class="flex items-center gap-3">
          <NuxtLink v-if="isSidebarCollapsed" to="/dashboard" class="logo-link">
            <div class="logo-icon">A</div>
            <span class="logo-text">AgentHive</span>
          </NuxtLink>
        </div>

        <div class="breadcrumb">
          <span v-if="currentProject">{{ currentProject.name }}</span>
          <span v-else-if="route.path === '/dashboard'">Dashboard</span>
          <span v-else-if="route.path.startsWith('/marketplace')">Marketplace</span>
          <span v-else-if="route.path === '/projects' || route.path.startsWith('/projects/')">Projects</span>
          <span v-else-if="route.path.startsWith('/chat')">Chat</span>
          <span v-else-if="route.path.startsWith('/credits')">Credits</span>
          <span v-else-if="route.path.startsWith('/creator')">Creator Center</span>
          <span v-else>Workspace</span>
        </div>

        <div class="top-actions">
          <div class="user-menu" @click="showUserMenuTop = !showUserMenuTop">
            <img v-if="user?.avatar" :src="user.avatar" class="user-avatar" alt="user" />
            <div v-else class="user-avatar fallback">{{ userInitial }}</div>
            <!-- Dropdown menu -->
            <div v-if="showUserMenuTop" class="user-dropdown">
              <div class="dropdown-item" @click="goHome">
                <el-icon><HomeFilled /></el-icon>
                <span>Home</span>
              </div>
              <div class="dropdown-divider"></div>
              <div class="dropdown-item danger" @click="logout">
                <el-icon><SwitchButton /></el-icon>
                <span>Logout</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <!-- Page Content -->
      <div class="content-wrapper">
        <slot />
      </div>
    </main>
    </template>

    <!-- Notifications Dialog (placeholder) -->
    <el-dialog
      v-model="showNotifications"
      title="Notifications"
      width="400px"
      :close-on-click-modal="true"
    >
      <div class="placeholder-dialog">
        <el-icon :size="48"><Bell /></el-icon>
        <p>No new notifications</p>
      </div>
    </el-dialog>

    <!-- Settings Dialog (placeholder) -->
    <el-dialog
      v-model="showSettings"
      title="Settings"
      width="400px"
      :close-on-click-modal="true"
    >
      <div class="placeholder-dialog">
        <el-icon :size="48"><Setting /></el-icon>
        <p>Settings will be available soon</p>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  Plus,
  FolderOpened,
  HomeFilled,
  SwitchButton,
  Shop,
  Fold,
  Expand,
  Bell,
  Setting,
  Coin,
  ShoppingBag,
} from '@element-plus/icons-vue'
import { useProjectStore, type Project } from '~/stores/project'
import { useAuthStore } from '~/stores/auth'
import { useChatStore } from '~/stores/chat'
import { useMockCredits } from '~/composables/useMockCredits'

const router = useRouter()
const route = useRoute()
const projectStore = useProjectStore()
const authStore = useAuthStore()
const mockCredits = useMockCredits()

// Only show sidebar/header for authenticated users
const isAuthenticated = computed(() => authStore.isAuthenticated)

// Auth
const user = computed(() => authStore.currentUser)
const userInitial = computed(() => authStore.userInitial)

const logout = async () => {
  await authStore.logout()
  router.push('/dashboard')
}

const goHome = () => {
  router.push('/dashboard')
  showUserMenu.value = false
  showUserMenuTop.value = false
}

// User menus
const showUserMenu = ref(false)
const showUserMenuTop = ref(false)

// Close user dropdown on click outside
let userMenuClickHandler: ((e: MouseEvent) => void) | null = null
onMounted(() => {
  userMenuClickHandler = (e: MouseEvent) => {
    const target = e.target as HTMLElement
    if (!target.closest('.footer-avatar') && !target.closest('.user-menu')) {
      showUserMenu.value = false
      showUserMenuTop.value = false
    }
  }
  document.addEventListener('click', userMenuClickHandler)
})
onUnmounted(() => {
  if (userMenuClickHandler) {
    document.removeEventListener('click', userMenuClickHandler)
  }
})

// Sidebar state - persist in localStorage
const SIDEBAR_KEY = 'agenthive:sidebar-collapsed'
const isSidebarCollapsed = ref(false)

const toggleSidebar = () => {
  isSidebarCollapsed.value = !isSidebarCollapsed.value
  if (import.meta.client) {
    localStorage.setItem(SIDEBAR_KEY, String(isSidebarCollapsed.value))
  }
}

onMounted(() => {
  if (import.meta.client) {
    const saved = localStorage.getItem(SIDEBAR_KEY)
    if (saved !== null) {
      isSidebarCollapsed.value = saved === 'true'
    }
  }
})

// Projects from store
const currentProject = computed(() => projectStore.currentProject)
const recentProjects = computed(() => projectStore.activeProjects.slice(0, 3))

const selectProject = async (project: Project) => {
  projectStore.setCurrentProject(project)
  const chatStore = useChatStore()
  // 加载该项目的已有 chat sessions
  await chatStore.loadConversations(project.id)
  if (chatStore.conversations.length > 0) {
    router.push('/chat/' + chatStore.conversations[0].id)
  } else {
    const conv = await chatStore.createConversation(project.name, project.id)
    router.push('/chat/' + conv.id)
  }
}

// Fetch projects on mount
onMounted(async () => {
  try {
    await projectStore.fetchProjects()
  } catch (err: any) {
    if (import.meta.dev) {
      console.debug('[AppLayout] Failed to fetch projects:', err.message)
    }
  }
})

// Poll credits balance every 5s
let creditsPollInterval: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  mockCredits.refresh()
  creditsPollInterval = setInterval(() => {
    mockCredits.refresh()
  }, 5000)
})
onUnmounted(() => {
  if (creditsPollInterval) {
    clearInterval(creditsPollInterval)
    creditsPollInterval = null
  }
})

// Placeholder dialogs
const showNotifications = ref(false)
const showSettings = ref(false)
</script>

<style scoped>
.app-layout {
  display: flex;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  background: #ffffff;
}

.unauthenticated-content {
  flex: 1;
  overflow: auto;
  min-height: 100vh;
}

/* Left Sidebar */
.left-sidebar {
  width: 240px;
  flex-shrink: 0;
  background: #f9fafb;
  border-right: 1px solid #e5e7eb;
  display: flex;
  flex-direction: column;
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
  z-index: 50;
}

.left-sidebar.collapsed {
  width: 56px;
}

/* Sidebar Toggle */
.sidebar-toggle {
  padding: 12px;
  display: flex;
  justify-content: flex-end;
}

.toggle-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #9ca3af;
  cursor: pointer;
  transition: all 0.15s ease;
}

.toggle-btn:hover {
  background: #f3f4f6;
  color: #374151;
}

/* Sidebar Logo */
.sidebar-logo {
  padding: 0 16px 12px;
}

.sidebar-logo .logo-link {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
}

.sidebar-logo .logo-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: #4267ff;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 16px;
  flex-shrink: 0;
}

.sidebar-logo .logo-text {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
}

/* Sidebar Navigation */
.sidebar-nav {
  flex: 1;
  overflow-y: auto;
  padding: 0 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  text-decoration: none;
  color: #374151;
  cursor: pointer;
  transition: all 0.15s ease;
  user-select: none;
}

.nav-item:hover {
  background: #f3f4f6;
  color: #111827;
}

.nav-item.active {
  background: #eff6ff;
  color: #4f46e5;
}

.nav-icon {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
}

.nav-label {
  font-size: 13px;
  font-weight: 500;
  flex: 1;
}

/* Recents */
.sidebar-recents {
  padding: 12px 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-top: 1px solid #e5e7eb;
}

.recents-label {
  font-size: 11px;
  font-weight: 500;
  color: #9ca3af;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding-left: 4px;
}

.project-icons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.project-icon-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 6px;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.15s ease;
  width: 64px;
}

.project-icon-item:hover {
  background: #f3f4f6;
}

.project-icon-item.active {
  background: #eff6ff;
}

.project-icon-item.active .project-icon-avatar {
  background: #4f46e5;
  color: white;
}

.project-icon-item.active .project-icon-name {
  color: #4f46e5;
}

.project-icon-avatar {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: #e5e7eb;
  color: #374151;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 600;
  flex-shrink: 0;
}

.project-icon-name {
  font-size: 10px;
  font-weight: 500;
  color: #6b7280;
  text-align: center;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.view-all-link {
  font-size: 12px;
  font-weight: 500;
  color: #4f46e5;
  text-decoration: none;
  padding: 4px;
  transition: color 0.15s ease;
}

.view-all-link:hover {
  color: #4338ca;
  text-decoration: underline;
}

/* Sidebar Footer */
.sidebar-footer {
  padding: 12px;
  border-top: 1px solid #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
}

.footer-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #6b7280;
  cursor: pointer;
  text-decoration: none;
  transition: all 0.15s ease;
}

.footer-btn:hover {
  background: #f3f4f6;
  color: #374151;
}

.footer-btn-label {
  font-size: 11px;
  font-weight: 500;
}

.footer-avatar {
  position: relative;
  cursor: pointer;
}

.user-avatar-img {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
}

.user-avatar-fallback {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #4267ff;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 600;
}

/* Collapsed Footer */
.sidebar-footer-collapsed {
  padding: 12px 0;
  border-top: 1px solid #e5e7eb;
  display: flex;
  justify-content: center;
}

.footer-avatar-collapsed {
  cursor: pointer;
}

/* User Dropdown */
.user-dropdown {
  position: absolute;
  bottom: 44px;
  right: 0;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12);
  z-index: 100;
  min-width: 160px;
  padding: 6px;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  color: #374151;
  transition: all 0.15s ease;
}

.dropdown-item:hover {
  background: #f3f4f6;
}

.dropdown-item.danger {
  color: #ef4444;
}

.dropdown-item.danger:hover {
  background: #fef2f2;
}

.dropdown-divider {
  height: 1px;
  background: #e5e7eb;
  margin: 4px 0;
}

/* Main Content */
.main-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: #ffffff;
}

/* Top Bar */
.top-bar {
  height: 64px;
  background: #ffffff;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  flex-shrink: 0;
}

.top-bar .logo-link {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
}

.top-bar .logo-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: #4267ff;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 16px;
  flex-shrink: 0;
}

.top-bar .logo-text {
  font-size: 18px;
  font-weight: 600;
  color: #111827;
  font-family: 'IBM Plex Sans', sans-serif;
}

.breadcrumb {
  font-size: 14px;
  font-weight: 500;
  color: #6b7280;
  flex: 1;
  text-align: center;
}

.top-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.user-menu {
  position: relative;
  display: flex;
  align-items: center;
  cursor: pointer;
}

.user-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
}

.user-avatar.fallback {
  background: #e5e7eb;
  color: #6b7280;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 600;
}

.top-bar .user-dropdown {
  position: absolute;
  top: 44px;
  right: 0;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  box-shadow: 0 10px 40px rgba(0,0,0,0.12);
  z-index: 100;
  min-width: 160px;
  padding: 6px;
}

/* Content Wrapper */
.content-wrapper {
  flex: 1;
  overflow: hidden;
  display: flex;
  position: relative;
}

/* Placeholder Dialog */
.placeholder-dialog {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: #9ca3af;
  gap: 12px;
}

.placeholder-dialog p {
  font-size: 14px;
}
</style>

<template>
  <div class="chat-layout">
    <!-- Overlay when sidebar is open on mobile -->
    <div
      v-if="!isSidebarCollapsed && isMobile"
      class="sidebar-overlay"
      @click="toggleSidebar"
    ></div>

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
          :class="{ active: route.path === '/projects' }"
        >
          <div class="nav-icon">
            <el-icon><FolderOpened /></el-icon>
          </div>
          <span v-if="!isSidebarCollapsed" class="nav-label">My Projects</span>
        </NuxtLink>

        <!-- Recents -->
        <div v-if="!isSidebarCollapsed" class="sidebar-recents">
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
            View All →
          </NuxtLink>
          <div v-if="recentProjects.length === 0" class="empty-recents">
            <span>No projects yet</span>
          </div>
        </div>
      </nav>

      <!-- Sidebar Footer -->
      <div v-if="!isSidebarCollapsed" class="sidebar-footer">
        <NuxtLink to="/" class="footer-btn" title="Home">
          <el-icon><HomeFilled /></el-icon>
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
    <main class="main-content">
      <!-- Chat Header -->
      <header class="chat-header">
        <!-- Left: Project Name -->
        <div class="header-left">
          <span v-if="currentProject" class="project-name">{{ currentProject.name }}</span>
          <span v-else class="project-name placeholder">Select a project</span>
        </div>

        <!-- Center: Tab Buttons -->
        <div class="header-center">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            class="tab-btn"
            :class="{ active: chatStore.activeTab === tab.id }"
            @click="chatStore.setActiveTab(tab.id)"
          >
            <el-icon><component :is="tab.icon" /></el-icon>
            <span v-if="chatStore.activeTab === tab.id" class="tab-label">{{ tab.label }}</span>
          </button>
        </div>

        <!-- Right: Actions -->
        <div class="header-right">
          <button class="header-action-btn" title="Publish" @click="handlePublish">
            <el-icon><Upload /></el-icon>
          </button>
        </div>
      </header>

      <!-- Page Content -->
      <div class="content-area">
        <slot />
      </div>
    </main>

    <!-- New Project Dialog -->
    <el-dialog
      v-model="showNewProjectDialog"
      title="New Project"
      width="420px"
      :close-on-click-modal="false"
      class="project-dialog"
    >
      <el-form :model="newProject" label-position="top">
        <el-form-item label="Project Name">
          <el-input v-model="newProject.name" placeholder="Enter project name" size="large" />
        </el-form-item>
        <el-form-item label="Description">
          <el-input
            v-model="newProject.description"
            type="textarea"
            :rows="3"
            placeholder="Describe your project (optional)"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showNewProjectDialog = false">Cancel</el-button>
        <el-button type="primary" :loading="projectStore.loading" @click="addProject">
          Create
        </el-button>
      </template>
    </el-dialog>



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
import type { Component } from 'vue'
import {
  Plus,
  FolderOpened,
  Upload,
  HomeFilled,
  SwitchButton,
  Shop,
  Fold,
  Expand,
  Bell,
  Setting,
  View,
  Edit,
  Document,
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useProjectStore, type Project } from '~/stores/project'
import { useAuthStore } from '~/stores/auth'
import { useChatStore } from '~/stores/chat'

const router = useRouter()
const route = useRoute()
const projectStore = useProjectStore()
const authStore = useAuthStore()
const chatStore = useChatStore()

// Auth
const user = computed(() => authStore.currentUser)
const userInitial = computed(() => authStore.userInitial)

const logout = async () => {
  await authStore.logout()
  router.push('/')
}

const goHome = () => {
  router.push('/')
  showUserMenu.value = false
}

// User menu
const showUserMenu = ref(false)

// Close user dropdown on click outside
let userMenuClickHandler: ((e: MouseEvent) => void) | null = null
onMounted(() => {
  userMenuClickHandler = (e: MouseEvent) => {
    const target = e.target as HTMLElement
    if (!target.closest('.footer-avatar')) {
      showUserMenu.value = false
    }
  }
  document.addEventListener('click', userMenuClickHandler)
})
onUnmounted(() => {
  if (userMenuClickHandler) {
    document.removeEventListener('click', userMenuClickHandler)
  }
})

// Mobile detection
const isMobile = ref(false)
const checkMobile = () => {
  isMobile.value = window.innerWidth < 768
}
onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
})
onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
})

// Sidebar state - default expanded
const isSidebarCollapsed = ref(false)

const toggleSidebar = () => {
  isSidebarCollapsed.value = !isSidebarCollapsed.value
}

// Projects from store
const currentProject = computed(() => projectStore.currentProject)
const recentProjects = computed(() => projectStore.activeProjects.slice(0, 3))

const selectProject = (project: Project) => {
  projectStore.setCurrentProject(project)
  router.push(`/workspace/${project.id}`)
}

// Fetch projects on mount
onMounted(async () => {
  try {
    await projectStore.fetchProjects()
  } catch (err: any) {
    if (import.meta.dev) {
      console.debug('[ChatLayout] Failed to fetch projects:', err.message)
    }
  }
})

// New project
const showNewProjectDialog = ref(false)
const newProject = ref({ name: '', description: '' })

const addProject = async () => {
  if (!newProject.value.name.trim()) {
    ElMessage.warning('Please enter a project name')
    return
  }
  try {
    const project = await projectStore.createProject({
      name: newProject.value.name.trim(),
      description: newProject.value.description.trim(),
    })
    newProject.value = { name: '', description: '' }
    showNewProjectDialog.value = false
    ElMessage.success('Project created')
    projectStore.setCurrentProject(project)
    router.push(`/workspace/${project.id}`)
  } catch (err: any) {
    ElMessage.error(err.message || 'Failed to create project')
  }
}



// Header tabs
type TabId = 'files' | 'editor' | 'preview'
const tabs: { id: TabId; label: string; icon: Component }[] = [
  { id: 'preview', label: 'Preview', icon: View },
  { id: 'files', label: 'Files', icon: Document },
  { id: 'editor', label: 'Editor', icon: Edit },
]

// Placeholder dialogs
const showNotifications = ref(false)
const showSettings = ref(false)

const handlePublish = () => {
  ElMessage.info('Publish feature coming soon')
}

// Provide current project for child pages
provide('currentProject', currentProject)
</script>

<style scoped>
.chat-layout {
  display: flex;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  background: #ffffff;
}

/* Overlay when sidebar is open on mobile */
.sidebar-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(2px);
  z-index: 40;
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

/* Nav Section */
.nav-section {
  display: flex;
  flex-direction: column;
}

.nav-section-header {
  width: 100%;
  border: none;
  background: transparent;
}

.section-arrow {
  font-size: 12px;
  color: #9ca3af;
  transition: transform 0.2s ease;
}

.section-arrow.expanded {
  transform: rotate(90deg);
}

/* Projects List */
.sidebar-recents {
  padding: 4px 8px 4px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
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

.my-projects-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 500;
  color: #374151;
  cursor: pointer;
  transition: all 0.15s ease;
}

.my-projects-btn:hover {
  border-color: #4f46e5;
  color: #4f46e5;
  background: #eff6ff;
}

/* Recents */
.recents-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
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

.empty-recents {
  padding: 12px;
  text-align: center;
}

.empty-recents span {
  font-size: 12px;
  color: #9ca3af;
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
.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: #ffffff;
}

/* Chat Header */
.chat-header {
  height: 48px;
  background: #ffffff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  min-width: 0;
  flex: 1;
}

.project-name {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.project-name.placeholder {
  color: #9ca3af;
}

.header-center {
  display: flex;
  align-items: center;
  gap: 6px;
  justify-content: center;
  flex: 1;
}

.tab-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 32px;
  min-width: 32px;
  padding: 0;
  border: none;
  border-radius: 16px;
  background: transparent;
  color: #6b7280;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.tab-btn .el-icon {
  font-size: 16px;
}

.tab-btn:hover {
  background: #f3f4f6;
  color: #374151;
}

.tab-btn.active {
  background: #eff6ff;
  color: #4f46e5;
  padding: 0 12px;
}

.tab-label {
  white-space: nowrap;
}

.header-right {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex: 1;
}

.header-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.15s ease;
}

.header-action-btn:hover {
  background: #f3f4f6;
  color: #374151;
}

/* Content Area */
.content-area {
  flex: 1;
  overflow: hidden;
  display: flex;
}

/* Dialog Styles */
:deep(.project-dialog) {
  border-radius: 12px;
}

:deep(.project-dialog .el-dialog__header) {
  padding: 20px;
  border-bottom: 1px solid #e5e7eb;
}

:deep(.project-dialog .el-dialog__title) {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
}

:deep(.project-dialog .el-dialog__body) {
  padding: 20px;
}

:deep(.project-dialog .el-dialog__footer) {
  padding: 16px 20px;
  border-top: 1px solid #e5e7eb;
}

:deep(.project-dialog .el-button--primary) {
  background: #4f46e5;
  border-color: #4f46e5;
}

:deep(.project-dialog .el-button--primary:hover) {
  background: #4338ca;
  border-color: #4338ca;
}

/* Project Search Dialog */
:deep(.project-search-dialog) {
  border-radius: 16px;
}

:deep(.project-search-dialog .el-dialog__header) {
  padding: 20px 24px;
  border-bottom: 1px solid #e5e7eb;
  margin-right: 0;
}

:deep(.project-search-dialog .el-dialog__title) {
  font-size: 18px;
  font-weight: 600;
  color: #111827;
}

:deep(.project-search-dialog .el-dialog__body) {
  padding: 20px 24px;
}

.project-search-input-wrapper {
  position: relative;
  margin-bottom: 16px;
}

.search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: #9ca3af;
  font-size: 18px;
  z-index: 1;
}

:deep(.project-search-input .el-input__inner) {
  padding-left: 40px;
  border-radius: 10px;
  height: 44px;
}

.project-search-list {
  max-height: 400px;
  overflow-y: auto;
}

.project-search-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.15s ease;
  margin-bottom: 4px;
}

.project-search-item:hover {
  background: #f3f4f6;
}

.project-search-item.active {
  background: #eff6ff;
  border: 1px solid #bfdbfe;
}

.project-search-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: #f3f4f6;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #6b7280;
  font-size: 20px;
}

.project-search-item:hover .project-search-icon {
  background: #e5e7eb;
  color: #4f46e5;
}

.project-search-info {
  flex: 1;
  min-width: 0;
}

.project-search-name {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
  margin-bottom: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.project-search-desc {
  font-size: 13px;
  color: #6b7280;
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.project-search-date {
  font-size: 12px;
  color: #9ca3af;
}

.project-search-check {
  color: #4f46e5;
  font-size: 20px;
}

.project-search-empty {
  text-align: center;
  padding: 40px 20px;
  color: #9ca3af;
}

.project-search-empty p {
  margin-top: 12px;
  font-size: 14px;
}

.project-search-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.project-count {
  font-size: 13px;
  color: #6b7280;
}

:deep(.project-search-dialog .el-dialog__footer) {
  padding: 16px 24px;
  border-top: 1px solid #e5e7eb;
}

/* Placeholder Dialogs */
.placeholder-dialog {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: #9ca3af;
  gap: 12px;
}

.placeholder-dialog p {
  font-size: 14px;
}

/* Responsive */
@media (max-width: 768px) {
  .left-sidebar {
    position: fixed;
    top: 0;
    left: 0;
    height: 100vh;
    transform: translateX(0);
  }

  .left-sidebar.collapsed {
    transform: translateX(-100%);
    width: 240px;
  }

  .chat-header {
    padding: 0 12px;
  }

  .tab-btn {
    min-width: 28px;
    height: 28px;
  }

  .tab-btn.active {
    padding: 0 8px;
  }
}
</style>

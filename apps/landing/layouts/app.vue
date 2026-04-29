<template>
  <div class="app-layout">
    <!-- Left Sidebar - Projects -->
    <aside class="project-sidebar" :class="{ collapsed: isSidebarCollapsed }">
      <div class="sidebar-inner">
        <!-- Sidebar Header -->
        <div class="sidebar-header">
          <NuxtLink to="/dashboard" class="logo-link">
            <div class="logo-icon">A</div>
            <span class="logo-text">AgentHive</span>
          </NuxtLink>
          <button
            class="new-project-btn"
            @click="showNewProjectDialog = true"
          >
            <el-icon><Plus /></el-icon>
            <span>New Project</span>
          </button>
        </div>

        <!-- Projects Section -->
        <div class="projects-section">
          <div class="section-header" @click="toggleProjectsExpanded">
            <div class="section-title">
              <el-icon><Folder /></el-icon>
              <span>My Projects</span>
            </div>
            <div class="flex items-center gap-2">
              <NuxtLink
                to="/marketplace"
                class="view-all-btn"
                title="Marketplace"
                @click.stop
              >
                <el-icon><ShoppingBag /></el-icon>
              </NuxtLink>
              <NuxtLink
                to="/projects"
                class="view-all-btn"
                title="View all projects"
                @click.stop
              >
                <el-icon><FolderOpened /></el-icon>
              </NuxtLink>
              <button
                class="view-all-btn"
                @click.stop="showProjectSearchDialog = true"
                title="Search projects"
              >
                <el-icon><Search /></el-icon>
              </button>
              <el-icon class="expand-icon" :class="{ expanded: isProjectsExpanded }">
                <ArrowRight />
              </el-icon>
            </div>
          </div>

          <div v-show="isProjectsExpanded" class="project-list">
            <div class="project-group">
              <div class="group-label">Recents</div>
            </div>
            <div
              v-for="project in recentProjects"
              :key="project.id"
              class="project-item"
              :class="{ active: currentProject?.id === project.id }"
              @click="selectProject(project)"
            >
              <div class="project-info">
                <div class="project-name">{{ project.name }}</div>
                <div class="project-desc">{{ project.description }}</div>
              </div>
              <button
                class="workspace-btn"
                title="Open workspace"
                @click.stop="openWorkspace(project.id)"
              >
                <el-icon><Document /></el-icon>
              </button>
            </div>
            <div v-if="recentProjects.length === 0" class="empty-projects">
              <span class="empty-text">No projects yet</span>
            </div>
          </div>
        </div>
      </div>
    </aside>

    <!-- Main Content Area -->
    <main class="main-area">
      <!-- Top Bar -->
      <header class="top-bar">
        <div class="flex items-center gap-3">
          <button class="sidebar-toggle-btn" @click="toggleSidebar" title="Toggle sidebar">
            <el-icon><Menu /></el-icon>
          </button>
          <NuxtLink to="/dashboard" class="logo-link">
            <div class="logo-icon">A</div>
            <span class="logo-text">AgentHive</span>
          </NuxtLink>
        </div>

        <div class="breadcrumb">
          <span v-if="currentProject">{{ currentProject.name }}</span>
          <span v-else>Dashboard</span>
        </div>

        <div class="top-actions">
          <NuxtLink to="/credits" class="credits-badge">
            <el-icon><Coin /></el-icon>
            <span>{{ (mockCredits.account.value?.balance ?? 0).toFixed(0) }}</span>
          </NuxtLink>
          <NuxtLink to="/creator" class="nav-link" title="Creator Center">
            <el-icon><ShoppingBag /></el-icon>
          </NuxtLink>
          <button class="action-btn" @click="showNewProjectDialog = true">
            <el-icon><Plus /></el-icon>
            <span>New Project</span>
          </button>
          <div class="user-menu" @click="showUserMenu = !showUserMenu">
            <img v-if="user?.avatar" :src="user.avatar" class="user-avatar" alt="user" />
            <div v-else class="user-avatar fallback">{{ userInitial }}</div>
            <!-- Dropdown menu -->
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
      </header>

      <!-- Page Content -->
      <div class="content-wrapper">
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

    <!-- Project Search Dialog -->
    <el-dialog
      v-model="showProjectSearchDialog"
      title="All Projects"
      width="600px"
      :close-on-click-modal="true"
      class="project-search-dialog"
    >
      <div class="project-search-input-wrapper">
        <el-icon class="search-icon"><Search /></el-icon>
        <el-input
          v-model="projectSearchQuery"
          placeholder="Search projects..."
          size="large"
          clearable
          class="project-search-input"
        />
      </div>

      <div class="project-search-list">
        <div
          v-for="project in filteredProjects"
          :key="project.id"
          class="project-search-item"
          :class="{ active: currentProject?.id === project.id }"
          @click="selectProjectFromSearch(project)"
        >
          <div class="project-search-icon">
            <el-icon><Folder /></el-icon>
          </div>
          <div class="project-search-info">
            <div class="project-search-name">{{ project.name }}</div>
            <div class="project-search-desc">{{ project.description }}</div>
            <div class="project-search-date">{{ formatDate(project.createdAt) }}</div>
          </div>
          <el-icon v-if="currentProject?.id === project.id" class="project-search-check"><Check /></el-icon>
        </div>

        <div v-if="filteredProjects.length === 0" class="project-search-empty">
          <el-icon :size="48"><Search /></el-icon>
          <p>No projects found</p>
        </div>
      </div>

      <template #footer>
        <div class="project-search-footer">
          <span class="project-count">{{ filteredProjects.length }} projects</span>
          <el-button @click="showProjectSearchDialog = false">Close</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  Plus,
  Folder,
  FolderOpened,
  ArrowRight,
  Menu,
  Search,
  Check,
  HomeFilled,
  SwitchButton,
  Document,
  ShoppingBag,
  Coin,
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useProjectStore } from '~/stores/project'
import { useAuthStore } from '~/stores/auth'
import { useMockCredits } from '~/composables/useMockCredits'

const router = useRouter()
const projectStore = useProjectStore()
const authStore = useAuthStore()
const mockCredits = useMockCredits()

// Auth
const user = computed(() => authStore.currentUser)
const userInitial = computed(() => authStore.userInitial)

const logout = async () => {
  await authStore.logout()
  router.push('/')
}

const goHome = () => {
  router.push('/dashboard')
  showUserMenu.value = false
}

// User menu
const showUserMenu = ref(false)

// Sidebar state
const isSidebarCollapsed = ref(false)
const isProjectsExpanded = ref(true)

const toggleSidebar = () => {
  isSidebarCollapsed.value = !isSidebarCollapsed.value
}

const toggleProjectsExpanded = () => {
  if (!isSidebarCollapsed.value) {
    isProjectsExpanded.value = !isProjectsExpanded.value
  }
}

// Projects from store
const currentProject = computed(() => projectStore.currentProject)
const recentProjects = computed(() => projectStore.activeProjects.slice(0, 5))

const selectProject = (project: any) => {
  projectStore.setCurrentProject(project)
  router.push(`/workspace/${project.id}`)
}

const openWorkspace = (projectId: string) => {
  router.push(`/workspace/${projectId}`)
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
    // Navigate to workspace with the new project
    projectStore.setCurrentProject(project)
    router.push(`/workspace/${project.id}`)
  } catch (err: any) {
    ElMessage.error(err.message || 'Failed to create project')
  }
}

// Project Search Dialog
const showProjectSearchDialog = ref(false)
const projectSearchQuery = ref('')

const filteredProjects = computed(() => {
  if (!projectSearchQuery.value.trim()) return projectStore.projects
  const query = projectSearchQuery.value.toLowerCase()
  return projectStore.projects.filter(p =>
    p.name.toLowerCase().includes(query) ||
    (p.description?.toLowerCase().includes(query) ?? false)
  )
})

const selectProjectFromSearch = (project: any) => {
  selectProject(project)
  showProjectSearchDialog.value = false
  projectSearchQuery.value = ''
}

const formatDate = (date: string | Date) => {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString()
}

// Close user dropdown on click outside
onMounted(() => {
  const handler = (e: MouseEvent) => {
    const target = e.target as HTMLElement
    if (!target.closest('.user-menu')) {
      showUserMenu.value = false
    }
  }
  document.addEventListener('click', handler)
})
</script>

<style scoped>
.app-layout {
  display: flex;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  background: #ffffff;
}

/* Left Sidebar */
.project-sidebar {
  width: 280px;
  flex-shrink: 0;
  background: #f9fafb;
  border-right: 1px solid #e5e7eb;
  display: flex;
  flex-direction: column;
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

.project-sidebar.collapsed {
  width: 0;
}

.sidebar-inner {
  width: 280px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* Sidebar Header */
.sidebar-header {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sidebar-header .logo-link {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
}

.sidebar-header .logo-icon {
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

.sidebar-header .logo-text {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
}

.new-project-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 8px 16px;
  background: #4f46e5;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.new-project-btn:hover {
  background: #4338ca;
}

/* Projects Section */
.projects-section {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  cursor: pointer;
  user-select: none;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #111827;
}

.expand-icon {
  font-size: 12px;
  color: #9ca3af;
  transition: transform 0.2s ease;
}

.expand-icon.expanded {
  transform: rotate(90deg);
}

.project-list {
  overflow-y: auto;
  padding: 0 12px;
}

.project-group {
  padding: 4px 12px;
}

.group-label {
  font-size: 11px;
  font-weight: 500;
  color: #9ca3af;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.project-item {
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
  margin-bottom: 2px;
}

.project-item:hover {
  background: #f3f4f6;
}

.project-item.active {
  background: #4f46e5;
}

.project-item.active .project-name {
  color: white;
}

.project-item.active .project-desc {
  color: rgba(255,255,255,0.7);
}

.project-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.workspace-btn {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.15s ease;
}

.project-item:hover .workspace-btn {
  color: #9ca3af;
}

.project-item:hover .workspace-btn:hover {
  background: #e5e7eb;
  color: #4f46e5;
}

.project-item.active .workspace-btn:hover {
  background: rgba(255,255,255,0.2);
  color: white;
}

.project-name {
  font-size: 13px;
  font-weight: 500;
  color: #374151;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.project-desc {
  font-size: 11px;
  color: #9ca3af;
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.empty-projects {
  padding: 16px;
  text-align: center;
}

.empty-text {
  font-size: 12px;
  color: #9ca3af;
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

.sidebar-toggle-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: white;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.15s ease;
}

.sidebar-toggle-btn:hover {
  background: #f3f4f6;
  color: #374151;
  border-color: #d1d5db;
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

.credits-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  background: #fefce8;
  border: 1px solid #fde68a;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #b45309;
  text-decoration: none;
  transition: all 0.15s ease;
}

.credits-badge:hover {
  background: #fef3c7;
}

.nav-link {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  color: #6b7280;
  text-decoration: none;
  transition: all 0.15s ease;
}

.nav-link:hover {
  background: #f3f4f6;
  color: #4f46e5;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: #4f46e5;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.action-btn:hover {
  background: #4338ca;
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

.user-dropdown {
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

/* Content Wrapper */
.content-wrapper {
  flex: 1;
  overflow: hidden;
  display: flex;
  position: relative;
}

/* View All Button */
.view-all-btn {
  width: 24px;
  height: 24px;
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

.view-all-btn:hover {
  background: #f3f4f6;
  color: #4f46e5;
}

/* Dialogs */
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
</style>

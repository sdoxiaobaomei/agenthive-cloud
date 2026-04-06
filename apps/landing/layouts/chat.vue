<template>
  <div class="chat-layout">
    <!-- Overlay when sidebar is open -->
    <div 
      v-if="!isSidebarCollapsed" 
      class="sidebar-overlay" 
      @click="toggleSidebar"
    ></div>

    <!-- Left Floating Sidebar - Projects Only -->
    <aside class="left-sidebar" :class="{ collapsed: isSidebarCollapsed }">
      <!-- Sidebar Header -->
      <div class="sidebar-header">
        <NuxtLink to="/" class="logo-link">
          <div class="logo-icon" style="background: #4267ff;">A</div>
          <span v-if="!isSidebarCollapsed" class="logo-text">AgentHive</span>
        </NuxtLink>
        <button 
          v-if="!isSidebarCollapsed"
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
            <span v-if="!isSidebarCollapsed">My Projects</span>
          </div>
          <el-icon v-if="!isSidebarCollapsed" class="expand-icon" :class="{ expanded: isProjectsExpanded }">
            <ArrowRight />
          </el-icon>
        </div>

        <div v-show="isProjectsExpanded || isSidebarCollapsed" class="project-list">
          <div class="project-group" v-if="!isSidebarCollapsed">
            <div class="group-label">Recents</div>
          </div>
          <div
            v-for="project in projects"
            :key="project.id"
            class="project-item"
            :class="{ active: currentProject?.id === project.id }"
            @click="selectProject(project)"
          >
            <div class="project-info">
              <div class="project-name">{{ project.name }}</div>
              <div v-if="!isSidebarCollapsed" class="project-desc">{{ project.description }}</div>
            </div>
          </div>
        </div>
      </div>
    </aside>

    <!-- Main Content Area -->
    <main class="main-content">
      <!-- Top Bar -->
      <header class="top-bar">
        <!-- Left: Toggle Sidebar + Logo -->
        <div class="flex items-center gap-3">
          <button class="sidebar-toggle-btn" @click="toggleSidebar" title="Toggle sidebar">
            <el-icon><Menu /></el-icon>
          </button>
          <NuxtLink to="/" class="logo-link">
            <div class="logo-icon" style="background: #4267ff;">A</div>
            <span class="logo-text">AgentHive</span>
          </NuxtLink>
        </div>
        
        <!-- Center: Project Name -->
        <div class="breadcrumb">
          <span v-if="currentProject">{{ currentProject.name }}</span>
          <span v-else>Select a project</span>
        </div>
        
        <!-- Right: Actions -->
        <div class="top-actions">
          <button class="action-btn" title="Deploy">
            <el-icon><Upload /></el-icon>
            <span>Publish</span>
          </button>
          <div class="user-menu">
            <img v-if="user?.avatar" :src="user.avatar" class="user-avatar" alt="user" />
            <div v-else class="user-avatar fallback" style="background: #4267ff; color: white;">{{ userInitial }}</div>
          </div>
        </div>
      </header>

      <!-- Page Content (with Chat sidebar + Center area) -->
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
        <el-button type="primary" @click="addProject">Create</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, provide } from 'vue'
import { 
  Plus,
  Folder,
  ArrowRight,
  Upload,
  Menu
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

// Projects
interface Project {
  id: string
  name: string
  description: string
  createdAt: Date
}

const projects = reactive<Project[]>([
  { 
    id: '1', 
    name: 'UI Framework Inquiry', 
    description: 'Research modern UI frameworks',
    createdAt: new Date(Date.now() - 86400000 * 2) 
  },
  { 
    id: '2', 
    name: 'Minimalist Habit Tracker', 
    description: 'Track daily habits with clean UI',
    createdAt: new Date(Date.now() - 86400000 * 5) 
  },
  { 
    id: '3', 
    name: 'E-commerce Dashboard', 
    description: 'Admin panel for online store',
    createdAt: new Date(Date.now() - 86400000 * 7) 
  }
])

const currentProject = ref<Project | null>(null)
const selectProject = (project: Project) => {
  currentProject.value = project
}

// Sidebar state - default collapsed
const isSidebarCollapsed = ref(true)
const isProjectsExpanded = ref(true)

const toggleSidebar = () => {
  isSidebarCollapsed.value = !isSidebarCollapsed.value
}

const toggleProjectsExpanded = () => {
  if (!isSidebarCollapsed.value) {
    isProjectsExpanded.value = !isProjectsExpanded.value
  }
}

// New project
const showNewProjectDialog = ref(false)
const newProject = reactive({ name: '', description: '' })

const addProject = () => {
  if (!newProject.name.trim()) {
    ElMessage.warning('Please enter a project name')
    return
  }
  const project: Project = {
    id: Date.now().toString(),
    name: newProject.name,
    description: newProject.description,
    createdAt: new Date()
  }
  projects.unshift(project)
  currentProject.value = project
  newProject.name = ''
  newProject.description = ''
  showNewProjectDialog.value = false
  ElMessage.success('Project created')
}

// Auth
const { user, userInitial } = useAuth()

// Provide
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

/* Overlay when sidebar is open */
.sidebar-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(2px);
  z-index: 40;
}

/* Left Sidebar - Floating overlay */
.left-sidebar {
  position: fixed;
  top: 64px; /* Below header */
  left: 0;
  width: 280px;
  height: calc(100vh - 64px);
  background: #f9fafb;
  border-right: 1px solid #e5e7eb;
  display: flex;
  flex-direction: column;
  z-index: 50;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.left-sidebar.collapsed {
  transform: translateX(-100%);
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

/* Main Content - Full width */
.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: #ffffff;
  width: 100%;
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
  display: flex;
  align-items: center;
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

/* Content Area */
.content-area {
  flex: 1;
  overflow: hidden;
  display: flex;
}

/* Dialog */
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
</style>

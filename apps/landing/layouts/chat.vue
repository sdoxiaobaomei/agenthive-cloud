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
          <div class="flex items-center gap-2">
            <!-- View All Button -->
            <button 
              v-if="!isSidebarCollapsed"
              class="view-all-btn"
              @click.stop="showProjectSearchDialog = true"
              title="View all projects"
            >
              <el-icon><Search /></el-icon>
            </button>
            <el-icon v-if="!isSidebarCollapsed" class="expand-icon" :class="{ expanded: isProjectsExpanded }">
              <ArrowRight />
            </el-icon>
          </div>
        </div>

        <div v-show="isProjectsExpanded || isSidebarCollapsed" class="project-list">
          <div class="project-group" v-if="!isSidebarCollapsed">
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

    <!-- Project Search Dialog -->
    <el-dialog
      v-model="showProjectSearchDialog"
      title="All Projects"
      width="600px"
      :close-on-click-modal="true"
      class="project-search-dialog"
    >
      <!-- Search Input -->
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

      <!-- Project List -->
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
            <div class="project-search-date">{{ new Date(project.createdAt).toLocaleDateString() }}</div>
          </div>
          <el-icon v-if="currentProject?.id === project.id" class="project-search-check"><Check /></el-icon>
        </div>
        
        <!-- Empty State -->
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
import { ref, reactive, provide, computed } from 'vue'
import { 
  Plus,
  Folder,
  ArrowRight,
  Upload,
  Menu,
  Search,
  Check
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

// Project Search Dialog
const showProjectSearchDialog = ref(false)
const projectSearchQuery = ref('')

// Recent projects (show only last 3)
const recentProjects = computed(() => projects.slice(0, 3))

// Filtered projects for search
const filteredProjects = computed(() => {
  if (!projectSearchQuery.value.trim()) return projects
  const query = projectSearchQuery.value.toLowerCase()
  return projects.filter(p => 
    p.name.toLowerCase().includes(query) || 
    p.description.toLowerCase().includes(query)
  )
})

const selectProjectFromSearch = (project: Project) => {
  selectProject(project)
  showProjectSearchDialog.value = false
  projectSearchQuery.value = ''
}

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

/* Left Sidebar - Floating overlay (full height) */
.left-sidebar {
  position: fixed;
  top: 0;
  left: 0;
  width: 280px;
  height: 100vh;
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

<template>
  <div class="project-dashboard-page">
    <!-- Loading -->
    <div v-if="projectStore.loading && !project" class="dashboard-loading">
      <el-skeleton :rows="12" animated />
    </div>

    <!-- 404 -->
    <el-empty
      v-else-if="!project"
      description="Project not found"
      :image-size="180"
    >
      <template #description>
        <div class="empty-desc">
          <p class="empty-title">Project not found</p>
          <p class="empty-subtitle">The project you are looking for does not exist</p>
        </div>
      </template>
      <el-button type="primary" @click="goToProjects">
        <el-icon><ArrowLeft /></el-icon>
        Back to Projects
      </el-button>
    </el-empty>

    <!-- Dashboard Content -->
    <div v-else class="dashboard-layout">
      <!-- Left Sidebar: Project Info -->
      <aside class="project-info-card">
        <div class="info-header">
          <div class="project-avatar" :style="{ backgroundColor: stringToColor(project.name) }">
            {{ project.name.charAt(0).toUpperCase() }}
          </div>
          <h1 class="project-name">{{ project.name }}</h1>
          <p v-if="project.description" class="project-desc">{{ project.description }}</p>
          <el-tag :type="statusTagType(project.status)" size="small" effect="light">
            {{ project.status }}
          </el-tag>
        </div>

        <div class="info-section">
          <h4>Details</h4>
          <div class="info-row">
            <span class="info-label">Type</span>
            <span class="info-value">{{ project.type || 'Blank' }}</span>
          </div>
          <div v-if="project.techStack" class="info-row">
            <span class="info-label">Tech Stack</span>
            <span class="info-value">{{ project.techStack }}</span>
          </div>
          <div v-if="project.gitUrl" class="info-row">
            <span class="info-label">Git URL</span>
            <span class="info-value code">{{ project.gitUrl }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Created</span>
            <span class="info-value">{{ formatDate(project.createdAt) }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Updated</span>
            <span class="info-value">{{ formatDate(project.updatedAt) }}</span>
          </div>
        </div>

        <div class="info-section">
          <h4>Members</h4>
          <div class="member-avatars">
            <div
              v-for="member in displayedMembers"
              :key="member.id"
              class="member-avatar"
              :title="`${member.name} (${member.role})`"
            >
              {{ member.name.charAt(0).toUpperCase() }}
            </div>
            <div v-if="members.length > 5" class="member-more">
              +{{ members.length - 5 }}
            </div>
          </div>
        </div>

        <div class="quick-actions">
          <el-button type="primary" class="action-btn" @click="openWorkspace">
            <el-icon><Monitor /></el-icon>
            Open Workspace
          </el-button>
          <el-button class="action-btn" @click="openChat">
            <el-icon><ChatDotRound /></el-icon>
            Open Chat
          </el-button>
          <el-button class="action-btn" @click="goToSettings">
            <el-icon><Setting /></el-icon>
            Settings
          </el-button>
        </div>
      </aside>

      <!-- Right Content: Tabs -->
      <main class="dashboard-content">
        <el-tabs v-model="activeTab" class="dashboard-tabs">
          <!-- Overview Tab -->
          <el-tab-pane label="Overview" name="overview">
            <div class="tab-panel">
              <!-- Recent Files -->
              <div class="panel-section">
                <div class="section-header">
                  <h3>Recent Files</h3>
                  <el-button text size="small" @click="openWorkspace">
                    View All
                  </el-button>
                </div>

                <div v-if="recentFiles.length > 0" class="file-list">
                  <div
                    v-for="file in recentFiles"
                    :key="file.path"
                    class="file-item"
                    @click="openFile(file.path)"
                  >
                    <FileIcon :filename="file.name" :is-folder="file.type === 'directory'" />
                    <span class="file-name">{{ file.name }}</span>
                    <span class="file-time">{{ formatRelativeTime(file.modifiedAt) }}</span>
                  </div>
                </div>

                <el-empty
                  v-else
                  description="No recent files"
                  :image-size="120"
                >
                  <template #description>
                    <p class="empty-subtitle">Workspace is empty, start coding</p>
                  </template>
                </el-empty>
              </div>

              <!-- Recent Tasks -->
              <div class="panel-section">
                <div class="section-header">
                  <h3>Recent Agent Tasks</h3>
                </div>
                <div class="task-list">
                  <div
                    v-for="task in recentTasks"
                    :key="task.id"
                    class="task-item"
                  >
                    <el-tag :type="taskStatusType(task.status)" size="small">
                      {{ task.status }}
                    </el-tag>
                    <span class="task-title">{{ task.title }}</span>
                    <span class="task-time">{{ formatRelativeTime(task.createdAt) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </el-tab-pane>

          <!-- Members Tab -->
          <el-tab-pane label="Members" name="members">
            <div class="tab-panel">
              <div class="panel-section">
                <div class="section-header">
                  <h3>Project Members</h3>
                  <span class="member-count">{{ members.length }} members</span>
                </div>

                <div class="member-list">
                  <div
                    v-for="member in members"
                    :key="member.id"
                    class="member-row"
                  >
                    <div class="member-avatar-large">{{ member.name.charAt(0).toUpperCase() }}</div>
                    <div class="member-info">
                      <span class="member-name">{{ member.name }}</span>
                      <span class="member-role">{{ member.role }}</span>
                    </div>
                    <span class="member-joined">{{ formatDate(member.joinedAt) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </el-tab-pane>

          <!-- Activity Tab -->
          <el-tab-pane label="Activity" name="activity">
            <div class="tab-panel">
              <div class="panel-section">
                <div class="section-header">
                  <h3>Activity Log</h3>
                </div>
                <el-timeline>
                  <el-timeline-item
                    v-for="activity in activityLog"
                    :key="activity.id"
                    :type="activity.type"
                    :timestamp="formatDate(activity.createdAt)"
                  >
                    <span class="activity-title">{{ activity.title }}</span>
                    <p class="activity-desc">{{ activity.description }}</p>
                  </el-timeline-item>
                </el-timeline>
              </div>
            </div>
          </el-tab-pane>
        </el-tabs>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ArrowLeft,
  Monitor,
  ChatDotRound,
  Setting,
} from '@element-plus/icons-vue'
import { useProjectStore, type ProjectMember } from '~/stores/project'
import { useWorkspaceStore } from '~/stores/workspace'
import FileIcon from '~/components/FileIcon.vue'

definePageMeta({
  layout: 'app',
})

const route = useRoute()
const router = useRouter()
const projectStore = useProjectStore()
const workspaceStore = useWorkspaceStore()

const projectId = computed(() => route.params.id as string)
const activeTab = ref('overview')
const members = ref<ProjectMember[]>([])
const recentFiles = ref<any[]>([])

const project = computed(() => projectStore.currentProject)

const displayedMembers = computed(() => members.value.slice(0, 5))

// ============ Mock Data ============
const recentTasks = ref([
  { id: 'task-1', title: 'Initialize project structure', status: 'completed', createdAt: '2026-04-25T10:00:00Z' },
  { id: 'task-2', title: 'Setup CI/CD pipeline', status: 'running', createdAt: '2026-04-26T14:00:00Z' },
  { id: 'task-3', title: 'Add authentication module', status: 'pending', createdAt: '2026-04-27T09:00:00Z' },
])

const activityLog = ref([
  { id: 'act-1', title: 'Project created', description: 'Project was initialized with Vue template', type: 'primary', createdAt: '2026-04-20T10:00:00Z' },
  { id: 'act-2', title: 'Member joined', description: 'Alice Chen joined as admin', type: 'success', createdAt: '2026-04-21T11:00:00Z' },
  { id: 'act-3', title: 'File updated', description: 'Modified src/App.vue', type: 'warning', createdAt: '2026-04-25T16:00:00Z' },
  { id: 'act-4', title: 'Task completed', description: 'Initialize project structure completed', type: 'success', createdAt: '2026-04-25T10:30:00Z' },
])

// ============ Navigation ============
const goToProjects = () => router.push('/projects')
const openWorkspace = () => router.push(`/workspace/${projectId.value}`)
const openChat = () => router.push('/chat')
const goToSettings = () => router.push(`/projects/${projectId.value}/settings`)
const openFile = (path: string) => {
  router.push(`/workspace/${projectId.value}`)
  // TODO: 打开特定文件（需要 workspace store 支持）
}

// ============ Helpers ============
const stringToColor = (str: string): string => {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  const colors = ['#4f46e5', '#06b6d4', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981']
  return colors[Math.abs(hash) % colors.length]
}

const statusTagType = (status: string): string => {
  switch (status) {
    case 'active': return 'success'
    case 'archived': return 'info'
    case 'deleted': return 'danger'
    default: return ''
  }
}

const taskStatusType = (status: string): string => {
  switch (status) {
    case 'completed': return 'success'
    case 'running': return 'primary'
    case 'failed': return 'danger'
    default: return 'info'
  }
}

const formatDate = (dateStr: string): string => {
  const d = new Date(dateStr)
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

const formatRelativeTime = (dateStr: string): string => {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHour < 24) return `${diffHour}h ago`
  if (diffDay < 30) return `${diffDay}d ago`
  return formatDate(dateStr)
}

// ============ Lifecycle ============
onMounted(async () => {
  try {
    await projectStore.selectProject(projectId.value)
  } catch {
    // 404 handled by template
    return
  }

  // 加载成员
  try {
    members.value = await projectStore.fetchMembers(projectId.value)
  } catch (err: any) {
    if (import.meta.dev) console.debug('[Dashboard] Failed to fetch members:', err.message)
  }

  // 加载最近文件
  try {
    const files = await workspaceStore.fetchFiles(projectId.value, '')
    // 取最近修改的 5 个文件（扁平化处理）
    const allFiles: any[] = []
    const collect = (nodes: any[]) => {
      for (const node of nodes) {
        if (node.type === 'file') {
          allFiles.push(node)
        }
        if (node.children) collect(node.children)
      }
    }
    collect(files)
    recentFiles.value = allFiles
      .sort((a, b) => new Date(b.modifiedAt || 0).getTime() - new Date(a.modifiedAt || 0).getTime())
      .slice(0, 5)
  } catch (err: any) {
    if (import.meta.dev) console.debug('[Dashboard] Failed to fetch files:', err.message)
  }
})
</script>

<style scoped>
.project-dashboard-page {
  padding: 24px 32px;
  max-width: 1400px;
  margin: 0 auto;
  min-height: 100%;
}

/* ============ Loading ============ */
.dashboard-loading {
  padding: 40px;
}

/* ============ Layout ============ */
.dashboard-layout {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 24px;
}

/* ============ Project Info Card ============ */
.project-info-card {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 24px;
  height: fit-content;
  position: sticky;
  top: 24px;
}

.info-header {
  text-align: center;
  margin-bottom: 20px;
  padding-bottom: 20px;
  border-bottom: 1px solid #f3f4f6;
}

.project-avatar {
  width: 64px;
  height: 64px;
  border-radius: 16px;
  color: white;
  font-size: 28px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 12px;
}

.project-name {
  font-size: 18px;
  font-weight: 600;
  color: #111827;
  margin: 0 0 6px;
  word-break: break-word;
}

.project-desc {
  font-size: 13px;
  color: #6b7280;
  margin: 0 0 10px;
  line-height: 1.5;
}

.info-section {
  margin-bottom: 20px;
}

.info-section h4 {
  font-size: 12px;
  font-weight: 600;
  color: #9ca3af;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 0 0 10px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  font-size: 13px;
}

.info-label {
  color: #6b7280;
}

.info-value {
  color: #374151;
  font-weight: 500;
  max-width: 60%;
  text-align: right;
  word-break: break-word;
}

.info-value.code {
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 11px;
  color: #4f46e5;
  background: #f3f4f6;
  padding: 2px 6px;
  border-radius: 4px;
}

/* Members */
.member-avatars {
  display: flex;
  align-items: center;
}

.member-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #4f46e5;
  color: white;
  font-size: 12px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid white;
  margin-left: -8px;
}

.member-avatar:first-child {
  margin-left: 0;
}

.member-more {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #f3f4f6;
  color: #6b7280;
  font-size: 11px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid white;
  margin-left: -8px;
}

/* Quick Actions */
.quick-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.action-btn {
  width: 100%;
  justify-content: flex-start;
}

/* ============ Dashboard Content ============ */
.dashboard-content {
  min-width: 0;
}

.dashboard-tabs :deep(.el-tabs__header) {
  margin-bottom: 16px;
}

.tab-panel {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.panel-section {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 20px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.section-header h3 {
  font-size: 15px;
  font-weight: 600;
  color: #111827;
  margin: 0;
}

.member-count {
  font-size: 13px;
  color: #9ca3af;
}

/* File List */
.file-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.file-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s ease;
}

.file-item:hover {
  background: #f9fafb;
}

.file-name {
  flex: 1;
  font-size: 13px;
  color: #374151;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-time {
  font-size: 12px;
  color: #9ca3af;
}

/* Task List */
.task-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.task-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  background: #f9fafb;
}

.task-title {
  flex: 1;
  font-size: 13px;
  color: #374151;
}

.task-time {
  font-size: 12px;
  color: #9ca3af;
}

/* Member List */
.member-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.member-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  transition: background 0.15s ease;
}

.member-row:hover {
  background: #f9fafb;
}

.member-avatar-large {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #4f46e5;
  color: white;
  font-size: 14px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.member-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.member-name {
  font-size: 14px;
  font-weight: 500;
  color: #374151;
}

.member-role {
  font-size: 12px;
  color: #9ca3af;
  text-transform: capitalize;
}

.member-joined {
  font-size: 12px;
  color: #9ca3af;
}

/* Activity */
.activity-title {
  font-size: 14px;
  font-weight: 500;
  color: #374151;
}

.activity-desc {
  font-size: 12px;
  color: #9ca3af;
  margin: 4px 0 0;
}

/* Empty */
.empty-subtitle {
  font-size: 13px;
  color: #9ca3af;
  margin: 0;
}

/* Responsive */
@media (max-width: 1024px) {
  .dashboard-layout {
    grid-template-columns: 1fr;
  }

  .project-info-card {
    position: static;
  }
}

@media (max-width: 768px) {
  .project-dashboard-page {
    padding: 16px;
  }
}
</style>

<template>
  <div class="projects-page">
    <!-- Page Header -->
    <div class="page-header">
      <h1 class="page-title">Projects</h1>
      <div class="header-actions">
        <el-button type="primary" @click="goToCreate">
          <el-icon><Plus /></el-icon>
          <span>New Project</span>
        </el-button>
      </div>
    </div>

    <!-- Toolbar -->
    <div class="toolbar">
      <el-input
        v-model="searchQuery"
        placeholder="Search projects by name or description..."
        clearable
        class="search-input"
        size="large"
      >
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
      </el-input>

      <el-tabs
        v-model="projectStore.statusFilter"
        class="status-tabs"
        @tab-change="onStatusChange"
      >
        <el-tab-pane label="All" name="all" />
        <el-tab-pane label="Active" name="active" />
        <el-tab-pane label="Archived" name="archived" />
      </el-tabs>
    </div>

    <!-- Content Area -->
    <div class="content-area">
      <!-- Loading -->
      <div v-if="projectStore.loading" class="loading-wrapper">
        <div class="card-grid">
          <el-skeleton
            v-for="i in 6"
            :key="i"
            animated
            class="skeleton-card"
          >
            <template #template>
              <el-skeleton-item variant="image" style="width: 100%; height: 120px" />
              <div style="padding: 14px">
                <el-skeleton-item variant="h3" style="width: 50%" />
                <el-skeleton-item variant="text" style="margin-top: 12px" />
                <el-skeleton-item variant="text" style="width: 30%; margin-top: 8px" />
              </div>
            </template>
          </el-skeleton>
        </div>
      </div>

      <!-- Empty State -->
      <el-empty
        v-else-if="filteredProjects.length === 0"
        :image-size="180"
        class="projects-empty"
      >
        <template #description>
          <div class="empty-description">
            <p class="empty-title">
              {{ searchQuery ? 'No matching projects' : 'No projects yet' }}
            </p>
            <p class="empty-subtitle">
              {{ searchQuery
                ? 'Try adjusting your search or filters'
                : 'Create your first project to get started with AgentHive'
              }}
            </p>
          </div>
        </template>
        <el-button v-if="!searchQuery" type="primary" @click="goToCreate">
          <el-icon><Plus /></el-icon>
          Create First Project
        </el-button>
        <el-button v-else text @click="clearSearch">
          Clear Search
        </el-button>
      </el-empty>

      <!-- Card View -->
      <div v-else class="card-grid">
        <div
          v-for="project in paginatedProjects"
          :key="project.id"
          class="project-card"
          @click="goToProject(project.id)"
        >
          <div class="card-header">
            <div
              class="project-avatar"
              :style="{ backgroundColor: stringToColor(project.name) }"
            >
              {{ project.name.charAt(0).toUpperCase() }}
            </div>
            <el-tag
              :type="statusTagType(project.status)"
              size="small"
              effect="light"
            >
              {{ project.status }}
            </el-tag>
          </div>

          <h3 class="project-name" :title="project.name">{{ project.name }}</h3>
          <p class="project-desc">
            {{ project.description || 'No description' }}
          </p>

          <div class="card-footer">
            <span class="meta-item" title="Last updated">
              <el-icon><Clock /></el-icon>
              <span>{{ formatRelativeTime(project.updatedAt) }}</span>
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Pagination -->
    <div v-if="filteredProjects.length > 0" class="pagination-wrapper">
      <el-pagination
        v-model:current-page="projectStore.currentPage"
        v-model:page-size="projectStore.itemsPerPage"
        :page-sizes="[12, 24, 48]"
        :total="filteredTotal"
        layout="total, sizes, prev, pager, next, jumper"
        background
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  Plus,
  Search,
  Clock,
} from '@element-plus/icons-vue'
import { useProjectStore, type Project } from '~/stores/project'
import { useChatStore } from '~/stores/chat'

definePageMeta({
  layout: 'app',
})

const router = useRouter()
const projectStore = useProjectStore()

// ============ 搜索状态 ============
const searchQuery = ref('')

const clearSearch = () => {
  searchQuery.value = ''
}

// ============ 过滤与分页（前端计算） ============
/** 经状态过滤+搜索过滤后的项目列表 */
const filteredProjects = computed(() => {
  let result = projectStore.projects

  // 状态过滤
  if (projectStore.statusFilter !== 'all') {
    result = result.filter(p => p.status === projectStore.statusFilter)
  }

  // 搜索过滤（按名称和描述）
  const query = searchQuery.value.trim().toLowerCase()
  if (query) {
    result = result.filter(p =>
      p.name.toLowerCase().includes(query) ||
      (p.description?.toLowerCase().includes(query) ?? false)
    )
  }

  return result
})

/** 过滤后的总数 */
const filteredTotal = computed(() => filteredProjects.value.length)

/** 分页后的项目列表 */
const paginatedProjects = computed(() => {
  const start = (projectStore.currentPage - 1) * projectStore.itemsPerPage
  return filteredProjects.value.slice(start, start + projectStore.itemsPerPage)
})

// ============ 过滤事件 ============
const onStatusChange = () => {
  // tab-change 时 store 已同步，页码已在 store action 中重置
}

// ============ 导航 ============
const goToProject = async (projectId: string) => {
  const chatStore = useChatStore()
  await chatStore.loadConversations(projectId)
  if (chatStore.conversations.length > 0) {
    router.push('/chat/' + chatStore.conversations[0].id)
  } else {
    const conv = await chatStore.createConversation('New Chat', projectId)
    router.push('/chat/' + conv.id)
  }
}

const goToCreate = () => {
  router.push('/')
}

// ============ 工具函数 ============
/** 将字符串映射为固定颜色 */
const stringToColor = (str: string): string => {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  const colors = [
    '#4f46e5', '#06b6d4', '#8b5cf6', '#ec4899',
    '#f59e0b', '#10b981', '#ef4444', '#6366f1',
    '#14b8a6', '#f97316',
  ]
  return colors[Math.abs(hash) % colors.length]
}

/** 状态标签类型 */
const statusTagType = (status: string): string => {
  switch (status) {
    case 'active': return 'success'
    case 'archived': return 'info'
    case 'deleted': return 'danger'
    default: return ''
  }
}

/** 相对时间格式化 */
const formatRelativeTime = (dateStr: string): string => {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffSec < 60) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHour < 24) return `${diffHour}h ago`
  if (diffDay < 30) return `${diffDay}d ago`
  if (diffDay < 365) return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

// ============ 生命周期 ============
onMounted(async () => {
  try {
    await projectStore.fetchProjects()
  } catch (err: any) {
    if (import.meta.dev) {
      console.debug('[ProjectsPage] Failed to fetch projects:', err.message)
    }
  }
})
</script>

<style scoped>
.projects-page {
  padding: 24px 32px;
  max-width: 1400px;
  margin: 0 auto;
  min-height: 100%;
  display: flex;
  flex-direction: column;
}

/* ============ Page Header ============ */
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.page-title {
  font-size: 24px;
  font-weight: 600;
  color: #111827;
  margin: 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* ============ Toolbar ============ */
.toolbar {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.search-input {
  width: 320px;
}

.status-tabs :deep(.el-tabs__header) {
  margin: 0;
}

.status-tabs :deep(.el-tabs__nav-wrap::after) {
  display: none;
}

.status-tabs :deep(.el-tabs__item) {
  font-size: 14px;
  font-weight: 500;
  color: #6b7280;
}

.status-tabs :deep(.el-tabs__item.is-active) {
  color: #4f46e5;
}

.status-tabs :deep(.el-tabs__active-bar) {
  background-color: #4f46e5;
}

/* ============ Content Area ============ */
.content-area {
  flex: 1;
  min-height: 0;
}

.loading-wrapper {
  padding: 8px 0;
}

/* ============ Card Grid ============ */
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.skeleton-card {
  border-radius: 12px;
  overflow: hidden;
}

.project-card {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 20px;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.project-card:hover {
  border-color: #bfdbfe;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  transform: translateY(-2px);
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.project-avatar {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  color: white;
  font-size: 18px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.project-name {
  font-size: 15px;
  font-weight: 600;
  color: #111827;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.project-desc {
  font-size: 13px;
  color: #6b7280;
  margin: 0;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: 40px;
}

.card-footer {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: auto;
  padding-top: 8px;
  border-top: 1px solid #f3f4f6;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #9ca3af;
}

.meta-item .el-icon {
  font-size: 14px;
}

/* ============ Empty State ============ */
.projects-empty :deep(.el-empty__description) {
  margin-top: 16px;
}

.empty-description {
  text-align: center;
}

.empty-title {
  font-size: 16px;
  font-weight: 600;
  color: #374151;
  margin: 0 0 4px;
}

.empty-subtitle {
  font-size: 13px;
  color: #9ca3af;
  margin: 0;
}

/* ============ Pagination ============ */
.pagination-wrapper {
  display: flex;
  justify-content: flex-end;
  padding-top: 20px;
  border-top: 1px solid #f3f4f6;
  margin-top: 16px;
}

/* ============ Responsive ============ */
@media (min-width: 1280px) {
  .card-grid {
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  }
}

@media (max-width: 768px) {
  .projects-page {
    padding: 16px;
  }

  .page-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .toolbar {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }

  .search-input {
    width: 100%;
  }

  .card-grid {
    grid-template-columns: 1fr;
  }
}
</style>

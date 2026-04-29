<template>
  <div class="dashboard-page" style="background: var(--ah-bg-page);">
    <div class="dashboard-header">
      <h1>我的工作台</h1>
      <p class="dashboard-subtitle">选择项目继续，或创建新项目</p>
    </div>
    <!-- Authenticated Dashboard Extension -->
    <section class="dashboard-section">
      <div class="container">
        <h2 class="section-title">我的工作台</h2>

        <!-- Recent Projects -->
        <div v-if="recentProjects.length > 0" class="recent-projects-block">
          <h3 class="block-title">最近项目</h3>
          <div class="project-grid">
            <div
              v-for="project in recentProjects"
              :key="project.id"
              class="project-card"
              @click="router.push(`/workspace/${project.id}`)"
            >
              <div class="project-icon-lg">{{ project.name.charAt(0) }}</div>
              <div class="project-name-lg">{{ project.name }}</div>
              <div class="project-desc-lg">{{ project.description }}</div>
            </div>
          </div>
        </div>

        <!-- Quick Actions -->
        <div class="quick-actions">
          <h3 class="block-title">快速开始</h3>
          <div class="action-buttons">
            <button class="action-btn primary" @click="router.push('/projects')">
              <el-icon><FolderOpened /></el-icon>
              <span>我的项目</span>
            </button>
            <button class="action-btn" @click="showProjectDialog = true">
              <el-icon><Plus /></el-icon>
              <span>新建项目</span>
            </button>
            <button class="action-btn" @click="router.push('/marketplace')">
              <el-icon><ShoppingBag /></el-icon>
              <span>应用市场</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { FolderOpened, Plus, ShoppingBag } from '@element-plus/icons-vue'
import { useAuthStore } from '~/stores/auth'
import { useProjectStore, type Project } from '~/stores/project'

const router = useRouter()
const authStore = useAuthStore()
const projectStore = useProjectStore()

const showProjectDialog = ref(false)
const showCreateProjectDialog = ref(false)
const newProject = ref({ name: '', description: '' })
const creating = ref(false)
const projectSearchQuery = ref('')

const projects = computed(() => projectStore.projects)
const currentProject = computed(() => projectStore.currentProject)
const recentProjects = computed(() => {
  return projectStore.activeProjects.slice(0, 6)
})

const filteredProjects = computed(() => {
  if (!projectSearchQuery.value) return projects.value
  const query = projectSearchQuery.value.toLowerCase()
  return projects.value.filter((p: Project) =>
    p.name.toLowerCase().includes(query) ||
    (p.description || '').toLowerCase().includes(query)
  )
})

onMounted(async () => {
  if (authStore.isAuthenticated) {
    await projectStore.fetchProjects()
  }
})

const selectProject = (project: Project) => {
  projectStore.setCurrentProject(project)
  showProjectDialog.value = false
  router.push(`/workspace/${project.id}`)
}

const openCreateDialog = () => {
  showProjectDialog.value = false
  showCreateProjectDialog.value = true
}

const confirmCreateProject = async () => {
  if (!newProject.value.name.trim()) return
  creating.value = true
  try {
    const project = await projectStore.createProject({
      name: newProject.value.name.trim(),
      description: newProject.value.description.trim(),
    })
    showCreateProjectDialog.value = false
    newProject.value = { name: '', description: '' }
    projectStore.setCurrentProject(project)
    ElMessage.success('项目创建成功')
    router.push(`/workspace/${project.id}`)
  } catch (err: any) {
    ElMessage.error(err.message || '创建项目失败')
  } finally {
    creating.value = false
  }
}
</script>

<style scoped>
.project-search {
  margin-bottom: 16px;
}

.project-loading {
  padding: 20px 0;
}

.project-list {
  max-height: 400px;
  overflow-y: auto;
}

.project-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.project-item:hover {
  background: #f5f7fa;
}

.project-item.active {
  background: #ecf5ff;
}

.project-icon {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: #4267ff;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 600;
}

.project-info {
  flex: 1;
}

.project-name {
  font-weight: 500;
  color: #303133;
  margin-bottom: 4px;
}

.project-desc {
  font-size: 12px;
  color: #909399;
}

.empty-projects {
  padding: 40px 0;
}

/* Prompt Section for Authenticated Users */
.prompt-section {
  min-height: calc(100vh - 64px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  background: linear-gradient(180deg, #f8fafc 0%, #ffffff 100%);
}

.prompt-container {
  max-width: 720px;
  width: 100%;
  text-align: center;
}

.prompt-title {
  font-size: 36px;
  font-weight: 700;
  color: #111827;
  margin: 0 0 12px;
  letter-spacing: -0.5px;
}

.prompt-subtitle {
  font-size: 16px;
  color: #6b7280;
  margin: 0 0 32px;
}

.prompt-input-wrapper {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.06);
  text-align: left;
}

.prompt-textarea :deep(.el-textarea__inner) {
  border: none;
  background: transparent;
  font-size: 15px;
  resize: none;
  box-shadow: none !important;
  padding: 0;
}

.prompt-actions {
  display: flex;
  gap: 12px;
  margin-top: 16px;
  justify-content: flex-end;
}

.prompt-btn {
  background: #4267ff !important;
  border-color: #4267ff !important;
}

.history-btn {
  color: #374151;
}

.recent-projects {
  margin-top: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  flex-wrap: wrap;
}

.recent-label {
  font-size: 13px;
  color: #9ca3af;
}

.recent-list {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.recent-tag {
  font-size: 13px;
  color: #4267ff;
  background: rgba(66, 103, 255, 0.08);
  padding: 4px 12px;
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.2s;
}

.recent-tag:hover {
  background: rgba(66, 103, 255, 0.15);
}

/* Dashboard Section Styles */
.dashboard-section {
  padding: 80px 20px;
  background: var(--ah-beige-50);
  border-top: 1px solid var(--ah-beige-200);
}

.dashboard-section .container {
  max-width: 1200px;
  margin: 0 auto;
}

.dashboard-section .section-title {
  font-size: 32px;
  font-weight: 700;
  color: var(--ah-text-primary);
  margin: 0 0 40px;
  text-align: center;
}

.dashboard-section .block-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--ah-text-primary);
  margin: 0 0 20px;
}

.recent-projects-block {
  margin-bottom: 48px;
}

.project-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 20px;
}

.project-card {
  background: #ffffff;
  border: 1px solid var(--ah-beige-200);
  border-radius: 16px;
  padding: 24px;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: var(--shadow-sm);
}

.project-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
  border-color: var(--ah-primary-light);
}

.project-icon-lg {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: var(--ah-primary);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 16px;
}

.project-name-lg {
  font-weight: 600;
  font-size: 16px;
  color: var(--ah-text-primary);
  margin-bottom: 8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.project-desc-lg {
  font-size: 13px;
  color: var(--ah-grey-500);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.quick-actions {
  text-align: center;
}

.action-buttons {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 16px;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 14px 28px;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 500;
  border: 1px solid var(--ah-beige-300);
  background: #ffffff;
  color: var(--ah-text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: var(--shadow-sm);
}

.action-btn:hover {
  border-color: var(--ah-primary);
  color: var(--ah-primary);
  box-shadow: var(--shadow-md);
}

.action-btn.primary {
  background: var(--ah-primary);
  border-color: var(--ah-primary);
  color: #ffffff;
}

.action-btn.primary:hover {
  background: var(--ah-primary-dark);
  border-color: var(--ah-primary-dark);
}

@media (max-width: 640px) {
  .prompt-title {
    font-size: 28px;
  }
  .prompt-actions {
    flex-direction: column;
  }
  .prompt-actions .el-button {
    width: 100%;
  }

  .dashboard-section {
    padding: 48px 16px;
  }

  .dashboard-section .section-title {
    font-size: 24px;
    margin-bottom: 28px;
  }

  .project-grid {
    grid-template-columns: 1fr;
  }

  .action-buttons {
    flex-direction: column;
    align-items: stretch;
  }

  .action-btn {
    justify-content: center;
  }
}
</style>

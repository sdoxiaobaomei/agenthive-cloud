<template>
  <div class="landing-page" style="background: var(--ah-bg-page);">
    <!-- Header with sidebar toggle -->
    <AppHeader mode="landing" @toggle-sidebar="showProjectDialog = true" />
    
    <!-- Hero -->
    <OrganismsHeroSection />

    <!-- Feature Highlights -->
    <FeaturesSection />

    <!-- Workflow -->
    <WorkflowSection />

    <!-- CTA -->
    <CTASection />
    
    <!-- Project Selection Dialog -->
    <ClientRender>
      <el-dialog
        v-model="showProjectDialog"
        title="我的项目"
        width="600px"
        :close-on-click-modal="true"
      >
        <div class="project-search">
          <el-input
            v-model="projectSearchQuery"
            placeholder="搜索项目..."
            prefix-icon="Search"
            clearable
          />
        </div>
        <div v-if="projectStore.loading" class="project-loading">
          <el-skeleton :rows="3" animated />
        </div>
        <div v-else class="project-list">
          <div
            v-for="project in filteredProjects"
            :key="project.id"
            class="project-item"
            :class="{ active: currentProject?.id === project.id }"
            @click="selectProject(project)"
          >
            <div class="project-icon">{{ project.name.charAt(0) }}</div>
            <div class="project-info">
              <div class="project-name">{{ project.name }}</div>
              <div class="project-desc">{{ project.description }}</div>
            </div>
          </div>
          <div v-if="!filteredProjects?.length" class="empty-projects">
            <el-empty description="暂无项目" />
          </div>
        </div>
        <template #footer>
          <el-button type="primary" @click="openCreateDialog">
            <el-icon><Plus /></el-icon>
            <span>新建项目</span>
          </el-button>
        </template>
      </el-dialog>
    </ClientRender>

    <!-- Create Project Dialog -->
    <ClientRender>
      <el-dialog
        v-model="showCreateProjectDialog"
        title="新建项目"
        width="500px"
        :close-on-click-modal="true"
      >
        <el-form label-position="top">
          <el-form-item label="项目名称">
            <el-input
              v-model="newProject.name"
              placeholder="给项目起个名字"
              maxlength="50"
              show-word-limit
            />
          </el-form-item>
          <el-form-item label="项目描述">
            <el-input
              v-model="newProject.description"
              type="textarea"
              :rows="3"
              placeholder="简单描述这个项目的目标..."
              maxlength="200"
              show-word-limit
            />
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="showCreateProjectDialog = false">取消</el-button>
          <el-button
            type="primary"
            :loading="creating"
            :disabled="!newProject.name.trim()"
            @click="confirmCreateProject"
          >
            创建并进入
          </el-button>
        </template>
      </el-dialog>
    </ClientRender>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { MagicStick, FolderOpened, Plus } from '@element-plus/icons-vue'
import { useAuthStore } from '~/stores/auth'
import { useProjectStore, type Project } from '~/stores/project'

const router = useRouter()
const authStore = useAuthStore()
const projectStore = useProjectStore()

const showProjectDialog = ref(false)
const showCreateProjectDialog = ref(false)
const projectSearchQuery = ref('')
const projectPrompt = ref('')
const creating = ref(false)

const newProject = ref({
  name: '',
  description: '',
})

// 使用 projectStore 中的项目和当前项目
const projects = computed(() => projectStore.projects)
const currentProject = computed(() => projectStore.currentProject)

const filteredProjects = computed(() => {
  if (!projectSearchQuery.value) return projects.value
  const query = projectSearchQuery.value.toLowerCase()
  return projects.value.filter(p => 
    p.name.toLowerCase().includes(query) || 
    (p.description?.toLowerCase().includes(query) ?? false)
  )
})

// 最近访问的项目（取前 3 个活跃项目）
const recentProjects = computed(() => {
  return projectStore.activeProjects.slice(0, 3)
})

// 在组件挂载时加载项目列表
onMounted(async () => {
  if (!authStore.isAuthenticated) return
  try {
    await projectStore.fetchProjects()
  } catch (error: any) {
    if (import.meta.dev) {
      console.debug('[Projects] Failed to fetch projects (may need login):', error.message)
    }
  }
})

const selectProject = (project: Project) => {
  projectStore.setCurrentProject(project)
  sessionStorage.setItem('pending-project', JSON.stringify(project))
  showProjectDialog.value = false
  router.push(`/workspace/${project.id}`)
}

// 从需求描述创建项目
const handlePromptSubmit = async () => {
  const prompt = projectPrompt.value.trim()
  if (!prompt) return

  // 自动生成项目名（取前 20 字）
  const autoName = prompt.slice(0, 20) + (prompt.length > 20 ? '...' : '')

  creating.value = true
  try {
    const project = await projectStore.createProject({
      name: autoName,
      description: prompt,
    })
    projectPrompt.value = ''
    projectStore.setCurrentProject(project)
    sessionStorage.setItem('pending-project', JSON.stringify(project))
    ElMessage.success('项目创建成功，进入工作区')
    router.push(`/workspace/${project.id}`)
  } catch (error: any) {
    ElMessage.error(error.message || '创建项目失败')
  } finally {
    creating.value = false
  }
}

// 打开手动创建项目对话框
const openCreateDialog = () => {
  showProjectDialog.value = false
  newProject.value = { name: '', description: '' }
  showCreateProjectDialog.value = true
}

// 手动确认创建项目
const confirmCreateProject = async () => {
  if (!newProject.value.name.trim()) return
  creating.value = true
  try {
    const project = await projectStore.createProject({
      name: newProject.value.name.trim(),
      description: newProject.value.description.trim(),
    })
    showCreateProjectDialog.value = false
    projectStore.setCurrentProject(project)
    sessionStorage.setItem('pending-project', JSON.stringify(project))
    ElMessage.success('项目创建成功')
    router.push(`/workspace/${project.id}`)
  } catch (error: any) {
    ElMessage.error(error.message || '创建项目失败')
  } finally {
    creating.value = false
  }
}

useSeoMeta({
  title: 'AgentHive Cloud - AI驱动的智能开发团队管理平台',
  description: 'AgentHive Cloud 帮助您管理和协调多个 AI Agent，像管理真实团队一样管理 AI 开发者，实现自动化软件开发。',
  ogTitle: 'AgentHive Cloud - AI驱动的智能开发团队管理平台',
  ogDescription: '管理和协调多个AI Agent，实现自动化软件开发',
  ogImage: '/og-image.png',
  twitterCard: 'summary_large_image',
})
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
}
</style>

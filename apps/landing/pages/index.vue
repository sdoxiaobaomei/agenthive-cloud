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
          <div v-if="filteredProjects.length === 0" class="empty-projects">
            <el-empty description="暂无项目" />
          </div>
        </div>
      </el-dialog>
    </ClientRender>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useProjectStore, type Project } from '~/stores/project'

const router = useRouter()
const projectStore = useProjectStore()

const showProjectDialog = ref(false)
const projectSearchQuery = ref('')

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

// 在组件挂载时加载项目列表
onMounted(async () => {
  try {
    await projectStore.fetchProjects()
  } catch (error: any) {
    // 静默处理错误，因为用户可能未登录
    // 使用 debug 级别只在开发环境显示
    if (import.meta.dev) {
      console.debug('[Projects] Failed to fetch projects (may need login):', error.message)
    }
  }
})

const selectProject = (project: Project) => {
  projectStore.setCurrentProject(project)
  // 存储到 sessionStorage
  sessionStorage.setItem('pending-project', JSON.stringify(project))
  showProjectDialog.value = false
  router.push('/chat')
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
</style>

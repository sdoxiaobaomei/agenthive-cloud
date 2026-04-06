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
        <div class="project-list">
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

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const showProjectDialog = ref(false)
const projectSearchQuery = ref('')
const currentProject = ref(null)

// Demo projects - in production this would come from an API
const projects = ref([
  { id: '1', name: '任务管理系统', description: '支持拖拽排序和团队协作的任务管理应用', createdAt: '2026-04-01' },
  { id: '2', name: '个人博客', description: '基于 Markdown 的简洁博客系统', createdAt: '2026-04-02' },
  { id: '3', name: '电商数据看板', description: '销售趋势和库存预警分析面板', createdAt: '2026-04-03' },
])

const filteredProjects = computed(() => {
  if (!projectSearchQuery.value) return projects.value
  const query = projectSearchQuery.value.toLowerCase()
  return projects.value.filter(p => 
    p.name.toLowerCase().includes(query) || 
    p.description.toLowerCase().includes(query)
  )
})

const selectProject = (project) => {
  currentProject.value = project
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

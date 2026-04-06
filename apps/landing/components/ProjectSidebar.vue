<template>
  <aside class="project-sidebar" :class="{ collapsed: isCollapsed }">
    <!-- Header -->
    <div class="sidebar-header">
      <span v-if="!isCollapsed" class="header-title">项目</span>
      <button class="add-btn" @click="showAddDialog = true" :title="isCollapsed ? '新建项目' : ''">
        <el-icon><Plus /></el-icon>
      </button>
    </div>
    
    <!-- Project List -->
    <div class="project-list">
      <div
        v-for="project in projects"
        :key="project.id"
        class="project-item"
        :class="{ active: currentProject?.id === project.id }"
        @click="selectProject(project)"
        :title="isCollapsed ? project.name : ''"
      >
        <div class="project-avatar">
          <img :src="getProjectAvatar(project)" :alt="project.name" />
        </div>
        <template v-if="!isCollapsed">
          <div class="project-info">
            <div class="project-name">{{ project.name }}</div>
            <div class="project-meta">{{ formatDate(project.createdAt) }}</div>
          </div>
        </template>
      </div>
    </div>
    
    <!-- Add Project Dialog -->
    <el-dialog
      v-model="showAddDialog"
      title="新建项目"
      width="400px"
      :close-on-click-modal="false"
      class="project-dialog"
    >
      <el-form :model="newProject" label-position="top" class="project-form">
        <el-form-item label="项目名称">
          <el-input 
            v-model="newProject.name" 
            placeholder="输入项目名称"
            size="large"
          />
        </el-form-item>
        <el-form-item label="项目描述">
          <el-input
            v-model="newProject.description"
            type="textarea"
            :rows="3"
            placeholder="输入项目描述（可选）"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddDialog = false">取消</el-button>
        <el-button type="primary" @click="addProject" class="create-btn">创建</el-button>
      </template>
    </el-dialog>
  </aside>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { Plus } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

interface Project {
  id: string
  name: string
  description: string
  avatar?: string
  createdAt: Date
}

const props = defineProps<{
  modelValue?: Project | null
  collapsed?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [project: Project | null]
  'update:collapsed': [collapsed: boolean]
}>()

const showAddDialog = ref(false)

// 项目列表使用柴犬头像
const projects = ref<Project[]>([
  {
    id: '1',
    name: '个人博客',
    description: '基于 Vue3 的个人博客系统',
    avatar: '/avatars/shiba_tl.png',
    createdAt: new Date(Date.now() - 86400000 * 2)
  },
  {
    id: '2',
    name: '电商后台',
    description: '管理商品、订单、用户',
    avatar: '/avatars/shiba_fe.png',
    createdAt: new Date(Date.now() - 86400000 * 5)
  },
  {
    id: '3',
    name: '数据分析平台',
    description: '数据可视化和报表系统',
    avatar: '/avatars/shiba_qa.png',
    createdAt: new Date(Date.now() - 86400000 * 7)
  }
])

const currentProject = computed({
  get: () => props.modelValue ?? null,
  set: (val: Project | null) => emit('update:modelValue', val)
})

const isCollapsed = computed({
  get: () => props.collapsed ?? false,
  set: (val) => emit('update:collapsed', val)
})

const newProject = reactive({
  name: '',
  description: ''
})

const getProjectAvatar = (project: Project) => {
  return project.avatar || '/avatars/shiba_tl.png'
}

const selectProject = (project: Project) => {
  currentProject.value = project
}

const formatDate = (date: Date) => {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return '今天'
  if (days === 1) return '昨天'
  if (days < 7) return `${days} 天前`
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

const addProject = () => {
  if (!newProject.name.trim()) {
    ElMessage.warning('请输入项目名称')
    return
  }
  
  const avatars = ['/avatars/shiba_tl.png', '/avatars/shiba_fe.png', '/avatars/shiba_be.png', '/avatars/shiba_qa.png']
  const randomAvatar = avatars[Math.floor(Math.random() * avatars.length)]
  
  const project: Project = {
    id: Date.now().toString(),
    name: newProject.name,
    description: newProject.description,
    avatar: randomAvatar,
    createdAt: new Date()
  }
  
  projects.value.unshift(project)
  currentProject.value = project
  
  newProject.name = ''
  newProject.description = ''
  showAddDialog.value = false
  
  ElMessage.success('项目创建成功')
}
</script>

<style scoped>
.project-sidebar {
  width: 220px;
  height: 100%;
  background: #ffffff;
  border-left: 1px solid #e5e5e5;
  display: flex;
  flex-direction: column;
  transition: width 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  flex-shrink: 0;
}

.project-sidebar.collapsed {
  width: 64px;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 14px 10px;
  min-height: 52px;
  border-bottom: 1px solid #f0f0f0;
}

.header-title {
  font-size: 14px;
  font-weight: 600;
  color: #1a1a1a;
}

.add-btn {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: #666;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.add-btn:hover {
  background: #f0f0f0;
  color: #333;
}

.project-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.project-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
  margin-bottom: 2px;
}

.project-item:hover {
  background: #f5f5f5;
}

.project-item.active {
  background: #1a1a1a;
}

.project-item.active .project-name {
  color: white;
  font-weight: 500;
}

.project-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  flex-shrink: 0;
  overflow: hidden;
  border: 1px solid #e5e5e5;
}

.project-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.project-info {
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.project-name {
  font-size: 13px;
  color: #333;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.4;
}

.project-meta {
  font-size: 11px;
  color: #999;
  margin-top: 1px;
}

/* Dialog Styles */
:deep(.project-dialog) {
  border-radius: 10px;
  overflow: hidden;
}

:deep(.project-dialog .el-dialog__header) {
  padding: 16px 16px 10px;
  border-bottom: 1px solid #f0f0f0;
}

:deep(.project-dialog .el-dialog__title) {
  font-size: 15px;
  font-weight: 600;
  color: #1a1a1a;
}

:deep(.project-dialog .el-dialog__body) {
  padding: 16px;
}

:deep(.project-dialog .el-dialog__footer) {
  padding: 10px 16px 16px;
  border-top: 1px solid #f0f0f0;
}

:deep(.project-form .el-form-item) {
  margin-bottom: 14px;
}

:deep(.project-form .el-form-item__label) {
  font-size: 12px;
  font-weight: 500;
  color: #666;
  padding-bottom: 4px;
}

:deep(.project-form .el-input__wrapper) {
  box-shadow: 0 0 0 1px #e0e0e0 inset;
  border-radius: 6px;
  padding: 0 10px;
}

:deep(.project-form .el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px #333 inset, 0 0 0 2px rgba(0, 0, 0, 0.05);
}

:deep(.project-form .el-textarea__inner) {
  border-radius: 6px;
  padding: 8px 10px;
  box-shadow: 0 0 0 1px #e0e0e0 inset;
}

:deep(.project-form .el-textarea__inner:focus) {
  box-shadow: 0 0 0 1px #333 inset, 0 0 0 2px rgba(0, 0, 0, 0.05);
}

:deep(.create-btn) {
  background: #1a1a1a;
  border-color: #1a1a1a;
  border-radius: 6px;
  font-weight: 500;
}

:deep(.create-btn:hover) {
  background: #333;
  border-color: #333;
}
</style>

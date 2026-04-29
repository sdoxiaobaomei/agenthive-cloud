<template>
  <div class="project-settings-page">
    <!-- Header -->
    <div class="settings-header">
      <el-button text @click="goBack">
        <el-icon><ArrowLeft /></el-icon>
        Back to Dashboard
      </el-button>
      <h1 class="page-title">Project Settings</h1>
      <div class="header-spacer" />
    </div>

    <!-- Loading -->
    <div v-if="projectStore.loading && !project" class="settings-loading">
      <el-skeleton :rows="10" animated />
    </div>

    <!-- 404 -->
    <el-empty v-else-if="!project" description="Project not found" :image-size="180">
      <template #description>
        <div class="empty-desc">
          <p class="empty-title">Project not found</p>
        </div>
      </template>
      <el-button type="primary" @click="goToProjects">Back to Projects</el-button>
    </el-empty>

    <!-- Settings Content -->
    <div v-else class="settings-layout">
      <!-- Basic Info -->
      <div class="settings-card">
        <h2 class="card-title">Basic Information</h2>
        <el-form :model="editForm" label-position="top">
          <el-form-item label="Project Name">
            <el-input v-model="editForm.name" maxlength="128" show-word-limit />
          </el-form-item>
          <el-form-item label="Description">
            <el-input v-model="editForm.description" type="textarea" :rows="4" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" :loading="saving" @click="saveBasicInfo">
              Save Changes
            </el-button>
          </el-form-item>
        </el-form>
      </div>

      <!-- Danger Zone -->
      <div class="settings-card danger-zone">
        <h2 class="card-title danger-title">Danger Zone</h2>

        <div class="danger-item">
          <div class="danger-info">
            <h4>Archive Project</h4>
            <p>Archive this project. It will become read-only but can be restored later.</p>
          </div>
          <el-button @click="archiveProject">Archive</el-button>
        </div>

        <div class="danger-item">
          <div class="danger-info">
            <h4>Delete Project</h4>
            <p>Permanently delete this project and all its data. This action cannot be undone.</p>
          </div>
          <el-button type="danger" @click="deleteProject">Delete</el-button>
        </div>
      </div>
    </div>


  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  ArrowLeft,
} from '@element-plus/icons-vue'
import { useProjectStore } from '~/stores/project'

definePageMeta({
  layout: 'app',
})

const route = useRoute()
const router = useRouter()
const projectStore = useProjectStore()

const projectId = computed(() => route.params.id as string)
const saving = ref(false)

const editForm = ref({ name: '', description: '' })

const project = computed(() => projectStore.currentProject)

// ============ 操作 ============
const goBack = () => router.push('/projects')
const goToProjects = () => router.push('/projects')

const saveBasicInfo = async () => {
  saving.value = true
  try {
    await projectStore.updateProject(projectId.value, {
      name: editForm.value.name.trim(),
      description: editForm.value.description.trim(),
    })
    ElMessage.success('Project updated')
  } catch (err: any) {
    ElMessage.error(err.message || 'Failed to update')
  } finally {
    saving.value = false
  }
}

const archiveProject = async () => {
  try {
    await ElMessageBox.confirm(
      'Archive this project? It will become read-only.',
      'Archive Project',
      { confirmButtonText: 'Archive', cancelButtonText: 'Cancel', type: 'warning' }
    )

    await projectStore.updateProject(projectId.value, { status: 'archived' })
    ElMessage.success('Project archived')
    router.push('/projects')
  } catch (err: any) {
    if (err !== 'cancel') {
      ElMessage.error(err.message || 'Failed to archive')
    }
  }
}

const deleteProject = async () => {
  try {
    const projectName = project.value?.name || ''
    const { value } = await ElMessageBox.prompt(
      `This action cannot be undone. Type "${projectName}" to confirm deletion.`,
      'Delete Project',
      {
        confirmButtonText: 'Delete',
        cancelButtonText: 'Cancel',
        type: 'danger',
        inputValidator: (val) => {
          if (val !== projectName) return `Please type "${projectName}" to confirm`
          return true
        },
      }
    )

    if (value === projectName) {
      await projectStore.deleteProject(projectId.value)
      ElMessage.success('Project deleted')
      router.push('/projects')
    }
  } catch (err: any) {
    if (err !== 'cancel') {
      ElMessage.error(err.message || 'Failed to delete')
    }
  }
}

// ============ Helpers ============
const formatDate = (dateStr: string): string => {
  const d = new Date(dateStr)
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

// ============ Lifecycle ============
onMounted(async () => {
  try {
    await projectStore.selectProject(projectId.value)
    if (project.value) {
      editForm.value.name = project.value.name
      editForm.value.description = project.value.description || ''
    }
  } catch (err: any) {
    if (import.meta.dev) console.debug('[Settings] Failed to load:', err.message)
  }
})
</script>

<style scoped>
.project-settings-page {
  padding: 24px 32px;
  max-width: 800px;
  margin: 0 auto;
  min-height: 100%;
}

/* Header */
.settings-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
}

.page-title {
  font-size: 20px;
  font-weight: 600;
  color: #111827;
  margin: 0;
  flex: 1;
  text-align: center;
}

.header-spacer {
  width: 60px;
}

/* Loading */
.settings-loading {
  padding: 40px;
}

/* Layout */
.settings-layout {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* Card */
.settings-card {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 24px;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
  margin: 0 0 20px;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.card-header .card-title {
  margin: 0;
}

/* Member Cell */
.member-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.member-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #4f46e5;
  color: white;
  font-size: 13px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}

.member-name {
  font-size: 14px;
  color: #374151;
}

/* Danger Zone */
.danger-zone {
  border-color: #fecaca;
  background: #fef2f2;
}

.danger-title {
  color: #ef4444;
}

.danger-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 0;
  border-bottom: 1px solid #fecaca;
}

.danger-item:last-child {
  border-bottom: none;
}

.danger-info h4 {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
  margin: 0 0 4px;
}

.danger-info p {
  font-size: 13px;
  color: #9ca3af;
  margin: 0;
}

/* Empty */
.empty-desc {
  text-align: center;
}

.empty-title {
  font-size: 16px;
  font-weight: 600;
  color: #374151;
  margin: 0 0 4px;
}

/* Responsive */
@media (max-width: 768px) {
  .project-settings-page {
    padding: 16px;
  }

  .danger-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
}
</style>

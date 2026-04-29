<template>
  <div class="create-project-page">
    <div class="create-container">
      <!-- Header -->
      <div class="page-header">
        <el-button text @click="goBack">
          <el-icon><ArrowLeft /></el-icon>
          Back
        </el-button>
        <h1 class="page-title">Create New Project</h1>
        <div class="header-spacer" />
      </div>

      <!-- Steps -->
      <el-steps :active="currentStep" finish-status="success" class="steps-nav">
        <el-step title="Method" />
        <el-step title="Configure" />
        <el-step title="Confirm" />
      </el-steps>

      <!-- Step 1: Choose Method -->
      <div v-if="currentStep === 0" class="step-content">
        <h2 class="step-title">Choose creation method</h2>
        <div class="method-cards">
          <div
            class="method-card"
            :class="{ selected: form.type === 'blank' }"
            @click="selectMethod('blank')"
          >
            <div class="method-icon">
              <el-icon :size="32"><Document /></el-icon>
            </div>
            <h3 class="method-name">Blank Project</h3>
            <p class="method-desc">
              Start from scratch with a template based on your tech stack
            </p>
          </div>

          <div
            class="method-card"
            :class="{ selected: form.type === 'git-import' }"
            @click="selectMethod('git-import')"
          >
            <div class="method-icon">
              <el-icon :size="32"><Link /></el-icon>
            </div>
            <h3 class="method-name">Import from Git</h3>
            <p class="method-desc">
              Clone an existing repository from GitHub, GitLab, or other Git hosts
            </p>
          </div>
        </div>
      </div>

      <!-- Step 2: Configure -->
      <div v-if="currentStep === 1" class="step-content">
        <h2 class="step-title">Configure project</h2>

        <el-form
          ref="formRef"
          :model="form"
          :rules="formRules"
          label-position="top"
          class="project-form"
        >
          <!-- Common Fields -->
          <el-form-item label="Project Name" prop="name">
            <el-input
              v-model="form.name"
              placeholder="Enter project name"
              size="large"
              maxlength="128"
              show-word-limit
            />
          </el-form-item>

          <el-form-item label="Description" prop="description">
            <el-input
              v-model="form.description"
              type="textarea"
              :rows="3"
              placeholder="Describe your project (optional)"
            />
          </el-form-item>

          <!-- Blank Project: Tech Stack -->
          <el-form-item v-if="form.type === 'blank'" label="Tech Stack" prop="techStack">
            <div class="tech-stack-grid">
              <div
                v-for="stack in techStacks"
                :key="stack.value"
                class="tech-stack-card"
                :class="{ selected: form.techStack === stack.value }"
                @click="form.techStack = stack.value"
              >
                <div class="stack-icon" :style="{ backgroundColor: stack.color }">
                  {{ stack.label.charAt(0) }}
                </div>
                <span class="stack-name">{{ stack.label }}</span>
              </div>
            </div>
          </el-form-item>

          <!-- Git Import: Git URL + Branch -->
          <template v-if="form.type === 'git-import'">
            <el-form-item label="Git URL" prop="gitUrl">
              <el-input
                v-model="form.gitUrl"
                placeholder="https://github.com/user/repo.git or git@github.com:user/repo.git"
                size="large"
              />
            </el-form-item>

            <el-form-item label="Branch" prop="gitBranch">
              <el-input
                v-model="form.gitBranch"
                placeholder="main"
                size="large"
              />
            </el-form-item>
          </template>
        </el-form>
      </div>

      <!-- Step 3: Confirm -->
      <div v-if="currentStep === 2" class="step-content">
        <h2 class="step-title">Review and create</h2>

        <div class="summary-card">
          <div class="summary-row">
            <span class="summary-label">Creation Method</span>
            <span class="summary-value">
              <el-tag :type="form.type === 'blank' ? 'primary' : 'success'">
                {{ form.type === 'blank' ? 'Blank Project' : 'Git Import' }}
              </el-tag>
            </span>
          </div>

          <div class="summary-row">
            <span class="summary-label">Project Name</span>
            <span class="summary-value">{{ form.name }}</span>
          </div>

          <div v-if="form.description" class="summary-row">
            <span class="summary-label">Description</span>
            <span class="summary-value">{{ form.description }}</span>
          </div>

          <div v-if="form.type === 'blank' && form.techStack" class="summary-row">
            <span class="summary-label">Tech Stack</span>
            <span class="summary-value">
              <el-tag effect="light">{{ techStackLabel }}</el-tag>
            </span>
          </div>

          <div v-if="form.type === 'git-import'" class="summary-row">
            <span class="summary-label">Git URL</span>
            <span class="summary-value code">{{ form.gitUrl }}</span>
          </div>

          <div v-if="form.type === 'git-import' && form.gitBranch" class="summary-row">
            <span class="summary-label">Branch</span>
            <span class="summary-value code">{{ form.gitBranch }}</span>
          </div>
        </div>

        <!-- Error Alert -->
        <el-alert
          v-if="projectStore.error"
          :title="projectStore.error"
          type="error"
          :closable="false"
          class="create-error"
        />
      </div>

      <!-- Actions -->
      <div class="step-actions">
        <el-button v-if="currentStep > 0" @click="prevStep">
          Previous
        </el-button>
        <el-button
          v-if="currentStep < 2"
          type="primary"
          :disabled="!canProceed"
          @click="nextStep"
        >
          Next
        </el-button>
        <el-button
          v-if="currentStep === 2"
          type="primary"
          :loading="projectStore.loading"
          @click="createProject"
        >
          Create Project
        </el-button>
      </div>
    </div>

    <!-- Creating Overlay -->
    <div v-if="isCreating" class="creating-overlay">
      <div class="creating-content">
        <el-icon :size="48" class="creating-icon"><Loading /></el-icon>
        <p class="creating-title">Creating project...</p>
        <p class="creating-subtitle">Initializing workspace, please wait</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import type { FormInstance, FormRules } from 'element-plus'
import {
  ArrowLeft,
  Document,
  Link,
  Loading,
} from '@element-plus/icons-vue'
import { useProjectStore } from '~/stores/project'

definePageMeta({
  layout: 'app',
})

const router = useRouter()
const projectStore = useProjectStore()
const formRef = ref<FormInstance>()

// ============ 步骤状态 ============
const currentStep = ref(0)
const isCreating = ref(false)

// ============ 表单数据 ============
const form = ref({
  type: 'blank' as 'blank' | 'git-import',
  name: '',
  description: '',
  techStack: '' as string,
  gitUrl: '',
  gitBranch: 'main',
})

// ============ 技术栈选项 ============
const techStacks = [
  { value: 'vue', label: 'Vue', color: '#42b883' },
  { value: 'react', label: 'React', color: '#61dafb' },
  { value: 'node', label: 'Node.js', color: '#339933' },
  { value: 'java', label: 'Java', color: '#e76f00' },
]

const techStackLabel = computed(() => {
  return techStacks.find(s => s.value === form.value.techStack)?.label || form.value.techStack
})

// ============ 表单校验 ============
const formRules: FormRules = {
  name: [
    { required: true, message: 'Project name is required', trigger: 'blur' },
    { min: 1, max: 128, message: 'Name must be 1-128 characters', trigger: 'blur' },
  ],
  techStack: [
    { required: true, message: 'Please select a tech stack', trigger: 'change' },
  ],
  gitUrl: [
    { required: true, message: 'Git URL is required', trigger: 'blur' },
    {
      validator: (_rule: any, value: string, callback: any) => {
        if (!value) {
          callback()
          return
        }
        const httpsPattern = /^https:\/\/.+\.git$/
        const sshPattern = /^git@[^:]+:.+\.git$/
        if (httpsPattern.test(value) || sshPattern.test(value)) {
          callback()
        } else {
          callback(new Error('Please enter a valid Git URL (HTTPS or SSH)'))
        }
      },
      trigger: 'blur',
    },
  ],
}

// ============ 步骤控制 ============
const canProceed = computed(() => {
  if (currentStep.value === 0) return true
  if (currentStep.value === 1) {
    if (!form.value.name.trim()) return false
    if (form.value.type === 'blank' && !form.value.techStack) return false
    if (form.value.type === 'git-import') {
      if (!form.value.gitUrl.trim()) return false
      const httpsPattern = /^https:\/\/.+\.git$/
      const sshPattern = /^git@[^:]+:.+\.git$/
      if (!httpsPattern.test(form.value.gitUrl) && !sshPattern.test(form.value.gitUrl)) return false
    }
    return true
  }
  return true
})

const selectMethod = (type: 'blank' | 'git-import') => {
  form.value.type = type
}

const nextStep = async () => {
  if (currentStep.value === 1) {
    const valid = await formRef.value?.validate().catch(() => false)
    if (!valid) return
  }
  currentStep.value++
}

const prevStep = () => {
  if (currentStep.value > 0) {
    currentStep.value--
  }
}

// ============ 创建项目 ============
const createProject = async () => {
  isCreating.value = true
  projectStore.clearError()

  try {
    const project = await projectStore.createProject({
      name: form.value.name.trim(),
      description: form.value.description.trim(),
      type: form.value.type,
      techStack: form.value.type === 'blank' ? form.value.techStack : undefined,
      gitUrl: form.value.type === 'git-import' ? form.value.gitUrl.trim() : undefined,
      gitBranch: form.value.type === 'git-import' ? form.value.gitBranch.trim() : undefined,
    })

    // 创建成功，跳转到 workspace
    router.push(`/workspace/${project.id}`)
  } catch (err: any) {
    // 错误已在 store 中设置，停留在当前页显示错误
    if (import.meta.dev) {
      console.debug('[CreateProject] Failed:', err.message)
    }
  } finally {
    isCreating.value = false
  }
}

const goBack = () => {
  router.push('/projects')
}
</script>

<style scoped>
.create-project-page {
  padding: 24px 32px;
  max-width: 800px;
  margin: 0 auto;
  min-height: 100%;
  display: flex;
  flex-direction: column;
}

.create-container {
  flex: 1;
  display: flex;
  flex-direction: column;
}

/* ============ Header ============ */
.page-header {
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

/* ============ Steps ============ */
.steps-nav {
  margin-bottom: 32px;
}

.steps-nav :deep(.el-step__title) {
  font-size: 13px;
}

/* ============ Step Content ============ */
.step-content {
  flex: 1;
}

.step-title {
  font-size: 16px;
  font-weight: 600;
  color: #374151;
  margin: 0 0 24px;
}

/* ============ Method Cards ============ */
.method-cards {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
}

.method-card {
  background: #ffffff;
  border: 2px solid #e5e7eb;
  border-radius: 16px;
  padding: 32px 24px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.method-card:hover {
  border-color: #bfdbfe;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
}

.method-card.selected {
  border-color: #4f46e5;
  background: #eff6ff;
  box-shadow: 0 4px 20px rgba(79, 70, 229, 0.1);
}

.method-icon {
  width: 64px;
  height: 64px;
  border-radius: 16px;
  background: #f3f4f6;
  color: #6b7280;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 16px;
  transition: all 0.2s ease;
}

.method-card:hover .method-icon {
  background: #e5e7eb;
  color: #4f46e5;
}

.method-card.selected .method-icon {
  background: #4f46e5;
  color: white;
}

.method-name {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
  margin: 0 0 8px;
}

.method-desc {
  font-size: 13px;
  color: #9ca3af;
  margin: 0;
  line-height: 1.5;
}

/* ============ Form ============ */
.project-form {
  max-width: 560px;
}

/* ============ Tech Stack Grid ============ */
.tech-stack-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.tech-stack-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px 12px;
  border: 2px solid #e5e7eb;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.tech-stack-card:hover {
  border-color: #bfdbfe;
  transform: translateY(-2px);
}

.tech-stack-card.selected {
  border-color: #4f46e5;
  background: #eff6ff;
}

.stack-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  color: white;
  font-size: 18px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.stack-name {
  font-size: 13px;
  font-weight: 500;
  color: #374151;
}

/* ============ Summary Card ============ */
.summary-card {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 20px 24px;
  max-width: 560px;
}

.summary-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid #f3f4f6;
}

.summary-row:last-child {
  border-bottom: none;
}

.summary-label {
  font-size: 13px;
  color: #6b7280;
}

.summary-value {
  font-size: 13px;
  font-weight: 500;
  color: #111827;
  max-width: 60%;
  text-align: right;
  word-break: break-word;
}

.summary-value.code {
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 12px;
  color: #4f46e5;
  background: #f3f4f6;
  padding: 2px 8px;
  border-radius: 4px;
}

.create-error {
  margin-top: 16px;
  max-width: 560px;
}

/* ============ Actions ============ */
.step-actions {
  display: flex;
  justify-content: center;
  gap: 12px;
  padding-top: 32px;
  border-top: 1px solid #f3f4f6;
  margin-top: 24px;
}

/* ============ Creating Overlay ============ */
.creating-overlay {
  position: fixed;
  inset: 0;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.creating-content {
  text-align: center;
}

.creating-icon {
  color: #4f46e5;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.creating-title {
  font-size: 18px;
  font-weight: 600;
  color: #111827;
  margin: 0 0 8px;
}

.creating-subtitle {
  font-size: 14px;
  color: #9ca3af;
  margin: 0;
}

/* ============ Responsive ============ */
@media (max-width: 768px) {
  .create-project-page {
    padding: 16px;
  }

  .method-cards {
    grid-template-columns: 1fr;
  }

  .tech-stack-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .page-title {
    font-size: 16px;
  }
}
</style>

<template>
  <el-dialog
    v-model="visible"
    title="新建 Agent"
    width="560px"
    :close-on-click-modal="false"
    destroy-on-close
    class="create-agent-dialog"
  >
    <el-scrollbar max-height="60vh">
      <el-form 
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="100px"
        class="agent-form"
        status-icon
      >
        <!-- 基本信息 -->
        <div class="form-section">
          <div class="section-title">基本信息</div>
          
          <el-form-item label="名称" prop="name">
            <el-input 
              v-model="form.name" 
              placeholder="例如: Frontend Dev 1"
              maxlength="50"
              show-word-limit
              clearable
            >
              <template #prefix>
                <el-icon><User /></el-icon>
              </template>
            </el-input>
          </el-form-item>
          
          <el-form-item label="角色" prop="role">
            <el-select 
              v-model="form.role" 
              placeholder="选择角色" 
              style="width: 100%"
              filterable
            >
              <el-option
                v-for="role in AGENT_ROLES"
                :key="role.value"
                :label="role.label"
                :value="role.value"
              >
                <div class="role-option">
                  <el-icon :size="16" :color="role.color">
                    <component :is="role.icon" />
                  </el-icon>
                  <span>{{ role.label }}</span>
                </div>
              </el-option>
            </el-select>
            <div v-if="form.role" class="role-description">
              {{ getRoleDescription(form.role) }}
            </div>
          </el-form-item>
          
          <el-form-item label="描述" prop="description">
            <el-input 
              v-model="form.description" 
              type="textarea" 
              :rows="3"
              placeholder="描述这个 Agent 的职责和能力..."
              maxlength="500"
              show-word-limit
            />
          </el-form-item>
        </div>
        
        <!-- 资源配置 -->
        <div class="form-section">
          <div class="section-title">
            资源配置
            <el-tooltip content="根据 Agent 角色调整资源分配" placement="top">
              <el-icon class="section-help"><QuestionFilled /></el-icon>
            </el-tooltip>
          </div>
          
          <el-form-item label="内存限制" prop="config.memory">
            <div class="resource-input">
              <el-slider 
                v-model="form.config.memory" 
                :min="512" 
                :max="16384" 
                :step="512"
                show-stops
                :marks="{512: '512M', 4096: '4G', 8192: '8G', 16384: '16G'}"
              />
              <el-input-number 
                v-model="form.config.memory" 
                :min="512" 
                :max="16384" 
                :step="512"
                controls-position="right"
                style="width: 120px"
              />
              <span class="unit">MB</span>
            </div>
          </el-form-item>
          
          <el-form-item label="CPU限制" prop="config.cpu">
            <div class="resource-input">
              <el-slider 
                v-model="form.config.cpu" 
                :min="0.5" 
                :max="16" 
                :step="0.5"
                show-stops
              />
              <el-input-number 
                v-model="form.config.cpu" 
                :min="0.5" 
                :max="16" 
                :step="0.5"
                controls-position="right"
                style="width: 120px"
              />
              <span class="unit">核</span>
            </div>
          </el-form-item>
          
          <el-form-item label="超时时间" prop="config.timeout">
            <el-input-number 
              v-model="form.config.timeout" 
              :min="30" 
              :max="3600" 
              :step="30"
              controls-position="right"
              style="width: 150px"
            />
            <span class="unit">秒</span>
            <span class="form-hint">任务执行超时时间</span>
          </el-form-item>
        </div>
        
        <!-- 高级配置 -->
        <el-collapse v-model="activeCollapse">
          <el-collapse-item title="高级配置" name="advanced">
            <el-form-item label="环境变量" prop="config.env">
              <div class="env-vars-list">
                <div 
                  v-for="(env, index) in envVars" 
                  :key="index"
                  class="env-var-item"
                >
                  <el-input v-model="env.key" placeholder="KEY" size="small" />
                  <span class="env-separator">=</span>
                  <el-input v-model="env.value" placeholder="value" size="small" />
                  <el-button 
                    :icon="Delete" 
                    text 
                    size="small"
                    type="danger"
                    @click="removeEnvVar(index)"
                  />
                </div>
                <el-button 
                  :icon="Plus" 
                  text 
                  size="small"
                  @click="addEnvVar"
                >
                  添加环境变量
                </el-button>
              </div>
            </el-form-item>
            
            <el-form-item label="工作目录" prop="config.workDir">
              <el-input 
                v-model="form.config.workDir" 
                placeholder="/workspace"
              />
            </el-form-item>
            
            <el-form-item label="日志级别" prop="config.logLevel">
              <el-radio-group v-model="form.config.logLevel">
                <el-radio-button label="debug">Debug</el-radio-button>
                <el-radio-button label="info">Info</el-radio-button>
                <el-radio-button label="warn">Warn</el-radio-button>
                <el-radio-button label="error">Error</el-radio-button>
              </el-radio-group>
            </el-form-item>
          </el-collapse-item>
        </el-collapse>
      </el-form>
    </el-scrollbar>
    
    <template #footer>
      <div class="dialog-footer">
        <el-button @click="visible = false">取消</el-button>
        <el-button type="primary" :loading="loading" @click="handleSubmit">
          创建 Agent
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useAgentStore } from '@/stores/agent'
import { AGENT_ROLES } from '@/utils/constants'
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { User, QuestionFilled, Delete, Plus } from '@element-plus/icons-vue'
import type { AgentRole } from '@/types'

interface EnvVar {
  key: string
  value: string
}

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  created: []
}>()

const agentStore = useAgentStore()
const formRef = ref<FormInstance>()
const loading = ref(false)
const activeCollapse = ref<string[]>([])
const envVars = ref<EnvVar[]>([])

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})

// 根据角色自动设置资源
const getDefaultResources = (role: AgentRole) => {
  const defaults: Record<AgentRole, { memory: number; cpu: number }> = {
    director: { memory: 4096, cpu: 2 },
    scrum_master: { memory: 2048, cpu: 1 },
    tech_lead: { memory: 4096, cpu: 2 },
    backend_dev: { memory: 4096, cpu: 2 },
    frontend_dev: { memory: 4096, cpu: 2 },
    qa_engineer: { memory: 2048, cpu: 1 },
    devops_engineer: { memory: 2048, cpu: 1 },
    custom: { memory: 2048, cpu: 1 },
  }
  return defaults[role] || defaults.custom
}

const form = ref({
  name: '',
  role: '' as string,
  description: '',
  config: {
    memory: 2048,
    cpu: 2,
    timeout: 300,
    env: {} as Record<string, string>,
    workDir: '/workspace',
    logLevel: 'info' as const,
  },
})

// 监听角色变化，自动调整资源
watch(() => form.value.role, (newRole) => {
  if (newRole) {
    const defaults = getDefaultResources(newRole as AgentRole)
    form.value.config.memory = defaults.memory
    form.value.config.cpu = defaults.cpu
  }
})

const getRoleDescription = (role: string): string => {
  const descriptions: Record<string, string> = {
    director: '负责项目整体规划和协调，分配任务给其他 Agent',
    scrum_master: '负责敏捷流程管理，跟踪任务进度和解决阻塞',
    tech_lead: '负责技术架构设计，代码审查和技术决策',
    backend_dev: '负责后端服务开发，API 设计和数据库实现',
    frontend_dev: '负责前端界面开发，用户体验和交互实现',
    qa_engineer: '负责测试用例编写，质量保障和问题追踪',
    devops_engineer: '负责 CI/CD 流程，部署和运维自动化',
    custom: '自定义 Agent，可根据需求配置特定功能',
  }
  return descriptions[role] || ''
}

// 验证规则
const rules: FormRules = {
  name: [
    { required: true, message: '请输入 Agent 名称', trigger: 'blur' },
    { min: 2, max: 50, message: '长度在 2 到 50 个字符', trigger: 'blur' },
    { 
      pattern: /^[\u4e00-\u9fa5a-zA-Z0-9_-]+$/, 
      message: '只能包含中文、字母、数字、下划线和横线', 
      trigger: 'blur' 
    },
  ],
  role: [
    { required: true, message: '请选择 Agent 角色', trigger: 'change' },
  ],
  description: [
    { max: 500, message: '描述不能超过 500 个字符', trigger: 'blur' },
  ],
  'config.memory': [
    { required: true, message: '请设置内存限制', trigger: 'change' },
    { type: 'number', min: 512, max: 16384, message: '内存范围: 512MB - 16GB', trigger: 'change' },
  ],
  'config.cpu': [
    { required: true, message: '请设置 CPU 限制', trigger: 'change' },
    { type: 'number', min: 0.5, max: 16, message: 'CPU 范围: 0.5 - 16 核', trigger: 'change' },
  ],
  'config.timeout': [
    { type: 'number', min: 30, max: 3600, message: '超时时间: 30秒 - 1小时', trigger: 'change' },
  ],
}

const addEnvVar = () => {
  envVars.value.push({ key: '', value: '' })
}

const removeEnvVar = (index: number) => {
  envVars.value.splice(index, 1)
}

const validateEnvVars = (): boolean => {
  for (const env of envVars.value) {
    if (env.key && !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(env.key)) {
      ElMessage.error(`环境变量名 "${env.key}" 格式不正确`)
      return false
    }
  }
  return true
}

const handleSubmit = async () => {
  if (!formRef.value) return
  
  // 验证环境变量
  if (!validateEnvVars()) return
  
  await formRef.value.validate(async (valid, fields) => {
    if (!valid) {
      // 滚动到第一个错误项
      const firstErrorField = Object.keys(fields || {})[0]
      if (firstErrorField) {
        ElMessage.error(fields![firstErrorField][0].message)
      }
      return
    }
    
    loading.value = true
    try {
      // 构建环境变量对象
      const env: Record<string, string> = {}
      envVars.value.forEach(({ key, value }) => {
        if (key) env[key] = value
      })
      
      await agentStore.createAgent({
        name: form.value.name,
        role: form.value.role,
        description: form.value.description,
        config: {
          memory: form.value.config.memory,
          cpu: form.value.config.cpu,
          timeout: form.value.config.timeout,
          env,
          workDir: form.value.config.workDir,
          logLevel: form.value.config.logLevel,
        },
      })
      
      ElMessage.success('Agent 创建成功')
      visible.value = false
      resetForm()
      emit('created')
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '创建失败')
    } finally {
      loading.value = false
    }
  })
}

const resetForm = () => {
  form.value = {
    name: '',
    role: '',
    description: '',
    config: {
      memory: 2048,
      cpu: 2,
      timeout: 300,
      env: {},
      workDir: '/workspace',
      logLevel: 'info',
    },
  }
  envVars.value = []
  activeCollapse.value = []
  formRef.value?.resetFields()
}

// 对话框关闭时重置表单
watch(visible, (val) => {
  if (!val) {
    resetForm()
  }
})
</script>

<style scoped>
.create-agent-dialog :deep(.el-dialog__body) {
  padding: 0 20px;
}

.agent-form {
  padding: 20px 0;
}

.form-section {
  margin-bottom: 24px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--el-border-color-light);
  display: flex;
  align-items: center;
  gap: 8px;
}

.section-help {
  color: var(--el-text-color-secondary);
  cursor: help;
}

.role-option {
  display: flex;
  align-items: center;
  gap: 8px;
}

.role-description {
  margin-top: 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.5;
}

.resource-input {
  display: flex;
  align-items: center;
  gap: 12px;
}

.resource-input .el-slider {
  flex: 1;
}

.unit {
  margin-left: 4px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.form-hint {
  margin-left: 12px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.env-vars-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.env-var-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.env-var-item .el-input {
  flex: 1;
}

.env-separator {
  color: var(--el-text-color-secondary);
  font-weight: bold;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

:deep(.el-collapse) {
  border: none;
}

:deep(.el-collapse-item__header) {
  border: none;
  background: transparent;
  font-size: 14px;
  font-weight: 600;
}

:deep(.el-collapse-item__wrap) {
  border: none;
  background: var(--el-fill-color-light);
  border-radius: var(--radius-md);
}

:deep(.el-collapse-item__content) {
  padding: 16px;
}

:deep(.el-form-item__label) {
  font-weight: 500;
}
</style>

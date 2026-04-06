<template>
  <el-dialog
    v-model="visible"
    title="创建新 Agent"
    width="500px"
    :close-on-click-modal="false"
    destroy-on-close
  >
    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-position="top"
      class="create-agent-form"
    >
      <el-form-item label="Agent 名称" prop="name">
        <el-input 
          v-model="form.name" 
          placeholder="例如：前端开发助手"
          maxlength="20"
          show-word-limit
        />
      </el-form-item>
      
      <el-form-item label="角色类型" prop="role">
        <el-select v-model="form.role" placeholder="选择角色" class="w-full">
          <el-option
            v-for="role in roleOptions"
            :key="role.value"
            :label="role.label"
            :value="role.value"
          >
            <div class="role-option">
              <AgentAvatar :role="role.value as any" :size="24" />
              <span>{{ role.label }}</span>
            </div>
          </el-option>
        </el-select>
      </el-form-item>
      
      <el-form-item label="描述" prop="description">
        <el-input
          v-model="form.description"
          type="textarea"
          :rows="3"
          placeholder="描述这个 Agent 的职责和专长..."
          maxlength="200"
          show-word-limit
        />
      </el-form-item>
      
      <el-form-item label="技能标签">
        <el-select
          v-model="form.skills"
          multiple
          filterable
          allow-create
          placeholder="选择或输入技能"
          class="w-full"
        >
          <el-option
            v-for="skill in skillOptions"
            :key="skill"
            :label="skill"
            :value="skill"
          />
        </el-select>
      </el-form-item>
    </el-form>
    
    <template #footer>
      <div class="dialog-footer">
        <el-button @click="visible = false">取消</el-button>
        <el-button type="primary" :loading="loading" @click="handleSubmit">
          创建
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'created': []
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

const formRef = ref()
const loading = ref(false)

const form = ref<{
  name: string
  role: 'frontend_dev' | 'backend_dev' | 'qa_engineer' | 'tech_lead' | ''
  description: string
  skills: string[]
}>({
  name: '',
  role: '',
  description: '',
  skills: []
})

const rules = {
  name: [
    { required: true, message: '请输入 Agent 名称', trigger: 'blur' },
    { min: 2, max: 20, message: '长度在 2 到 20 个字符', trigger: 'blur' }
  ],
  role: [
    { required: true, message: '请选择角色类型', trigger: 'change' }
  ],
  description: [
    { max: 200, message: '描述不能超过 200 个字符', trigger: 'blur' }
  ]
}

const roleOptions = [
  { value: 'frontend_dev', label: '前端开发' },
  { value: 'backend_dev', label: '后端开发' },
  { value: 'qa_engineer', label: '质量保障' },
  { value: 'tech_lead', label: '技术负责人' },
]

const skillOptions = [
  'Vue.js', 'React', 'TypeScript', 'Node.js', 'Python',
  'Go', 'Rust', '数据库', 'Docker', 'Kubernetes',
  '测试', 'CI/CD', 'UI/UX', '性能优化'
]

const handleSubmit = async () => {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  
  loading.value = true
  try {
    // TODO: 调用 API 创建 Agent
    await new Promise(resolve => setTimeout(resolve, 500))
    
    ElMessage.success('Agent 创建成功')
    visible.value = false
    emit('created')
    
    // 重置表单
    form.value = {
      name: '',
      role: '',
      description: '',
      skills: []
    }
  } catch (error) {
    ElMessage.error('创建失败，请重试')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.create-agent-form {
  padding: 8px 0;
}

.role-option {
  display: flex;
  align-items: center;
  gap: 8px;
}

.w-full {
  width: 100%;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>

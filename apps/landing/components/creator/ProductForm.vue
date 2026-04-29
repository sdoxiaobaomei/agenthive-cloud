<script setup lang="ts">
import { ref, computed, reactive, watch } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { Plus, Delete, Rank } from '@element-plus/icons-vue'
import { useMarkdownRender } from '~/composables/useMarkdownRender'
import type { CreatorProductType } from '~/types/economy'

export interface ProductFormData {
  name: string
  description: string
  type: CreatorProductType
  techStack: string[]
  tags: string[]
  creditsPrice: number | null
  price: number | null
  demoUrl: string
  previewImages: { url: string; name: string }[]
  sourceProjectId: string
}

interface Props {
  modelValue: ProductFormData
  loading?: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: ProductFormData]
  submit: []
  cancel: []
}>()

const formRef = ref<FormInstance>()
const { render } = useMarkdownRender()

// Local reactive copy synced with parent
const form = reactive<ProductFormData>({
  name: '',
  description: '',
  type: 'template',
  techStack: [],
  tags: [],
  creditsPrice: null,
  price: null,
  demoUrl: '',
  previewImages: [],
  sourceProjectId: '',
})

// Sync initial and external updates
watch(
  () => props.modelValue,
  (val) => {
    Object.assign(form, val)
  },
  { immediate: true, deep: true }
)

// Emit changes back to parent
watch(
  () => ({ ...form }),
  (val) => {
    emit('update:modelValue', { ...val, previewImages: [...form.previewImages] })
  },
  { deep: true }
)

// Markdown preview
const showPreview = ref(false)
const renderedDescription = computed(() => render(form.description))

// Tech stack tag input
const techInput = ref('')
const handleTechKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Enter') {
    e.preventDefault()
    const val = techInput.value.trim()
    if (val && !form.techStack.includes(val)) {
      if (form.techStack.length >= 10) {
        ElMessage.warning('Maximum 10 tech stack tags')
        return
      }
      form.techStack.push(val)
      techInput.value = ''
    }
  }
}
const removeTech = (tag: string) => {
  form.techStack = form.techStack.filter(t => t !== tag)
}

// Image upload
const MAX_IMAGES = 5
const MAX_SIZE_MB = 2
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024
const dragIndex = ref<number | null>(null)

const handleImageChange = (uploadFile: any) => {
  const raw = uploadFile.raw as File
  if (!raw) return

  if (raw.size > MAX_SIZE_BYTES) {
    ElMessage.error(`Image "${raw.name}" exceeds ${MAX_SIZE_MB}MB limit`)
    return
  }

  if (form.previewImages.length >= MAX_IMAGES) {
    ElMessage.warning(`Maximum ${MAX_IMAGES} images allowed`)
    return
  }

  const reader = new FileReader()
  reader.onload = (e) => {
    form.previewImages.push({
      url: e.target?.result as string,
      name: raw.name,
    })
  }
  reader.readAsDataURL(raw)
}

const removeImage = (index: number) => {
  form.previewImages.splice(index, 1)
}

// Drag sort
const handleDragStart = (index: number) => {
  dragIndex.value = index
}
const handleDragOver = (e: DragEvent) => {
  e.preventDefault()
}
const handleDrop = (index: number) => {
  if (dragIndex.value === null || dragIndex.value === index) return
  const list = [...form.previewImages]
  const [moved] = list.splice(dragIndex.value, 1)
  list.splice(index, 0, moved)
  form.previewImages = list
  dragIndex.value = null
}

// Source project mock data
const mockProjects = [
  { id: 'proj-001', name: 'AgentHive Dashboard' },
  { id: 'proj-002', name: 'E-commerce Platform' },
  { id: 'proj-003', name: 'Blog System' },
  { id: 'proj-004', name: 'Chat Application' },
  { id: 'proj-005', name: 'Portfolio Site' },
]

// Form validation
const rules: FormRules = {
  name: [
    { required: true, message: 'Product name is required', trigger: 'blur' },
    { min: 2, max: 50, message: 'Name must be 2-50 characters', trigger: 'blur' },
  ],
  description: [
    { required: true, message: 'Description is required', trigger: 'blur' },
    { min: 10, max: 2000, message: 'Description must be 10-2000 characters', trigger: 'blur' },
  ],
  type: [
    { required: true, message: 'Product type is required', trigger: 'change' },
  ],
  creditsPrice: [
    { required: true, message: 'Credits price is required', trigger: 'change' },
    {
      validator: (_rule, value, callback) => {
        if (value === null || value === undefined || value <= 0) {
          callback(new Error('Credits price must be greater than 0'))
        } else {
          callback()
        }
      },
      trigger: 'change',
    },
  ],
}

const handleSubmit = async () => {
  if (!formRef.value) return
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  emit('submit')
}
</script>

<template>
  <ElForm
    ref="formRef"
    :model="form"
    :rules="rules"
    label-position="top"
    class="product-form"
  >
    <!-- Product Name -->
    <ElFormItem label="Product Name" prop="name">
      <ElInput
        v-model="form.name"
        placeholder="Enter product name (2-50 characters)"
        maxlength="50"
        show-word-limit
      />
    </ElFormItem>

    <!-- Description with Markdown Preview -->
    <ElFormItem label="Description" prop="description">
      <div class="description-field">
        <ElInput
          v-model="form.description"
          type="textarea"
          :rows="6"
          placeholder="Describe your product in detail (10-2000 characters). Markdown is supported."
          maxlength="2000"
          show-word-limit
        />
        <div class="preview-toggle">
          <ElButton text size="small" @click="showPreview = !showPreview">
            {{ showPreview ? 'Hide Preview' : 'Show Markdown Preview' }}
          </ElButton>
        </div>
        <div v-show="showPreview" class="markdown-preview-panel">
          <div class="preview-label">Preview</div>
          <div class="markdown-body" v-html="renderedDescription" />
        </div>
      </div>
    </ElFormItem>

    <!-- Type -->
    <ElFormItem label="Product Type" prop="type">
      <ElRadioGroup v-model="form.type">
        <ElRadioButton label="template">Template</ElRadioButton>
        <ElRadioButton label="website">Website</ElRadioButton>
        <ElRadioButton label="component">Component</ElRadioButton>
        <ElRadioButton label="plugin">Plugin</ElRadioButton>
      </ElRadioGroup>
    </ElFormItem>

    <!-- Tech Stack Tags -->
    <ElFormItem label="Tech Stack">
      <div class="tag-input-wrapper">
        <ElInput
          v-model="techInput"
          placeholder="Press Enter to add tech stack tags (e.g. Vue 3, React)"
          @keydown="handleTechKeydown"
        />
        <div v-if="form.techStack.length" class="tag-list">
          <ElTag
            v-for="tag in form.techStack"
            :key="tag"
            closable
            effect="light"
            type="info"
            @close="removeTech(tag)"
          >
            {{ tag }}
          </ElTag>
        </div>
      </div>
    </ElFormItem>

    <!-- Tags -->
    <ElFormItem label="Tags">
      <ElSelect
        v-model="form.tags"
        multiple
        filterable
        allow-create
        placeholder="Add tags"
        style="width: 100%"
      />
    </ElFormItem>

    <!-- Pricing -->
    <div class="pricing-row">
      <ElFormItem label="Credits Price" prop="creditsPrice" class="pricing-item">
        <ElInputNumber
          v-model="form.creditsPrice"
          :min="1"
          :step="10"
          placeholder="Required"
          style="width: 100%"
        />
      </ElFormItem>
      <ElFormItem label="Fiat Price (USD, optional)" class="pricing-item">
        <ElInputNumber
          v-model="form.price"
          :min="0"
          :precision="2"
          :step="1"
          placeholder="Optional"
          style="width: 100%"
        />
      </ElFormItem>
    </div>

    <!-- Demo URL -->
    <ElFormItem label="Demo URL (optional)">
      <ElInput
        v-model="form.demoUrl"
        placeholder="https://demo.example.com"
      />
    </ElFormItem>

    <!-- Source Project -->
    <ElFormItem label="Source Project">
      <ElSelect
        v-model="form.sourceProjectId"
        placeholder="Select a source project (optional)"
        style="width: 100%"
        clearable
      >
        <ElOption
          v-for="proj in mockProjects"
          :key="proj.id"
          :label="proj.name"
          :value="proj.id"
        />
      </ElSelect>
    </ElFormItem>

    <!-- Preview Images -->
    <ElFormItem label="Preview Images">
      <div class="image-upload-wrapper">
        <!-- Draggable Preview List -->
        <div v-if="form.previewImages.length" class="preview-list">
          <div
            v-for="(img, idx) in form.previewImages"
            :key="img.url + idx"
            class="preview-item"
            draggable="true"
            @dragstart="handleDragStart(idx)"
            @dragover="handleDragOver"
            @drop="handleDrop(idx)"
          >
            <img :src="img.url" :alt="img.name" />
            <div class="preview-overlay">
              <ElIcon class="drag-icon"><Rank /></ElIcon>
              <ElButton
                circle
                size="small"
                type="danger"
                class="remove-btn"
                @click="removeImage(idx)"
              >
                <ElIcon><Delete /></ElIcon>
              </ElButton>
            </div>
            <div class="preview-index">{{ idx + 1 }}</div>
          </div>
        </div>

        <!-- Upload Trigger -->
        <ElUpload
          v-if="form.previewImages.length < MAX_IMAGES"
          action="#"
          :auto-upload="false"
          :show-file-list="false"
          :on-change="handleImageChange"
          class="upload-trigger"
        >
          <div class="upload-placeholder">
            <ElIcon :size="24"><Plus /></ElIcon>
            <span>Upload Image</span>
            <span class="upload-hint">Max {{ MAX_IMAGES }}, {{ MAX_SIZE_MB }}MB each</span>
          </div>
        </ElUpload>
      </div>
    </ElFormItem>

    <!-- Actions -->
    <ElFormItem>
      <div class="form-actions">
        <ElButton type="primary" size="large" :loading="loading" @click="handleSubmit">
          Publish Product
        </ElButton>
        <ElButton size="large" @click="emit('cancel')">Cancel</ElButton>
      </div>
    </ElFormItem>
  </ElForm>
</template>

<style scoped>
.product-form :deep(.el-form-item__label) {
  font-weight: 500;
}

.description-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.preview-toggle {
  display: flex;
  justify-content: flex-end;
}

.markdown-preview-panel {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 16px;
  background: #f9fafb;
}

.preview-label {
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}

.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3),
.markdown-body :deep(h4) {
  margin: 12px 0 8px;
  color: #111827;
}

.markdown-body :deep(p) {
  margin: 8px 0;
  line-height: 1.6;
  color: #374151;
}

.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  margin: 8px 0;
  padding-left: 24px;
}

.markdown-body :deep(code) {
  background: #f3f4f6;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 13px;
}

.markdown-body :deep(pre) {
  background: #1e293b;
  color: #e2e8f0;
  padding: 12px;
  border-radius: 8px;
  overflow-x: auto;
}

.markdown-body :deep(pre code) {
  background: transparent;
  padding: 0;
  color: inherit;
}

.markdown-body :deep(a) {
  color: #4f46e5;
  text-decoration: none;
}

.markdown-body :deep(blockquote) {
  border-left: 4px solid #e5e7eb;
  padding-left: 12px;
  margin: 8px 0;
  color: #6b7280;
}

.markdown-body :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 8px 0;
}

.markdown-body :deep(th),
.markdown-body :deep(td) {
  border: 1px solid #e5e7eb;
  padding: 8px 12px;
  text-align: left;
}

.markdown-body :deep(th) {
  background: #f9fafb;
  font-weight: 600;
}

.tag-input-wrapper {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.pricing-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.image-upload-wrapper {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.preview-list {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.preview-item {
  position: relative;
  width: 120px;
  height: 120px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #e5e7eb;
  cursor: grab;
}

.preview-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.preview-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.preview-item:hover .preview-overlay {
  opacity: 1;
}

.drag-icon {
  color: white;
  font-size: 20px;
}

.remove-btn {
  --el-button-bg-color: #ef4444;
  --el-button-border-color: #ef4444;
  --el-button-hover-bg-color: #dc2626;
  --el-button-hover-border-color: #dc2626;
}

.preview-index {
  position: absolute;
  top: 4px;
  left: 4px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.6);
  color: white;
  font-size: 11px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}

.upload-trigger :deep(.el-upload) {
  display: block;
}

.upload-placeholder {
  width: 120px;
  height: 120px;
  border: 2px dashed #d1d5db;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  cursor: pointer;
  transition: all 0.15s ease;
  color: #6b7280;
  font-size: 13px;
}

.upload-placeholder:hover {
  border-color: #4f46e5;
  color: #4f46e5;
}

.upload-hint {
  font-size: 11px;
  color: #9ca3af;
}

.form-actions {
  display: flex;
  gap: 12px;
  padding-top: 8px;
}

/* Dark mode */
.dark .markdown-preview-panel {
  background: #1e293b;
  border-color: #334155;
}

.dark .markdown-body :deep(h1),
.dark .markdown-body :deep(h2),
.dark .markdown-body :deep(h3),
.dark .markdown-body :deep(h4) {
  color: #f1f5f9;
}

.dark .markdown-body :deep(p) {
  color: #cbd5e1;
}

.dark .markdown-body :deep(code) {
  background: #334155;
  color: #e2e8f0;
}

.dark .markdown-body :deep(pre) {
  background: #0f172a;
}

.dark .markdown-body :deep(th) {
  background: #1e293b;
  color: #e2e8f0;
}

.dark .markdown-body :deep(td) {
  border-color: #334155;
  color: #cbd5e1;
}

.dark .markdown-body :deep(blockquote) {
  border-color: #334155;
  color: #94a3b8;
}

.dark .upload-placeholder {
  border-color: #4b5563;
  color: #9ca3af;
}

.dark .upload-placeholder:hover {
  border-color: #818cf8;
  color: #818cf8;
}

.dark .preview-item {
  border-color: #334155;
}

@media (max-width: 768px) {
  .pricing-row {
    grid-template-columns: 1fr;
  }
}
</style>

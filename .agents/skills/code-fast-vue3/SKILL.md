---
name: code-fast-vue3
description: Rapid Vue 3 and Nuxt 3 code generation with TypeScript, Element Plus, and Pinia. Use when creating Vue components, composables, Pinia stores, or pages in agenthive-cloud. Supports Composition API with <script setup>, Element Plus UI components, Vue Router navigation, and async data fetching patterns. Triggers on: "create Vue component", "add page", "new composable", "Pinia store", "Vue 3", "Element Plus".
---

# Fast Vue 3/Nuxt 3 Coding

Accelerate Vue 3 development with Composition API, TypeScript, Element Plus, and Pinia patterns.

## Quick Patterns

### Vue 3 Component Template

```vue
<template>
  <div class="component-name">
    <el-card shadow="hover">
      <template #header>
        <div class="card-header">
          <span>{{ title }}</span>
          <el-button type="primary" @click="handleAction">
            操作
          </el-button>
        </div>
      </template>
      
      <div v-if="loading" class="loading-wrapper">
        <el-skeleton :rows="3" animated />
      </div>
      
      <div v-else-if="error" class="error-wrapper">
        <el-alert :title="error" type="error" closable @close="clearError" />
      </div>
      
      <div v-else class="content-wrapper">
        <slot />
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

interface Props {
  title: string
  initialData?: DataType[]
}

const props = withDefaults(defineProps<Props>(), {
  title: '默认标题',
  initialData: () => []
})

const emit = defineEmits<{
  action: [data: DataType]
  update: [value: string]
}>()

// State
const loading = ref(false)
const error = ref('')
const data = ref<DataType[]>(props.initialData)

// Computed
const hasData = computed(() => data.value.length > 0)

// Methods
const handleAction = async () => {
  loading.value = true
  try {
    const result = await fetchData()
    emit('action', result)
  } catch (err) {
    error.value = err instanceof Error ? err.message : '未知错误'
  } finally {
    loading.value = false
  }
}

const clearError = () => {
  error.value = ''
}

// Lifecycle
onMounted(() => {
  // Initialize
})
</script>

<style scoped>
.component-name {
  padding: 16px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.loading-wrapper {
  padding: 20px;
}
</style>
```

### Pinia Store Template

```typescript
import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type { Entity } from '@/types'

export const useEntityStore = defineStore('entity', () => {
  // State
  const items = ref<Entity[]>([])
  const loading = ref(false)
  const error = ref('')
  
  // Getters (Computed)
  const allItems = computed(() => items.value)
  const activeItems = computed(() => items.value.filter(i => i.status === 'active'))
  const itemCount = computed(() => items.value.length)
  const hasItems = computed(() => items.value.length > 0)
  
  // Actions
  const setItems = (newItems: Entity[]) => {
    items.value = newItems
  }
  
  const addItem = (item: Entity) => {
    items.value.push(item)
  }
  
  const updateItem = (id: string, updates: Partial<Entity>) => {
    const index = items.value.findIndex(i => i.id === id)
    if (index !== -1) {
      items.value[index] = { ...items.value[index], ...updates }
    }
  }
  
  const removeItem = (id: string) => {
    items.value = items.value.filter(i => i.id !== id)
  }
  
  const clearError = () => {
    error.value = ''
  }
  
  // Async Actions
  const fetchItems = async () => {
    loading.value = true
    error.value = ''
    try {
      const response = await fetch('/api/items')
      const data = await response.json()
      items.value = data
    } catch (err) {
      error.value = err instanceof Error ? err.message : '获取失败'
    } finally {
      loading.value = false
    }
  }
  
  const createItem = async (itemData: Omit<Entity, 'id'>) => {
    loading.value = true
    try {
      const response = await fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(itemData)
      })
      const newItem = await response.json()
      addItem(newItem)
      return newItem
    } catch (err) {
      error.value = err instanceof Error ? err.message : '创建失败'
      throw err
    } finally {
      loading.value = false
    }
  }
  
  return {
    // State
    items,
    loading,
    error,
    // Getters
    allItems,
    activeItems,
    itemCount,
    hasItems,
    // Actions
    setItems,
    addItem,
    updateItem,
    removeItem,
    clearError,
    fetchItems,
    createItem
  }
})
```

### Composable Template

```typescript
import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { Ref } from 'vue'

export interface UseFeatureOptions {
  immediate?: boolean
  interval?: number
}

export interface UseFeatureReturn {
  data: Ref<DataType | null>
  loading: Ref<boolean>
  error: Ref<string>
  refresh: () => Promise<void>
}

export function useFeature(
  options: UseFeatureOptions = {}
): UseFeatureReturn {
  const { immediate = true, interval = 0 } = options
  
  const data = ref<DataType | null>(null)
  const loading = ref(false)
  const error = ref('')
  let timer: ReturnType<typeof setInterval> | null = null
  
  const fetchData = async () => {
    loading.value = true
    error.value = ''
    try {
      // Fetch logic
      data.value = await api.fetch()
    } catch (err) {
      error.value = err instanceof Error ? err.message : '请求失败'
    } finally {
      loading.value = false
    }
  }
  
  const refresh = async () => {
    await fetchData()
  }
  
  onMounted(() => {
    if (immediate) {
      fetchData()
    }
    if (interval > 0) {
      timer = setInterval(fetchData, interval)
    }
  })
  
  onUnmounted(() => {
    if (timer) {
      clearInterval(timer)
    }
  })
  
  return {
    data,
    loading,
    error,
    refresh
  }
}
```

### Nuxt 3 Page Template

```vue
<template>
  <div class="page-name">
    <div class="page-header">
      <div>
        <h1 class="page-title">页面标题</h1>
        <p class="page-subtitle">页面描述</p>
      </div>
      <div class="header-actions">
        <el-button @click="refresh">刷新</el-button>
        <el-button type="primary" @click="createNew">新建</el-button>
      </div>
    </div>
    
    <!-- Content -->
    <div v-if="pending" class="loading">
      <el-skeleton :rows="5" animated />
    </div>
    
    <div v-else-if="error" class="error">
      <el-alert :title="error.message" type="error" />
    </div>
    
    <div v-else class="content">
      <pre>{{ data }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'

definePageMeta({
  layout: 'default',
  middleware: ['auth']
})

useHead({
  title: '页面标题 - AgentHive',
  meta: [
    { name: 'description', content: '页面描述' }
  ]
})

const router = useRouter()

// Nuxt 3 useFetch
const { data, pending, error, refresh } = await useFetch('/api/data', {
  lazy: false,
  server: true
})

const createNew = () => {
  router.push('/new')
}
</script>

<style scoped>
.page-name {
  padding: 24px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
}

.page-title {
  margin: 0 0 8px 0;
  font-size: 24px;
  font-weight: 600;
}

.page-subtitle {
  margin: 0;
  color: var(--el-text-color-secondary);
}

.header-actions {
  display: flex;
  gap: 12px;
}
</style>
```

## Element Plus Patterns

### Form with Validation

```vue
<template>
  <el-form
    ref="formRef"
    :model="form"
    :rules="rules"
    label-width="100px"
    @submit.prevent="handleSubmit"
  >
    <el-form-item label="名称" prop="name">
      <el-input v-model="form.name" placeholder="请输入名称" />
    </el-form-item>
    
    <el-form-item label="邮箱" prop="email">
      <el-input v-model="form.email" type="email" />
    </el-form-item>
    
    <el-form-item label="状态" prop="status">
      <el-select v-model="form.status" placeholder="选择状态">
        <el-option label="激活" value="active" />
        <el-option label="禁用" value="disabled" />
      </el-select>
    </el-form-item>
    
    <el-form-item>
      <el-button type="primary" @click="handleSubmit" :loading="submitting">
        提交
      </el-button>
      <el-button @click="handleReset">重置</el-button>
    </el-form-item>
  </el-form>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'

const formRef = ref<FormInstance>()
const submitting = ref(false)

const form = reactive({
  name: '',
  email: '',
  status: 'active'
})

const rules: FormRules = {
  name: [
    { required: true, message: '请输入名称', trigger: 'blur' },
    { min: 2, max: 50, message: '长度 2-50 个字符', trigger: 'blur' }
  ],
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '邮箱格式不正确', trigger: 'blur' }
  ]
}

const handleSubmit = async () => {
  if (!formRef.value) return
  
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  
  submitting.value = true
  try {
    await submitForm(form)
    ElMessage.success('提交成功')
  } finally {
    submitting.value = false
  }
}

const handleReset = () => {
  formRef.value?.resetFields()
}
</script>
```

### Table with Pagination

```vue
<template>
  <el-table
    v-loading="loading"
    :data="paginatedData"
    stripe
    border
    @selection-change="handleSelectionChange"
  >
    <el-table-column type="selection" width="55" />
    <el-table-column prop="name" label="名称" min-width="150" />
    <el-table-column prop="status" label="状态" width="100">
      <template #default="{ row }">
        <el-tag :type="getStatusType(row.status)">
          {{ row.status }}
        </el-tag>
      </template>
    </el-table-column>
    <el-table-column label="操作" width="150" fixed="right">
      <template #default="{ row }">
        <el-button link type="primary" @click="edit(row)">编辑</el-button>
        <el-button link type="danger" @click="remove(row)">删除</el-button>
      </template>
    </el-table-column>
  </el-table>
  
  <el-pagination
    v-model:current-page="currentPage"
    v-model:page-size="pageSize"
    :total="total"
    :page-sizes="[10, 20, 50, 100]"
    layout="total, sizes, prev, pager, next"
    class="pagination"
  />
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

const props = defineProps<{
  data: any[]
  loading: boolean
}>()

const currentPage = ref(1)
const pageSize = ref(10)
const total = computed(() => props.data.length)

const paginatedData = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return props.data.slice(start, end)
})

const getStatusType = (status: string) => {
  const types: Record<string, string> = {
    active: 'success',
    pending: 'warning',
    disabled: 'info',
    error: 'danger'
  }
  return types[status] || 'info'
}

const handleSelectionChange = (selection: any[]) => {
  console.log('Selected:', selection)
}
</script>
```

### Dialog with Form

```vue
<template>
  <el-dialog
    v-model="visible"
    title="对话框标题"
    width="500px"
    :close-on-click-modal="false"
    destroy-on-close
  >
    <el-form :model="form" label-width="80px">
      <el-form-item label="名称">
        <el-input v-model="form.name" />
      </el-form-item>
    </el-form>
    
    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" @click="confirm" :loading="loading">
        确认
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { reactive, ref, watch } from 'vue'

interface Props {
  modelValue: boolean
  initialData?: any
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  confirm: [data: any]
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const loading = ref(false)
const form = reactive({
  name: ''
})

watch(() => props.initialData, (data) => {
  if (data) {
    form.name = data.name
  }
}, { immediate: true })

const confirm = async () => {
  loading.value = true
  try {
    emit('confirm', { ...form })
    visible.value = false
  } finally {
    loading.value = false
  }
}
</script>
```

## Vue Router Patterns

### Navigation

```typescript
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()

// Navigate
router.push('/path')
router.push({ name: 'route-name', params: { id: 1 } })
router.push({ path: '/path', query: { tab: 'settings' } })
router.replace('/path')  // No history entry
router.go(-1)  // Go back

// Current route
const id = route.params.id
const tab = route.query.tab
const currentPath = route.path

// Watch route changes
watch(() => route.params.id, (newId) => {
  // Handle param change
})
```

### Route Guard in Component

```vue
<script setup lang="ts">
import { onBeforeRouteLeave, onBeforeRouteUpdate } from 'vue-router'

onBeforeRouteLeave((to, from) => {
  const answer = window.confirm('确定要离开吗？未保存的更改将丢失。')
  if (!answer) return false
})

onBeforeRouteUpdate(async (to) => {
  // React to route update
  await fetchData(to.params.id)
})
</script>
```

## Common Composables

### useAsyncData

```typescript
import { ref, watchEffect } from 'vue'

export function useAsyncData<T>(
  fetcher: () => Promise<T>,
  immediate = true
) {
  const data = ref<T | null>(null)
  const loading = ref(false)
  const error = ref<Error | null>(null)
  
  const execute = async () => {
    loading.value = true
    error.value = null
    try {
      data.value = await fetcher()
    } catch (e) {
      error.value = e instanceof Error ? e : new Error(String(e))
    } finally {
      loading.value = false
    }
  }
  
  if (immediate) {
    execute()
  }
  
  return { data, loading, error, execute, refresh: execute }
}
```

### useLocalStorage

```typescript
import { ref, watch } from 'vue'

export function useLocalStorage<T>(key: string, defaultValue: T) {
  const stored = localStorage.getItem(key)
  const data = ref<T>(stored ? JSON.parse(stored) : defaultValue)
  
  watch(data, (newValue) => {
    localStorage.setItem(key, JSON.stringify(newValue))
  }, { deep: true })
  
  return data
}
```

### useDebounce

```typescript
import { ref, watch } from 'vue'

export function useDebounce<T>(value: Ref<T>, delay = 300) {
  const debouncedValue = ref(value.value)
  let timeout: ReturnType<typeof setTimeout>
  
  watch(value, (newValue) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => {
      debouncedValue.value = newValue
    }, delay)
  })
  
  return debouncedValue
}
```

## Best Practices

- Always use `<script setup lang="ts">` for new components
- Prefer `ref` for primitives, `reactive` for objects
- Use `computed` for derived state
- Extract reusable logic into composables
- Use Pinia for global state management
- Prefer Element Plus components over custom ones
- Use scoped CSS or CSS modules for styles

> ⚠️ **v0.9 批量模板** — 此 skill 为初始化时批量生成，非实战沉淀。内容可能不完整或存在编码损坏。执行相关 Ticket 后应逐步替换为实战验证版本。

# Pattern: Composition API + script setup

```vue
<script setup lang="ts">
import { ref, computed } from 'vue'

const props = defineProps<{
  userId: string
  initialData?: UserProfile
}>()

const emit = defineEmits<{
  update: [value: UserProfile]
  delete: [id: string]
}>()

const loading = ref(false)
const userName = computed(() => userStore.userInfo?.name ?? 'Guest')

async function handleSave() {
  loading.value = true
  await userStore.updateProfile(props.userId)
  emit('update', userStore.userInfo!)
  loading.value = false
}
</script>
```

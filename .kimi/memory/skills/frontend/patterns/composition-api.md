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

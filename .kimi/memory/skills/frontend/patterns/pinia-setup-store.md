# Pattern: Pinia Setup Store

```typescript
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useUserStore = defineStore('user', () => {
  const userInfo = ref<UserInfo | null>(null)
  const loading = ref(false)
  const isLoggedIn = computed(() => !!userInfo.value)

  async function loadUser(id: string) {
    loading.value = true
    userInfo.value = await fetchUser(id)
    loading.value = false
  }

  return { userInfo, loading, isLoggedIn, loadUser }
})

// 解构保持响应式
import { storeToRefs } from 'pinia'
const { userInfo, isLoggedIn } = storeToRefs(useUserStore())
const { loadUser } = useUserStore()  // actions 可直接解构
```

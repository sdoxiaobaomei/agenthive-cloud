> ⚠️ **v0.9 批量模板** — 此 skill 为初始化时批量生成，非实战沉淀。内容可能不完整或存在编码损坏。执行相关 Ticket 后应逐步替换为实战验证版本。

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

// 瑙ｆ瀯淇濇寔鍝嶅簲寮?
import { storeToRefs } from 'pinia'
const { userInfo, isLoggedIn } = storeToRefs(useUserStore())
const { loadUser } = useUserStore()  // actions 鍙洿鎺ヨВ鏋?
```

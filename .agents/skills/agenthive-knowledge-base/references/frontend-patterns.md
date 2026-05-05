# Reference: Frontend Patterns

> Quick reference for frontend development conventions.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Nuxt 3 (SSR) |
| UI | Vue 3 Composition API + `<script setup>` |
| Components | Element Plus |
| Styling | Tailwind CSS |
| State | Pinia (setup store pattern) |
| Icons | Element Plus icons |

---

## SSR Safety (CRITICAL)

Nuxt 3 runs code on both server and client. Any browser-only API will crash during SSR.

### ✅ Safe patterns

```vue
<script setup>
const isClient = ref(false)
onMounted(() => {
  isClient.value = true
  localStorage.setItem('key', 'value')  // OK here
})
</script>
```

```vue
<template>
  <ClientOnly>
    <BrowserOnlyComponent />
  </ClientOnly>
</template>
```

```typescript
if (import.meta.client) {
  // Client-only code
}
```

### ❌ Forbidden

```typescript
// NEVER at top level
const width = window.innerWidth
localStorage.getItem('key')
document.getElementById('app')
```

---

## Pinia Store Pattern

```typescript
// stores/example.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useExampleStore = defineStore('example', () => {
  // State
  const items = ref<any[]>([])
  const loading = ref(false)
  
  // Getters
  const count = computed(() => items.value.length)
  
  // Actions
  const fetchItems = async () => {
    loading.value = true
    try {
      items.value = await $fetch('/api/items')
    } finally {
      loading.value = false
    }
  }
  
  return { items, loading, count, fetchItems }
})
```

---

## Mock Data Policy

**Status**: Transitioning away from mocks.

| Module | Status | Action |
|--------|--------|--------|
| `useMockCredits` | ❌ Active | Replace with real API |
| `useMockTransactions` | ❌ Active | Replace with real API |
| `useMockRecharge` | ❌ Active | Replace with real API |
| `useMockWithdraw` | ❌ Active | Replace with real API |
| `useMockProducts` | ❌ Active | Replace with real API |
| `useMockSales` | ❌ Active | Replace with real API |

**Rule**: When backend API exists, frontend MUST call it. No fallback to mock data.

**ID Generation**: Frontend must use real UUIDs from backend. No `conv-${Date.now()}` or `msg-${Date.now()}` fallbacks.

---

## File Tree Loading

```typescript
// stores/file-tree.ts
async function loadFileTree(projectId: string | null) {
  if (!projectId) {
    // Demo mode: use defaultFileTree
    fileTree.value = defaultFileTree
    return
  }
  // Real mode: fetch from API
  fileTree.value = await $fetch(`/api/projects/${projectId}/files`)
}
```

---

## API Integration

Use Nuxt's `$fetch` for server-side compatible requests:

```typescript
const { data, error } = await useFetch('/api/projects')
// or
const result = await $fetch('/api/projects', { method: 'POST', body: projectData })
```

For BFF (server API routes in Nuxt):
```typescript
// server/api/projects.get.ts
export default defineEventHandler(async (event) => {
  return await $fetch(`${useRuntimeConfig().apiBaseUrl}/projects`, {
    headers: getProxyHeaders(event)
  })
})
```

---

## Component Naming

- Components: `PascalCase.vue` (e.g., `AgentTracker.vue`)
- Composables: `use` prefix (e.g., `useAgentTracker.ts`)
- Stores: `use` prefix + Store suffix (e.g., `useChatStore.ts`)

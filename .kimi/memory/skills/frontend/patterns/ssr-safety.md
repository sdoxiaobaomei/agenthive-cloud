# Pattern: SSR 安全

```vue
<script setup>
const isClient = ref(false)
const localData = ref('')

onMounted(() => {
  isClient.value = true
  localData.value = localStorage.getItem('key') ?? ''
})
</script>

<template>
  <ClientOnly>
    <BrowserOnlyComponent />
  </ClientOnly>
  <div v-if="isClient">{{ localData }}</div>
</template>
```

规则:
- 任何访问 window/document/localStorage 的代码必须在 onMounted 中或 import.meta.client 条件内
- 使用 <ClientOnly> 包裹浏览器专属组件

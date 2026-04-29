> ⚠️ **v0.9 批量模板** — 此 skill 为初始化时批量生成，非实战沉淀。内容可能不完整或存在编码损坏。执行相关 Ticket 后应逐步替换为实战验证版本。

# Pattern: SSR 瀹夊叏

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

瑙勫垯:
- 浠讳綍璁块棶 window/document/localStorage 鐨勪唬鐮佸繀椤诲湪 onMounted 涓垨 import.meta.client 鏉′欢鍐?
- 浣跨敤 <ClientOnly> 鍖呰９娴忚鍣ㄤ笓灞炵粍浠?

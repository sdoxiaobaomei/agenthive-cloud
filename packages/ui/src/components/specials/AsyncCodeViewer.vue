<template>
  <Suspense>
    <template #default>
      <component :is="CodeViewer" v-bind="$attrs" />
    </template>
    <template #fallback>
      <div class="flex items-center justify-center h-48 text-gray-400">
        <div class="w-8 h-8 border-2 border-gray-200 border-t-primary-500 rounded-full animate-spin mr-3" />
        加载编辑器中...
      </div>
    </template>
  </Suspense>
</template>

<script setup lang="ts">
import { defineAsyncComponent } from 'vue'

const CodeViewer = defineAsyncComponent(() => import('../organisms/CodeViewer.vue'))
</script>

<style scoped>
.border-t-primary-500 { border-top-color: #3b82f6; }
</style>

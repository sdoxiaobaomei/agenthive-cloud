<template>
  <div class="studio-toolbox flex flex-col gap-2 p-2 bg-white rounded-xl border border-gray-200 shadow-sm">
    <button
      v-for="tool in tools"
      :key="tool.id"
      class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
      :class="activeTool === tool.id ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-50'"
      @click="$emit('activate', tool.id)"
    >
      <span class="text-lg">{{ tool.icon }}</span>
      <span class="hidden lg:inline">{{ tool.label }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  activeTool?: string
}>()

defineEmits<{
  (e: 'activate', id: string): void
}>()

const tools = [
  { id: 'execution', label: '执行看板', icon: '📋' },
  { id: 'chat', label: '对话', icon: '💬' },
  { id: 'code', label: '代码', icon: '📝' },
  { id: 'terminal', label: '终端', icon: '🖥️' },
]
</script>

<style scoped>
.bg-primary-50 { background-color: #eff6ff; }
.text-primary-700 { color: #1d4ed8; }
</style>

<template>
  <slot v-if="!hasError" />
  <div v-else class="error-boundary p-8 text-center">
    <h3 class="mb-2 text-lg font-semibold text-gray-900">出错了</h3>
    <p class="mb-4 text-sm text-gray-500">{{ errorMessage }}</p>
    <button
      class="rounded-lg bg-primary-500 px-4 py-2 text-sm font-medium text-white hover:bg-primary-600"
      @click="reset"
    >
      重试
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, onErrorCaptured } from 'vue'

const hasError = ref(false)
const errorMessage = ref('')

onErrorCaptured((err) => {
  hasError.value = true
  errorMessage.value = err instanceof Error ? err.message : '未知错误'
  return false
})

function reset() {
  hasError.value = false
  errorMessage.value = ''
}
</script>

<style scoped>
.bg-primary-500 { background-color: #3b82f6; }
.bg-primary-600 { background-color: #2563eb; }
</style>

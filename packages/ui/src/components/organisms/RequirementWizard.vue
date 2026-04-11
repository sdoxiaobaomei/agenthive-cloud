<template>
  <div class="bg-white rounded-2xl border border-gray-200 p-5 h-full overflow-y-auto">
    <h3 class="font-semibold text-gray-900 mb-4 flex items-center gap-2">
      <span>📋</span> 需求建模助手
    </h3>
    <div v-if="step === 1" class="space-y-4">
      <p class="text-sm text-gray-600">输入您的原始需求，AI 将帮您扩展并建模。</p>
      <textarea
        v-model="requirement"
        rows="4"
        placeholder="例如：我想要一个个人博客网站..."
        class="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
      />
      <button
        :disabled="!requirement.trim() || loading"
        class="w-full py-2.5 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2"
        @click="expand"
      >
        <span v-if="loading" class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        <span>AI 扩展需求</span>
      </button>
    </div>
    <div v-else-if="step === 2" class="space-y-4">
      <div class="flex items-center gap-2 text-sm text-gray-500">
        <button class="hover:text-gray-700" @click="step = 1">← 返回</button>
        <span>|</span>
        <span>基于您的需求，我们识别了以下选项</span>
      </div>
      <div class="bg-amber-50 border border-amber-100 rounded-xl p-4">
        <div class="text-xs font-medium text-amber-700 mb-1">原始需求</div>
        <div class="text-sm text-amber-900">{{ requirement }}</div>
      </div>
      <button
        :disabled="selectedOptions.size === 0"
        class="w-full py-2.5 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold transition-all"
        @click="emitFeatures"
      >
        生成 Feature ({{ selectedOptions.size }})
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const step = ref(1)
const requirement = ref('')
const loading = ref(false)
const selectedOptions = ref<Set<number>>(new Set([0, 1, 2]))

const emit = defineEmits<{
  (e: 'export', data: { requirement: string; selected: number[] }): void
}>()

function expand() {
  loading.value = true
  setTimeout(() => {
    step.value = 2
    loading.value = false
  }, 800)
}

function emitFeatures() {
  emit('export', {
    requirement: requirement.value,
    selected: Array.from(selectedOptions.value),
  })
}
</script>

<style scoped>
.bg-primary-500 { background-color: #3b82f6; }
.bg-primary-600 { background-color: #2563eb; }
.focus\:ring-primary-500:focus { --tw-ring-color: #3b82f6; }
</style>

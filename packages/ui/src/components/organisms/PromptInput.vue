<template>
  <div class="prompt-input w-full max-w-2xl">
    <div class="relative flex items-end gap-2 p-2 bg-white rounded-2xl border border-gray-200 shadow-sm focus-within:ring-2 focus-within:ring-primary-300 focus-within:border-primary-400 transition-all">
      <textarea
        v-model="text"
        rows="1"
        class="flex-1 resize-none max-h-32 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 bg-transparent outline-none"
        placeholder="输入你的需求，例如：帮我做一个会员系统..."
        @input="autoResize"
        @keydown.enter.prevent="submit"
      />
      <button
        class="mb-0.5 px-4 py-2 bg-primary-500 text-white text-sm font-medium rounded-xl hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        :disabled="!text.trim()"
        @click="submit"
      >
        发送
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue'

const text = ref('')
const emit = defineEmits<{
  (e: 'submit', value: string): void
}>()

function autoResize(e: Event) {
  const target = e.target as HTMLTextAreaElement
  target.style.height = 'auto'
  target.style.height = Math.min(target.scrollHeight, 128) + 'px'
}

function submit() {
  const val = text.value.trim()
  if (!val) return
  emit('submit', val)
  text.value = ''
  nextTick(() => {
    const ta = document.querySelector('.prompt-input textarea') as HTMLTextAreaElement
    if (ta) ta.style.height = 'auto'
  })
}
</script>

<style scoped>
.bg-primary-500 { background-color: #3b82f6; }
.bg-primary-600 { background-color: #2563eb; }
.focus-within\:ring-primary-300:focus-within { --tw-ring-color: #93c5fd; }
.focus-within\:border-primary-400:focus-within { border-color: #60a5fa; }
</style>

<template>
  <div class="locked-panel p-6 text-center">
    <div class="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
      <span class="text-lg">🔒</span>
    </div>
    <h4 class="mb-1 text-sm font-semibold text-gray-900">{{ title }}</h4>
    <p class="mb-4 text-xs text-gray-500">{{ description }}</p>
    <button
      class="rounded-lg bg-primary-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-600 transition-colors"
      @click="$emit('cta')"
    >
      {{ ctaText }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  feature: string
  tier: string
}>()

defineEmits<{
  (e: 'cta'): void
}>()

const config = computed(() => {
  const map: Record<string, { title: string; description: string; cta: string }> = {
    terminal: {
      title: 'Terminal 已锁定',
      description: '升级到 Pro 即可在 Studio 中使用真实终端',
      cta: '升级解锁',
    },
    sprint: {
      title: 'Sprint 管理已锁定',
      description: 'Pro 用户可使用完整的 Sprint 规划功能',
      cta: '升级解锁',
    },
    default: {
      title: '功能已锁定',
      description: '登录或升级以解锁此功能',
      cta: '立即解锁',
    },
  }
  return map[props.feature] || map.default
})

const title = computed(() => config.value.title)
const description = computed(() => config.value.description)
const ctaText = computed(() => config.value.cta)
</script>

<style scoped>
.bg-primary-500 { background-color: #3b82f6; }
.bg-primary-600 { background-color: #2563eb; }
</style>

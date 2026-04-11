<template>
  <div
    class="shiba-avatar relative flex items-center justify-center rounded-full overflow-hidden"
    :style="{ width: size + 'px', height: size + 'px', backgroundColor: roleColor + '20' }"
  >
    <img
      v-if="shibaSrc"
      :src="shibaSrc"
      alt="agent avatar"
      class="w-full h-full object-cover"
    />
    <span v-else class="text-sm font-bold" :style="{ color: roleColor }">
      {{ fallbackLetter }}
    </span>
    <div
      v-if="status === 'working'"
      class="absolute -inset-0.5 rounded-full border-2 border-blue-500 animate-spin"
      style="clip-path: polygon(0 0, 100% 0, 100% 30%, 0 30%)"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

export type ShibaRole = 'tech_lead' | 'frontend_dev' | 'backend_dev' | 'qa_engineer' | 'orchestrator' | string

const props = withDefaults(defineProps<{
  role: ShibaRole
  status?: 'idle' | 'working'
  size?: number
}>(), {
  status: 'idle',
  size: 40,
})

const shibaSrc = computed(() => {
  const base = typeof window !== 'undefined' ? (window as any).__BASE_URL__ || '' : ''
  const map: Record<string, string> = {
    tech_lead: `${base}/avatars/shiba_tl.png`,
    frontend_dev: `${base}/avatars/shiba_fe.png`,
    backend_dev: `${base}/avatars/shiba_be.png`,
    qa_engineer: `${base}/avatars/shiba_qa.png`,
    orchestrator: `${base}/avatars/shiba_tl.png`,
  }
  return map[props.role] || ''
})

const roleColor = computed(() => {
  const map: Record<string, string> = {
    tech_lead: '#1890ff',
    frontend_dev: '#eb2f96',
    backend_dev: '#52c41a',
    qa_engineer: '#fa8c16',
    orchestrator: '#1890ff',
  }
  return map[props.role] || '#8c8c8c'
})

const fallbackLetter = computed(() => {
  const map: Record<string, string> = {
    tech_lead: '黄',
    frontend_dev: '花',
    backend_dev: '铁',
    qa_engineer: '镜',
    orchestrator: '黄',
  }
  return map[props.role] || props.role[0]?.toUpperCase() || '?'
})
</script>

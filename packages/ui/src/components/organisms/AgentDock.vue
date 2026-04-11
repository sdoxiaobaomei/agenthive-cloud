<template>
  <div class="agent-dock fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
    <div class="flex items-center gap-3 px-4 py-3 bg-white/90 backdrop-blur rounded-2xl shadow-lg border border-gray-200/60">
      <button
        v-for="member in shibaTeam"
        :key="member.role"
        class="group relative flex flex-col items-center gap-1 min-w-[48px]"
        @click="$emit('select', member.role)"
      >
        <ShibaAvatar
          :role="member.role"
          :size="40"
          :status="member.status"
          class="transition-transform group-hover:scale-110"
        />
        <span class="text-[10px] font-medium text-gray-600">{{ member.name }}</span>
        <span
          v-if="member.status === 'working'"
          class="absolute -top-1 -right-1 w-2.5 h-2.5 bg-blue-500 rounded-full border-2 border-white"
        />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import ShibaAvatar from '../atoms/ShibaAvatar.vue'

export interface DockMember {
  role: string
  name: string
  status: 'idle' | 'working'
}

const shibaTeam: DockMember[] = [
  { role: 'orchestrator', name: '阿黄', status: 'idle' },
  { role: 'frontend_dev', name: '小花', status: 'idle' },
  { role: 'backend_dev', name: '阿铁', status: 'idle' },
  { role: 'qa_engineer', name: '阿镜', status: 'idle' },
]

defineEmits<{
  (e: 'select', role: string): void
}>()
</script>

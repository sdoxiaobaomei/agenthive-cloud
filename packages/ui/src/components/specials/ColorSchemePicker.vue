<template>
  <div class="bg-white rounded-2xl border border-gray-200 p-5">
    <h3 class="font-semibold text-gray-900 mb-4 flex items-center gap-2">
      <span>🎨</span> 配色方案
    </h3>
    <div class="grid grid-cols-3 gap-2 mb-5">
      <button
        v-for="scheme in presetSchemes"
        :key="scheme.id"
        class="relative p-3 rounded-xl border-2 transition-all text-left"
        :class="modelValue === scheme.id ? 'border-primary-500 ring-2 ring-primary-500/20' : 'border-gray-100 hover:border-gray-200'"
        :style="{ backgroundColor: scheme.bg }"
        @click="select(scheme.id)"
      >
        <div class="text-xs font-medium mb-2" :style="{ color: scheme.text }">{{ scheme.name }}</div>
        <div class="flex gap-1">
          <div
            v-for="(color, i) in scheme.colors.slice(0, 5)"
            :key="i"
            class="w-4 h-4 rounded-full border border-white/20"
            :style="{ backgroundColor: color }"
          />
        </div>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

export interface ColorScheme {
  id: string
  name: string
  bg: string
  surface: string
  text: string
  border: string
  accent: string
  colors: string[]
}

const props = defineProps<{
  modelValue: string
  schemes: ColorScheme[]
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', id: string): void
}>()

const presetSchemes = computed(() => props.schemes)

function select(id: string) {
  emit('update:modelValue', id)
}
</script>

<style scoped>
.border-primary-500 { border-color: #3b82f6; }
.ring-primary-500\/20 { --tw-ring-color: rgb(59 130 246 / 0.2); }
</style>

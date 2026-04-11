<template>
  <Transition name="slide">
    <div
      v-if="modelValue"
      class="studio-drawer fixed right-0 top-16 bottom-0 w-full sm:w-[420px] lg:w-[480px] bg-white border-l border-gray-200 shadow-xl z-30 flex flex-col"
    >
      <div class="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div class="flex gap-2">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            class="px-3 py-1.5 text-sm font-medium rounded-lg transition-colors"
            :class="activeTab === tab.id ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-700'"
            @click="activeTab = tab.id"
          >
            {{ tab.label }}
          </button>
        </div>
        <button class="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500" @click="$emit('update:modelValue', false)">✕</button>
      </div>
      <div class="flex-1 overflow-hidden">
        <slot :active-tab="activeTab" />
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  modelValue: boolean
  defaultTab?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
}>()

const tabs = [
  { id: 'chat', label: 'Chat' },
  { id: 'code', label: 'Code' },
  { id: 'terminal', label: 'Terminal' },
]

const activeTab = ref(props.defaultTab || 'chat')

watch(() => props.defaultTab, (v) => {
  if (v) activeTab.value = v
})
</script>

<style scoped>
.slide-enter-active,
.slide-leave-active {
  transition: transform 0.25s ease;
}
.slide-enter-from,
.slide-leave-to {
  transform: translateX(100%);
}
</style>

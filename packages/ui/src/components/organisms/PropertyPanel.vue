<template>
  <div class="bg-white rounded-2xl border border-gray-200 p-5 h-full">
    <h3 class="font-semibold text-gray-900 mb-4 flex items-center gap-2">
      <span>🎛️</span> 属性面板
    </h3>
    <div v-if="component" class="space-y-5">
      <div>
        <label class="block text-xs font-medium text-gray-500 mb-1.5">组件名称</label>
        <input
          v-model="localName"
          class="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          @input="update('name', localName)"
        />
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-xs font-medium text-gray-500 mb-1.5">宽度 (px)</label>
          <input
            type="number"
            :value="component.width"
            class="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            @input="update('width', +($event.target as HTMLInputElement).value)"
          />
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-500 mb-1.5">高度 (px)</label>
          <input
            type="number"
            :value="component.height"
            class="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            @input="update('height', +($event.target as HTMLInputElement).value)"
          />
        </div>
      </div>
      <div class="pt-3 border-t border-gray-100 flex gap-2">
        <button
          class="flex-1 px-3 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-lg text-sm font-medium"
          @click="$emit('bringToFront')"
        >
          置顶
        </button>
        <button
          class="flex-1 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-sm font-medium"
          @click="$emit('delete')"
        >
          删除
        </button>
      </div>
    </div>
    <div v-else class="text-center py-12 text-gray-400">
      <div class="text-4xl mb-3">🖱️</div>
      <p class="text-sm">在画布上点击组件<br>以编辑属性</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

export interface CanvasComponent {
  id: string
  name: string
  width: number
  height: number
  x: number
  y: number
  color: string
  borderColor: string
  borderRadius: number
}

const props = defineProps<{
  component: CanvasComponent | null
}>()

const emit = defineEmits<{
  (e: 'update', id: string, updates: Partial<CanvasComponent>): void
  (e: 'delete'): void
  (e: 'bringToFront'): void
}>()

const localName = ref('')

watch(() => props.component, (comp) => {
  localName.value = comp?.name || ''
}, { immediate: true })

function update<K extends keyof CanvasComponent>(key: K, value: CanvasComponent[K]) {
  if (props.component) {
    emit('update', props.component.id, { [key]: value } as Partial<CanvasComponent>)
  }
}
</script>

<style scoped>
.focus\:ring-primary-500:focus { --tw-ring-color: #3b82f6; }
</style>

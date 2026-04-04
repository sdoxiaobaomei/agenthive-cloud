<template>
  <div class="bg-white rounded-2xl border border-gray-200 p-5 h-full">
    <h3 class="font-semibold text-gray-900 mb-4 flex items-center gap-2">
      <span>🎛️</span> 属性面板
    </h3>
    
    <div v-if="component" class="space-y-5">
      <!-- Name -->
      <div>
        <label class="block text-xs font-medium text-gray-500 mb-1.5">组件名称</label>
        <input
          v-model="localName"
          @input="update('name', localName)"
          class="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>
      
      <!-- Dimensions -->
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-xs font-medium text-gray-500 mb-1.5">宽度 (px)</label>
          <input
            type="number"
            :value="component.width"
            @input="update('width', +($event.target as HTMLInputElement).value)"
            class="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-500 mb-1.5">高度 (px)</label>
          <input
            type="number"
            :value="component.height"
            @input="update('height', +($event.target as HTMLInputElement).value)"
            class="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-500 mb-1.5">X 坐标</label>
          <input
            type="number"
            :value="Math.round(component.x)"
            @input="update('x', +($event.target as HTMLInputElement).value)"
            class="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-500 mb-1.5">Y 坐标</label>
          <input
            type="number"
            :value="Math.round(component.y)"
            @input="update('y', +($event.target as HTMLInputElement).value)"
            class="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>
      
      <!-- Border Radius -->
      <div>
        <label class="block text-xs font-medium text-gray-500 mb-1.5">圆角 (px)</label>
        <input
          type="range"
          min="0"
          max="50"
          :value="component.borderRadius"
          @input="update('borderRadius', +($event.target as HTMLInputElement).value)"
          class="w-full accent-primary-500"
        />
        <div class="text-right text-xs text-gray-400 mt-1">{{ component.borderRadius }}px</div>
      </div>
      
      <!-- Colors -->
      <div class="space-y-3">
        <div>
          <label class="block text-xs font-medium text-gray-500 mb-1.5">填充颜色</label>
          <div class="flex items-center gap-2">
            <input
              type="color"
              :value="component.color"
              @input="update('color', ($event.target as HTMLInputElement).value)"
              class="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer"
            />
            <input
              :value="component.color"
              @input="update('color', ($event.target as HTMLInputElement).value)"
              class="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-500 mb-1.5">边框颜色</label>
          <div class="flex items-center gap-2">
            <input
              type="color"
              :value="component.borderColor"
              @input="update('borderColor', ($event.target as HTMLInputElement).value)"
              class="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer"
            />
            <input
              :value="component.borderColor"
              @input="update('borderColor', ($event.target as HTMLInputElement).value)"
              class="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>
      </div>
      
      <!-- Actions -->
      <div class="pt-3 border-t border-gray-100 flex gap-2">
        <button
          @click="emit('bringToFront')"
          class="flex-1 px-3 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-lg text-sm font-medium transition-colors"
        >
          置顶
        </button>
        <button
          @click="emit('delete')"
          class="flex-1 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-sm font-medium transition-colors"
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
import type { CanvasComponent } from '~/composables/useCanvasBuilder'

const props = defineProps<{
  component: CanvasComponent | null
}>()

const emit = defineEmits<{
  update: [id: string, updates: Partial<CanvasComponent>]
  delete: []
  bringToFront: []
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

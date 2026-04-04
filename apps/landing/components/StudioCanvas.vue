<template>
  <div class="relative rounded-2xl overflow-hidden border-2 border-dashed transition-colors"
    :class="isDragging ? 'border-primary-500 bg-primary-50/30' : 'border-gray-200 bg-white'"
  >
    <canvas
      ref="canvasRef"
      :width="width"
      :height="height"
      class="cursor-crosshair block"
      @mousedown="onMouseDown"
      @mousemove="onMouseMove"
      @mouseup="onMouseUp"
      @mouseleave="onMouseUp"
    />
    
    <!-- Floating toolbar -->
    <div class="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-white/95 backdrop-blur px-4 py-2 rounded-xl shadow-lg border border-gray-100">
      <button
        v-for="tool in tools"
        :key="tool.type"
        @click="builder.addComponent(tool.type)"
        class="flex flex-col items-center gap-1 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors text-xs text-gray-600"
        :title="tool.label"
      >
        <span class="text-lg">{{ tool.icon }}</span>
        <span>{{ tool.label }}</span>
      </button>
      <div class="w-px h-8 bg-gray-200 mx-1" />
      <button
        @click="emit('delete')"
        :disabled="!builder.selectedComponent.value"
        class="flex flex-col items-center gap-1 px-3 py-2 rounded-lg hover:bg-red-50 text-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-xs"
      >
        <span class="text-lg">🗑️</span>
        <span>删除</span>
      </button>
    </div>
    
    <!-- Component count -->
    <div class="absolute top-3 left-3 text-xs text-gray-400 bg-white/80 px-2 py-1 rounded-md">
      {{ builder.components.value.length }} 个组件
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useCanvasBuilder } from '~/composables/useCanvasBuilder'

const props = defineProps<{
  width: number
  height: number
}>()

const emit = defineEmits<{
  select: [component: ReturnType<typeof useCanvasBuilder>['selectedComponent']['value']]
  delete: []
}>()

const canvasRef = ref<HTMLCanvasElement>()
const builder = useCanvasBuilder()

const tools = [
  { type: 'rect' as const, icon: '▭', label: '矩形' },
  { type: 'circle' as const, icon: '●', label: '圆形' },
  { type: 'card' as const, icon: '🃏', label: '卡片' },
  { type: 'button' as const, icon: '🔘', label: '按钮' },
  { type: 'input' as const, icon: '▭', label: '输入框' },
]

function onMouseDown(e: MouseEvent) {
  if (!canvasRef.value) return
  builder.handleMouseDown(e, canvasRef.value)
  emit('select', builder.selectedComponent.value)
}

function onMouseMove(e: MouseEvent) {
  if (!canvasRef.value) return
  builder.handleMouseMove(e, canvasRef.value)
}

function onMouseUp() {
  builder.handleMouseUp()
}

function render() {
  if (!canvasRef.value) return
  const ctx = canvasRef.value.getContext('2d')
  if (ctx) builder.draw(ctx)
}

let rafId: number
function loop() {
  render()
  rafId = requestAnimationFrame(loop)
}

onMounted(() => {
  loop()
})

onUnmounted(() => {
  cancelAnimationFrame(rafId)
})

watch(() => builder.components.value, () => {
  // reactive redraw handled by loop
}, { deep: true })

defineExpose({ builder })
</script>

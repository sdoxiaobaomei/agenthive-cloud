<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Studio Header -->
    <header class="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div class="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between h-16">
          <div class="flex items-center gap-4">
            <NuxtLink to="/" class="flex items-center gap-2 text-gray-900 hover:text-primary-600 transition-colors">
              <span class="text-xl font-bold bg-gradient-to-r from-primary-500 to-primary-700 bg-clip-text text-transparent">
                AgentHive
              </span>
            </NuxtLink>
            <span class="text-gray-300">|</span>
            <h1 class="text-lg font-semibold text-gray-900">AI Studio</h1>
          </div>
          
          <div class="flex items-center gap-3">
            <!-- Shiba team mini -->
            <div class="hidden md:flex items-center gap-2 mr-2">
              <div
                v-for="(member, idx) in shibaTeam"
                :key="member.role"
                class="shiba-mini"
                :style="{ zIndex: 10 - idx }"
                :title="member.name"
              >
                <img :src="member.src" :alt="member.name" />
              </div>
            </div>

            <!-- Agent tracker toggle -->
            <button
              @click="toggleTracker"
              class="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all"
              :class="showTracker ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/25' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'"
            >
              <span class="relative flex h-2 w-2">
                <span v-if="isTracking" class="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75" />
                <span class="relative inline-flex rounded-full h-2 w-2 bg-current" />
              </span>
              {{ showTracker ? '隐藏监控' : '追踪 Agent' }}
            </button>
            
            <button
              @click="showWizard = !showWizard"
              class="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium transition-colors"
            >
              📋 需求
            </button>
          </div>
        </div>
      </div>
    </header>
    
    <!-- Main workspace -->
    <main class="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-7rem)]">
        <!-- Left sidebar: Properties & Colors -->
        <div class="lg:col-span-3 flex flex-col gap-4 overflow-y-auto">
          <PropertyPanel
            :component="selectedComponent"
            @update="onUpdateComponent"
            @delete="onDeleteComponent"
            @bring-to-front="onBringToFront"
          />
          <ColorSchemePicker />
        </div>
        
        <!-- Center: Canvas preview -->
        <div class="lg:col-span-6 flex flex-col gap-4">
          <!-- Shiba team card -->
          <div class="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl border border-amber-100 p-4">
            <div class="flex items-center justify-between mb-3">
              <h3 class="font-semibold text-gray-900 flex items-center gap-2">
                <span>🐕</span>
                <span>柴犬装修队</span>
              </h3>
              <span class="text-xs text-gray-500">您的专属 Agent 团队</span>
            </div>
            <div class="flex justify-center gap-6 sm:gap-10">
              <div
                v-for="member in shibaTeam"
                :key="member.role"
                class="flex flex-col items-center gap-2 cursor-pointer hover:-translate-y-1 transition-transform"
              >
                <div class="w-16 h-16 rounded-full overflow-hidden border-2 border-white shadow-md">
                  <img :src="member.src" :alt="member.name" class="w-full h-full object-cover" />
                </div>
                <div class="text-sm font-medium text-gray-800">{{ member.name }}</div>
                <span class="text-[10px] px-2 py-0.5 rounded-full bg-white/80 text-gray-600 border border-amber-100">
                  {{ member.label }}
                </span>
              </div>
            </div>
          </div>

          <div class="bg-white rounded-2xl border border-gray-200 p-4 flex-1 flex flex-col">
            <div class="flex items-center justify-between mb-3">
              <h2 class="font-semibold text-gray-900 flex items-center gap-2">
                <span>🎨</span> 可视化画布
              </h2>
              <div class="flex items-center gap-2">
                <span class="text-xs text-gray-400">支持拖拽移动、点击选中</span>
                <button
                  @click="clearCanvas"
                  class="text-xs text-red-600 hover:text-red-700 font-medium px-2 py-1 rounded hover:bg-red-50 transition-colors"
                >
                  清空画布
                </button>
              </div>
            </div>
            <div class="flex-1 min-h-0">
              <StudioCanvas
                ref="canvasRef"
                :width="canvasWidth"
                :height="canvasHeight"
                @select="selectedComponent = $event"
                @delete="onDeleteComponent"
              />
            </div>
          </div>
          
          <DeployPipeline />
        </div>
        
        <!-- Right sidebar: Wizard & Tracker -->
        <div class="lg:col-span-3 flex flex-col gap-4 overflow-y-auto">
          <!-- Requirement wizard -->
          <div v-if="showWizard" class="flex-1 min-h-[300px]">
            <RequirementWizard @export="onExportFeatures" />
          </div>
          
          <!-- Placeholder when wizard hidden -->
          <div v-else class="bg-white rounded-2xl border border-gray-200 p-8 text-center">
            <div class="text-4xl mb-3">📋</div>
            <p class="text-sm text-gray-500 mb-4">使用需求建模助手<br>将想法转化为可执行的任务</p>
            <button
              @click="showWizard = true"
              class="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-sm font-medium transition-colors"
            >
              打开需求助手
            </button>
          </div>
          
          <!-- Quick tips -->
          <div class="bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl p-5 text-white">
            <h4 class="font-semibold mb-2">💡 小贴士</h4>
            <ul class="text-sm space-y-1.5 opacity-90">
              <li>• 在画布上点击组件即可编辑属性</li>
              <li>• 拖拽组件可调整位置</li>
              <li>• 配色方案支持自定义调色盘</li>
              <li>• 点击"追踪 Agent"查看实时工作</li>
            </ul>
          </div>
        </div>
      </div>
    </main>
    
    <!-- Floating agent tracker panel -->
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="translate-y-full opacity-0"
      enter-to-class="translate-y-0 opacity-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="translate-y-0 opacity-100"
      leave-to-class="translate-y-full opacity-0"
    >
      <div
        v-if="showTracker"
        class="fixed bottom-4 left-4 right-4 lg:left-[calc(25%+1rem)] lg:right-[calc(25%+1rem)] h-[420px] z-40 shadow-2xl"
      >
        <AgentTracker @close="showTracker = false" />
      </div>
    </Transition>
    
    <!-- Toast notification -->
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="translate-y-2 opacity-0"
      enter-to-class="translate-y-0 opacity-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="translate-y-0 opacity-100"
      leave-to-class="translate-y-2 opacity-0"
    >
      <div
        v-if="toast.visible"
        class="fixed top-20 right-6 z-50 bg-gray-900 text-white px-4 py-3 rounded-xl shadow-xl text-sm font-medium"
      >
        {{ toast.message }}
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import StudioCanvas from '~/components/StudioCanvas.vue'
import PropertyPanel from '~/components/PropertyPanel.vue'
import ColorSchemePicker from '~/components/ColorSchemePicker.vue'
import AgentTracker from '~/components/AgentTracker.vue'
import RequirementWizard from '~/components/RequirementWizard.vue'
import DeployPipeline from '~/components/DeployPipeline.vue'
import { useAgentTracker as useAgentTrackerComposable } from '~/composables/useAgentTracker'
import type { CanvasComponent } from '~/composables/useCanvasBuilder'

useSeoMeta({
  title: 'AI Studio - 可视化构建与监控',
  description: 'AgentHive AI Studio 提供可视化画布、实时 Agent 监控、需求建模和一键部署能力。',
})

const canvasRef = ref<InstanceType<typeof StudioCanvas>>()
const selectedComponent = ref<CanvasComponent | null>(null)
const showTracker = ref(false)
const showWizard = ref(true)
const canvasWidth = ref(600)
const canvasHeight = ref(400)

const shibaTeam = [
  { role: 'tech_lead', name: '阿黄', label: '技术负责人', src: '/avatars/shiba_tl.png' },
  { role: 'frontend_dev', name: '小花', label: '前端开发', src: '/avatars/shiba_fe.png' },
  { role: 'backend_dev', name: '阿铁', label: '后端开发', src: '/avatars/shiba_be.png' },
  { role: 'qa_engineer', name: '阿镜', label: '质量保障', src: '/avatars/shiba_qa.png' },
]

const agentTracker = useAgentTrackerComposable()
const isTracking = computed(() => agentTracker.isTracking.value)

const toast = ref({ visible: false, message: '' })

function showToast(message: string) {
  toast.value = { visible: true, message }
  setTimeout(() => toast.value.visible = false, 3000)
}

function toggleTracker() {
  showTracker.value = !showTracker.value
}

function onUpdateComponent(id: string, updates: Partial<CanvasComponent>) {
  canvasRef.value?.builder.updateComponent(id, updates)
}

function onDeleteComponent() {
  if (selectedComponent.value) {
    canvasRef.value?.builder.deleteComponent(selectedComponent.value.id)
    selectedComponent.value = null
    showToast('组件已删除')
  }
}

function onBringToFront() {
  if (selectedComponent.value) {
    canvasRef.value?.builder.bringToFront(selectedComponent.value.id)
    showToast('组件已置顶')
  }
}

function clearCanvas() {
  const ids = canvasRef.value?.builder.components.value.map(c => c.id) || []
  ids.forEach(id => canvasRef.value?.builder.deleteComponent(id))
  selectedComponent.value = null
  showToast('画布已清空')
}

function onExportFeatures(features: any[]) {
  showToast(`已导出 ${features.length} 个 Feature 到 Sprint 看板`)
}

// Responsive canvas size
function updateCanvasSize() {
  const container = canvasRef.value?.$el
  if (container) {
    const rect = container.getBoundingClientRect()
    canvasWidth.value = Math.max(600, Math.floor(rect.width - 32))
    canvasHeight.value = Math.max(400, Math.floor(rect.height - 32))
  }
}

onMounted(() => {
  updateCanvasSize()
  window.addEventListener('resize', updateCanvasSize)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateCanvasSize)
})
</script>

<style>
/* Custom scrollbar for the studio */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: #d1d5db;
  border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover {
  background: #9ca3af;
}

.shiba-mini {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  overflow: hidden;
  border: 2px solid white;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  margin-left: -10px;
  transition: transform 0.2s ease;
}

.shiba-mini:first-child {
  margin-left: 0;
}

.shiba-mini:hover {
  transform: scale(1.15);
  z-index: 20 !important;
}

.shiba-mini img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>

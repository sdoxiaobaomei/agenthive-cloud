<template>
  <div class="bg-gray-900 rounded-2xl overflow-hidden border border-gray-800 flex flex-col h-full">
    <!-- Header -->
    <div class="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-gray-900/95 backdrop-blur">
      <div class="flex items-center gap-3">
        <div class="w-2 h-2 rounded-full animate-pulse"
          :class="isTracking ? 'bg-green-500' : 'bg-gray-500'"
        />
        <h3 class="font-semibold text-gray-100 text-sm">Agent 实时监控</h3>
      </div>
      <div class="flex items-center gap-2">
        <button
          @click="isTracking = !isTracking"
          class="px-2 py-1 rounded-md text-xs font-medium transition-colors"
          :class="isTracking ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'"
        >
          {{ isTracking ? '追踪中' : '已暂停' }}
        </button>
        <button
          @click="emit('close')"
          class="p-1 hover:bg-gray-800 rounded-md text-gray-400 transition-colors"
        >
          ✕
        </button>
      </div>
    </div>
    
    <!-- Agent tabs -->
    <div class="flex border-b border-gray-800 overflow-x-auto">
      <button
        v-for="task in tasks"
        :key="task.id"
        @click="setActiveTask(task.id)"
        class="flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap"
        :class="activeTaskId === task.id ? 'border-primary-500 text-primary-400 bg-gray-800/50' : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-gray-800/30'"
      >
        <span class="w-1.5 h-1.5 rounded-full"
          :class="statusDotColor(task.status)"
        />
        {{ task.name }}
        <span class="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-800 text-gray-400">
          {{ statusLabels[task.status] }}
        </span>
      </button>
    </div>
    
    <!-- Content -->
    <div class="flex-1 flex overflow-hidden">
      <!-- Log stream -->
      <div class="flex-1 flex flex-col min-w-0">
        <!-- Progress bar -->
        <div class="px-4 py-2 border-b border-gray-800 bg-gray-900">
          <div class="flex items-center justify-between text-xs mb-1.5">
            <span class="text-gray-400">{{ activeTask.name }} - {{ statusLabels[activeTask.status] }}</span>
            <span class="text-primary-400 font-medium">{{ activeTask.progress }}%</span>
          </div>
          <div class="h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div
              class="h-full bg-gradient-to-r from-primary-500 to-primary-400 rounded-full transition-all duration-500"
              :style="{ width: activeTask.progress + '%' }"
            />
          </div>
        </div>
        
        <!-- Logs -->
        <div ref="logsRef" class="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-xs">
          <div
            v-for="log in activeLogs"
            :key="log.id"
            class="animate-fade-in"
          >
            <!-- System log -->
            <div v-if="log.type === 'system'" class="text-purple-400">
              <span class="text-gray-500">[{{ formatTime(log.timestamp) }}]</span>
              <span class="ml-2">⚙️ {{ log.content }}</span>
            </div>
            
            <!-- Terminal stdout -->
            <div v-else-if="log.type === 'stdout'" class="text-gray-300">
              <span class="text-gray-500">[{{ formatTime(log.timestamp) }}]</span>
              <span class="ml-2 text-green-500">➜</span>
              <span class="ml-2">{{ log.content }}</span>
            </div>
            
            <!-- Terminal stderr -->
            <div v-else-if="log.type === 'stderr'" class="text-red-400">
              <span class="text-gray-500">[{{ formatTime(log.timestamp) }}]</span>
              <span class="ml-2">✖ {{ log.content }}</span>
            </div>
            
            <!-- Thinking -->
            <div v-else-if="log.type === 'thinking'" class="text-amber-300/90 italic">
              <span class="text-gray-500">[{{ formatTime(log.timestamp) }}]</span>
              <span class="ml-2">💭 "{{ log.content }}"</span>
            </div>
            
            <!-- File operation -->
            <div v-else-if="log.type === 'file'" class="text-blue-300">
              <span class="text-gray-500">[{{ formatTime(log.timestamp) }}]</span>
              <span class="ml-2">{{ log.meta?.action === 'create' ? '➕' : '✏️' }} {{ log.content }}</span>
            </div>
            
            <!-- Code -->
            <div v-else-if="log.type === 'code'" class="mt-2">
              <div class="flex items-center gap-2 mb-1">
                <span class="text-gray-500">[{{ formatTime(log.timestamp) }}]</span>
                <span class="text-cyan-400 text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/10">{{ log.meta?.language || 'code' }}</span>
              </div>
              <pre class="bg-gray-950 border border-gray-800 rounded-lg p-3 overflow-x-auto text-[11px] leading-relaxed text-gray-300"><code>{{ log.content }}</code></pre>
            </div>
          </div>
          
          <!-- Typing indicator -->
          <div v-if="isTracking && activeTask.status !== 'completed'" class="flex items-center gap-2 text-gray-500 pt-2">
            <span class="w-1.5 h-1.5 rounded-full bg-primary-500 animate-bounce" />
            <span class="w-1.5 h-1.5 rounded-full bg-primary-500 animate-bounce [animation-delay:0.2s]" />
            <span class="w-1.5 h-1.5 rounded-full bg-primary-500 animate-bounce [animation-delay:0.4s]" />
            <span class="text-[10px]">Agent 正在工作...</span>
          </div>
        </div>
      </div>
      
      <!-- Mini visualizations -->
      <div class="w-48 border-l border-gray-800 bg-gray-900/50 p-3 space-y-4 hidden lg:block">
        <!-- Current file -->
        <div v-if="activeTask.currentFile" class="text-xs">
          <div class="text-gray-500 mb-1.5">当前文件</div>
          <div class="bg-gray-800 rounded-lg p-2 text-cyan-300 font-mono truncate border border-gray-700">
            {{ activeTask.currentFile }}
          </div>
        </div>
        
        <!-- Mini code editor visualization -->
        <div class="rounded-lg overflow-hidden border border-gray-700 bg-gray-950">
          <div class="flex items-center gap-1 px-2 py-1.5 bg-gray-800 border-b border-gray-700">
            <div class="w-2 h-2 rounded-full bg-red-500/80" />
            <div class="w-2 h-2 rounded-full bg-amber-500/80" />
            <div class="w-2 h-2 rounded-full bg-green-500/80" />
          </div>
          <div class="p-2 space-y-1">
            <div class="h-1 bg-gray-700 rounded w-full animate-pulse" />
            <div class="h-1 bg-primary-500/60 rounded w-3/4" />
            <div class="h-1 bg-gray-700 rounded w-5/6" />
            <div class="h-1 bg-gray-700 rounded w-2/3" />
            <div class="h-1 bg-green-500/60 rounded w-1/2" />
          </div>
        </div>
        
        <!-- Stats -->
        <div class="space-y-2">
          <div class="text-xs text-gray-500">运行统计</div>
          <div class="grid grid-cols-2 gap-2">
            <div class="bg-gray-800 rounded-lg p-2 text-center">
              <div class="text-lg font-semibold text-gray-200">{{ activeLogs.filter(l => l.type === 'file').length }}</div>
              <div class="text-[10px] text-gray-500">文件变更</div>
            </div>
            <div class="bg-gray-800 rounded-lg p-2 text-center">
              <div class="text-lg font-semibold text-gray-200">{{ activeLogs.filter(l => l.type === 'code').length }}</div>
              <div class="text-[10px] text-gray-500">代码片段</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { useAgentTracker } from '~/composables/useAgentTracker'

const tracker = useAgentTracker()
const { tasks, activeTaskId, activeTask, activeLogs, isTracking, statusLabels, setActiveTask } = tracker

const logsRef = ref<HTMLElement>()
const emit = defineEmits<{ close: [] }>()

// Auto-scroll logs
watch(() => activeLogs.value.length, async () => {
  await nextTick()
  if (logsRef.value) {
    logsRef.value.scrollTop = logsRef.value.scrollHeight
  }
})

// Simulate activity
let interval: ReturnType<typeof setInterval>
onMounted(() => {
  interval = setInterval(() => tracker.simulateActivity(), 2500)
})
onUnmounted(() => {
  clearInterval(interval)
})

function formatTime(date: Date) {
  return date.toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function statusDotColor(status: string) {
  const map: Record<string, string> = {
    idle: 'bg-gray-500',
    thinking: 'bg-amber-400 animate-pulse',
    coding: 'bg-blue-400 animate-pulse',
    testing: 'bg-purple-400 animate-pulse',
    reviewing: 'bg-cyan-400 animate-pulse',
    deploying: 'bg-orange-400 animate-pulse',
    completed: 'bg-green-500',
    error: 'bg-red-500',
  }
  return map[status] || 'bg-gray-500'
}
</script>

<style scoped>
.animate-fade-in {
  animation: fadeIn 0.2s ease-out;
}
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>

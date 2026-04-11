<template>
  <div class="bg-white rounded-2xl border border-gray-200 p-5">
    <div class="flex items-center justify-between mb-4">
      <h3 class="font-semibold text-gray-900 flex items-center gap-2">
        <span>🚀</span> 自动部署通道
      </h3>
      <button
        @click="startDeploy"
        :disabled="isDeploying"
        class="px-4 py-1.5 bg-green-500 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-all flex items-center gap-2"
      >
        <span v-if="isDeploying" class="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        <span>{{ isDeploying ? '部署中...' : '一键部署' }}</span>
      </button>
    </div>
    
    <!-- Pipeline visualization -->
    <div class="relative">
      <div class="flex items-center justify-between gap-2">
        <div
          v-for="(stage, i) in stages"
          :key="stage.id"
          class="flex-1 relative"
        >
          <!-- Connector -->
          <div
            v-if="i > 0"
            class="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-full h-1 -z-10"
            :class="stage.status === 'pending' ? 'bg-gray-100' : 'bg-green-100'"
          >
            <div
              class="h-full bg-green-500 transition-all duration-700"
              :style="{ width: connectorWidth(i) }"
            />
          </div>
          
          <!-- Stage node -->
          <div
            class="flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all"
            :class="nodeClasses(stage.status)"
          >
            <div class="w-10 h-10 rounded-full flex items-center justify-center text-lg transition-all"
              :class="iconClasses(stage.status)"
            >
              <span v-if="stage.status === 'running'" class="animate-spin">↻</span>
              <span v-else-if="stage.status === 'completed'">✓</span>
              <span v-else-if="stage.status === 'error'">✕</span>
              <span v-else>{{ stage.icon }}</span>
            </div>
            <div class="text-xs font-medium text-center">{{ stage.name }}</div>
            <div class="text-[10px] text-gray-400 text-center">{{ stageStatusText(stage) }}</div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Deploy log -->
    <div v-if="deployLogs.length > 0" class="mt-4 bg-gray-900 rounded-xl p-3 font-mono text-xs text-gray-300 max-h-40 overflow-y-auto space-y-1">
      <div
        v-for="log in deployLogs"
        :key="log.id"
        class="animate-fade-in"
      >
        <span class="text-gray-500">[{{ log.time }}]</span>
        <span :class="log.type === 'error' ? 'text-red-400' : log.type === 'success' ? 'text-green-400' : 'text-gray-300'" class="ml-2">
          {{ log.message }}
        </span>
      </div>
    </div>
    
    <!-- Deploy result -->
    <div v-if="deployUrl" class="mt-4 p-3 bg-green-50 border border-green-100 rounded-xl flex items-center justify-between">
      <div>
        <div class="text-sm font-medium text-green-800">部署成功！</div>
        <a :href="deployUrl" target="_blank" class="text-xs text-green-600 hover:underline break-all">{{ deployUrl }}</a>
      </div>
      <button class="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-medium rounded-lg transition-colors">
        访问站点
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

type StageStatus = 'pending' | 'running' | 'completed' | 'error'

interface Stage {
  id: string
  name: string
  icon: string
  status: StageStatus
  duration?: number
}

interface DeployLog {
  id: string
  time: string
  type: 'info' | 'success' | 'error'
  message: string
}

const stages = ref<Stage[]>([
  { id: 'build', name: '构建', icon: '🔨', status: 'pending' },
  { id: 'test', name: '测试', icon: '✓', status: 'pending' },
  { id: 'package', name: '打包', icon: '📦', status: 'pending' },
  { id: 'deploy', name: '部署', icon: '🚀', status: 'pending' },
])

const deployLogs = ref<DeployLog[]>([])
const isDeploying = ref(false)
const deployUrl = ref('')

function connectorWidth(index: number) {
  const stage = stages.value[index]
  if (stage.status === 'completed') return '100%'
  if (stage.status === 'running') return '50%'
  return '0%'
}

function nodeClasses(status: StageStatus) {
  switch (status) {
    case 'running': return 'border-primary-500 bg-primary-50 animate-pulse'
    case 'completed': return 'border-green-500 bg-green-50'
    case 'error': return 'border-red-500 bg-red-50'
    default: return 'border-gray-100 bg-gray-50'
  }
}

function iconClasses(status: StageStatus) {
  switch (status) {
    case 'running': return 'bg-primary-500 text-white'
    case 'completed': return 'bg-green-500 text-white'
    case 'error': return 'bg-red-500 text-white'
    default: return 'bg-gray-200 text-gray-500'
  }
}

function stageStatusText(stage: Stage) {
  switch (stage.status) {
    case 'running': return '进行中'
    case 'completed': return stage.duration ? `${stage.duration}s` : '完成'
    case 'error': return '失败'
    default: return '等待中'
  }
}

function addLog(type: DeployLog['type'], message: string) {
  deployLogs.value.push({
    id: `${Date.now()}-${Math.random()}`,
    time: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
    type,
    message,
  })
}

async function startDeploy() {
  if (isDeploying.value) return
  
  isDeploying.value = true
  deployUrl.value = ''
  deployLogs.value = []
  stages.value.forEach(s => s.status = 'pending')
  
  const steps = [
    { stage: 'build', logs: [
      { type: 'info' as const, message: '开始构建项目...' },
      { type: 'info' as const, message: '解析依赖树...' },
      { type: 'info' as const, message: '编译 TypeScript 组件...' },
      { type: 'success' as const, message: '构建完成，输出到 .output/' },
    ]},
    { stage: 'test', logs: [
      { type: 'info' as const, message: '运行单元测试...' },
      { type: 'info' as const, message: '运行 E2E 测试...' },
      { type: 'success' as const, message: '所有测试通过 (42/42)' },
    ]},
    { stage: 'package', logs: [
      { type: 'info' as const, message: '生成 Docker 镜像...' },
      { type: 'info' as const, message: '压缩静态资源...' },
      { type: 'success' as const, message: '镜像打包完成: agenthive-app:v1.2.3' },
    ]},
    { stage: 'deploy', logs: [
      { type: 'info' as const, message: '推送到容器仓库...' },
      { type: 'info' as const, message: '更新 Kubernetes 部署...' },
      { type: 'success' as const, message: '服务已上线！' },
    ]},
  ]
  
  for (const step of steps) {
    const stage = stages.value.find(s => s.id === step.stage)!
    stage.status = 'running'
    
    for (const log of step.logs) {
      addLog(log.type, log.message)
      await sleep(400 + Math.random() * 600)
    }
    
    stage.status = 'completed'
    stage.duration = Math.floor(Math.random() * 5) + 2
    await sleep(300)
  }
  
  deployUrl.value = `https://app-${Math.random().toString(36).slice(2, 8)}.agenthive.cloud`
  isDeploying.value = false
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}
</script>

<style scoped>
.animate-fade-in {
  animation: fadeIn 0.2s ease-out;
}
@keyframes fadeIn {
  from { opacity: 0; transform: translateX(-8px); }
  to { opacity: 1; transform: translateX(0); }
}
</style>

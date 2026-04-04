import { ref, computed } from 'vue'

export type AgentStatus = 'idle' | 'thinking' | 'coding' | 'testing' | 'reviewing' | 'deploying' | 'completed' | 'error'

export interface AgentLog {
  id: string
  timestamp: Date
  type: 'system' | 'stdout' | 'stderr' | 'code' | 'thinking' | 'file'
  content: string
  meta?: Record<string, any>
}

export interface AgentTask {
  id: string
  name: string
  status: AgentStatus
  progress: number
  startTime: Date
  logs: AgentLog[]
  currentFile?: string
}

const statusLabels: Record<AgentStatus, string> = {
  idle: '等待中',
  thinking: '思考中',
  coding: '编写代码',
  testing: '运行测试',
  reviewing: '代码审查',
  deploying: '部署中',
  completed: '已完成',
  error: '出错',
}

const sampleCodeSnippets = [
  `export function calculateTotal(items: CartItem[]) {
  return items.reduce((sum, item) => {
    return sum + item.price * item.quantity
  }, 0)
}`,
  `const router = useRouter()
const userStore = useUserStore()

onMounted(async () => {
  await userStore.fetchProfile()
})`,
  `<template>
  <div class="card">
    <h2>{{ title }}</h2>
    <slot />
  </div>
</template>`,
  `async function handleSubmit() {
  try {
    const result = await api.post('/orders', formData)
    toast.success('订单创建成功')
    router.push('/orders/' + result.id)
  } catch (err) {
    toast.error(err.message)
  }
}`,
]

const sampleTerminalLines = [
  { type: 'system' as const, content: '> npm run build' },
  { type: 'stdout' as const, content: 'vite v5.2.0 building for production...' },
  { type: 'stdout' as const, content: 'transforming (128) modules...' },
  { type: 'stdout' as const, content: '✓ 142 modules transformed.' },
  { type: 'stdout' as const, content: 'rendering chunks...' },
  { type: 'stdout' as const, content: 'computing gzip size...' },
  { type: 'stdout' as const, content: 'dist/                     48.23 kB │ gzip: 12.10 kB' },
  { type: 'system' as const, content: '> npm run test' },
  { type: 'stdout' as const, content: 'Test Files  8 passed (8)' },
  { type: 'stdout' as const, content: '     Tests  42 passed (42)' },
  { type: 'stdout' as const, content: '  Duration  3.24s' },
]

export function useAgentTracker() {
  const tasks = ref<AgentTask[]>([
    {
      id: 'agent-1',
      name: 'Frontend Developer',
      status: 'coding',
      progress: 65,
      startTime: new Date(Date.now() - 1000 * 60 * 5),
      logs: [
        { id: '1', timestamp: new Date(), type: 'system', content: '任务开始: 实现用户登录页面' },
        { id: '2', timestamp: new Date(), type: 'thinking', content: '分析需求: 需要邮箱验证、密码强度指示、OAuth 集成...' },
        { id: '3', timestamp: new Date(), type: 'file', content: 'pages/login.vue', meta: { action: 'create' } },
      ],
      currentFile: 'pages/login.vue',
    },
    {
      id: 'agent-2',
      name: 'Backend Developer',
      status: 'testing',
      progress: 80,
      startTime: new Date(Date.now() - 1000 * 60 * 8),
      logs: [
        { id: '1', timestamp: new Date(), type: 'system', content: '任务开始: 实现 JWT 认证 API' },
        { id: '2', timestamp: new Date(), type: 'file', content: 'src/auth/service.ts', meta: { action: 'edit' } },
        { id: '3', timestamp: new Date(), type: 'stdout', content: 'Running auth tests...' },
      ],
      currentFile: 'src/auth/service.ts',
    },
    {
      id: 'agent-3',
      name: 'QA Engineer',
      status: 'reviewing',
      progress: 45,
      startTime: new Date(Date.now() - 1000 * 60 * 3),
      logs: [
        { id: '1', timestamp: new Date(), type: 'system', content: '任务开始: 审查登录功能测试覆盖率' },
        { id: '2', timestamp: new Date(), type: 'thinking', content: '检查边界条件: 空密码、超长邮箱、SQL 注入尝试...' },
      ],
    },
  ])
  
  const activeTaskId = ref<string>(tasks.value[0].id)
  const isTracking = ref(true)
  const showTracker = ref(false)
  
  const activeTask = computed(() => 
    tasks.value.find(t => t.id === activeTaskId.value) || tasks.value[0]
  )
  
  const activeLogs = computed(() => activeTask.value?.logs || [])
  
  function toggleTracker() {
    showTracker.value = !showTracker.value
  }
  
  function setActiveTask(id: string) {
    activeTaskId.value = id
  }
  
  function addLog(taskId: string, log: Omit<AgentLog, 'id' | 'timestamp'>) {
    const task = tasks.value.find(t => t.id === taskId)
    if (task) {
      task.logs.push({
        ...log,
        id: `${Date.now()}-${Math.random()}`,
        timestamp: new Date(),
      })
    }
  }
  
  // Simulate agent activity
  function simulateActivity() {
    if (!isTracking.value) return
    
    const task = tasks.value[Math.floor(Math.random() * tasks.value.length)]
    if (task.status === 'completed' || task.status === 'error') return
    
    const r = Math.random()
    
    if (r < 0.3) {
      // Add terminal output
      const line = sampleTerminalLines[Math.floor(Math.random() * sampleTerminalLines.length)]
      addLog(task.id, { type: line.type, content: line.content })
    } else if (r < 0.6) {
      // Add code snippet
      const code = sampleCodeSnippets[Math.floor(Math.random() * sampleCodeSnippets.length)]
      addLog(task.id, { type: 'code', content: code, meta: { language: 'typescript' } })
      task.progress = Math.min(100, task.progress + Math.floor(Math.random() * 5) + 1)
    } else if (r < 0.8) {
      // Add thinking
      const thoughts = [
        '正在分析组件依赖关系...',
        '考虑使用 Composition API 重构...',
        '检查类型定义是否完整...',
        '优化渲染性能中...',
        '评估不同状态管理方案的优劣...',
      ]
      addLog(task.id, { type: 'thinking', content: thoughts[Math.floor(Math.random() * thoughts.length)] })
    } else {
      // File operation
      const files = ['components/UserCard.vue', 'composables/useAuth.ts', 'pages/profile.vue', 'api/users.get.ts']
      const file = files[Math.floor(Math.random() * files.length)]
      const action = Math.random() > 0.5 ? 'edit' : 'create'
      addLog(task.id, { type: 'file', content: file, meta: { action } })
      task.currentFile = file
    }
    
    // Occasionally change status
    if (task.progress >= 100) {
      task.status = 'completed'
    } else if (task.progress > 90) {
      task.status = 'deploying'
    } else if (task.progress > 70) {
      task.status = 'reviewing'
    } else if (task.progress > 40) {
      task.status = 'testing'
    }
  }
  
  return {
    tasks,
    activeTaskId,
    activeTask,
    activeLogs,
    isTracking,
    showTracker,
    statusLabels,
    toggleTracker,
    setActiveTask,
    addLog,
    simulateActivity,
  }
}

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { tasksApi } from '@/api/tasks'
import type { Task, TaskStatus } from '@/types'

export const useTaskStore = defineStore('task', () => {
  // State
  const tasks = ref<Task[]>([])
  const currentTask = ref<Task | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const total = ref(0)
  const page = ref(1)
  const pageSize = ref(10)
  
  // Getters
  const pendingTasks = computed(() => 
    tasks.value.filter(t => t.status === 'pending')
  )
  
  const runningTasks = computed(() => 
    tasks.value.filter(t => t.status === 'running')
  )
  
  const completedTasks = computed(() => 
    tasks.value.filter(t => t.status === 'completed')
  )
  
  const failedTasks = computed(() => 
    tasks.value.filter(t => t.status === 'failed')
  )
  
  const tasksByAgent = computed(() => (agentId: string) =>
    tasks.value.filter(t => t.assignedTo === agentId)
  )
  
  // Actions
  const fetchTasks = async (params?: {
    status?: TaskStatus
    assignedTo?: string
    page?: number
    pageSize?: number
  }) => {
    loading.value = true
    error.value = null
    try {
      const data = await tasksApi.getTasks(params)
      tasks.value = data.tasks
      total.value = data.total
      page.value = data.page
      pageSize.value = data.pageSize
      return data
    } catch (err) {
      error.value = err instanceof Error ? err.message : '获取任务列表失败'
      throw err
    } finally {
      loading.value = false
    }
  }
  
  const fetchTask = async (id: string) => {
    loading.value = true
    error.value = null
    try {
      const task = await tasksApi.getTask(id)
      currentTask.value = task
      return task
    } catch (err) {
      error.value = err instanceof Error ? err.message : '获取任务详情失败'
      throw err
    } finally {
      loading.value = false
    }
  }
  
  const createTask = async (data: Parameters<typeof tasksApi.createTask>[0]) => {
    const task = await tasksApi.createTask(data)
    tasks.value.unshift(task)
    total.value++
    return task
  }
  
  const updateTask = async (id: string, data: Parameters<typeof tasksApi.updateTask>[1]) => {
    const task = await tasksApi.updateTask(id, data)
    const index = tasks.value.findIndex(t => t.id === id)
    if (index !== -1) {
      tasks.value[index] = task
    }
    if (currentTask.value?.id === id) {
      currentTask.value = task
    }
    return task
  }
  
  const deleteTask = async (id: string) => {
    await tasksApi.deleteTask(id)
    tasks.value = tasks.value.filter(t => t.id !== id)
    total.value--
    if (currentTask.value?.id === id) {
      currentTask.value = null
    }
  }
  
  const cancelTask = async (id: string) => {
    const task = await tasksApi.cancelTask(id)
    const index = tasks.value.findIndex(t => t.id === id)
    if (index !== -1) {
      tasks.value[index] = task
    }
    if (currentTask.value?.id === id) {
      currentTask.value = task
    }
    return task
  }
  
  // WebSocket 更新
  const updateTaskStatus = (id: string, status: TaskStatus, progress?: number) => {
    const task = tasks.value.find(t => t.id === id)
    if (task) {
      task.status = status
      if (progress !== undefined) {
        task.progress = progress
      }
    }
    if (currentTask.value?.id === id) {
      currentTask.value = { ...currentTask.value, status, progress: progress ?? currentTask.value.progress }
    }
  }
  
  const updateTaskProgress = (id: string, progress: number) => {
    const task = tasks.value.find(t => t.id === id)
    if (task) {
      task.progress = progress
    }
    if (currentTask.value?.id === id) {
      currentTask.value = { ...currentTask.value, progress }
    }
  }
  
  const addTask = (task: Task) => {
    tasks.value.unshift(task)
    total.value++
  }
  
  const updateTaskInList = (task: Task) => {
    const index = tasks.value.findIndex(t => t.id === task.id)
    if (index !== -1) {
      tasks.value[index] = task
    } else {
      tasks.value.unshift(task)
    }
    if (currentTask.value?.id === task.id) {
      currentTask.value = task
    }
  }
  
  const selectTask = (task: Task | null) => {
    currentTask.value = task
  }
  
  return {
    // State
    tasks,
    currentTask,
    loading,
    error,
    total,
    page,
    pageSize,
    
    // Getters
    pendingTasks,
    runningTasks,
    completedTasks,
    failedTasks,
    tasksByAgent,
    
    // Actions
    fetchTasks,
    fetchTask,
    createTask,
    updateTask,
    deleteTask,
    cancelTask,
    updateTaskStatus,
    updateTaskProgress,
    addTask,
    updateTaskInList,
    selectTask,
  }
})

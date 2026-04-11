import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Task, TaskStatus, CreateTaskInput, UpdateTaskInput } from '@agenthive/types'

// Stub store for SSR compatibility - full implementation in landing app
export const useTaskStore = defineStore('task', () => {
  const tasks = ref<Task[]>([])
  const currentTask = ref<Task | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const taskList = computed(() => tasks.value)
  const pendingTasks = computed(() => tasks.value.filter(t => t.status === 'pending'))
  const runningTasks = computed(() => tasks.value.filter(t => t.status === 'running'))
  const completedTasks = computed(() => tasks.value.filter(t => t.status === 'completed'))
  const tasksByAgent = computed(() => (agentId: string) => 
    tasks.value.filter(t => t.assignedTo === agentId)
  )

  const fetchTasks = async () => {
    loading.value = true
    error.value = null
    try {
      await new Promise(resolve => setTimeout(resolve, 500))
      tasks.value = []
    } catch (e) {
      error.value = '加载任务列表失败'
      console.error(e)
    } finally {
      loading.value = false
    }
  }

  const fetchTaskById = async (_id: string) => {
    currentTask.value = null
  }

  const createTask = async (_input: CreateTaskInput) => {
    return null
  }

  const updateTask = async (_id: string, _input: UpdateTaskInput) => {
    return null
  }

  const cancelTask = async (_id: string) => {
    return false
  }

  const deleteTask = async (_id: string) => {
    return false
  }

  return {
    tasks,
    currentTask,
    loading,
    error,
    taskList,
    pendingTasks,
    runningTasks,
    completedTasks,
    tasksByAgent,
    fetchTasks,
    fetchTaskById,
    createTask,
    updateTask,
    cancelTask,
    deleteTask,
  }
})

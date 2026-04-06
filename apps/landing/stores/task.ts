import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Task } from '@agenthive/types'

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

export interface CreateTaskInput {
  title: string
  description?: string
  status?: TaskStatus
  priority?: 'low' | 'medium' | 'high' | 'urgent'
  assignedTo?: string
}

export interface UpdateTaskInput {
  title?: string
  description?: string
  status?: TaskStatus
  priority?: 'low' | 'medium' | 'high' | 'urgent'
  assignedTo?: string
  progress?: number
  error?: string
}

export const useTaskStore = defineStore('task', () => {
  // State
  const tasks = ref<Task[]>([])
  const currentTask = ref<Task | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Getters
  const taskList = computed(() => tasks.value)
  const pendingTasks = computed(() => tasks.value.filter(t => t.status === 'pending'))
  const runningTasks = computed(() => tasks.value.filter(t => t.status === 'running'))
  const completedTasks = computed(() => tasks.value.filter(t => t.status === 'completed'))
  const tasksByAgent = computed(() => (agentId: string) => 
    tasks.value.filter(t => t.agentId === agentId || t.assignedTo === agentId)
  )

  // Actions
  const fetchTasks = async (_params?: { page?: number; pageSize?: number }) => {
    loading.value = true
    error.value = null
    try {
      await new Promise(resolve => setTimeout(resolve, 500))
      if (typeof window === 'undefined') {
        tasks.value = []
        return
      }
      const stored = localStorage.getItem('agenthive_tasks')
      if (stored) {
        tasks.value = JSON.parse(stored)
      } else {
        tasks.value = []
      }
    } catch (e) {
      error.value = '加载任务列表失败'
      console.error(e)
    } finally {
      loading.value = false
    }
  }

  const fetchTaskById = async (id: string) => {
    loading.value = true
    error.value = null
    try {
      await new Promise(resolve => setTimeout(resolve, 300))
      currentTask.value = tasks.value.find(t => t.id === id) || null
    } catch (e) {
      error.value = '加载任务详情失败'
      console.error(e)
    } finally {
      loading.value = false
    }
  }

  const createTask = async (input: CreateTaskInput) => {
    loading.value = true
    try {
      const newTask = {
        id: Date.now().toString(),
        ...input,
        status: 'pending' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as Task
      tasks.value.push(newTask)
      saveTasks()
      return newTask
    } catch (e) {
      error.value = '创建任务失败'
      throw e
    } finally {
      loading.value = false
    }
  }

  const updateTask = async (id: string, input: UpdateTaskInput) => {
    loading.value = true
    try {
      const index = tasks.value.findIndex(t => t.id === id)
      if (index === -1) throw new Error('Task not found')
      
      tasks.value[index] = { 
        ...tasks.value[index], 
        ...input,
        updatedAt: new Date().toISOString(),
      }
      saveTasks()
      return tasks.value[index]
    } catch (e) {
      error.value = '更新任务失败'
      throw e
    } finally {
      loading.value = false
    }
  }

  const deleteTask = async (id: string) => {
    try {
      const index = tasks.value.findIndex(t => t.id === id)
      if (index === -1) throw new Error('Task not found')
      
      tasks.value.splice(index, 1)
      saveTasks()
    } catch (e) {
      error.value = '删除任务失败'
      throw e
    }
  }

  const startTask = async (id: string) => {
    return updateTask(id, { status: 'running' })
  }

  const completeTask = async (id: string) => {
    return updateTask(id, { status: 'completed' })
  }

  const failTask = async (id: string, errorMsg: string) => {
    return updateTask(id, { status: 'failed', error: errorMsg })
  }

  const saveTasks = () => {
    localStorage.setItem('agenthive_tasks', JSON.stringify(tasks.value))
  }

  const clearError = () => {
    error.value = null
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
    deleteTask,
    startTask,
    completeTask,
    failTask,
    clearError,
  }
})

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Agent, CreateAgentInput, UpdateAgentInput } from '@agenthive/types'

export const useAgentStore = defineStore('agent', () => {
  // State
  const agents = ref<Agent[]>([])
  const currentAgent = ref<Agent | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Getters
  const agentList = computed(() => agents.value)
  const activeAgents = computed(() => agents.value.filter(a => a.status === 'doing'))
  const idleAgents = computed(() => agents.value.filter(a => a.status === 'pending'))
  const errorAgents = computed(() => agents.value.filter(a => a.status === 'failed'))
  const agentById = computed(() => (id: string) => agents.value.find(a => a.id === id))

  // Actions
  const fetchAgents = async () => {
    loading.value = true
    error.value = null
    try {
      // 模拟 API 调用
      await new Promise(resolve => setTimeout(resolve, 500))
      // 从 LocalStorage 加载或使用默认值 (仅客户端)
      if (typeof window === 'undefined') {
        agents.value = []
        return
      }
      const stored = localStorage.getItem('agenthive_agents')
      if (stored) {
        agents.value = JSON.parse(stored)
      } else {
        // 默认示例数据
        agents.value = [
          {
            id: '1',
            name: '前端开发助手',
            role: 'frontend_dev',
            status: 'doing' as const,
            description: '专门处理前端开发任务',
            skills: ['Vue.js', 'React', 'TypeScript'],
            createdAt: new Date().toISOString(),
          },
          {
            id: '2',
            name: '后端开发助手',
            role: 'backend_dev',
            status: 'pending' as const,
            description: '专门处理后端 API 开发',
            skills: ['Node.js', 'Python', 'PostgreSQL'],
            createdAt: new Date().toISOString(),
          },
        ]
        saveAgents()
      }
    } catch (e) {
      error.value = '加载 Agent 列表失败'
      console.error(e)
    } finally {
      loading.value = false
    }
  }

  const fetchAgentById = async (id: string) => {
    loading.value = true
    error.value = null
    try {
      await new Promise(resolve => setTimeout(resolve, 300))
      currentAgent.value = agents.value.find(a => a.id === id) || null
    } catch (e) {
      error.value = '加载 Agent 详情失败'
      console.error(e)
    } finally {
      loading.value = false
    }
  }

  const createAgent = async (input: CreateAgentInput) => {
    loading.value = true
    try {
      const newAgent: Agent = {
        id: Date.now().toString(),
        ...input,
        status: 'pending' as const,
        createdAt: new Date().toISOString(),
      }
      agents.value.push(newAgent)
      saveAgents()
      return newAgent
    } catch (e) {
      error.value = '创建 Agent 失败'
      throw e
    } finally {
      loading.value = false
    }
  }

  const updateAgent = async (id: string, input: UpdateAgentInput) => {
    loading.value = true
    try {
      const index = agents.value.findIndex(a => a.id === id)
      if (index === -1) throw new Error('Agent not found')
      
      agents.value[index] = { ...agents.value[index], ...input }
      saveAgents()
      return agents.value[index]
    } catch (e) {
      error.value = '更新 Agent 失败'
      throw e
    } finally {
      loading.value = false
    }
  }

  const deleteAgent = async (id: string) => {
    try {
      const index = agents.value.findIndex(a => a.id === id)
      if (index === -1) throw new Error('Agent not found')
      
      agents.value.splice(index, 1)
      saveAgents()
    } catch (e) {
      error.value = '删除 Agent 失败'
      throw e
    }
  }

  const saveAgents = () => {
    localStorage.setItem('agenthive_agents', JSON.stringify(agents.value))
  }

  const clearError = () => {
    error.value = null
  }

  return {
    agents,
    currentAgent,
    loading,
    error,
    agentList,
    activeAgents,
    idleAgents,
    errorAgents,
    agentById,
    fetchAgents,
    fetchAgentById,
    createAgent,
    updateAgent,
    deleteAgent,
    clearError,
  }
})

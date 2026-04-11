import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Agent, AgentStatus, CreateAgentInput, UpdateAgentInput } from '@agenthive/types'

// Stub store for SSR compatibility - full implementation in landing app
export const useAgentStore = defineStore('agent', () => {
  const agents = ref<Agent[]>([])
  const currentAgent = ref<Agent | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const agentList = computed(() => agents.value)
  const activeAgents = computed(() => agents.value.filter(a => a.status === 'active'))
  const agentById = computed(() => (id: string) => agents.value.find(a => a.id === id))

  const fetchAgents = async () => {
    loading.value = true
    error.value = null
    try {
      await new Promise(resolve => setTimeout(resolve, 500))
      agents.value = []
    } catch (e) {
      error.value = '加载失败'
      console.error(e)
    } finally {
      loading.value = false
    }
  }

  const fetchAgentById = async (_id: string) => {
    currentAgent.value = null
  }

  const createAgent = async (_input: CreateAgentInput) => {
    return null
  }

  const updateAgent = async (_id: string, _input: UpdateAgentInput) => {
    return null
  }

  const deleteAgent = async (_id: string) => {
    return false
  }

  return {
    agents,
    currentAgent,
    loading,
    error,
    agentList,
    activeAgents,
    agentById,
    fetchAgents,
    fetchAgentById,
    createAgent,
    updateAgent,
    deleteAgent,
  }
})

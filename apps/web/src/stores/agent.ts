import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { agentsApi } from '@/api/agents'
import type { Agent, AgentStatus, Task } from '@/types'

export const useAgentStore = defineStore('agent', () => {
  // State
  const agents = ref<Agent[]>([])
  const currentAgent = ref<Agent | null>(null)
  const agentTasks = ref<Task[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  
  // Getters
  const activeAgents = computed(() => 
    agents.value.filter(a => a.status === 'working')
  )
  
  const idleAgents = computed(() => 
    agents.value.filter(a => a.status === 'idle')
  )
  
  const errorAgents = computed(() => 
    agents.value.filter(a => a.status === 'error')
  )
  
  const agentById = computed(() => (id: string) =>
    agents.value.find(a => a.id === id)
  )
  
  const agentsByRole = computed(() => (role: string) =>
    agents.value.filter(a => a.role === role)
  )
  
  // Actions
  const fetchAgents = async (teamId?: string) => {
    loading.value = true
    error.value = null
    try {
      const data = await agentsApi.getAgents(teamId)
      agents.value = data.agents
      return data
    } catch (err) {
      error.value = err instanceof Error ? err.message : '获取Agent列表失败'
      throw err
    } finally {
      loading.value = false
    }
  }
  
  const fetchAgentDetail = async (id: string) => {
    loading.value = true
    error.value = null
    try {
      const data = await agentsApi.getAgent(id)
      currentAgent.value = data.agent
      agentTasks.value = data.tasks
      return data
    } catch (err) {
      error.value = err instanceof Error ? err.message : '获取Agent详情失败'
      throw err
    } finally {
      loading.value = false
    }
  }
  
  const createAgent = async (data: Parameters<typeof agentsApi.createAgent>[0]) => {
    const agent = await agentsApi.createAgent(data)
    agents.value.push(agent)
    return agent
  }
  
  const updateAgent = async (id: string, data: Parameters<typeof agentsApi.updateAgent>[1]) => {
    const agent = await agentsApi.updateAgent(id, data)
    const index = agents.value.findIndex(a => a.id === id)
    if (index !== -1) {
      agents.value[index] = agent
    }
    if (currentAgent.value?.id === id) {
      currentAgent.value = agent
    }
    return agent
  }
  
  const deleteAgent = async (id: string) => {
    await agentsApi.deleteAgent(id)
    agents.value = agents.value.filter(a => a.id !== id)
    if (currentAgent.value?.id === id) {
      currentAgent.value = null
    }
  }
  
  const startAgent = async (id: string) => {
    const agent = await agentsApi.startAgent(id)
    updateAgentInList(agent)
    return agent
  }
  
  const stopAgent = async (id: string) => {
    const agent = await agentsApi.stopAgent(id)
    updateAgentInList(agent)
    return agent
  }
  
  const pauseAgent = async (id: string) => {
    const agent = await agentsApi.pauseAgent(id)
    updateAgentInList(agent)
    return agent
  }
  
  const resumeAgent = async (id: string) => {
    const agent = await agentsApi.resumeAgent(id)
    updateAgentInList(agent)
    return agent
  }
  
  const sendCommand = async (id: string, command: { type: string; payload: Record<string, unknown> }) => {
    await agentsApi.sendCommand(id, command)
  }
  
  // WebSocket 更新
  const updateAgentStatus = (agentId: string, status: AgentStatus, progress?: number) => {
    const agent = agents.value.find(a => a.id === agentId)
    if (agent) {
      agent.status = status
      if (progress !== undefined) {
        agent.currentTask = {
          ...agent.currentTask,
          id: agent.currentTask?.id || '',
          title: agent.currentTask?.title || '',
          progress,
        }
      }
    }
    if (currentAgent.value?.id === agentId) {
      currentAgent.value = { ...currentAgent.value, status }
    }
  }
  
  const updateAgentInList = (agent: Agent) => {
    const index = agents.value.findIndex(a => a.id === agent.id)
    if (index !== -1) {
      agents.value[index] = agent
    }
    if (currentAgent.value?.id === agent.id) {
      currentAgent.value = agent
    }
  }
  
  const addAgent = (agent: Agent) => {
    agents.value.push(agent)
  }
  
  const removeAgent = (id: string) => {
    agents.value = agents.value.filter(a => a.id !== id)
    if (currentAgent.value?.id === id) {
      currentAgent.value = null
    }
  }
  
  const selectAgent = (agent: Agent | null) => {
    currentAgent.value = agent
  }
  
  const clearError = () => {
    error.value = null
  }
  
  return {
    // State
    agents,
    currentAgent,
    agentTasks,
    loading,
    error,
    
    // Getters
    activeAgents,
    idleAgents,
    errorAgents,
    agentById,
    agentsByRole,
    
    // Actions
    fetchAgents,
    fetchAgentDetail,
    createAgent,
    updateAgent,
    deleteAgent,
    startAgent,
    stopAgent,
    pauseAgent,
    resumeAgent,
    sendCommand,
    updateAgentStatus,
    updateAgentInList,
    addAgent,
    removeAgent,
    selectAgent,
    clearError,
  }
})

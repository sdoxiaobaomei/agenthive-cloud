import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { CodeFile, TerminalOutput, Message, MessageType } from '@agenthive/types'
import { useMessageHubStore } from './messageHub'

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

// 模拟 WebSocket 事件 - 使用 LocalStorage 替代真实连接
export const useWebSocketStore = defineStore('websocket', () => {
  // State
  const status = ref<ConnectionStatus>('disconnected')
  const reconnectAttempts = ref(0)
  const lastError = ref<string | null>(null)
  
  // 代码编辑器状态
  const currentCode = ref<CodeFile | null>(null)
  const codeHistory = ref<CodeFile[]>([])
  
  // 终端输出
  const terminalOutputs = ref<Record<string, TerminalOutput[]>>({})
  
  // 消息
  const messages = ref<Message[]>([])
  
  // Getters
  const isConnected = computed(() => status.value === 'connected')
  const isConnecting = computed(() => status.value === 'connecting')
  
  // Actions
  const connect = (_url?: string) => {
    if (status.value === 'connected') return
    
    status.value = 'connecting'
    lastError.value = null
    
    // 模拟连接延迟
    setTimeout(() => {
      status.value = 'connected'
      reconnectAttempts.value = 0
      console.log('[Mock] WebSocket connected (using LocalStorage mode)')
      
      // 加载历史代码
      loadCodeHistory()
    }, 500)
  }
  
  const disconnect = () => {
    status.value = 'disconnected'
    console.log('[Mock] WebSocket disconnected')
  }
  
  // 加载代码历史
  const loadCodeHistory = () => {
    if (typeof window === 'undefined') return
    const data = localStorage.getItem('agenthive_code_history')
    if (data) {
      codeHistory.value = JSON.parse(data)
    }
  }
  
  // 保存代码历史
  const saveCodeHistory = () => {
    if (typeof window === 'undefined') return
    localStorage.setItem('agenthive_code_history', JSON.stringify(codeHistory.value.slice(0, 50)))
  }
  
  // 模拟代码更新
  const simulateCodeUpdate = (data: {
    agentId: string
    file: string
    content: string
    language: string
  }) => {
    const messageHub = useMessageHubStore()
    
    const codeFile: CodeFile = {
      path: data.file,
      name: data.file.split('/').pop() || data.file,
      content: data.content,
      language: data.language,
      lastModified: new Date().toISOString(),
    }
    currentCode.value = codeFile
    codeHistory.value.unshift(codeFile)
    if (codeHistory.value.length > 50) {
      codeHistory.value = codeHistory.value.slice(0, 50)
    }
    saveCodeHistory()
    
    // 发送代码更新消息
    messageHub.notifyCode(
      data.file,
      `Agent ${data.agentId} 更新了代码`,
      { language: data.language, agentId: data.agentId }
    )
  }
  
  // 模拟终端输出
  const simulateTerminalOutput = (data: {
    agentId: string
    data: string
    isError?: boolean
  }) => {
    const output: TerminalOutput = {
      agentId: data.agentId,
      data: data.data,
      isError: data.isError || false,
      timestamp: new Date().toISOString(),
    }
    if (!terminalOutputs.value[data.agentId]) {
      terminalOutputs.value[data.agentId] = []
    }
    terminalOutputs.value[data.agentId].push(output)
    if (terminalOutputs.value[data.agentId].length > 1000) {
      terminalOutputs.value[data.agentId] = terminalOutputs.value[data.agentId].slice(-1000)
    }
  }
  
  // 发送命令到 Agent (模拟)
  const sendCommand = (agentId: string, command: { type: string; payload: Record<string, unknown> }) => {
    console.log('[Mock] Send command:', { agentId, command })
    // 模拟命令响应
    simulateTerminalOutput({
      agentId,
      data: `> Command executed: ${command.type}\n`,
    })
  }
  
  // 发送消息 (模拟)
  const sendMessage = (message: { content: string; contentType: string }) => {
    console.log('[Mock] Send message:', message)
    // 模拟收到自动回复
    setTimeout(() => {
      const reply: Message = {
        id: `msg-${Date.now()}`,
        senderType: 'agent',
        senderId: 'agent-1',
        senderName: 'Director',
        content: `Received: ${message.content}`,
        contentType: message.contentType as MessageType,
        createdAt: new Date().toISOString(),
      }
      messages.value.push(reply)
    }, 1000)
  }
  
  // 清除终端输出
  const clearTerminal = (agentId: string) => {
    delete terminalOutputs.value[agentId]
  }
  
  // 清除代码历史
  const clearCodeHistory = () => {
    codeHistory.value = []
    localStorage.removeItem('agenthive_code_history')
  }
  
  // 清除消息
  const clearMessages = () => {
    messages.value = []
  }
  
  return {
    // State
    socket: ref(null),
    status,
    reconnectAttempts,
    lastError,
    currentCode,
    codeHistory,
    terminalOutputs,
    messages,
    
    // Getters
    isConnected,
    isConnecting,
    
    // Actions
    connect,
    disconnect,
    sendCommand,
    sendMessage,
    clearTerminal,
    clearCodeHistory,
    clearMessages,
    
    // 模拟方法
    simulateCodeUpdate,
    simulateTerminalOutput,
  }
})

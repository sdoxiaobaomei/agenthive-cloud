import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface Message {
  id: string
  type: 'system' | 'agent' | 'task' | 'code' | 'error'
  source: string
  content: string
  timestamp: string
  read: boolean
  metadata?: Record<string, string>
}

export const useMessageHubStore = defineStore('messageHub', () => {
  // State
  const messages = ref<Message[]>([])
  const channels = ref<Record<string, string[]>>({
    system: [],
    agent: [],
    task: [],
    code: []
  })
  
  // Getters
  const unreadCount = computed(() => messages.value.filter(m => !m.read).length)
  const unreadMessages = computed(() => messages.value.filter(m => !m.read))
  const allMessages = computed(() => [...messages.value].sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  ))
  
  // Actions
  const addMessage = (message: Omit<Message, 'id' | 'timestamp' | 'read'>) => {
    const newMessage: Message = {
      ...message,
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      read: false
    }
    messages.value.unshift(newMessage)
    
    // 限制消息数量，保留最近 100 条
    if (messages.value.length > 100) {
      messages.value = messages.value.slice(0, 100)
    }
    
    return newMessage.id
  }
  
  const markAsRead = (id: string) => {
    const message = messages.value.find(m => m.id === id)
    if (message) {
      message.read = true
    }
  }
  
  const markAllAsRead = () => {
    messages.value.forEach(m => m.read = true)
  }
  
  const deleteMessage = (id: string) => {
    const index = messages.value.findIndex(m => m.id === id)
    if (index > -1) {
      messages.value.splice(index, 1)
    }
  }
  
  const clearMessages = () => {
    messages.value = []
  }
  
  // 发布-订阅机制
  const publish = (channel: string, message: Omit<Message, 'id' | 'timestamp' | 'read'>) => {
    const id = addMessage(message)
    
    // 通知该频道的订阅者
    // TODO: 实现订阅者通知机制
    console.log(`Published to ${channel}:`, id)
    
    return id
  }
  
  const subscribe = (_channel: string, _handler: (message: Message) => void) => {
    // TODO: 实现订阅机制
    return messages
  }
  
  // 快捷方法
  const notify = (content: string, type: Message['type'] = 'system', source = 'System') => {
    return addMessage({
      type,
      source,
      content,
      metadata: {}
    })
  }
  
  const notifyAgent = (agentId: string, agentName: string, content: string, metadata?: Record<string, string>) => {
    return addMessage({
      type: 'agent',
      source: agentName,
      content,
      metadata: { agentId, ...metadata }
    })
  }
  
  const notifyTask = (taskId: string, taskTitle: string, content: string, metadata?: Record<string, string>) => {
    return addMessage({
      type: 'task',
      source: taskTitle,
      content,
      metadata: { taskId, ...metadata }
    })
  }
  
  const notifyCode = (filePath: string, content: string, metadata?: Record<string, string>) => {
    return addMessage({
      type: 'code',
      source: filePath,
      content,
      metadata: { filePath, ...metadata }
    })
  }
  
  const notifyError = (error: string, source = 'System') => {
    return addMessage({
      type: 'error',
      source,
      content: error,
      metadata: {}
    })
  }
  
  return {
    // State
    messages,
    channels,
    
    // Getters
    unreadCount,
    unreadMessages,
    allMessages,
    
    // Actions
    addMessage,
    markAsRead,
    markAllAsRead,
    deleteMessage,
    clearMessages,
    publish,
    subscribe,
    notify,
    notifyAgent,
    notifyTask,
    notifyCode,
    notifyError
  }
})

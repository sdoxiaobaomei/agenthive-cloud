// LocalStorage 存储层 - 替代后端 API
import { ElMessage } from 'element-plus'
import type { Agent, Task, CodeFile, TaskStatus, TaskPriority } from '@/types'

// Storage Keys
const STORAGE_KEYS = {
  AGENTS: 'agenthive_agents',
  TASKS: 'agenthive_tasks',
  CODE_FILES: 'agenthive_code_files',
  USER: 'agenthive_user',
  TOKEN: 'agenthive_token',
  AGENT_LOGS: 'agenthive_agent_logs',
}

// 生成唯一 ID
const generateId = () => Math.random().toString(36).substring(2, 15)

// 生成时间戳
const now = () => new Date().toISOString()

// 模拟网络延迟
const delay = (ms = 300) => new Promise(resolve => setTimeout(resolve, ms))

// ==================== Agent Storage ====================

const defaultAgents: Agent[] = [
  {
    id: 'agent-1',
    name: 'Director',
    role: 'director',
    status: 'working',
    description: 'Project director agent',
    currentTask: {
      id: 'task-3',
      title: 'Code Review',
      progress: 100,
    },
    lastHeartbeatAt: now(),
    createdAt: new Date(Date.now() - 86400000 * 7).toISOString(),
    updatedAt: now(),
  },
  {
    id: 'agent-2',
    name: 'Frontend Dev',
    role: 'frontend_dev',
    status: 'idle',
    description: 'Frontend development specialist',
    lastHeartbeatAt: now(),
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    updatedAt: now(),
  },
  {
    id: 'agent-3',
    name: 'Backend Dev',
    role: 'backend_dev',
    status: 'working',
    description: 'Backend development specialist',
    currentTask: {
      id: 'task-1',
      title: 'API Development',
      progress: 65,
    },
    lastHeartbeatAt: now(),
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    updatedAt: now(),
  },
]

const getAgents = (): Agent[] => {
  const data = localStorage.getItem(STORAGE_KEYS.AGENTS)
  if (!data) {
    localStorage.setItem(STORAGE_KEYS.AGENTS, JSON.stringify(defaultAgents))
    return defaultAgents
  }
  return JSON.parse(data)
}

const saveAgents = (agents: Agent[]) => {
  localStorage.setItem(STORAGE_KEYS.AGENTS, JSON.stringify(agents))
}

// ==================== Task Storage ====================

const defaultTasks: Task[] = [
  {
    id: 'task-1',
    title: 'Design System Implementation',
    description: 'Implement the design system components',
    type: 'feature',
    status: 'running',
    priority: 'high',
    progress: 65,
    assignedTo: 'agent-3',
    input: {},
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: 'task-2',
    title: 'Authentication Module',
    description: 'Implement user authentication',
    type: 'feature',
    status: 'pending',
    priority: 'critical',
    progress: 0,
    input: {},
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'task-3',
    title: 'Code Review',
    description: 'Review pull requests',
    type: 'review',
    status: 'completed',
    priority: 'medium',
    progress: 100,
    assignedTo: 'agent-1',
    input: {},
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
]

const getTasks = (): Task[] => {
  const data = localStorage.getItem(STORAGE_KEYS.TASKS)
  if (!data) {
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(defaultTasks))
    return defaultTasks
  }
  return JSON.parse(data)
}

const saveTasks = (tasks: Task[]) => {
  localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks))
}

// ==================== Code Files Storage ====================

const defaultCodeFiles: CodeFile[] = [
  {
    path: '/main.go',
    name: 'main.go',
    content: `package main

import (
    "fmt"
    "log"
    "net/http"
)

func main() {
    fmt.Println("Starting AgentHive Cloud...")
    
    http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
        fmt.Fprintf(w, "Welcome to AgentHive Cloud!")
    })
    
    log.Fatal(http.ListenAndServe(":8080", nil))
}`,
    language: 'go',
    lastModified: now(),
  },
  {
    path: '/handlers/auth.go',
    name: 'auth.go',
    content: `package handlers

import (
    "net/http"
    "github.com/gin-gonic/gin"
)

func Login(c *gin.Context) {
    var req LoginRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }
    // Login logic here
    c.JSON(http.StatusOK, gin.H{"token": "mock-token"})
}`,
    language: 'go',
    lastModified: now(),
  },
  {
    path: '/README.md',
    name: 'README.md',
    content: `# AgentHive Cloud

AI-powered development team management platform.

## Features

- 🤖 Multi-Agent System
- 📊 Task Management
- 💻 Real-time Code Editing
- 🖥️ Terminal Access
- 💬 Team Chat

## Getting Started

\`\`\`bash
npm install
npm run dev
\`\`\``,
    language: 'markdown',
    lastModified: now(),
  },
]

const getCodeFiles = (): CodeFile[] => {
  const data = localStorage.getItem(STORAGE_KEYS.CODE_FILES)
  if (!data) {
    localStorage.setItem(STORAGE_KEYS.CODE_FILES, JSON.stringify(defaultCodeFiles))
    return defaultCodeFiles
  }
  return JSON.parse(data)
}

const saveCodeFiles = (files: CodeFile[]) => {
  localStorage.setItem(STORAGE_KEYS.CODE_FILES, JSON.stringify(files))
}

// ==================== Agent Logs ====================

const defaultLogs: Record<string, string[]> = {
  'agent-1': [
    '[2024-01-15 10:00:01] Agent started',
    '[2024-01-15 10:00:02] Initializing capabilities...',
    '[2024-01-15 10:00:03] Ready for tasks',
    '[2024-01-15 10:05:30] Assigned task: Code Review',
    '[2024-01-15 10:15:45] Task completed successfully',
  ],
  'agent-3': [
    '[2024-01-15 09:00:00] Agent started',
    '[2024-01-15 09:30:00] Working on API Development',
    '[2024-01-15 10:00:00] Progress: 30%',
    '[2024-01-15 11:00:00] Progress: 65%',
  ],
}

const getAgentLogs = (agentId: string): string[] => {
  const data = localStorage.getItem(STORAGE_KEYS.AGENT_LOGS)
  const logs = data ? JSON.parse(data) : defaultLogs
  if (!data) {
    localStorage.setItem(STORAGE_KEYS.AGENT_LOGS, JSON.stringify(defaultLogs))
  }
  return logs[agentId] || []
}

// ==================== Auth ====================

interface User {
  id: string
  username: string
  email: string
  role: string
}

const defaultUser: User = {
  id: 'user-1',
  username: 'admin',
  email: 'admin@agenthive.local',
  role: 'admin',
}

// ==================== API 实现 ====================

export const localStorageApi = {
  // 清除所有数据
  clearAll: () => {
    Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key))
    ElMessage.success('所有本地数据已清除')
  },

  // 重置为默认数据
  resetToDefaults: () => {
    localStorage.removeItem(STORAGE_KEYS.AGENTS)
    localStorage.removeItem(STORAGE_KEYS.TASKS)
    localStorage.removeItem(STORAGE_KEYS.CODE_FILES)
    localStorage.removeItem(STORAGE_KEYS.AGENT_LOGS)
    getAgents()
    getTasks()
    getCodeFiles()
    ElMessage.success('已重置为默认数据')
  },

  // Agents API
  agents: {
    getAgents: async (_teamId?: string) => {
      await delay()
      const agents = getAgents()
      return {
        agents,
        total: agents.length,
      }
    },

    getAgent: async (id: string) => {
      await delay()
      const agents = getAgents()
      const agent = agents.find(a => a.id === id)
      if (!agent) throw new Error('Agent not found')
      
      const tasks = getTasks().filter(t => t.assignedTo === id)
      return {
        agent,
        tasks,
        stats: {
          totalTasks: tasks.length,
          completedTasks: tasks.filter(t => t.status === 'completed').length,
          failedTasks: tasks.filter(t => t.status === 'failed').length,
          avgCompletionTime: 0,
        },
      }
    },

    createAgent: async (data: { name: string; role: string; description?: string; config?: Record<string, unknown> }) => {
      await delay()
      const agents = getAgents()
      const newAgent: Agent = {
        id: `agent-${generateId()}`,
        name: data.name,
        role: data.role as Agent['role'],
        status: 'idle',
        description: data.description || '',
        lastHeartbeatAt: now(),
        createdAt: now(),
        updatedAt: now(),
      }
      agents.push(newAgent)
      saveAgents(agents)
      return newAgent
    },

    updateAgent: async (id: string, data: { name?: string; description?: string; config?: Record<string, unknown> }) => {
      await delay()
      const agents = getAgents()
      const index = agents.findIndex(a => a.id === id)
      if (index === -1) throw new Error('Agent not found')
      
      agents[index] = {
        ...agents[index],
        ...data,
        updatedAt: now(),
      }
      saveAgents(agents)
      return agents[index]
    },

    deleteAgent: async (id: string) => {
      await delay()
      const agents = getAgents()
      const filtered = agents.filter(a => a.id !== id)
      saveAgents(filtered)
    },

    startAgent: async (id: string) => {
      await delay()
      const agents = getAgents()
      const index = agents.findIndex(a => a.id === id)
      if (index === -1) throw new Error('Agent not found')
      
      agents[index].status = 'working'
      agents[index].updatedAt = now()
      saveAgents(agents)
      return agents[index]
    },

    stopAgent: async (id: string) => {
      await delay()
      const agents = getAgents()
      const index = agents.findIndex(a => a.id === id)
      if (index === -1) throw new Error('Agent not found')
      
      agents[index].status = 'idle'
      agents[index].updatedAt = now()
      saveAgents(agents)
      return agents[index]
    },

    pauseAgent: async (id: string) => {
      await delay()
      const agents = getAgents()
      const index = agents.findIndex(a => a.id === id)
      if (index === -1) throw new Error('Agent not found')
      
      agents[index].status = 'paused'
      agents[index].updatedAt = now()
      saveAgents(agents)
      return agents[index]
    },

    resumeAgent: async (id: string) => {
      await delay()
      const agents = getAgents()
      const index = agents.findIndex(a => a.id === id)
      if (index === -1) throw new Error('Agent not found')
      
      agents[index].status = 'working'
      agents[index].updatedAt = now()
      saveAgents(agents)
      return agents[index]
    },

    sendCommand: async (_id: string, _command: { type: string; payload: Record<string, unknown> }) => {
      await delay()
      // 模拟命令执行
      return
    },

    getAgentLogs: async (id: string, lines = 100) => {
      await delay()
      const logs = getAgentLogs(id)
      return logs.slice(-lines)
    },
  },

  // Tasks API
  tasks: {
    getTasks: async (params?: { status?: TaskStatus; assignedTo?: string; page?: number; pageSize?: number }) => {
      await delay()
      let tasks = getTasks()
      
      if (params?.status) {
        tasks = tasks.filter(t => t.status === params.status)
      }
      if (params?.assignedTo) {
        tasks = tasks.filter(t => t.assignedTo === params.assignedTo)
      }
      
      const page = params?.page || 1
      const pageSize = params?.pageSize || 10
      const start = (page - 1) * pageSize
      const end = start + pageSize
      
      return {
        tasks: tasks.slice(start, end),
        total: tasks.length,
        page,
        pageSize,
      }
    },

    getTask: async (id: string) => {
      await delay()
      const tasks = getTasks()
      const task = tasks.find(t => t.id === id)
      if (!task) throw new Error('Task not found')
      return task
    },

    createTask: async (data: { title: string; description?: string; type: string; priority?: TaskPriority; input?: Record<string, unknown>; assignedTo?: string }) => {
      await delay()
      const tasks = getTasks()
      const newTask: Task = {
        id: `task-${generateId()}`,
        title: data.title,
        description: data.description || '',
        type: data.type,
        status: 'pending',
        priority: data.priority || 'medium',
        progress: 0,
        assignedTo: data.assignedTo,
        input: data.input || {},
        createdAt: now(),
      }
      tasks.push(newTask)
      saveTasks(tasks)
      return newTask
    },

    updateTask: async (id: string, data: Partial<Task>) => {
      await delay()
      const tasks = getTasks()
      const index = tasks.findIndex(t => t.id === id)
      if (index === -1) throw new Error('Task not found')
      
      const updatedTask = { ...tasks[index], ...data } as Task
      tasks[index] = updatedTask
      saveTasks(tasks)
      return updatedTask
    },

    deleteTask: async (id: string) => {
      await delay()
      const tasks = getTasks()
      const filtered = tasks.filter(t => t.id !== id)
      saveTasks(filtered)
    },

    cancelTask: async (id: string) => {
      await delay()
      const tasks = getTasks()
      const index = tasks.findIndex(t => t.id === id)
      if (index === -1) throw new Error('Task not found')
      
      tasks[index].status = 'cancelled'
      saveTasks(tasks)
      return tasks[index]
    },

    getSubtasks: async (id: string) => {
      await delay()
      const tasks = getTasks()
      return tasks.filter(t => t.parentId === id)
    },
  },

  // Code API
  code: {
    getFileList: async (_path = '/') => {
      await delay()
      const files = getCodeFiles()
      return {
        files,
        total: files.length,
      }
    },

    getFileContent: async (path: string) => {
      await delay()
      const files = getCodeFiles()
      const file = files.find(f => f.path === path)
      if (!file) throw new Error('File not found')
      return {
        path: file.path,
        content: file.content,
        language: file.language,
        lastModified: file.lastModified,
      }
    },

    updateFile: async (path: string, content: string) => {
      await delay()
      const files = getCodeFiles()
      const index = files.findIndex(f => f.path === path)
      if (index === -1) throw new Error('File not found')
      
      files[index].content = content
      files[index].lastModified = now()
      saveCodeFiles(files)
      
      return {
        path: files[index].path,
        content: files[index].content,
        language: files[index].language,
        lastModified: files[index].lastModified,
      }
    },

    searchFiles: async (query: string) => {
      await delay()
      const files = getCodeFiles()
      const filtered = files.filter(f => 
        f.name.toLowerCase().includes(query.toLowerCase()) ||
        f.content.toLowerCase().includes(query.toLowerCase())
      )
      return {
        files: filtered,
        total: filtered.length,
      }
    },

    getRecentFiles: async (limit = 10) => {
      await delay()
      const files = getCodeFiles()
      const sorted = [...files].sort((a, b) => 
        new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
      )
      return {
        files: sorted.slice(0, limit),
        total: sorted.length,
      }
    },
  },

  // Auth API
  auth: {
    login: async (data: { username: string; password: string }) => {
      await delay(500)
      // 模拟登录，任何用户名密码都接受
      const user = {
        ...defaultUser,
        username: data.username,
      }
      const token = `mock-token-${generateId()}`
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user))
      localStorage.setItem(STORAGE_KEYS.TOKEN, token)
      return {
        token,
        user,
      }
    },

    register: async (data: { username: string; email: string; password: string }) => {
      await delay(500)
      const user = {
        id: `user-${generateId()}`,
        username: data.username,
        email: data.email,
        role: 'user',
      }
      const token = `mock-token-${generateId()}`
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user))
      localStorage.setItem(STORAGE_KEYS.TOKEN, token)
      return {
        token,
        user,
      }
    },

    logout: async () => {
      await delay(200)
      localStorage.removeItem(STORAGE_KEYS.USER)
      localStorage.removeItem(STORAGE_KEYS.TOKEN)
    },

    refreshToken: async () => {
      await delay(200)
      const user = localStorage.getItem(STORAGE_KEYS.USER)
      if (!user) throw new Error('Not authenticated')
      const token = `mock-token-${generateId()}`
      localStorage.setItem(STORAGE_KEYS.TOKEN, token)
      return {
        token,
        user: JSON.parse(user),
      }
    },

    getCurrentUser: async () => {
      await delay(200)
      const user = localStorage.getItem(STORAGE_KEYS.USER)
      if (!user) throw new Error('Not authenticated')
      return JSON.parse(user)
    },
  },
}

export default localStorageApi

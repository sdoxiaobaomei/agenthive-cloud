// 内存数据库 - Mock 数据存储
import type { Agent, Task, User, CodeFile, SmsCode } from '../types/index.js'

// 生成唯一 ID
export const generateId = () => Math.random().toString(36).substring(2, 15)

// 生成时间戳
export const now = () => new Date().toISOString()

// 模拟延迟
export const delay = (ms = 300) => new Promise(resolve => setTimeout(resolve, ms))

// ============ Users ============
const users: Map<string, User> = new Map()

export const userDb = {
  findById: (id: string): User | undefined => users.get(id),
  
  findByPhone: (phone: string): User | undefined => {
    for (const user of users.values()) {
      if (user.phone === phone) return user
    }
    return undefined
  },
  
  create: (data: Partial<User>): User => {
    const user: User = {
      id: `user-${generateId()}`,
      username: data.username || `user_${generateId().slice(0, 6)}`,
      phone: data.phone,
      email: data.email,
      role: data.role || 'user',
      avatar: data.avatar,
      createdAt: now(),
      updatedAt: now(),
    }
    users.set(user.id, user)
    return user
  },
  
  update: (id: string, data: Partial<User>): User | undefined => {
    const user = users.get(id)
    if (!user) return undefined
    const updated = { ...user, ...data, updatedAt: now() }
    users.set(id, updated)
    return updated
  },
  
  delete: (id: string): boolean => users.delete(id),
  
  getAll: (): User[] => Array.from(users.values()),
}

// ============ Agents ============
const agents: Map<string, Agent> = new Map()

// 初始化默认 Agents
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

defaultAgents.forEach(agent => agents.set(agent.id, agent))

export const agentDb = {
  findById: (id: string): Agent | undefined => agents.get(id),
  
  findAll: (): Agent[] => Array.from(agents.values()),
  
  create: (data: Partial<Agent>): Agent => {
    const agent: Agent = {
      id: `agent-${generateId()}`,
      name: data.name || 'New Agent',
      role: data.role || 'custom',
      status: data.status || 'idle',
      description: data.description,
      avatar: data.avatar,
      currentTask: data.currentTask,
      podIp: data.podIp,
      lastHeartbeatAt: now(),
      createdAt: now(),
      updatedAt: now(),
    }
    agents.set(agent.id, agent)
    return agent
  },
  
  update: (id: string, data: Partial<Agent>): Agent | undefined => {
    const agent = agents.get(id)
    if (!agent) return undefined
    const updated = { ...agent, ...data, updatedAt: now() }
    agents.set(id, updated)
    return updated
  },
  
  delete: (id: string): boolean => agents.delete(id),
}

// ============ Tasks ============
const tasks: Map<string, Task> = new Map()

// 初始化默认 Tasks
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
    completedAt: now(),
  },
]

defaultTasks.forEach(task => tasks.set(task.id, task))

export const taskDb = {
  findById: (id: string): Task | undefined => tasks.get(id),
  
  findAll: (filters?: { status?: string; assignedTo?: string }): Task[] => {
    let result = Array.from(tasks.values())
    if (filters?.status) {
      result = result.filter(t => t.status === filters.status)
    }
    if (filters?.assignedTo) {
      result = result.filter(t => t.assignedTo === filters.assignedTo)
    }
    return result
  },
  
  create: (data: Partial<Task>): Task => {
    const task: Task = {
      id: `task-${generateId()}`,
      title: data.title || 'New Task',
      description: data.description,
      type: data.type || 'feature',
      status: data.status || 'pending',
      priority: data.priority || 'medium',
      progress: data.progress || 0,
      assignedTo: data.assignedTo,
      input: data.input || {},
      output: data.output,
      parentId: data.parentId,
      createdAt: now(),
    }
    tasks.set(task.id, task)
    return task
  },
  
  update: (id: string, data: Partial<Task>): Task | undefined => {
    const task = tasks.get(id)
    if (!task) return undefined
    const updated = { ...task, ...data }
    if (data.status === 'completed' && !updated.completedAt) {
      updated.completedAt = now()
    }
    tasks.set(id, updated)
    return updated
  },
  
  delete: (id: string): boolean => tasks.delete(id),
  
  findSubtasks: (parentId: string): Task[] => {
    return Array.from(tasks.values()).filter(t => t.parentId === parentId)
  },
}

// ============ Code Files ============
const codeFiles: Map<string, CodeFile> = new Map()

// 初始化默认 Code Files
const defaultFiles: CodeFile[] = [
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

defaultFiles.forEach(file => codeFiles.set(file.path, file))

export const codeDb = {
  findByPath: (path: string): CodeFile | undefined => codeFiles.get(path),
  
  findAll: (): CodeFile[] => Array.from(codeFiles.values()),
  
  create: (data: Partial<CodeFile>): CodeFile => {
    const file: CodeFile = {
      path: data.path || `/untitled-${generateId()}`,
      name: data.name || 'untitled',
      content: data.content || '',
      language: data.language || 'text',
      lastModified: now(),
      isDirectory: data.isDirectory,
    }
    codeFiles.set(file.path, file)
    return file
  },
  
  update: (path: string, content: string): CodeFile | undefined => {
    const file = codeFiles.get(path)
    if (!file) return undefined
    const updated = { ...file, content, lastModified: now() }
    codeFiles.set(path, updated)
    return updated
  },
  
  delete: (path: string): boolean => codeFiles.delete(path),
  
  search: (query: string): CodeFile[] => {
    const lowerQuery = query.toLowerCase()
    return Array.from(codeFiles.values()).filter(
      f => f.name.toLowerCase().includes(lowerQuery) || 
           f.content.toLowerCase().includes(lowerQuery)
    )
  },
  
  getRecent: (limit: number): CodeFile[] => {
    return Array.from(codeFiles.values())
      .sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime())
      .slice(0, limit)
  },
}

// ============ SMS Codes ============
const smsCodes: Map<string, SmsCode> = new Map()

export const smsDb = {
  findByPhone: (phone: string): SmsCode | undefined => smsCodes.get(phone),
  
  save: (data: SmsCode): void => {
    smsCodes.set(data.phone, data)
  },
  
  delete: (phone: string): boolean => smsCodes.delete(phone),
  
  // 清理过期的验证码
  cleanExpired: (): void => {
    const now = Date.now()
    for (const [phone, code] of smsCodes.entries()) {
      if (code.expiresAt < now) {
        smsCodes.delete(phone)
      }
    }
  },
}

// ============ Agent Logs ============
const agentLogs: Map<string, string[]> = new Map()

// 初始化默认日志
agentLogs.set('agent-1', [
  '[2024-01-15 10:00:01] Agent started',
  '[2024-01-15 10:00:02] Initializing capabilities...',
  '[2024-01-15 10:00:03] Ready for tasks',
  '[2024-01-15 10:05:30] Assigned task: Code Review',
  '[2024-01-15 10:15:45] Task completed successfully',
])

agentLogs.set('agent-3', [
  '[2024-01-15 09:00:00] Agent started',
  '[2024-01-15 09:30:00] Working on API Development',
  '[2024-01-15 10:00:00] Progress: 30%',
  '[2024-01-15 11:00:00] Progress: 65%',
])

export const logDb = {
  getLogs: (agentId: string): string[] => agentLogs.get(agentId) || [],
  
  addLog: (agentId: string, message: string): void => {
    const logs = agentLogs.get(agentId) || []
    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19)
    logs.push(`[${timestamp}] ${message}`)
    agentLogs.set(agentId, logs)
  },
  
  clearLogs: (agentId: string): void => {
    agentLogs.set(agentId, [])
  },
}

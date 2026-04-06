# AgentHive Cloud API 文档

> 本文档描述了 AgentHive Cloud 的前后端 API 接口规范。

## 概述

AgentHive Cloud 采用分层 API 架构：

- **前端 API** (`apps/web/src/api/`): LocalStorage 模拟层，用于本地开发
- **后端 API** (`apps/api/src/routes/`): Express REST API
- **WebSocket API**: 实时事件通信

## 目录

- [认证 API](#认证-api)
- [Agent API](#agent-api)
- [Task API](#task-api)
- [Code API](#code-api)
- [Demo API](#demo-api)
- [类型定义](#类型定义)

---

## 认证 API

### 接口列表

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/auth/sms/send` | 发送短信验证码 |
| POST | `/api/auth/login/sms` | 短信验证码登录 |
| POST | `/api/auth/login` | 用户名密码登录 |
| POST | `/api/auth/register` | 用户注册 |
| POST | `/api/auth/logout` | 用户登出 |
| POST | `/api/auth/refresh` | 刷新 Token |
| GET | `/api/auth/me` | 获取当前用户 |

### 发送短信验证码

```http
POST /api/auth/sms/send
Content-Type: application/json

{
  "phone": "13800138000"
}
```

**响应:**

```json
{
  "success": true,
  "message": "验证码发送成功",
  "requestId": "sms-abc123",
  "devCode": "123456"
}
```

**说明:**
- 验证码有效期 5 分钟
- 同一手机号每分钟只能发送一次
- 开发环境返回 `devCode` 方便测试

### 短信验证码登录

```http
POST /api/auth/login/sms
Content-Type: application/json

{
  "phone": "13800138000",
  "code": "123456"
}
```

**响应:**

```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "user-1",
      "username": "user_8000",
      "phone": "13800138000",
      "role": "user"
    }
  }
}
```

### 登录

```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "password"
}
```

**响应:**

```json
{
  "token": "mock-token-abc123",
  "user": {
    "id": "user-1",
    "username": "admin",
    "email": "admin@agenthive.local",
    "role": "admin"
  }
}
```

### 注册

```http
POST /api/auth/register
Content-Type: application/json

{
  "username": "newuser",
  "email": "user@example.com",
  "password": "password123"
}
```

**响应:**

```json
{
  "token": "mock-token-xyz789",
  "user": {
    "id": "user-2",
    "username": "newuser",
    "email": "user@example.com",
    "role": "user"
  }
}
```

### 获取当前用户

```http
GET /api/auth/me
Authorization: Bearer {token}
```

**响应:**

```json
{
  "id": "user-1",
  "username": "admin",
  "email": "admin@agenthive.local",
  "role": "admin"
}
```

---

## Agent API

### 接口列表

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/agents` | 获取 Agent 列表 |
| GET | `/api/agents/:id` | 获取 Agent 详情 |
| POST | `/api/agents` | 创建 Agent |
| PATCH | `/api/agents/:id` | 更新 Agent |
| DELETE | `/api/agents/:id` | 删除 Agent |
| POST | `/api/agents/:id/start` | 启动 Agent |
| POST | `/api/agents/:id/stop` | 停止 Agent |
| POST | `/api/agents/:id/pause` | 暂停 Agent |
| POST | `/api/agents/:id/resume` | 恢复 Agent |
| POST | `/api/agents/:id/command` | 发送命令 |
| GET | `/api/agents/:id/logs` | 获取日志 |

### 获取 Agent 列表

```http
GET /api/agents?teamId={teamId}
```

**响应:**

```json
{
  "agents": [
    {
      "id": "agent-1",
      "name": "Director",
      "role": "director",
      "status": "working",
      "description": "Project director agent",
      "currentTask": {
        "id": "task-3",
        "title": "Code Review",
        "progress": 100
      },
      "lastHeartbeatAt": "2024-01-15T10:00:00Z",
      "createdAt": "2024-01-08T10:00:00Z",
      "updatedAt": "2024-01-15T10:00:00Z"
    }
  ],
  "total": 3
}
```

### 获取 Agent 详情

```http
GET /api/agents/agent-1
```

**响应:**

```json
{
  "agent": {
    "id": "agent-1",
    "name": "Director",
    "role": "director",
    "status": "working",
    "description": "Project director agent",
    "currentTask": {
      "id": "task-3",
      "title": "Code Review",
      "progress": 100
    },
    "lastHeartbeatAt": "2024-01-15T10:00:00Z",
    "createdAt": "2024-01-08T10:00:00Z",
    "updatedAt": "2024-01-15T10:00:00Z"
  },
  "tasks": [
    {
      "id": "task-3",
      "title": "Code Review",
      "status": "completed",
      "progress": 100
    }
  ],
  "stats": {
    "totalTasks": 10,
    "completedTasks": 8,
    "failedTasks": 1,
    "avgCompletionTime": 0
  }
}
```

### 创建 Agent

```http
POST /api/agents
Content-Type: application/json

{
  "name": "New Agent",
  "role": "frontend_dev",
  "description": "Frontend specialist",
  "config": {
    "skills": ["vue", "typescript"]
  }
}
```

**响应:**

```json
{
  "id": "agent-abc123",
  "name": "New Agent",
  "role": "frontend_dev",
  "status": "idle",
  "description": "Frontend specialist",
  "lastHeartbeatAt": "2024-01-15T10:00:00Z",
  "createdAt": "2024-01-15T10:00:00Z",
  "updatedAt": "2024-01-15T10:00:00Z"
}
```

### 更新 Agent

```http
PATCH /api/agents/agent-1
Content-Type: application/json

{
  "name": "Updated Name",
  "description": "Updated description"
}
```

### 控制 Agent 状态

```http
POST /api/agents/agent-1/start
POST /api/agents/agent-1/stop
POST /api/agents/agent-1/pause
POST /api/agents/agent-1/resume
```

### 发送命令

```http
POST /api/agents/agent-1/command
Content-Type: application/json

{
  "type": "run_task",
  "payload": {
    "taskId": "task-123"
  }
}
```

### 获取日志

```http
GET /api/agents/agent-1/logs?lines=100
```

**响应:**

```json
[
  "[2024-01-15 10:00:01] Agent started",
  "[2024-01-15 10:00:02] Initializing capabilities...",
  "[2024-01-15 10:00:03] Ready for tasks"
]
```

---

## Task API

### 接口列表

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/tasks` | 获取任务列表 |
| GET | `/api/tasks/:id` | 获取任务详情 |
| POST | `/api/tasks` | 创建任务 |
| PATCH | `/api/tasks/:id` | 更新任务 |
| DELETE | `/api/tasks/:id` | 删除任务 |
| POST | `/api/tasks/:id/cancel` | 取消任务 |
| GET | `/api/tasks/:id/subtasks` | 获取子任务 |

### 获取任务列表

```http
GET /api/tasks?status=running&assignedTo=agent-1&page=1&pageSize=10
```

**查询参数:**

| 参数 | 类型 | 描述 |
|------|------|------|
| status | string | 状态筛选 (pending, assigned, running, completed, failed, cancelled) |
| assignedTo | string | Agent ID 筛选 |
| page | number | 页码 |
| pageSize | number | 每页数量 |

**响应:**

```json
{
  "tasks": [
    {
      "id": "task-1",
      "title": "Design System Implementation",
      "description": "Implement the design system components",
      "type": "feature",
      "status": "running",
      "priority": "high",
      "progress": 65,
      "assignedTo": "agent-3",
      "input": {},
      "createdAt": "2024-01-13T10:00:00Z"
    }
  ],
  "total": 5,
  "page": 1,
  "pageSize": 10
}
```

### 创建任务

```http
POST /api/tasks
Content-Type: application/json

{
  "title": "New Feature",
  "description": "Implement user authentication",
  "type": "feature",
  "priority": "high",
  "assignedTo": "agent-1",
  "input": {
    "requirements": ["OAuth", "JWT"]
  }
}
```

**响应:**

```json
{
  "id": "task-xyz789",
  "title": "New Feature",
  "description": "Implement user authentication",
  "type": "feature",
  "status": "pending",
  "priority": "high",
  "progress": 0,
  "assignedTo": "agent-1",
  "input": {
    "requirements": ["OAuth", "JWT"]
  },
  "createdAt": "2024-01-15T10:00:00Z"
}
```

### 更新任务

```http
PATCH /api/tasks/task-1
Content-Type: application/json

{
  "status": "completed",
  "progress": 100
}
```

### 取消任务

```http
POST /api/tasks/task-1/cancel
```

---

## Code API

### 接口列表

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/code/files` | 获取文件列表 |
| GET | `/api/code/files/:path` | 获取文件内容 |
| PUT | `/api/code/files/:path` | 更新文件 |
| GET | `/api/code/search` | 搜索文件 |
| GET | `/api/code/recent` | 获取最近文件 |

### 获取文件列表

```http
GET /api/code/files?path=/
```

**响应:**

```json
{
  "files": [
    {
      "path": "/main.go",
      "name": "main.go",
      "content": "package main...",
      "language": "go",
      "lastModified": "2024-01-15T10:00:00Z"
    },
    {
      "path": "/README.md",
      "name": "README.md",
      "content": "# AgentHive Cloud...",
      "language": "markdown",
      "lastModified": "2024-01-15T10:00:00Z"
    }
  ],
  "total": 2
}
```

### 获取文件内容

```http
GET /api/code/files/main.go
```

**响应:**

```json
{
  "path": "/main.go",
  "content": "package main\n\nimport \"fmt\"\n\nfunc main() {...}",
  "language": "go",
  "lastModified": "2024-01-15T10:00:00Z"
}
```

### 更新文件

```http
PUT /api/code/files/main.go
Content-Type: application/json

{
  "content": "package main\n\nfunc main() {\n  println(\"Hello\")\n}"
}
```

### 搜索文件

```http
GET /api/code/search?query=auth
```

**响应:**

```json
{
  "files": [
    {
      "path": "/handlers/auth.go",
      "name": "auth.go",
      "content": "...",
      "language": "go",
      "lastModified": "2024-01-15T10:00:00Z"
    }
  ],
  "total": 1
}
```

### 获取最近文件

```http
GET /api/code/recent?limit=10
```

---

## Demo API

演示接口用于展示功能，数据为模拟数据。

### 接口列表

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/demo/plan` | 获取示例计划 |
| GET | `/api/demo/agents` | 获取示例 Agents |
| GET | `/api/health` | 健康检查 |
| GET | `/api/visitor-status` | 访客状态 |

### 获取示例计划

```http
GET /api/demo/plan
```

**响应:**

```json
{
  "id": "demo-plan-1",
  "name": "示例 SaaS 项目",
  "summary": "一个带会员系统的博客平台",
  "tickets": [
    { "id": "T-001", "role": "frontend_dev", "task": "设计登录页面", "status": "done" },
    { "id": "T-002", "role": "backend_dev", "task": "搭建用户 API", "status": "doing" },
    { "id": "T-003", "role": "qa_engineer", "task": "编写测试用例", "status": "pending" }
  ]
}
```

### 健康检查

```http
GET /api/health
```

**响应:**

```json
{ "ok": true }
```

---

## WebSocket API

用于实时事件通信。

### 连接

```javascript
const ws = new WebSocket('ws://localhost:3001')
```

### 事件类型

| 事件 | 方向 | 描述 |
|------|------|------|
| `agent_state_change` | Server → Client | Agent 状态变更 |
| `code_update` | Server → Client | 代码更新 |
| `log_output` | Server → Client | 日志输出 |
| `new_message` | Server → Client | 新消息 |

### Agent 状态变更事件

```json
{
  "type": "agent_state_change",
  "payload": {
    "agentId": "agent-1",
    "oldState": "idle",
    "newState": "working",
    "progress": 45,
    "message": "Starting task execution"
  },
  "timestamp": "2024-01-15T10:00:00Z"
}
```

### 代码更新事件

```json
{
  "type": "code_update",
  "payload": {
    "agentId": "agent-1",
    "file": "src/main.ts",
    "content": "console.log('hello')",
    "language": "typescript"
  },
  "timestamp": "2024-01-15T10:00:00Z"
}
```

---

## 类型定义

### Agent

```typescript
interface Agent {
  id: string
  name: string
  role: AgentRole
  status: AgentStatus
  avatar?: string
  description?: string
  currentTask?: {
    id: string
    title: string
    progress: number
  }
  podIp?: string
  lastHeartbeatAt: string
  createdAt: string
  updatedAt: string
}

type AgentRole = 
  | 'director' 
  | 'scrum_master' 
  | 'tech_lead'
  | 'backend_dev'
  | 'frontend_dev'
  | 'qa_engineer'
  | 'devops_engineer'
  | 'custom'

type AgentStatus = 
  | 'idle'
  | 'starting'
  | 'working'
  | 'paused'
  | 'error'
  | 'completed'
```

### Task

```typescript
interface Task {
  id: string
  type: string
  status: TaskStatus
  priority: TaskPriority
  title: string
  description?: string
  assignedTo?: string
  input: Record<string, unknown>
  output?: Record<string, unknown>
  progress: number
  createdAt: string
  startedAt?: string
  completedAt?: string
  parentId?: string
  subtasks?: Task[]
}

type TaskStatus = 
  | 'pending'
  | 'assigned'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'

type TaskPriority = 'low' | 'medium' | 'high' | 'critical'
```

### CodeFile

```typescript
interface CodeFile {
  path: string
  name: string
  content: string
  language: string
  lastModified: string
  isDirectory?: boolean
}
```

### Message

```typescript
interface Message {
  id: string
  senderType: 'user' | 'agent' | 'system'
  senderId?: string
  senderName?: string
  senderRole?: AgentRole
  content: string
  contentType: 'text' | 'code' | 'image' | 'file' | 'command'
  language?: string
  metadata?: Record<string, unknown>
  createdAt: string
  taskId?: string
}
```

---

## 前端 API 客户端

前端使用 LocalStorage API 模拟后端调用：

```typescript
import { agentsApi, tasksApi, codeApi, authApi } from '@/api'

// 获取 Agents
const { agents } = await agentsApi.getAgents()

// 创建任务
const task = await tasksApi.createTask({
  title: 'New Task',
  type: 'feature',
  priority: 'high'
})

// 更新文件
await codeApi.updateFile('/main.go', 'package main')
```

---

## 错误处理

API 使用标准 HTTP 状态码：

| 状态码 | 描述 |
|--------|------|
| 200 | 成功 |
| 400 | 请求参数错误 |
| 401 | 未认证 |
| 403 | 无权限 |
| 404 | 资源不存在 |
| 500 | 服务器错误 |

**错误响应格式:**

```json
{
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

# AgentHive Cloud API 文档

> 版本: 1.0.0  
> 基础地址: `http://localhost:3001/api`  
> 更新时间: 2026-04-06

---

## 目录

1. [通用说明](#通用说明)
2. [认证模块](#认证模块-auth)
3. [Agent 模块](#agent-模块-agents)
4. [任务模块](#任务模块-tasks)
5. [代码模块](#代码模块-code)
6. [演示模块](#演示模块-demo)
7. [数据模型](#数据模型)
8. [错误码说明](#错误码说明)

---

## 通用说明

### 请求格式

- 所有请求统一使用 JSON 格式
- Content-Type: `application/json`
- 认证接口需要在 Header 中携带: `Authorization: Bearer <token>`

### 响应格式

```typescript
interface ApiResponse<T> {
  success: boolean    // 请求是否成功
  data?: T           // 响应数据（成功时）
  error?: string     // 错误信息（失败时）
  message?: string   // 提示信息
}
```

### 认证方式

除以下接口外，其他接口都需要携带 JWT Token：

- `POST /api/auth/sms/send` - 发送短信验证码
- `POST /api/auth/login/sms` - 短信登录
- `POST /api/auth/login` - 用户名密码登录
- `POST /api/auth/register` - 用户注册
- `GET /api/health` - 健康检查
- `GET /api/demo/*` - 演示数据

---

## 认证模块 (/auth)

### 1. 发送短信验证码

```http
POST /api/auth/sms/send
Content-Type: application/json
```

**请求体:**
```json
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
- `devCode` 仅在开发环境返回，用于测试
- 同一手机号 1 分钟内只能发送一次
- 验证码 5 分钟有效，最多尝试 3 次

---

### 2. 短信验证码登录

```http
POST /api/auth/login/sms
Content-Type: application/json
```

**请求体:**
```json
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
      "id": "user-abc123",
      "username": "user_8000",
      "phone": "13800138000",
      "email": null,
      "role": "user",
      "avatar": null
    }
  }
}
```

**说明:**
- 如果是新用户，会自动注册
- Token 有效期 24 小时

---

### 3. 用户名密码登录

```http
POST /api/auth/login
Content-Type: application/json
```

**请求体:**
```json
{
  "username": "testuser",
  "password": "password123"
}
```

**响应:** 同短信登录

**说明:**
- 当前实现为 Mock，任何用户名密码都接受
- 如果不存在该用户，会自动创建

---

### 4. 用户注册

```http
POST /api/auth/register
Content-Type: application/json
```

**请求体:**
```json
{
  "username": "newuser",
  "email": "user@example.com",
  "password": "password123",
  "phone": "13800138000",
  "code": "123456"
}
```

**响应:** 同登录响应

**说明:**
- `phone` 和 `code` 为可选字段
- 如果提供手机号，会先验证短信验证码

---

### 5. 用户登出

```http
POST /api/auth/logout
Authorization: Bearer <token>
```

**响应:**
```json
{
  "success": true,
  "message": "登出成功"
}
```

**说明:**
- 客户端需要自行删除本地存储的 Token

---

### 6. 刷新 Token

```http
POST /api/auth/refresh
Authorization: Bearer <token>
```

**响应:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": { ... }
  }
}
```

---

### 7. 获取当前用户

```http
GET /api/auth/me
Authorization: Bearer <token>
```

**响应:**
```json
{
  "success": true,
  "data": {
    "id": "user-abc123",
    "username": "testuser",
    "email": "user@example.com",
    "phone": "13800138000",
    "role": "user",
    "avatar": null
  }
}
```

---

## Agent 模块 (/agents)

### 1. 获取 Agent 列表

```http
GET /api/agents?teamId=xxx
Authorization: Bearer <token>
```

**响应:**
```json
{
  "success": true,
  "data": {
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
        "lastHeartbeatAt": "2026-04-06T10:00:00Z",
        "createdAt": "2026-03-30T10:00:00Z",
        "updatedAt": "2026-04-06T10:00:00Z"
      }
    ],
    "total": 3
  }
}
```

---

### 2. 获取 Agent 详情

```http
GET /api/agents/:id
Authorization: Bearer <token>
```

**响应:**
```json
{
  "success": true,
  "data": {
    "agent": { ... },
    "tasks": [ ... ],
    "stats": {
      "totalTasks": 10,
      "completedTasks": 8,
      "failedTasks": 1,
      "avgCompletionTime": 0
    }
  }
}
```

---

### 3. 创建 Agent

```http
POST /api/agents
Authorization: Bearer <token>
Content-Type: application/json
```

**请求体:**
```json
{
  "name": "Frontend Dev",
  "role": "frontend_dev",
  "description": "Frontend specialist",
  "config": {
    "avatar": "...",
    "skills": ["React", "Vue"]
  }
}
```

**响应:**
```json
{
  "success": true,
  "data": {
    "id": "agent-xxx",
    "name": "Frontend Dev",
    "role": "frontend_dev",
    "status": "idle",
    ...
  }
}
```

---

### 4. 更新 Agent

```http
PATCH /api/agents/:id
Authorization: Bearer <token>
Content-Type: application/json
```

**请求体:**
```json
{
  "name": "New Name",
  "description": "Updated description",
  "config": { ... }
}
```

---

### 5. 删除 Agent

```http
DELETE /api/agents/:id
Authorization: Bearer <token>
```

**响应:**
```json
{
  "success": true,
  "message": "Agent 已删除"
}
```

---

### 6. 控制 Agent 状态

#### 启动 Agent
```http
POST /api/agents/:id/start
Authorization: Bearer <token>
```

#### 停止 Agent
```http
POST /api/agents/:id/stop
Authorization: Bearer <token>
```

#### 暂停 Agent
```http
POST /api/agents/:id/pause
Authorization: Bearer <token>
```

#### 恢复 Agent
```http
POST /api/agents/:id/resume
Authorization: Bearer <token>
```

**响应:**
```json
{
  "success": true,
  "data": {
    "id": "agent-1",
    "status": "working",
    ...
  }
}
```

---

### 7. 发送命令

```http
POST /api/agents/:id/command
Authorization: Bearer <token>
Content-Type: application/json
```

**请求体:**
```json
{
  "type": "terminal",
  "payload": {
    "command": "npm install"
  }
}
```

**响应:**
```json
{
  "success": true,
  "message": "命令已发送",
  "data": {
    "commandId": "cmd-123456",
    "type": "terminal",
    "status": "executing"
  }
}
```

---

### 8. 获取 Agent 日志

```http
GET /api/agents/:id/logs?lines=100
Authorization: Bearer <token>
```

**响应:**
```json
{
  "success": true,
  "data": {
    "logs": [
      "[2024-01-15 10:00:01] Agent started",
      "[2024-01-15 10:00:02] Initializing capabilities...",
      "[2024-01-15 10:00:03] Ready for tasks"
    ],
    "total": 3
  }
}
```

---

## 任务模块 (/tasks)

### 1. 获取任务列表

```http
GET /api/tasks?status=running&assignedTo=agent-1&page=1&pageSize=10
Authorization: Bearer <token>
```

**查询参数:**
- `status` - 任务状态筛选
- `assignedTo` - 分配给指定 Agent
- `page` - 页码，默认 1
- `pageSize` - 每页数量，默认 10

**响应:**
```json
{
  "success": true,
  "data": {
    "tasks": [ ... ],
    "total": 20,
    "page": 1,
    "pageSize": 10
  }
}
```

---

### 2. 获取任务详情

```http
GET /api/tasks/:id
Authorization: Bearer <token>
```

---

### 3. 创建任务

```http
POST /api/tasks
Authorization: Bearer <token>
Content-Type: application/json
```

**请求体:**
```json
{
  "title": "Implement Auth Module",
  "description": "Create authentication system",
  "type": "feature",
  "priority": "high",
  "assignedTo": "agent-3",
  "input": {
    "requirements": ["Login", "Register", "JWT"]
  }
}
```

---

### 4. 更新任务

```http
PATCH /api/tasks/:id
Authorization: Bearer <token>
Content-Type: application/json
```

**请求体:**
```json
{
  "title": "Updated Title",
  "status": "completed",
  "progress": 100,
  "assignedTo": "agent-1"
}
```

---

### 5. 删除任务

```http
DELETE /api/tasks/:id
Authorization: Bearer <token>
```

---

### 6. 取消任务

```http
POST /api/tasks/:id/cancel
Authorization: Bearer <token>
```

---

### 7. 获取子任务

```http
GET /api/tasks/:id/subtasks
Authorization: Bearer <token>
```

---

## 代码模块 (/code)

### 1. 获取文件列表

```http
GET /api/code/files?path=/
Authorization: Bearer <token>
```

**响应:**
```json
{
  "success": true,
  "data": {
    "files": [
      {
        "path": "/main.go",
        "name": "main.go",
        "content": "...",
        "language": "go",
        "lastModified": "2026-04-06T10:00:00Z"
      }
    ],
    "total": 3,
    "path": "/"
  }
}
```

---

### 2. 获取文件内容

```http
GET /api/code/files/src/main.go
Authorization: Bearer <token>
```

**说明:**
- 路径参数使用通配符 `*`，支持任意层级路径

**响应:**
```json
{
  "success": true,
  "data": {
    "path": "/src/main.go",
    "content": "package main\n...",
    "language": "go",
    "lastModified": "2026-04-06T10:00:00Z"
  }
}
```

---

### 3. 更新/创建文件

```http
PUT /api/code/files/src/main.go
Authorization: Bearer <token>
Content-Type: application/json
```

**请求体:**
```json
{
  "content": "package main\n\nimport \"fmt\"\n\nfunc main() {\n    fmt.Println(\"Hello\")\n}"
}
```

**说明:**
- 文件不存在时会自动创建
- 会自动根据文件扩展名识别语言

---

### 4. 删除文件

```http
DELETE /api/code/files/src/main.go
Authorization: Bearer <token>
```

---

### 5. 搜索文件

```http
GET /api/code/search?query=main
Authorization: Bearer <token>
```

**响应:**
```json
{
  "success": true,
  "data": {
    "files": [ ... ],
    "total": 2,
    "query": "main"
  }
}
```

---

### 6. 获取最近文件

```http
GET /api/code/recent?limit=10
Authorization: Bearer <token>
```

---

## 演示模块 (/demo)

### 1. 获取示例计划

```http
GET /api/demo/plan
```

**响应:**
```json
{
  "success": true,
  "data": {
    "id": "demo-plan-1",
    "name": "示例 SaaS 项目",
    "summary": "一个带会员系统的博客平台",
    "tickets": [
      { "id": "T-001", "role": "frontend_dev", "task": "设计登录页面", "status": "done" },
      { "id": "T-002", "role": "backend_dev", "task": "搭建用户 API", "status": "doing" },
      { "id": "T-003", "role": "qa_engineer", "task": "编写测试用例", "status": "pending" }
    ]
  }
}
```

---

### 2. 获取示例 Agents

```http
GET /api/demo/agents
```

---

### 3. 获取示例任务

```http
GET /api/demo/tasks
```

---

### 4. 访客状态

```http
GET /api/demo/visitor-status
```

**响应:**
```json
{
  "success": true,
  "data": {
    "visitorId": "visitor-123456",
    "mode": "visitor",
    "expiresAt": "2026-04-07T10:00:00Z"
  }
}
```

---

## 健康检查

```http
GET /api/health
```

**响应:**
```json
{
  "ok": true,
  "timestamp": "2026-04-06T10:00:00.000Z"
}
```

---

## 数据模型

### Agent

```typescript
interface Agent {
  id: string                    // 唯一标识
  name: string                  // 名称
  role: AgentRole              // 角色
  status: AgentStatus          // 状态
  avatar?: string              // 头像 URL
  description?: string         // 描述
  currentTask?: {               // 当前任务
    id: string
    title: string
    progress: number
  }
  podIp?: string               // Pod IP
  lastHeartbeatAt: string      // 最后心跳时间
  createdAt: string            // 创建时间
  updatedAt: string            // 更新时间
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
  status: TaskStatus          // pending | assigned | running | completed | failed | cancelled
  priority: TaskPriority      // low | medium | high | critical
  title: string
  description?: string
  assignedTo?: string         // Agent ID
  input: Record<string, unknown>
  output?: Record<string, unknown>
  progress: number            // 0-100
  createdAt: string
  startedAt?: string
  completedAt?: string
  parentId?: string           // 父任务ID
  subtasks?: Task[]
}
```

### User

```typescript
interface User {
  id: string
  username: string
  email?: string
  phone?: string
  role: string
  avatar?: string
  createdAt: string
  updatedAt: string
}
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

---

## 错误码说明

| HTTP 状态码 | 含义 | 说明 |
|------------|------|------|
| 200 | OK | 请求成功 |
| 201 | Created | 创建成功 |
| 400 | Bad Request | 请求参数错误 |
| 401 | Unauthorized | 未认证或 Token 无效 |
| 404 | Not Found | 资源不存在 |
| 409 | Conflict | 资源冲突（如用户名已存在）|
| 429 | Too Many Requests | 请求过于频繁 |
| 500 | Internal Server Error | 服务器内部错误 |

---

## 开发环境配置

### 启动服务

```bash
cd apps/api
npm install
npm run dev
```

服务将在 `http://localhost:3001` 启动

### 环境变量

```bash
PORT=3001                           # 服务端口
JWT_SECRET=your-secret-key          # JWT 密钥
CORS_ORIGIN=http://localhost:3000   # 前端地址
```

### 测试数据

当前使用内存数据库，包含以下默认数据：

**默认 Agents:**
- agent-1: Director (working)
- agent-2: Frontend Dev (idle)
- agent-3: Backend Dev (working)

**默认 Tasks:**
- task-1: Design System Implementation (running, 65%)
- task-2: Authentication Module (pending)
- task-3: Code Review (completed, 100%)

**默认 Code Files:**
- /main.go
- /handlers/auth.go
- /README.md

---

## 注意事项

1. **短信验证码**: 开发环境会返回 `devCode` 字段，生产环境不应返回验证码
2. **JWT Token**: 有效期 24 小时，建议客户端实现自动刷新机制
3. **内存数据库**: 当前为 Mock 实现，服务重启后数据会丢失
4. **文件路径**: 代码模块使用通配符路由，支持任意层级路径

---

## 后续计划

- [ ] 集成真实数据库 (PostgreSQL)
- [ ] 集成阿里云短信服务
- [ ] WebSocket 实时通信
- [ ] 文件系统持久化
- [ ] 用户权限管理

# AgentHive Cloud API 文档

> 版本: 1.0.0  
> 基础地址: `http://localhost:3001/api`  
> 更新时间: 2026-04-06
> 状态: ✅ Backend Server Running on Port 3001

---

## 📋 开发文档

- **[API TODO 清单](./API_TODO.md)** - 待实现功能一览

---

## 快速链接

- [健康检查](#健康检查) - `GET /api/health`
- [E2E 测试状态](#e2e-测试状态)
- [认证模块](#认证模块-auth)
- [Agent 模块](#agent-模块-agents)
- [任务模块](#任务模块-tasks)
- [代码模块](#代码模块-code)

---

## 目录

1. [E2E 测试状态](#e2e-测试状态)
2. [API TODO 清单](./API_TODO.md) 🔧
3. [通用说明](#通用说明)
4. [认证模块](#认证模块-auth)
5. [Agent 模块](#agent-模块-agents)
6. [任务模块](#任务模块-tasks)
7. [代码模块](#代码模块-code)
8. [演示模块](#演示模块-demo)
9. [数据模型](#数据模型)
10. [错误码说明](#错误码说明)
11. [开发环境配置](#开发环境配置)

---

## E2E 测试状态

最新 E2E 测试结果 (Port 3000 Frontend + Port 3001 Backend):

| 类别 | 测试项 | 状态 |
|------|--------|------|
| **Frontend** | Landing Page | ✅ Pass |
| **Frontend** | Login Page | ✅ Pass |
| **Frontend** | Chat Page | ✅ Pass |
| **Frontend** | Features Page | ✅ Pass |
| **Frontend** | Pricing Page | ✅ Pass |
| **Frontend** | Docs Page | ✅ Pass |
| **Backend** | Health Check | ✅ Pass |
| **Backend** | GET /api/agents | ❌ 500 (DB not initialized) |
| **Backend** | GET /api/tasks | ❌ 500 (DB not initialized) |
| **Backend** | GET /api/code/files | ❌ 500 (DB not initialized) |
| **Backend** | POST /api/auth/login | ❌ 500 (DB not initialized) |
| **Proxy** | /api/projects → Backend | ✅ Pass |
| **Proxy** | /api/auth/login → Backend | ✅ Pass |
| **Proxy** | /api/code/files → Backend | ✅ Pass |
| **Error** | 404 Handling | ✅ Pass |

**总体: 12/16 通过 (75%)**

> **注意**: Backend API 返回 500 是因为 PostgreSQL 数据库表尚未初始化  
> 🔧 **[TODO]**: 需要创建数据库初始化脚本，详见 [API_TODO.md#2-postgresql-数据库初始化](./API_TODO.md#2-postgresql-数据库初始化)

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

> ⚠️ **注意**: 短信服务尚未完全实现，详见 [API_TODO.md#1-短信验证码服务](./API_TODO.md#1-短信验证码服务)

### 1. 发送短信验证码 `[TODO]`

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

**响应 (成功):**
```json
{
  "success": true,
  "message": "验证码发送成功",
  "requestId": "sms-abc123",
  "devCode": "123456"
}
```

**响应 (失败):**
```json
{
  "success": false,
  "message": "验证码服务暂不可用"
}
```

**状态**: 🟡 开发中 - 当前返回固定验证码 `123456`  
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

> ⚠️ **注意**: Agent 运行时集成尚未完成，详见 [API_TODO.md#4-agent-运行时集成](./API_TODO.md#4-agent-运行时集成)

### 1. 获取 Agent 列表 `[MOCK]`

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

> ⚠️ **注意**: 任务执行引擎尚未实现，详见 [API_TODO.md#5-任务执行引擎](./API_TODO.md#5-任务执行引擎)

### 1. 获取任务列表 `[MOCK]`

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

> 📝 **说明**: 当前使用本地文件系统存储，对象存储支持详见 [API_TODO.md#6-文件存储服务](./API_TODO.md#6-文件存储服务)

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

> 🎮 **说明**: 此模块仅用于前端开发测试，返回静态 Mock 数据

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

## WebSocket 实时通信

WebSocket 服务在 Redis 连接成功时启用。

### 连接地址
```
ws://localhost:3001
```

### 事件

#### 订阅 Agent 状态
```javascript
socket.emit('agent:subscribe', 'agent-id-123')
```

#### 取消订阅
```javascript
socket.emit('agent:unsubscribe', 'agent-id-123')
```

#### 发送命令给 Agent
```javascript
socket.emit('agent:command', {
  agentId: 'agent-id-123',
  command: 'restart'
})
```

#### 订阅任务进度
```javascript
socket.emit('task:subscribe', 'task-id-456')
```

#### 终端输入
```javascript
socket.emit('terminal:input', {
  agentId: 'agent-id-123',
  input: 'npm install'
})
```

### 服务器推送事件

- `agent:status` - Agent 状态变更
- `agent:log` - Agent 日志输出
- `task:progress` - 任务进度更新
- `task:log` - 任务日志
- `terminal:output` - 终端输出

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

**E2E 测试:** ✅ Pass

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
# Server
PORT=3001                           # 服务端口 (默认: 3001)
JWT_SECRET=your-secret-key          # JWT 密钥
CORS_ORIGIN=http://localhost:3000   # 前端地址

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/agenthive
PGHOST=localhost
PGPORT=5432
PGDATABASE=agenthive
PGUSER=postgres
PGPASSWORD=password

# Redis (Optional)
REDIS_URL=redis://localhost:6379

# Workspace
WORKSPACE_BASE=/data/workspaces     # Agent 工作区目录

# LLM (Optional)
OLLAMA_HOST=http://localhost:11434
DEFAULT_LLM_PROVIDER=ollama
```

### 数据库初始化

首次启动需要初始化 PostgreSQL 数据库：

```bash
cd apps/api
npm run db:init
```

如果权限不足，可手动执行 SQL 脚本（见 `DATABASE.md`）。

### 测试数据

数据库初始化后，会自动创建以下默认数据：

**默认 Agents:**
- agent-1: Director (working)
- agent-2: Frontend Dev (idle)
- agent-3: Backend Dev (working)

**默认 Tasks:**
- task-1: Design System Implementation (running, 65%)
- task-2: Authentication Module (pending)
- task-3: Code Review (completed, 100%)

---

## 注意事项

1. **短信验证码**: 开发环境会返回 `devCode` 字段，生产环境不应返回验证码
2. **JWT Token**: 有效期 24 小时，建议客户端实现自动刷新机制
3. **PostgreSQL**: 数据库需要预先初始化 (`npm run db:init`)
4. **Redis**: 可选依赖，用于 WebSocket 和任务队列，不配置时部分功能受限
5. **文件路径**: 代码模块使用通配符路由，支持任意层级路径
6. **代理转发**: Frontend (Port 3000) 会将 `/api/*` 请求代理到 Backend (Port 3001)

---

## 后续计划

- [x] ✅ 集成 PostgreSQL 数据库
- [x] ✅ 集成阿里云短信服务 (接口已预留)
- [x] ✅ WebSocket 实时通信 (需 Redis)
- [ ] 文件系统持久化
- [ ] 用户权限管理 (RBAC)
- [ ] Kubernetes Operator 部署
- [ ] 分布式任务队列

---

## 架构说明

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (Nuxt)                       │
│                      http://localhost:3000                  │
└───────────────────────────┬─────────────────────────────────┘
                            │ /api/* Proxy
┌───────────────────────────▼─────────────────────────────────┐
│                      Backend (Express)                       │
│                      http://localhost:3001                  │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐           │
│  │  Auth   │ │ Agents  │ │  Tasks  │ │  Code   │           │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘           │
└───────────────────────────┬─────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│  PostgreSQL  │   │    Redis     │   │    LLM       │
│   (Data)     │   │  (Cache/WS)  │   │  (Ollama)    │
└──────────────┘   └──────────────┘   └──────────────┘
```

### 运行状态

```bash
# Terminal 1 - Start Backend
cd agenthive-cloud/apps/api
npm run dev
# or: node dist/index.js

# Terminal 2 - Start Frontend
cd agenthive-cloud/apps/landing
npm run build
node .output-new/server/index.mjs

# Terminal 3 - Run E2E Tests
node e2e-test.mjs
```

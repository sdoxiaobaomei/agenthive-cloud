# AgentHive Cloud - API 文档 (统一版)

> **版本**: 1.2.0  
> **生成时间**: 2026-05-03  
> **覆盖范围**: 全部 7 个后端服务 + 前端 BFF 层 + 前端调用接口  
> **架构**: Java Gateway (Spring Cloud Gateway) + Node API + Java Microservices

---

## 目录

1. [架构概览与路由总览](#1-架构概览与路由总览)
2. [认证模块 (auth)](#2-认证模块-auth)
3. [用户模块 (users)](#3-用户模块-users)
4. [Agent 模块 (agents)](#4-agent-模块-agents)
5. [任务模块 (tasks)](#5-任务模块-tasks)
6. [聊天模块 (chat)](#6-聊天模块-chat)
7. [代码模块 (code)](#7-代码模块-code)
8. [积分模块 (credits)](#8-积分模块-credits)
9. [项目模块 (projects)](#9-项目模块-projects)
10. [订单模块 (orders)](#10-订单模块-orders)
11. [支付模块 (payments)](#11-支付模块-payments)
12. [购物车模块 (carts)](#12-购物车模块-carts)
13. [物流模块 (logistics)](#13-物流模块-logistics)
14. [演示模块 (demo)](#14-演示模块-demo)
15. [系统模块 (system)](#15-系统模块-system)
16. [WebSocket 实时通信](#16-websocket-实时通信)
17. [响应格式说明](#17-响应格式说明)
18. [前端使用状态汇总](#18-前端使用状态汇总)
19. [错误码说明](#19-错误码说明)

---

## 1. 架构概览与路由总览

### 1.1 服务拓扑

```
┌─────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Landing   │────▶│  Nuxt BFF Layer │────▶│  Java Gateway   │
│  (Frontend) │     │ (server/api/)   │     │   (Port 8080)   │
└─────────────┘     └─────────────────┘     └────────┬────────┘
                                                     │
                          ┌──────────────────────────┼──────────────────────────┐
                          │                          │                          │
                          ▼                          ▼                          ▼
                   ┌─────────────┐           ┌─────────────┐           ┌─────────────┐
                   │ auth-service│           │  Node API   │           │ order-svc   │
                   │   (Java)    │           │  (Port 3001)│           │   (Java)    │
                   │  /auth/**   │           │ /agents/**  │           │  /orders/** │
                   │  /users/**  │           │ /tasks/**   │           │             │
                   └─────────────┘           │ /chat/**   │           └─────────────┘
                                             │ /code/**   │           ┌─────────────┐
                                             │ /projects/**│           │ payment-svc │
                                             │ /credits/**│           │   (Java)    │
                                             │ /demo/**   │           │ /payments/**│
                                             └─────────────┘           │ /wallets/** │
                                                                       │ /credits/**│
                                                                       └─────────────┘
                                                                       ┌─────────────┐
                                                                       │  cart-svc   │
                                                                       │   (Java)    │
                                                                       │  /carts/**  │
                                                                       └─────────────┘
                                                                       ┌─────────────┐
                                                                       │ logistics   │
                                                                       │   (Java)    │
                                                                       │ /logistics/**│
                                                                       └─────────────┘
```

### 1.2 Gateway 路由配置

| Gateway 路径 | 目标服务 | StripPrefix | 实际后端路径 | 前端使用 |
|-------------|---------|-------------|-------------|---------|
| `/api/auth/**` | auth-service | 1 | `/auth/**` | ✅ 全部使用 |
| `/api/users/**` | auth-service | 1 | `/users/**` | ❌ 未对接 |
| `/api/agents/**` | api-service (Node) | 0 | `/api/agents/**` | ✅ 全部使用 |
| `/api/tasks/**` | api-service (Node) | 0 | `/api/tasks/**` | ✅ 全部使用 |
| `/api/code/**` | api-service (Node) | 0 | `/api/code/**` | ✅ 全部使用 |
| `/api/chat/**` | api-service (Node) | 0 | `/api/chat/**` | ✅ 全部使用 |
| `/api/projects/**` | api-service (Node) | 0 | `/api/projects/**` | ⚠️ 部分使用 |
| `/api/demo/**` | api-service (Node) | 0 | `/api/demo/**` | ⚠️ 部分使用 |
| `/api/health` | api-service (Node) | 0 | `/api/health` | ❌ 内部使用 |
| `/api/orders/**` | order-service | 1 | `/orders/**` | ❌ 未对接 |
| `/api/payments/**` | payment-service | 1 | `/payments/**` | ❌ 未对接 |
| `/api/carts/**` | cart-service | 1 | `/carts/**` | ❌ 未对接 |
| `/api/logistics/**` | logistics-service | 1 | `/logistics/**` | ❌ 未对接 |

> **注**: `user-service` 已合并到 `auth-service`，`/api/users/**` 路由现在指向 auth-service 的 `UserController`。

### 1.3 认证方式总览

| 认证类型 | 方式 | 使用场景 |
|---------|------|---------|
| **Token 认证** | `Authorization: Bearer <token>` | 大多数对外接口 |
| **内部调用认证** | `X-Internal-Token` | 服务间内部调用 (payment-service credits agent-debit/admin 等) |
| **用户 ID 透传** | `X-User-Id` | 部分服务间调用透传身份 |

---

## 2. 认证模块 (auth)

**归属服务**: Java auth-service  
**BFF 代理**: `landing/server/api/auth/...` (全部经过 BFF 层)  
**前端使用**: ✅ **全部使用**

### 2.1 发送短信验证码

| 字段 | 值 |
|------|-----|
| 前端方法 | `auth.sendSms` |
| 前端路径 | `POST /api/auth/sms/send` |
| BFF 代理 | `landing/server/api/auth/sms/send.post.ts` |
| 后端路径 | `POST /auth/sms/send` → `SmsController.sendVerifyCode()` |
| 请求参数 | `{ phone: string, type: 'login' \| 'register' \| 'reset' }` |
| 响应数据 | `Result<Void>` — 成功返回空，开发环境可能带 `devCode` |
| 关键说明 | 前端 `type` 自动映射: `login/register` → `LOGIN_REGISTER`, `reset` → `RESET_PASSWORD`。已接入阿里云 SMS，60秒间隔限制，5分钟有效，每日上限10条 |

### 2.2 验证短信验证码

| 字段 | 值 |
|------|-----|
| 前端方法 | ❌ 未定义 (BFF 层内部使用) |
| 后端路径 | `POST /auth/sms/verify` → `SmsController.verifySmsCode()` |
| 请求参数 | `{ phone: string, code: string, templateType?: string }` |
| 响应数据 | `Result<Void>` |

### 2.3 短信验证码登录

| 字段 | 值 |
|------|-----|
| 前端方法 | `auth.loginBySms` |
| 前端路径 | `POST /api/auth/login/sms` |
| BFF 代理 | `landing/server/api/auth/login/sms.post.ts` |
| 后端路径 | `POST /auth/login/sms` → `AuthController.smsLogin()` |
| 请求参数 | `{ phone: string, code: string }` |
| 响应数据 | `TokenResponse` → BFF 转换: `{ accessToken, refreshToken, expiresIn?, tokenType?, isNewUser?, user }` |
| 关键说明 | 新用户自动注册，用户名自动生成 `phone_XXXX`。继承 IP 限流 5次/分钟 |

### 2.4 用户名密码登录

| 字段 | 值 |
|------|-----|
| 前端方法 | `auth.login` |
| 前端路径 | `POST /api/auth/login` |
| BFF 代理 | `landing/server/api/auth/login.post.ts` (自动判断短信/密码) |
| 后端路径 | `POST /auth/login` → `AuthController.login()` |
| 请求参数 | `{ username: string(3-64), password: string(8-128) }` |
| 响应数据 | `TokenResponse` — 同 2.3 |

### 2.5 用户注册

| 字段 | 值 |
|------|-----|
| 前端方法 | `auth.register` |
| 前端路径 | `POST /api/auth/register` |
| BFF 代理 | `landing/server/api/auth/register.post.ts` |
| 后端路径 | `POST /auth/register` → `AuthController.register()` |
| 请求参数 | `{ username: string(3-64), password: string(8-128), email?: string }` |
| 响应数据 | `TokenResponse` — 含 `syncStatus` 标记 |
| 关键说明 | Node API 降级路径: `POST /api/auth/register`。Java 不可用时本地创建，`syncStatus=pending` |

### 2.6 刷新 Token

| 字段 | 值 |
|------|-----|
| 前端方法 | `auth.refresh` |
| 前端路径 | `POST /api/auth/refresh` |
| BFF 代理 | `landing/server/api/auth/refresh.post.ts` |
| 后端路径 | `POST /auth/refresh` → `AuthController.refresh()` |
| 请求参数 | `{ refreshToken: string }` |
| 响应数据 | `{ accessToken: string, refreshToken: string }` |

### 2.7 登出

| 字段 | 值 |
|------|-----|
| 前端方法 | `auth.logout` |
| 前端路径 | `POST /api/auth/logout` |
| BFF 代理 | `landing/server/api/auth/logout.post.ts` |
| 后端路径 | `POST /auth/logout` → `AuthController.logout()` |
| 响应数据 | `Result<Void>` |

### 2.8 获取当前用户信息

| 字段 | 值 |
|------|-----|
| 前端方法 | `auth.me` |
| 前端路径 | `GET /api/auth/me` |
| BFF 代理 | `landing/server/api/auth/me.get.ts` (做格式转换) |
| 后端路径 | `GET /auth/me` → `AuthController.me()` |
| 响应数据 | Java `UserVO` → BFF 映射为前端 `User` |

**Java UserVO 字段**:
```typescript
{ id: Long, username: string, name?: string, email?: string, phone?: string, avatar?: string, status: string, createdAt: Date, roles: string[] }
```

**BFF 转换后前端 User**:
```typescript
{ id: string, username: string, name: string, email?: string, phone?: string, role: string, avatar?: string, createdAt: string, updatedAt: string }
```

### 2.9 更新用户资料 (后端有，前端未使用)

| 字段 | 值 |
|------|-----|
| 前端方法 | ❌ 未定义 |
| 后端路径 | `PATCH /auth/profile` → `AuthController.updateProfile()` |
| 请求参数 | `{ name?: string, email?: string, phone?: string, avatar?: string }` |
| 响应数据 | `Result<UserVO>` |

### 2.10 获取用户角色 (后端有，前端未使用)

| 字段 | 值 |
|------|-----|
| 前端方法 | ❌ 未定义 |
| 后端路径 | `GET /auth/users/{id}/roles` → `AuthController.getUserRoles()` |
| 路径参数 | `id` (Long) |
| 响应数据 | `Result<List<String>>` — 角色代码列表 |

---

## 3. 用户模块 (users)

**归属服务**: auth-service (已合并 user-service)  
**前端使用**: ❌ **未对接**

> **背景**: user-service 已合并到 auth-service，Gateway `/api/users/**` 路由现在指向 auth-service，保持 `/users` 前缀向后兼容。

### 3.1 获取用户角色 (兼容路由)

| 字段 | 值 |
|------|-----|
| 前端方法 | ❌ 未定义 |
| 后端路径 | `GET /users/{id}/roles` → `UserController.getUserRoles()` |
| 路径参数 | `id` (Long, @Positive) |
| 响应数据 | `Result<List<String>>` — 角色代码列表 |
| 关键说明 | 与 2.10 功能相同，路径前缀不同。前端两个都没调用 |

---

## 4. Agent 模块 (agents)

**归属服务**: api-service (Node.js)  
**BFF 代理**: `landing/server/api/agents.get.ts` (仅列表)  
**前端使用**: ✅ **全部使用**

### 4.1 获取 Agent 列表

| 字段 | 值 |
|------|-----|
| 前端方法 | `agents.list` |
| 前端路径 | `GET /api/agents` |
| BFF 代理 | `landing/server/api/agents.get.ts` |
| 后端路径 | `GET /api/agents` → `getAgents` |
| 查询参数 | `status?`, `type?`, `page?`, `pageSize?`, `sortBy?`, `sortOrder?` |
| 响应数据 | `PaginatedResponse<Agent>` |

### 4.2 获取所有 Agent (不分页)

| 字段 | 值 |
|------|-----|
| 前端方法 | `agents.getAll` |
| 前端路径 | `GET /api/agents/all` |
| 后端路径 | ❌ **路由缺失** — Node API 只有 `GET /`，没有 `/all` |
| 问题 | 🔴 前后端不一致 |

### 4.3 创建 Agent

| 字段 | 值 |
|------|-----|
| 前端方法 | `agents.create` |
| 前端路径 | `POST /api/agents` |
| 后端路径 | `POST /api/agents` → `createAgent` |
| 请求参数 | `{ name: string(1-100), type: string(1-50), description?: string, config?: Record<string,any> }` |
| 响应数据 | `Agent` |

### 4.4 获取 Agent 详情

| 字段 | 值 |
|------|-----|
| 前端方法 | `agents.get` |
| 前端路径 | `GET /api/agents/:id` |
| 后端路径 | `GET /api/agents/:id` → `getAgent` |
| 响应数据 | `{ agent: Agent, tasks: Task[], stats: { totalTasks, completedTasks, failedTasks, avgCompletionTime } }` |

### 4.5 更新 Agent

| 字段 | 值 |
|------|-----|
| 前端方法 | `agents.update` |
| 前端路径 | `PATCH /api/agents/:id` |
| 后端路径 | `PATCH /api/agents/:id` → `updateAgent` |
| 请求参数 | `{ name?: string, description?: string, config?: Record<string,any> }` |

### 4.6 删除 Agent

| 字段 | 值 |
|------|-----|
| 前端方法 | `agents.delete` |
| 前端路径 | `DELETE /api/agents/:id` |
| 后端路径 | `DELETE /api/agents/:id` → `deleteAgent` |

### 4.7 启动 Agent

| 字段 | 值 |
|------|-----|
| 前端方法 | `agents.start` |
| 前端路径 | `POST /api/agents/:id/start` |
| 后端路径 | `POST /api/agents/:id/start` → `startAgent` |
| 响应数据 | `Agent` (status → `working`) |

### 4.8 停止 Agent

| 字段 | 值 |
|------|-----|
| 前端方法 | `agents.stop` |
| 前端路径 | `POST /api/agents/:id/stop` |
| 后端路径 | `POST /api/agents/:id/stop` → `stopAgent` |
| 响应数据 | `Agent` (status → `idle`) |

### 4.9 暂停 Agent

| 字段 | 值 |
|------|-----|
| 前端方法 | `agents.pause` |
| 前端路径 | `POST /api/agents/:id/pause` |
| 后端路径 | `POST /api/agents/:id/pause` → `pauseAgent` |
| 响应数据 | `Agent` (status → `paused`) |

### 4.10 恢复 Agent

| 字段 | 值 |
|------|-----|
| 前端方法 | `agents.resume` |
| 前端路径 | `POST /api/agents/:id/resume` |
| 后端路径 | `POST /api/agents/:id/resume` → `resumeAgent` |
| 响应数据 | `Agent` (status → `working`) |

### 4.11 获取 Agent 日志

| 字段 | 值 |
|------|-----|
| 前端方法 | `agents.getLogs` |
| 前端路径 | `GET /api/agents/:id/logs` |
| 后端路径 | `GET /api/agents/:id/logs` → `getAgentLogs` |
| 查询参数 | `lines?`, `level?`, `startTime?`, `endTime?` |
| 响应数据 | `{ logs: AgentLog[], total: number }` |

### 4.12 获取 Agent 实时状态 (后端有，前端未使用)

| 字段 | 值 |
|------|-----|
| 前端方法 | ❌ 未定义 |
| 后端路径 | `GET /api/agents/:id/status` → `getAgentStatus` |
| 响应数据 | `{ agentId, dbStatus, redisStatus, lastHeartbeat, metadata }` |

### 4.13 向 Agent 发送命令 (后端有，前端未使用)

| 字段 | 值 |
|------|-----|
| 前端方法 | ❌ 未定义 |
| 后端路径 | `POST /api/agents/:id/command` → `sendCommand` |
| 请求参数 | `{ type: string, payload?: Record<string,any> }` |
| 响应数据 | `{ commandId, type, status: 'executing' }` |

### 4.14 为 Agent 创建任务 (后端有，前端未使用)

| 字段 | 值 |
|------|-----|
| 前端方法 | ❌ 未定义 |
| 后端路径 | `POST /api/agents/:id/tasks` → `createAgentTask` |
| 请求参数 | `{ title, description?, type, priority?, input? }` |
| 响应数据 | `{ task, agentId }` — 自动触发 TaskExecutionService 执行 |

---

## 5. 任务模块 (tasks)

**归属服务**: api-service (Node.js)  
**BFF 代理**: `landing/server/api/tasks.get.ts` (仅列表)  
**前端使用**: ✅ **全部使用**

### 5.1 获取任务列表

| 字段 | 值 |
|------|-----|
| 前端方法 | `tasks.list` |
| 前端路径 | `GET /api/tasks` |
| BFF 代理 | `landing/server/api/tasks.get.ts` |
| 后端路径 | `GET /api/tasks` → `getTasks` |
| 查询参数 | `status?`, `assignedTo?`, `page?`, `pageSize?` |
| 响应数据 | `PaginatedResponse<Task>` |

### 5.2 获取所有任务 (不分页)

| 字段 | 值 |
|------|-----|
| 前端方法 | `tasks.getAll` |
| 前端路径 | `GET /api/tasks/all` |
| 后端路径 | ❌ **路由缺失** — Node API 只有 `GET /`，没有 `/all` |
| 问题 | 🔴 前后端不一致 |

### 5.3 创建任务

| 字段 | 值 |
|------|-----|
| 前端方法 | `tasks.create` |
| 前端路径 | `POST /api/tasks` |
| 后端路径 | `POST /api/tasks` → `createTask` |
| 请求参数 | `{ title: string(1-200), description?, type, priority?, assignedTo?, input?, dueDate?, tags? }` |
| 响应数据 | `Task` |

### 5.4 获取任务详情

| 字段 | 值 |
|------|-----|
| 前端方法 | `tasks.get` |
| 前端路径 | `GET /api/tasks/:id` |
| 后端路径 | `GET /api/tasks/:id` → `getTask` |
| 响应数据 | `{ ...Task, execution: TaskExecutionStatus \| null }` |

### 5.5 更新任务

| 字段 | 值 |
|------|-----|
| 前端方法 | `tasks.update` |
| 前端路径 | `PATCH /api/tasks/:id` |
| 后端路径 | `PATCH /api/tasks/:id` → `updateTask` |
| 请求参数 | `{ title?, description?, priority?, status?, progress?(0-100), assignedTo?(UUID), input? }` |

### 5.6 删除任务

| 字段 | 值 |
|------|-----|
| 前端方法 | `tasks.delete` |
| 前端路径 | `DELETE /api/tasks/:id` |
| 后端路径 | `DELETE /api/tasks/:id` → `deleteTask` |

### 5.7 执行任务 (后端有，前端未使用)

| 字段 | 值 |
|------|-----|
| 前端方法 | ❌ 未定义 |
| 后端路径 | `POST /api/tasks/:id/execute` → `executeTask` |
| 响应数据 | `{ taskId, status: 'running' }` — 异步执行，通过 TaskExecutionService |

### 5.8 取消任务 (后端有，前端未使用)

| 字段 | 值 |
|------|-----|
| 前端方法 | ❌ 未定义 |
| 后端路径 | `POST /api/tasks/:id/cancel` → `cancelTask` |

### 5.9 获取任务进度 (后端有，前端未使用)

| 字段 | 值 |
|------|-----|
| 前端方法 | ❌ 未定义 |
| 后端路径 | `GET /api/tasks/:id/progress` → `getTaskProgress` |
| 响应数据 | `{ taskId, status, progress, startedAt, completedAt, error }` |

### 5.10 获取任务日志 (后端有，前端未使用)

| 字段 | 值 |
|------|-----|
| 前端方法 | ❌ 未定义 |
| 后端路径 | `GET /api/tasks/:id/logs` → `getTaskLogs` |
| 查询参数 | `limit` (默认 100, 最大 500) |
| 响应数据 | `{ taskId, logs[], total }` |

### 5.11 获取子任务 (后端有，前端未使用)

| 字段 | 值 |
|------|-----|
| 前端方法 | ❌ 未定义 |
| 后端路径 | `GET /api/tasks/:id/subtasks` → `getSubtasks` |
| 响应数据 | `{ subtasks[], total }` |

---

## 6. 聊天模块 (chat)

**归属服务**: api-service (Node.js)  
**BFF 代理**: ❌ 无独立 BFF 文件，前端直接调用  
**前端使用**: ✅ **全部使用**

### 6.1 创建会话

| 字段 | 值 |
|------|-----|
| 前端方法 | `chat.createSession` |
| 前端路径 | `POST /api/chat/sessions` |
| 后端路径 | `POST /api/chat/sessions` → `createSession` |
| 请求参数 | `{ projectId?(UUID), title?(max 200) }` |
| 响应数据 | `ChatSession` |

### 6.2 获取会话列表

| 字段 | 值 |
|------|-----|
| 前端方法 | `chat.listSessions` |
| 前端路径 | `GET /api/chat/sessions` |
| 后端路径 | `GET /api/chat/sessions` → `listSessions` |
| 响应数据 | `{ items: ChatSession[], total }` |

### 6.3 获取会话详情

| 字段 | 值 |
|------|-----|
| 前端方法 | `chat.getSession` |
| 前端路径 | `GET /api/chat/sessions/:id` |
| 后端路径 | `GET /api/chat/sessions/:id` → `getSession` |

### 6.4 发送消息

| 字段 | 值 |
|------|-----|
| 前端方法 | `chat.sendMessage` |
| 前端路径 | `POST /api/chat/sessions/:id/messages` |
| 后端路径 | `POST /api/chat/sessions/:id/messages` → `sendMessage` |
| 请求参数 | `{ content: string(1-10000) }` |
| 响应数据 | `{ message: { id, role, content, timestamp }, intent, tasks: [{ ticketId, workerRole, status }] }` |

### 6.5 获取消息列表

| 字段 | 值 |
|------|-----|
| 前端方法 | `chat.getMessages` |
| 前端路径 | `GET /api/chat/sessions/:id/messages?page=&pageSize=` |
| 后端路径 | `GET /api/chat/sessions/:id/messages` → `getMessages` |
| 查询参数 | `page`(默认1), `pageSize`(默认50) |
| 响应数据 | `{ messages: [{ id, role, content, timestamp, metadata? }], total, page, pageSize }` |

### 6.6 执行聊天任务

| 字段 | 值 |
|------|-----|
| 前端方法 | `chat.executeTask` |
| 前端路径 | `POST /api/chat/sessions/:id/execute` |
| 后端路径 | `POST /api/chat/sessions/:id/execute` → `executeTask` |
| 请求参数 | `{ content: string }` |
| 响应数据 | `{ intent, tasks: [{ ticketId, workerRole, status }] }` |

### 6.7 获取会话任务列表

| 字段 | 值 |
|------|-----|
| 前端方法 | `chat.getTasks` |
| 前端路径 | `GET /api/chat/sessions/:id/tasks` |
| 后端路径 | `GET /api/chat/sessions/:id/tasks` → `getTasks` |

### 6.8 获取会话进度

| 字段 | 值 |
|------|-----|
| 前端方法 | `chat.getProgress` |
| 前端路径 | `GET /api/chat/sessions/:id/progress` |
| 后端路径 | `GET /api/chat/sessions/:id/progress` → `getProgress` |

---

## 7. 代码模块 (code)

**归属服务**: api-service (Node.js)  
**BFF 代理**: `landing/server/api/code/...` (全部经过 BFF)  
**前端使用**: ✅ **全部使用**

### 7.1 获取文件列表

| 字段 | 值 |
|------|-----|
| 前端方法 | `code.getFiles` |
| 前端路径 | `GET /api/code/files?projectId=&path=` |
| BFF 代理 | `landing/server/api/code/files.get.ts` |
| 后端路径 | `GET /api/code/workspace/files` → `getWorkspaceFiles` |
| 查询参数 | `projectId`, `path?`(默认'') |
| 响应数据 | `{ files: [{ name, path, type, size, modifiedAt }], path, workspace }` |
| 安全机制 | 路径安全检查 `isPathSafe()`，禁止超出工作区范围 |

### 7.2 获取文件内容

| 字段 | 值 |
|------|-----|
| 前端方法 | `code.getFile` |
| 前端路径 | `GET /api/code/files/:path?projectId=` |
| BFF 代理 | `landing/server/api/code/files/[...path].get.ts` |
| 后端路径 | `GET /api/code/workspace/files/content` → `getWorkspaceFileContent` |
| 查询参数 | `projectId`, `filePath` |
| 响应数据 | `{ path, name, content, language, encoding, size, modifiedAt }` |

### 7.3 保存/更新文件

| 字段 | 值 |
|------|-----|
| 前端方法 | `code.updateFile` |
| 前端路径 | `POST /api/code/files/save` |
| BFF 代理 | `landing/server/api/code/files/save.post.ts` |
| 后端路径 | `POST /api/code/workspace/files/save` → `saveWorkspaceFile` |
| 请求参数 | `{ projectId, filePath, content, encoding?, message? }` |

### 7.4 创建文件/目录

| 字段 | 值 |
|------|-----|
| 前端方法 | `code.create` |
| 前端路径 | `POST /api/code/files/:path?projectId=` |
| BFF 代理 | `landing/server/api/code/files/[...path].post.ts` |
| 后端路径 | `POST /api/code/workspace/files/mkdir` → `mkdirWorkspace` |
| 请求参数 | `{ projectId, isDirectory?`(默认 false) }` |

### 7.5 删除文件/目录

| 字段 | 值 |
|------|-----|
| 前端方法 | `code.delete` |
| 前端路径 | `DELETE /api/code/files/:path?projectId=` |
| BFF 代理 | `landing/server/api/code/files/[...path].delete.ts` |
| 后端路径 | `DELETE /api/code/workspace/files` → `deleteWorkspaceFile` |
| 查询参数 | `projectId`, `path` |

### 7.6 移动/重命名文件

| 字段 | 值 |
|------|-----|
| 前端方法 | `code.move` |
| 前端路径 | `POST /api/code/files/move` |
| BFF 代理 | `landing/server/api/code/files/move.post.ts` |
| 后端路径 | `POST /api/code/workspace/files/move` → `moveWorkspace` |
| 请求参数 | `{ projectId, sourcePath, targetPath }` |

### 7.7 文件上传 (后端有，前端未使用)

| 字段 | 值 |
|------|-----|
| 前端方法 | ❌ 未定义 |
| 后端路径 | `POST /api/code/workspace/files/upload` → `uploadWorkspaceFiles` |
| 请求格式 | `multipart/form-data`，最多 5 个文件 |

### 7.8 文件下载 (后端有，前端未使用)

| 字段 | 值 |
|------|-----|
| 前端方法 | ❌ 未定义 |
| 后端路径 | `GET /api/code/workspace/files/download` → `downloadWorkspaceFile` |

### 7.9 批量删除 (后端有，前端未使用)

| 字段 | 值 |
|------|-----|
| 前端方法 | ❌ 未定义 |
| 后端路径 | `POST /api/code/workspace/files/batch-delete` → `batchDeleteWorkspaceFiles` |

### 7.10 批量移动 (后端有，前端未使用)

| 字段 | 值 |
|------|-----|
| 前端方法 | ❌ 未定义 |
| 后端路径 | `POST /api/code/workspace/files/batch-move` → `batchMoveWorkspaceFiles` |

### 7.11 搜索文件 (后端有，前端未使用)

| 字段 | 值 |
|------|-----|
| 前端方法 | ❌ 未定义 |
| 后端路径 | `GET /api/code/workspace/files/search` → `searchWorkspaceFiles` |

### 7.12 Git 状态查询 (后端有，前端未使用)

| 字段 | 值 |
|------|-----|
| 前端方法 | ❌ 未定义 |
| 后端路径 | `GET /api/code/workspace/git-status` → `getWorkspaceGitStatus` |

---

## 8. 积分模块 (credits)

**归属服务**: api-service (Node.js)  
**BFF 代理**: `landing/server/api/credits/...` (全部经过 BFF)  
**前端使用**: ✅ **全部使用**

### 8.1 查询余额

| 字段 | 值 |
|------|-----|
| 前端方法 | `credits.getBalance` |
| 前端路径 | `GET /api/credits/balance` |
| BFF 代理 | `landing/server/api/credits/balance.get.ts` |
| 后端路径 | `GET /api/credits/balance` → `getUserBalance` |
| 响应数据 | `{ balance: number, currency: string }` |

### 8.2 查询交易流水

| 字段 | 值 |
|------|-----|
| 前端方法 | `credits.getTransactions` |
| 前端路径 | `GET /api/credits/transactions?page=&pageSize=` |
| BFF 代理 | `landing/server/api/credits/transactions.get.ts` |
| 后端路径 | `GET /api/credits/transactions` → `getUserTransactions` |
| 查询参数 | `page`(默认1), `pageSize`(默认20, 最大100) |
| 响应数据 | `{ items: any[], total, page, pageSize }` |

### 8.3 查询定价

| 字段 | 值 |
|------|-----|
| 前端方法 | `credits.getPricing` |
| 前端路径 | `GET /api/credits/pricing` |
| BFF 代理 | `landing/server/api/credits/pricing.get.ts` |
| 后端路径 | `GET /api/credits/pricing` → `getPricingList` |
| 响应数据 | `Array<{ workerRole, baseCost, tokenPricePer1k }>` |

---

## 9. 项目模块 (projects)

**归属服务**: api-service (Node.js)  
**BFF 代理**: `landing/server/api/projects/...` (全部经过 BFF)  
**前端使用**: ⚠️ **部分使用**

### 9.1 获取项目列表

| 字段 | 值 |
|------|-----|
| 前端方法 | ❌ useApi 中未定义 |
| BFF 代理 | `landing/server/api/projects.get.ts` |
| 后端路径 | `GET /api/projects` → `getProjects` |
| 响应数据 | `PaginatedResponse<Project>` |

### 9.2 创建项目

| 字段 | 值 |
|------|-----|
| 前端方法 | ❌ useApi 中未定义 |
| BFF 代理 | `landing/server/api/projects.post.ts` |
| 后端路径 | `POST /api/projects` → `createProject` |
| 请求参数 | `{ name: string(1-128), description?, type?, tech_stack?, git_url?, git_branch?, is_template? }` |

### 9.3 获取项目详情

| 字段 | 值 |
|------|-----|
| 前端方法 | ❌ 未定义 |
| 后端路径 | `GET /api/projects/:id` → `getProject` |

### 9.4 更新项目

| 字段 | 值 |
|------|-----|
| 前端方法 | ❌ useApi 中未定义 |
| BFF 代理 | `landing/server/api/projects/[id].patch.ts` |
| 后端路径 | `PATCH /api/projects/:id` → `updateProject` |
| 请求参数 | `{ name?, description?, status?, type?, tech_stack?, git_url?, git_branch?, workspace_path?, is_template? }` |

### 9.5 删除项目

| 字段 | 值 |
|------|-----|
| 前端方法 | ❌ useApi 中未定义 |
| BFF 代理 | `landing/server/api/projects/[id].delete.ts` |
| 后端路径 | `DELETE /api/projects/:id` → `deleteProject` |

### 9.6 获取项目克隆状态

| 字段 | 值 |
|------|-----|
| 前端方法 | ❌ 未定义 |
| 后端路径 | `GET /api/projects/:id/clone-status` → `getCloneStatus` |

### 9.7 获取项目成员

| 字段 | 值 |
|------|-----|
| 前端方法 | ❌ useApi 中未定义 |
| BFF 代理 | `landing/server/api/projects/[id].members.get.ts` |
| 后端路径 | `GET /api/projects/:id/members` → `getProjectMembers` |

### 9.8 获取项目聊天会话

| 字段 | 值 |
|------|-----|
| 前端方法 | ❌ 未定义 |
| 后端路径 | `GET /api/projects/:id/chat-sessions` → `getProjectChatSessions` |

### 9.9 获取项目 Agent 任务

| 字段 | 值 |
|------|-----|
| 前端方法 | ❌ 未定义 |
| 后端路径 | `GET /api/projects/:id/agent-tasks` → `getProjectAgentTasks` |

### 9.10 获取项目仪表盘

| 字段 | 值 |
|------|-----|
| 前端方法 | ❌ 未定义 |
| 后端路径 | `GET /api/projects/:id/dashboard` → `getProjectDashboard` |

### 9.11 部署项目

| 字段 | 值 |
|------|-----|
| 前端方法 | ❌ 未定义 |
| 后端路径 | `POST /api/projects/:id/deploy` → `deployProjectController` |

### 9.12 停止部署

| 字段 | 值 |
|------|-----|
| 前端方法 | ❌ 未定义 |
| 后端路径 | `DELETE /api/projects/:id/deploy` → `stopDeploymentController` |

### 9.13 获取流量数据

| 字段 | 值 |
|------|-----|
| 前端方法 | ❌ 未定义 |
| 后端路径 | `GET /api/projects/:id/traffic` → `getProjectTraffic` |

### 9.14 获取实时流量

| 字段 | 值 |
|------|-----|
| 前端方法 | ❌ 未定义 |
| 后端路径 | `GET /api/projects/:id/traffic/realtime` → `getProjectRealtimeTraffic` |

---

## 10. 订单模块 (orders)

**归属服务**: Java order-service  
**前端使用**: ❌ **未对接**

### 10.1 OrderController (`/orders`)

| 接口路径 | 方法 | 功能 | 请求参数 | 响应 |
|---|---|---|---|---|
| `/orders` | POST | 创建订单 | `CreateOrderRequest` | `OrderVO` |
| `/orders/{orderNo}` | GET | 根据订单号查询订单 | Path: orderNo | `OrderVO` |
| `/orders/user/{userId}` | GET | 查询用户订单列表 | Path: userId, Query: page, size | `PageResult<OrderVO>` |
| `/orders/{orderNo}/cancel` | PUT | 取消订单 | Path: orderNo | Void |
| `/orders/{orderNo}/confirm` | PUT | 确认订单 | Path: orderNo | Void |

### 10.2 CreatorController (`/creator`)

| 接口路径 | 方法 | 功能 | 请求参数 | 响应 |
|---|---|---|---|---|
| `/creator/products` | POST | 发布创作者产品 | Header: X-User-Id + `PublishProductRequest` | `CreatorProductVO` |
| `/creator/products/{productId}` | PUT | 更新创作者产品 | Header: X-User-Id, Path: productId + `UpdateProductRequest` | `CreatorProductVO` |
| `/creator/products/{productId}/status` | PUT | 切换产品状态 | Header: X-User-Id, Path: productId, Query: status | Void |
| `/creator/products/{productId}` | DELETE | 删除创作者产品 | Header: X-User-Id, Path: productId | Void |
| `/creator/products/{productId}` | GET | 获取创作者产品详情 | Path: productId | `CreatorProductVO` |
| `/creator/products` | GET | 列出我的产品 | Header: X-User-Id, Query: status(optional) | `List<CreatorProductVO>` |
| `/creator/dashboard` | GET | 获取创作者仪表盘 | Header: X-User-Id | `CreatorDashboardVO` |
| `/creator/earnings` | GET | 查询收益记录 | Header: X-User-Id, Query: startDate, endDate, page, size | `PageResult<CreatorEarningVO>` |

---

## 11. 支付模块 (payments)

**归属服务**: Java payment-service  
**前端使用**: ❌ **未对接**

### 11.1 PaymentController (`/payments`)

| 接口路径 | 方法 | 功能 | 请求参数 | 响应 |
|---|---|---|---|---|
| `/payments/create` | POST | 创建支付 | `CreatePaymentRequest` | `PaymentVO` |
| `/payments/callback` | POST | 支付回调通知 | `CallbackDTO` | Void |
| `/payments/refund` | POST | 发起退款 | `RefundRequest` | `RefundVO` |
| `/payments/{orderNo}` | GET | 根据订单号查支付 | Path: orderNo | `PaymentVO` |

### 11.2 WalletController (`/wallets`)

| 接口路径 | 方法 | 功能 | 请求参数 | 响应 |
|---|---|---|---|---|
| `/wallets/{userId}` | GET | 查询钱包 | Path: userId | `WalletVO` |
| `/wallets/recharge` | POST | 钱包充值 | `RechargeRequest` | `WalletVO` |

### 11.3 CreditsController (`/credits`)

| 接口路径 | 方法 | 功能 | 请求参数 | 响应 |
|---|---|---|---|---|
| `/credits/balance/{userId}` | GET | 查询积分余额 | Path: userId | `CreditsBalanceVO` |
| `/credits/transactions/{userId}` | GET | 查询积分交易记录 | Path: userId, Query: page, size | `Page<CreditsTransaction>` |
| `/credits/credit` | POST | 积分充值（入账） | `CreditRequest`: userId, amount, type, sourceType, sourceId, description | Void |
| `/credits/debit` | POST | 积分扣减（出账） | `DebitRequest`: userId, amount, type, sourceType, sourceId, description | Void |

### 11.4 CreditsAgentController (`/credits`) — 内部接口

> ⚠️ **注意**: 以下接口使用 `X-Internal-Token` Header 认证，**前端不应直接调用**

| 接口路径 | 方法 | 功能 | 请求参数 | 响应 |
|---|---|---|---|---|
| `/credits/agent-debit` | POST | Agent 积分扣减 | `AgentDebitRequest`, Header: X-Internal-Token | `AgentDebitResponse` |
| `/credits/agent-pricing` | GET | 获取 Agent 定价列表 | — | `List<AgentPricingVO>` |
| `/credits/agent-usage/{userId}` | GET | 获取 Agent 使用统计 | Path: userId | `AgentUsageVO` |

### 11.5 WithdrawalController (`/credits/withdrawals`)

| 接口路径 | 方法 | 功能 | 请求参数 | 响应 |
|---|---|---|---|---|
| `/credits/withdrawals` | POST | 申请提现 | `ApplyWithdrawalRequest` | `WithdrawalVO` |
| `/credits/withdrawals` | GET | 查询提现列表 | Query: userId, page, size | `Page<WithdrawalVO>` |
| `/credits/withdrawals/{id}` | GET | 提现详情 | Path: id | `WithdrawalVO` |

### 11.6 AdminWithdrawalController (`/admin/withdrawals`) — 内部接口

> ⚠️ **注意**: 以下接口使用 `X-Internal-Token` Header 认证，**前端不应直接调用**

| 接口路径 | 方法 | 功能 | 请求参数 | 响应 |
|---|---|---|---|---|
| `/admin/withdrawals` | GET | 管理员查询提现列表 | Query: status, page, size, Header: X-Internal-Token | `Page<WithdrawalVO>` |
| `/admin/withdrawals/{id}/approve` | POST | 审批通过提现 | Path: id, Query: adminId, Header: X-Internal-Token | `WithdrawalVO` |
| `/admin/withdrawals/{id}/reject` | POST | 拒绝提现 | Path: id, Query: adminId, rejectReason, Header: X-Internal-Token | `WithdrawalVO` |

### 11.7 MarketplaceProductController (`/marketplace/products`)

| 接口路径 | 方法 | 功能 | 请求参数 | 响应 |
|---|---|---|---|---|
| `/marketplace/products` | POST | 创建市场产品 | `CreateProductRequest` | `MarketplaceProductVO` |
| `/marketplace/products` | GET | 查询产品列表 | `ProductQueryRequest` | `Page<MarketplaceProductVO>` |
| `/marketplace/products/{id}` | GET | 获取产品详情 | Path: id | `MarketplaceProductVO` |
| `/marketplace/products/{id}` | PATCH | 更新产品 | Path: id + `CreateProductRequest` | `MarketplaceProductVO` |
| `/marketplace/products/{id}/deactivate` | POST | 下架产品 | Path: id | Void |

### 11.8 MarketplaceOrderController (`/marketplace/orders`)

| 接口路径 | 方法 | 功能 | 请求参数 | 响应 |
|---|---|---|---|---|
| `/marketplace/orders` | POST | 创建市场订单 | `CreateOrderRequest` | `MarketplaceOrderVO` |
| `/marketplace/orders/{id}/pay` | POST | 支付订单 | Path: id, Query: payChannel | `MarketplaceOrderVO` |
| `/marketplace/orders/{id}/refund` | POST | 退款订单 | Path: id | `MarketplaceOrderVO` |

### 11.9 HostedWebsiteController (`/hosted-websites`)

| 接口路径 | 方法 | 功能 | 请求参数 | 响应 |
|---|---|---|---|---|
| `/hosted-websites` | POST | 创建托管网站 | `CreateHostedWebsiteRequest` | `HostedWebsiteVO` |
| `/hosted-websites/{id}` | GET | 获取托管网站 | Path: id | `HostedWebsiteVO` |
| `/hosted-websites/{id}/domain` | PATCH | 更新自定义域名 | Path: id, Query: customDomain | `HostedWebsiteVO` |
| `/hosted-websites/{id}/deploy` | POST | 更新部署配置 | Path: id, Body: deployConfig(String) | `HostedWebsiteVO` |
| `/hosted-websites/{id}` | DELETE | 删除托管网站 | Path: id | Void |
| `/hosted-websites/{id}/traffic` | POST | 上报流量统计 | Path: id + `TrafficReportRequest` | `TrafficStatsVO` |

---

## 12. 购物车模块 (carts)

**归属服务**: Java cart-service  
**前端使用**: ❌ **未对接**

### 12.1 CartController (`/carts`)

| 接口路径 | 方法 | 功能 | 请求参数 | 响应 |
|---|---|---|---|---|
| `/carts/{userId}` | GET | 获取购物车 | Path: userId | `CartVO` |
| `/carts/items` | POST | 添加购物车商品 | `AddCartItemRequest` | `CartItemVO` |
| `/carts/items/{id}` | PUT | 更新购物车商品 | Path: id + `UpdateCartItemRequest` | `CartItemVO` |
| `/carts/items/{id}` | DELETE | 删除购物车商品 | Path: id | Void |
| `/carts/clear` | POST | 清空购物车 | Query: userId | Void |
| `/carts/checkout` | POST | 结算预览 | `CheckoutRequest` | `OrderPreviewVO` |

---

## 13. 物流模块 (logistics)

**归属服务**: Java logistics-service  
**前端使用**: ❌ **未对接**

### 13.1 LogisticsController (`/logistics`)

| 接口路径 | 方法 | 功能 | 请求参数 | 响应 |
|---|---|---|---|---|
| `/logistics/create` | POST | 创建物流 | `CreateLogisticsRequest` | `LogisticsVO` |
| `/logistics/{orderNo}` | GET | 根据订单号查物流 | Path: orderNo | `LogisticsVO` |
| `/logistics/{trackingNo}/tracks` | GET | 查询物流轨迹 | Path: trackingNo | `List<TrackVO>` |
| `/logistics/{trackingNo}/ship` | PUT | 标记发货 | Path: trackingNo | Void |
| `/logistics/{trackingNo}/deliver` | PUT | 标记送达 | Path: trackingNo | Void |

---

## 14. 演示模块 (demo)

**归属服务**: api-service (Node.js)  
**前端使用**: ⚠️ **部分使用**

| 接口路径 | 方法 | 功能 | 响应数据 |
|---|---|---|---|
| `/api/demo/plan` | GET | 获取示例计划 | `{ id, name, summary, tickets[] }` |
| `/api/demo/agents` | GET | 获取示例 Agents | `Agent[]` |
| `/api/demo/tasks` | GET | 获取示例任务 | `Task[]` |
| `/api/demo/visitor-status` | GET | 访客状态 | `{ visitorId, mode, expiresAt }` |

---

## 15. 系统模块 (system)

**归属服务**: api-service (Node.js)  
**前端使用**: ❌ **内部使用**

### 15.1 健康检查

| 字段 | 值 |
|------|-----|
| 后端路径 | `GET /api/health` |
| 功能 | 检查 API 服务器及依赖服务（数据库、Redis、LLM）健康状态 |
| 响应数据 | `{ ok: boolean, timestamp: string, services: { database: { ok, latencyMs? }, redis: { ok }, llm: { ok, provider?, error? } } }` |
| HTTP 状态 | 200 (健康) / 503 (部分不可用) |

---

## 16. WebSocket 实时通信

**归属服务**: api-service (Node.js) + Redis  
**前端使用**: ❌ **尚未集成到前端**

### 16.1 连接地址
```
ws://localhost:3001
```

### 16.2 客户端事件 (emit)

| 事件 | 参数 | 说明 |
|------|------|------|
| `agent:subscribe` | `agentId: string` | 订阅 Agent 状态 |
| `agent:unsubscribe` | `agentId: string` | 取消订阅 |
| `agent:command` | `{ agentId, command }` | 发送命令给 Agent |
| `task:subscribe` | `taskId: string` | 订阅任务进度 |
| `terminal:input` | `{ agentId, input }` | 终端输入 |

### 16.3 服务端推送事件

| 事件 | 数据 | 说明 |
|------|------|------|
| `agent:status` | `{ agentId, status }` | Agent 状态变更 |
| `agent:log` | `{ agentId, log }` | Agent 日志输出 |
| `task:progress` | `{ taskId, progress, status }` | 任务进度更新 |
| `task:log` | `{ taskId, log }` | 任务日志 |
| `terminal:output` | `{ agentId, output }` | 终端输出 |

---

## 17. 响应格式说明

### 17.1 Node.js 统一响应格式

```json
{
  "code": 200,
  "message": "success",
  "data": { ... }
}
```

- `code`: HTTP 状态码或业务码
- `message`: 状态描述
- `data`: 业务数据

### 17.2 Java 统一响应格式

```json
{
  "code": 200,
  "message": "success",
  "data": { ... },
  "timestamp": 1713945600000
}
```

### 17.3 BFF 转换后格式 (前端消费)

前端 `useApi.ts` 内部通过 `result.code !== undefined && result.success === undefined` 自动识别 Java 格式，统一转换为:

```typescript
{
  success: boolean;
  data: T | null;
  error: { code: string; message: string; details?: Record<string, string[]> } | null;
  message: string;
}
```

---

## 18. 前端使用状态汇总

### 18.1 前端已使用 (useApi.ts 中定义) — 41 个接口

| 模块 | 接口数 | 关键接口 | 后端服务 |
|------|--------|---------|---------|
| auth | 7 | sendSms, loginBySms, login, register, logout, refresh, me | Java auth-service |
| agents | 11 | list, getAll, create, get, update, delete, start, stop, pause, resume, getLogs | Node API |
| tasks | 6 | list, getAll, create, get, update, delete | Node API |
| chat | 8 | createSession, listSessions, getSession, sendMessage, getMessages, executeTask, getTasks, getProgress | Node API |
| code | 6 | getFiles, getFile, updateFile, create, delete, move | Node API |
| credits | 3 | getBalance, getTransactions, getPricing | Node API |
| **合计** | **41** | | |

### 18.2 BFF 存在但 useApi.ts 未定义

| 模块 | 接口 | 说明 |
|------|------|------|
| projects | 5 | get, create, update, delete, members |
| agents | 3 | status, command, createAgentTask |
| tasks | 5 | execute, cancel, progress, logs, subtasks |
| code | 6 | upload, download, batch-delete, batch-move, search, git-status |

### 18.3 后端有但前端完全未使用

| 模块 | 接口数 | 后端路径示例 |
|------|--------|-------------|
| auth | 2 | PATCH /auth/profile, GET /auth/users/{id}/roles |
| users (merged) | 1 | GET /users/{id}/roles |
| projects | 9 | clone-status, chat-sessions, agent-tasks, dashboard, deploy, stop deploy, traffic, realtime traffic |
| code | 6 | upload, download, batch-delete, batch-move, search, git-status |
| agents | 3 | status, command, createAgentTask |
| tasks | 5 | execute, cancel, progress, logs, subtasks |
| orders | 13 | 全部 13 个 endpoint |
| payments | 25 | 含 marketplace, hosted-websites, withdrawals |
| carts | 6 | 全部 6 个 endpoint |
| logistics | 5 | 全部 5 个 endpoint |
| demo | 4 | plan, agents, tasks, visitor-status |
| system | 1 | GET /api/health |
| websocket | 10 | 全部事件 |

### 18.4 🔴 前端定义但后端路由缺失

| 模块 | 接口 | 问题 |
|------|------|------|
| agents | `GET /api/agents/all` | 前端 `agents.getAll` 调用，但 Node API 路由只有 `GET /`，没有 `/all` |
| tasks | `GET /api/tasks/all` | 前端 `tasks.getAll` 调用，但 Node API 路由只有 `GET /`，没有 `/all` |

---

## 19. 错误码说明

| HTTP 状态码 | 业务码 | 含义 | 说明 |
|------------|--------|------|------|
| 200 | 200 | OK | 请求成功 |
| 201 | 201 | Created | 创建成功 |
| 400 | 400 | Bad Request | 请求参数错误 |
| 401 | 401 | Unauthorized | 未认证或 Token 无效 |
| 403 | 403 | Forbidden | 权限不足 (路径安全检查等) |
| 404 | 404 | Not Found | 资源不存在 |
| 409 | 409 | Conflict | 资源冲突（如用户名已存在）|
| 429 | 429 | Too Many Requests | 请求过于频繁 |
| 500 | 500 | Internal Server Error | 服务器内部错误 |

### Java 特殊错误码

| 业务码 | 含义 |
|--------|------|
| 200 | 成功 |
| 400 | 参数校验失败 |
| 401 | 未认证 |
| 1001 | 用户名已存在 |
| 1002 | 用户不存在 |
| 1003 | 密码错误 |
| 1004 | Token 无效或过期 |
| 1005 | 短信验证码错误 |
| 1006 | 短信发送过于频繁 |

---

## 附录 A: 关键实体类型

### Agent
```typescript
interface Agent {
  id: string;
  name: string;
  description?: string;
  type: string;              // 后端使用 role
  status: 'idle' | 'running' | 'paused' | 'error' | 'stopped';
  config: Record<string, any>;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  lastRunAt?: string;
}
```

### Task
```typescript
interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  agentId?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dueDate?: string;
  tags: string[];
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
}
```

### User (前端)
```typescript
interface User {
  id: string;
  username: string;
  name: string;
  email?: string;
  phone?: string;
  role: string;
  avatar?: string;
  createdAt: string;
  updatedAt: string;
}
```

### UserVO (Java)
```typescript
interface UserVO {
  id: Long;
  username: string;
  name?: string;
  email?: string;
  phone?: string;
  avatar?: string;
  status: string;
  createdAt: Date;
  roles: string[];
}
```

### TokenResponse (Java)
```typescript
interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn?: number;
  tokenType?: string;
  isNewUser?: boolean;
}
```

---

## 附录 B: 待修复问题

1. **🔴 `GET /api/agents/all`** — 前端 `agents.getAll` 调用，但 Node API 路由只有 `GET /`
2. **🔴 `GET /api/tasks/all`** — 前端 `tasks.getAll` 调用，但 Node API 路由只有 `GET /`
3. **🟡 projects 模块** — BFF 层存在 5 个接口，但 `useApi.ts` 中未定义，前端可能通过其他方式调用
4. **🟡 WebSocket** — 已定义事件协议，但前端尚未集成 WebSocket 客户端

---

## 附录 C: Swagger/OpenAPI

各 Java 服务已配置 springdoc，可通过以下地址获取完整 schema：

| 服务 | OpenAPI 文档地址 |
|------|-----------------|
| auth-service | `http://localhost:8081/v3/api-docs` |
| gateway-service | `http://localhost:8080/v3/api-docs` |
| order-service | `http://localhost:8082/v3/api-docs` |
| payment-service | `http://localhost:8083/v3/api-docs` |
| cart-service | `http://localhost:8084/v3/api-docs` |
| logistics-service | `http://localhost:8085/v3/api-docs` |

Node API 的 OpenAPI 文档通过 `apps/api/src/swagger.ts` 配置，访问 `http://localhost:3001/api-docs`。

---

_文档生成: 2026-05-03 | 基于 develop 分支最新代码 | 整合来源: Kimi Claw 后端清单 + PC qclaw 前端梳理 + 现有 API_REFERENCE.md + API_INTEGRATION.md_

# Node.js 后端架构设计

> **范围**: `apps/api/` + `apps/agent-runtime/` + `packages/workflow-engine/`  
> **运行时**: Node.js 20 LTS + TypeScript 5.4 (ESM)  
> **状态**: 生产就绪（P0 已完成）

---

## 1. 服务定位

Node.js 后端在 AgentHive Cloud 中承担 **"AI 控制平面 + BFF 编排层"** 角色：

| 能力 | 说明 | 对应服务 |
|------|------|----------|
| **BFF / API 编排** | 聚合数据给前端，协议转换、缓存、认证透传 | `apps/api` |
| **AI Agent 控制平面** | Agent 生命周期、任务队列、Chat 编排 | `apps/api` + `packages/workflow-engine` |
| **实时通信** | WebSocket / SSE、Redis Pub/Sub | `apps/api` |
| **LLM 网关** | 多厂商统一封装、流式转发 | `apps/api` |
| **Agent 执行引擎** | 工具调用、LLM 交互、上下文管理 | `apps/agent-runtime` |

> **原则**: Node.js 是 **"编排者而非执行者"**。重事务、强一致性业务由 Java 微服务承载。

---

## 2. 服务拓扑

```
Browser / Landing BFF
        │
        ▼
┌───────────────┐
│  API Gateway  │  ← Spring Cloud Gateway (JWT 验签)
│   :8080       │     透传 X-User-Id / X-User-Name / X-User-Role
└───────┬───────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│                    Node API (apps/api/)                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  Auth    │  │  Chat    │  │  Agent   │  │  Task    │   │
│  │ Middleware│  │ Controller│  │  Mgmt   │  │  Queue   │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │
│  │  Project │  │  Code    │  │  Health  │                  │
│  │  API     │  │  Workspace│  │  Check   │                  │
│  └──────────┘  └──────────┘  └──────────┘                  │
└──────────┬──────────────────────────────────────────────────┘
           │
    ┌──────┴──────┐
    ▼             ▼
┌────────┐  ┌──────────┐
│PostgreSQL│  │  Redis   │
│ :5432  │  │ :6379    │
└────────┘  └────┬─────┘
                 │
        ┌────────┴────────┐
        ▼                 ▼
┌──────────────┐  ┌──────────────┐
│   Streams    │  │   Pub/Sub    │
│ agenthive:   │  │ task:progress│
│ agent:task:  │  │ task:result  │
│ queue        │  │ ws:broadcast │
└──────────────┘  └──────────────┘
        │
        ▼
┌─────────────────────────────────────────┐
│         Agent Runtime                    │
│  ┌──────────┐  ┌──────────┐            │
│  │ TaskConsumer│  │ QueryLoop │            │
│  │ (XREADGROUP)│  │ (LLM)    │            │
│  └──────────┘  └──────────┘            │
│  ┌──────────┐  ┌──────────┐            │
│  │ToolRegistry│  │Permission │            │
│  │   V2     │  │ Manager   │            │
│  └──────────┘  └──────────┘            │
└─────────────────────────────────────────┘
```

---

## 3. 核心模块

### 3.1 API 服务 (`apps/api/`)

**框架**: Express.js 4.x + TypeScript (ESM) + tsx 热重载

| 模块 | 文件路径 | 职责 |
|------|----------|------|
| **认证中间件** | `src/middleware/auth.ts` | 开发环境 `injectDevUser()`，生产环境校验 `X-User-Id` |
| **Chat 控制器** | `src/chat-controller/` | 意图识别、会话管理、Agent 任务调度 |
| **Agent 管理** | `src/routes/agents.ts` | Agent CRUD、生命周期（start/stop/pause/resume）|
| **任务队列** | `src/services/taskQueue.ts` | Redis Stream `XADD` / `XREADGROUP` |
| **WebSocket Hub** | `src/websocket/hub.ts` | Socket.IO 房间广播（`task:${taskId}`）|
| **LLM 服务** | `src/services/llm.ts` | OpenAI 兼容 API / Ollama 本地调用 |
| **代码工作区** | `src/routes/code.ts` | 文件树、读写、搜索（待拆分至 code-service）|

**数据库连接**:
- PostgreSQL: `pg` Pool (max 20 connections)
- Redis: `ioredis` (pub/sub + streams + cache)

### 3.2 Agent Runtime (`apps/agent-runtime/`)

**类型**: 共享库 + 独立运行时

| 组件 | 说明 |
|------|------|
| `ToolRegistryV2` | 文件、Shell、Git、Web 搜索、HTTP 工具 |
| `QueryLoopV2` | LLM 查询执行循环 |
| `PermissionManager` | Ask / Allow / Deny / Auto 模式 |
| `ConversationContextV2` | 上下文管理 + CompactionEngine |
| `AgentManager` | 多 Agent 编排 |

**工具集**:
- `FileRead` / `FileWrite` / `FileEdit`
- `Glob` / `Grep`
- `Bash` / `Git`
- `WebSearch` / `WebFetch` / `Http`

### 3.3 Workflow Engine (`packages/workflow-engine/`)

| 组件 | 说明 |
|------|------|
| `WorkflowEngine` | 会话生命周期：plan → execute → QA → fix loop |
| `Scheduler` | `executeTicketsInParallel`，文件锁 + 依赖解析 + 死锁检测 |
| **角色** | frontend-dev / backend-dev / qa-engineer |

---

## 4. 通信模式

| 源 → 目标 | 协议 | 模式 |
|-----------|------|------|
| Browser → Node API | HTTP / WebSocket | REST + Socket.IO |
| Gateway → Node API | HTTP | Proxy Pass |
| Node API ↔ Redis | TCP | ioredis (pub/sub + streams) |
| Node API ↔ PostgreSQL | TCP | pg Pool |
| Node API ↔ LLM | HTTP/S | OpenAI-compatible / Ollama |
| Agent Runtime ↔ API | WebSocket | 实时 Agent 事件 |

---

## 5. 数据模型

### 5.1 核心表

```sql
-- 项目表
CREATE TABLE projects (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  description TEXT,
  repo_url VARCHAR(500),
  owner_id BIGINT NOT NULL,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Chat 会话表
CREATE TABLE chat_sessions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  project_id BIGINT REFERENCES projects(id),
  title VARCHAR(200),
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Chat 消息表
CREATE TABLE chat_messages (
  id BIGSERIAL PRIMARY KEY,
  session_id BIGINT NOT NULL REFERENCES chat_sessions(id),
  role VARCHAR(20) NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Agent 任务表
CREATE TABLE agent_tasks (
  id BIGSERIAL PRIMARY KEY,
  session_id BIGINT NOT NULL,
  ticket_id VARCHAR(32) NOT NULL,
  worker_role VARCHAR(32) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  workspace_path VARCHAR(500),
  result JSONB,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 5.2 Redis 数据结构

| Key 模式 | 类型 | 用途 |
|----------|------|------|
| `session:{token}` | String | 用户会话 (TTL: 24h) |
| `agent:status:{agentId}` | Hash | Agent 实时状态 (TTL: 60s) |
| `task:progress:{taskId}` | Hash | 任务进度 |
| `chat:session:{sessionId}` | List | 消息列表 (最近 100 条) |
| `rate_limit:{ip}` | String | API 限流计数 |

---

## 6. Agent 执行流程

```
用户发送消息
    │
    ▼
[Chat Controller] 意图识别 (LLM classify)
    │
    ▼
创建 agent_tasks 记录 (PostgreSQL)
    │
    ▼
Redis Stream XADD agenthive:agent:task:queue
    │
    ▼
[Agent Runtime] XREADGROUP 消费任务
    │
    ▼
LLM 生成计划 → 工具调用 → 文件修改
    │
    ▼
Redis Pub/Sub 推送进度
    │
    ▼
[API WebSocket] 广播到 task:${taskId} 房间
    │
    ▼
前端实时展示进度
```

---

## 7. 当前架构债务

| 问题 | 影响 | 计划 |
|------|------|------|
| API 是"万能单体" | 6 种角色混杂 | Phase 1 拆分 code-service |
| 直接 spawn Orchestrator | 已改为队列，混沌测试待验证 | Phase 0 验证 |
| LLM 重复封装 | api 和 agent-runtime 都有 | Phase 2 独立 LLM Gateway |
| 文件服务混杂 | 阻塞事件循环 | Phase 1 拆分 code-service |
| 访客限流在内存 | 多实例不共享 | Phase 1 Redis 限流 |
| 无 Repository 层 | 直接 pool.query() | 逐步抽象 |

---

## 8. 相关文档

- [01-system-overview.md](./01-system-overview.md) — 系统总体架构
- [02-java-microservices.md](./02-java-microservices.md) — Java 微服务架构
- [03-ai-agent-platform.md](./03-ai-agent-platform.md) — AI Agent 平台详细设计
- [apps/agent-runtime/docs/ARCHITECTURE.md](../../apps/agent-runtime/docs/ARCHITECTURE.md) — Agent Runtime 内部架构

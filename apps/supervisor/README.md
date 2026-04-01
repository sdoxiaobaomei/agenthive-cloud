# AgentHive Cloud Supervisor

AgentHive Cloud 后端服务，提供 REST API 和 WebSocket 实时通信。

## 技术栈

- **语言**: Go 1.21+
- **Web 框架**: Gin
- **WebSocket**: gorilla/websocket
- **存储**: 内存存储 (map)

## 项目结构

```
supervisor/
├── cmd/server/         # 入口点
│   └── main.go
├── pkg/
│   ├── api/           # REST API 处理器和中间件
│   │   ├── handlers.go
│   │   └── middleware.go
│   ├── config/        # 配置管理
│   │   └── config.go
│   ├── scheduler/     # 任务调度器
│   │   └── scheduler.go
│   ├── store/         # 内存存储
│   │   └── memory.go
│   ├── types/         # 数据类型定义
│   │   └── models.go
│   └── websocket/     # WebSocket Hub
│       └── hub.go
├── go.mod
├── go.sum
└── README.md
```

## 快速开始

### 安装依赖

```bash
cd agenthive-cloud/apps/supervisor
go mod tidy
```

### 编译

```bash
go build -o supervisor.exe ./cmd/server/main.go
```

### 运行

```bash
# 默认端口 8080
./supervisor.exe

# 指定端口
./supervisor.exe -port=3000
```

## API 端点

### Agents

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/agents` | 获取所有 Agent |
| GET | `/api/agents/:id` | 获取单个 Agent 详情 |
| POST | `/api/agents` | 创建 Agent |
| PATCH | `/api/agents/:id` | 更新 Agent |
| DELETE | `/api/agents/:id` | 删除 Agent |
| POST | `/api/agents/:id/start` | 启动 Agent |
| POST | `/api/agents/:id/stop` | 停止 Agent |
| POST | `/api/agents/:id/pause` | 暂停 Agent |
| POST | `/api/agents/:id/resume` | 恢复 Agent |
| POST | `/api/agents/:id/command` | 发送命令 |
| GET | `/api/agents/:id/logs` | 获取 Agent 日志 |

### Tasks

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/tasks` | 获取所有任务 |
| GET | `/api/tasks/:id` | 获取单个任务 |
| POST | `/api/tasks` | 创建任务 |
| PATCH | `/api/tasks/:id` | 更新任务 |
| DELETE | `/api/tasks/:id` | 删除任务 |

### Sprints

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/sprints` | 获取所有 Sprint |
| POST | `/api/sprints` | 创建 Sprint |
| GET | `/api/sprints/:id` | 获取单个 Sprint |
| PUT | `/api/sprints/:id` | 更新 Sprint |

### WebSocket

| 路径 | 描述 |
|------|------|
| `/ws` 或 `/api/ws` | WebSocket 连接端点 |

## 示例请求

### 创建 Agent

```bash
curl -X POST http://localhost:8080/api/agents \
  -H "Content-Type: application/json" \
  -d '{
    "name": "New Agent",
    "role": "backend_dev",
    "description": "A backend developer agent"
  }'
```

### 创建 Task

```bash
curl -X POST http://localhost:8080/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "type": "feature",
    "title": "Implement Auth",
    "description": "Implement user authentication",
    "priority": "high"
  }'
```

### 控制 Agent

```bash
# 启动 Agent
curl -X POST http://localhost:8080/api/agents/{id}/start

# 停止 Agent
curl -X POST http://localhost:8080/api/agents/{id}/stop

# 暂停 Agent
curl -X POST http://localhost:8080/api/agents/{id}/pause

# 恢复 Agent
curl -X POST http://localhost:8080/api/agents/{id}/resume
```

## WebSocket 事件

### 客户端发送

```json
{
  "type": "ping",
  "payload": {},
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### 服务端广播

- `agent_created` - Agent 创建事件
- `agent_deleted` - Agent 删除事件
- `agent_state_change` - Agent 状态变更
- `task_created` - 任务创建事件
- `task_assigned` - 任务分配事件
- `heartbeat` - 心跳事件

## Mock 数据

服务启动时会自动创建以下 Mock 数据：

### Agents
- Scrum Master (📝) - working
- Tech Lead (🎯) - idle
- Backend Dev (⚙️) - working (65% progress)
- Frontend Dev (🎨) - paused
- QA Engineer (🧪) - idle
- DevOps (🚀) - error

### Tasks
- 实现用户认证系统 (running, high priority)
- 设计 Dashboard UI (pending, high priority)
- 修复 API 响应格式问题 (completed)
- 编写单元测试 (assigned)

## 配置

可以通过环境变量覆盖默认配置：

| 变量 | 描述 | 默认值 |
|------|------|--------|
| SERVER_PORT | 服务端口 | 8080 |
| SERVER_HOST | 服务主机 | 0.0.0.0 |
| GIN_MODE | Gin 模式 (debug/release) | debug |

## 健康检查

```bash
curl http://localhost:8080/health
```

响应：
```json
{
  "status": "healthy",
  "service": "supervisor",
  "timestamp": "2024-01-01T00:00:00Z",
  "version": "1.0.0"
}
```

# OpenAPI 3.0 Specification

**版本**: 1.0.0  
**基础路径**: `/api/v1`

---

## 1. Agents API

### 1.1 列出所有Agent

```yaml
get:
  path: /agents
  summary: List all agents
  parameters:
    - name: team_id
      in: query
      schema: { type: string, format: uuid }
    - name: status
      in: query
      schema: { type: string, enum: [idle, working, error] }
    - name: role
      in: query
      schema: { type: string }
  responses:
    200:
      description: List of agents
      content:
        application/json:
          schema:
            type: object
            properties:
              agents:
                type: array
                items:
                  $ref: '#/components/schemas/Agent'
```

**示例响应**:
```json
{
  "agents": [
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "name": "Backend Developer",
      "role": "backend_dev",
      "status": "working",
      "current_task": {
        "id": "t1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "title": "Implement login API",
        "progress": 75
      },
      "pod_ip": "10.0.1.23",
      "last_heartbeat_at": "2026-03-31T10:00:00Z"
    }
  ]
}
```

### 1.2 创建Agent

```yaml
post:
  path: /agents
  summary: Create a new agent
  requestBody:
    required: true
    content:
      application/json:
        schema:
          type: object
          required: [role, name]
          properties:
            role:
              type: string
              enum: [director, backend_dev, frontend_dev, ...]
            name:
              type: string
            config:
              type: object
              properties:
                llm:
                  type: object
                  properties:
                    model: { type: string }
                    temperature: { type: number }
  responses:
    201:
      description: Agent created
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Agent'
```

### 1.3 获取Agent详情

```yaml
get:
  path: /agents/{id}
  parameters:
    - name: id
      in: path
      required: true
      schema: { type: string, format: uuid }
  responses:
    200:
      description: Agent details
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/AgentDetail'
```

### 1.4 发送指令给Agent

```yaml
post:
  path: /agents/{id}/command
  summary: Send command to agent
  requestBody:
    content:
      application/json:
        schema:
          type: object
          required: [type]
          properties:
            type:
              type: string
              enum: [pause, resume, abort, message]
            message:
              type: string
              description: Required when type is 'message'
  responses:
    200:
      description: Command sent
      content:
        application/json:
          schema:
            type: object
            properties:
              success: { type: boolean }
              message: { type: string }
```

---

## 2. Tasks API

### 2.1 创建任务

```yaml
post:
  path: /tasks
  summary: Create a new task
  requestBody:
    content:
      application/json:
        schema:
          type: object
          required: [type, title, input]
          properties:
            type:
              type: string
              enum: [code_generation, code_review, bug_fix, ...]
            title:
              type: string
            description:
              type: string
            input:
              type: object
            priority:
              type: string
              enum: [low, medium, high, urgent]
              default: medium
  responses:
    201:
      description: Task created
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Task'
```

**示例请求**:
```json
{
  "type": "code_generation",
  "title": "Create login API",
  "description": "Implement JWT-based authentication",
  "input": {
    "requirements": "POST /api/login returns JWT token",
    "tech_stack": ["go", "gin", "jwt"],
    "files_to_modify": ["/app/auth.go"]
  },
  "priority": "high"
}
```

### 2.2 获取任务详情

```yaml
get:
  path: /tasks/{id}
  parameters:
    - name: id
      in: path
      required: true
      schema: { type: string }
  responses:
    200:
      description: Task details
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/TaskDetail'
```

---

## 3. WebSocket API

### 3.1 连接端点

```
Endpoint: wss://api.agenthive.io/ws
Protocol: Socket.IO
```

### 3.2 事件类型

#### 客户端 → 服务器

| 事件 | 描述 | 数据 |
|------|------|------|
| `subscribe` | 订阅团队更新 | `{team_id: string}` |
| `agent_command` | 发送Agent指令 | `{agent_id: string, command: object}` |
| `ping` | 心跳 | `{}` |

#### 服务器 → 客户端

| 事件 | 描述 | 数据 |
|------|------|------|
| `agent_state` | Agent状态变更 | `AgentState` |
| `task_update` | 任务进度更新 | `TaskUpdate` |
| `code_update` | 代码变更 | `CodeUpdate` |
| `terminal_output` | 终端输出 | `TerminalOutput` |
| `pong` | 心跳响应 | `{timestamp: string}` |

### 3.3 消息格式

**agent_state**:
```json
{
  "agent_id": "a1b2c3d4-...",
  "type": "agent_state",
  "state": "working",
  "current_task": {
    "id": "t1b2c3d4-...",
    "title": "Implement login API",
    "progress": 75
  },
  "timestamp": "2026-03-31T10:00:00Z"
}
```

**code_update**:
```json
{
  "agent_id": "a1b2c3d4-...",
  "type": "code_update",
  "file": "/app/main.go",
  "content": "package main\n...",
  "language": "go",
  "timestamp": "2026-03-31T10:00:00Z"
}
```

**terminal_output**:
```json
{
  "agent_id": "a1b2c3d4-...",
  "type": "terminal_output",
  "output": "Build successful\n",
  "is_error": false,
  "timestamp": "2026-03-31T10:00:00Z"
}
```

---

## 4. 数据模型

### 4.1 Agent

```yaml
Agent:
  type: object
  properties:
    id:
      type: string
      format: uuid
    name:
      type: string
    role:
      type: string
      enum: [director, backend_dev, frontend_dev, ...]
    status:
      type: string
      enum: [idle, starting, working, paused, error, completed]
    current_task:
      $ref: '#/components/schemas/TaskSummary'
    pod_ip:
      type: string
    last_heartbeat_at:
      type: string
      format: date-time
```

### 4.2 Task

```yaml
Task:
  type: object
  properties:
    id:
      type: string
      format: uuid
    type:
      type: string
    status:
      type: string
      enum: [pending, assigned, running, paused, completed, failed, cancelled]
    title:
      type: string
    description:
      type: string
    input:
      type: object
    output:
      type: object
    progress:
      type: integer
      minimum: 0
      maximum: 100
    created_at:
      type: string
      format: date-time
    started_at:
      type: string
      format: date-time
    completed_at:
      type: string
      format: date-time
```

---

## 5. 错误处理

### 5.1 错误响应格式

```json
{
  "error": {
    "code": "AGENT_NOT_FOUND",
    "message": "Agent with id 'xxx' not found",
    "details": {
      "agent_id": "xxx"
    },
    "timestamp": "2026-03-31T10:00:00Z"
  }
}
```

### 5.2 错误码列表

| 状态码 | 错误码 | 描述 |
|--------|--------|------|
| 400 | BAD_REQUEST | 请求参数错误 |
| 401 | UNAUTHORIZED | 未认证 |
| 403 | FORBIDDEN | 权限不足 |
| 404 | AGENT_NOT_FOUND | Agent不存在 |
| 404 | TASK_NOT_FOUND | 任务不存在 |
| 409 | AGENT_BUSY | Agent正忙 |
| 422 | VALIDATION_ERROR | 数据验证失败 |
| 429 | RATE_LIMITED | 请求过于频繁 |
| 500 | INTERNAL_ERROR | 服务器内部错误 |

---

**完整OpenAPI YAML**: `api/openapi.yaml`

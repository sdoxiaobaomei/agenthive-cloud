# Supervisor API Specification

**Auto-generated**: 2026-03-31  
**Sprint**: 3  
**Status**: ✅ Completed

---

## Base URL
```
http://localhost:8080/api/v1
```

## Endpoints

### 1. List Agents
```http
GET /agents
```

**Response**:
```json
{
  "agents": [
    {
      "id": "agent-001",
      "name": "Backend Developer",
      "role": "backend-dev",
      "status": "working",
      "current_task": "S3-001",
      "progress": 75,
      "last_seen": "2026-03-31T06:30:00Z"
    }
  ]
}
```

### 2. Get Agent Details
```http
GET /agents/:id
```

### 3. Create Agent
```http
POST /agents
Content-Type: application/json

{
  "role": "backend-dev",
  "name": "Backend Developer 2"
}
```

### 4. Send Command
```http
POST /agents/:id/command
Content-Type: application/json

{
  "type": "pause",
  "message": "Please review the code"
}
```

### 5. WebSocket Stream
```
WS /ws
```

**Events**:
- `agent_state_change` - Agent状态变更
- `task_update` - 任务进度更新
- `code_update` - 代码变更
- `log_output` - 日志输出

---

## Agent States

```go
type AgentState string

const (
    StateIdle       AgentState = "idle"
    StateStarting   AgentState = "starting"
    StateWorking    AgentState = "working"
    StateError      AgentState = "error"
    StateCompleted  AgentState = "completed"
)
```

---

## Implementation

See: `apps/supervisor/pkg/api/`

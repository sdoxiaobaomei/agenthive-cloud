# 数据库Schema设计

**数据库**: PostgreSQL 15+  
**设计日期**: 2026-03-31

---

## 1. 核心表结构

### 1.1 teams (团队表)

```sql
CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    namespace VARCHAR(63) NOT NULL UNIQUE,
    max_agents INTEGER DEFAULT 10,
    features JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);
```

### 1.2 agents (Agent表)

```sql
CREATE TYPE agent_role AS ENUM (
    'director', 'scrum_master', 'tech_lead', 
    'backend_dev', 'frontend_dev', 'qa_engineer', 'devops_engineer'
);

CREATE TYPE agent_status AS ENUM (
    'idle', 'starting', 'working', 'paused', 'error', 'completed'
);

CREATE TABLE agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID REFERENCES teams(id),
    name VARCHAR(100) NOT NULL,
    role agent_role NOT NULL,
    status agent_status DEFAULT 'idle',
    pod_name VARCHAR(253),
    pod_ip INET,
    config JSONB DEFAULT '{}',
    current_task_id UUID,
    progress INTEGER CHECK (progress >= 0 AND progress <= 100),
    last_heartbeat_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 1.3 tasks (任务表)

```sql
CREATE TYPE task_status AS ENUM (
    'pending', 'assigned', 'running', 'paused', 'completed', 'failed', 'cancelled'
);

CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID REFERENCES teams(id),
    agent_id UUID REFERENCES agents(id),
    type VARCHAR(50) NOT NULL,
    status task_status DEFAULT 'pending',
    title VARCHAR(200) NOT NULL,
    input JSONB NOT NULL,
    output JSONB,
    progress INTEGER DEFAULT 0,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 1.4 code_snapshots (代码快照)

```sql
CREATE TABLE code_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES tasks(id),
    agent_id UUID REFERENCES agents(id),
    file_path VARCHAR(500) NOT NULL,
    content TEXT NOT NULL,
    language VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 1.5 messages (对话消息)

```sql
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_type VARCHAR(20) NOT NULL, -- 'user', 'agent', 'system'
    sender_id UUID,
    content TEXT NOT NULL,
    content_type VARCHAR(20) DEFAULT 'text',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## 2. Redis数据结构

### 2.1 Agent状态
```
Key: agent:{agent_id}
Type: Hash
Fields:
  - status: "working"
  - current_task: "task-001"
  - progress: "75"
  - last_seen: "2026-03-31T10:00:00Z"
TTL: 60s (心跳续期)
```

### 2.2 任务队列
```
Key: task:queue:{team_id}
Type: List
Value: [task_json, task_json, ...]
```

### 2.3 WebSocket连接
```
Key: ws:client:{client_id}
Type: String
Value: agent_id
TTL: 300s
```

### 2.4 代码更新Pub/Sub
```
Channel: code:updates:{team_id}
Message: {agent_id, file_path, content_delta}
```

---

## 3. 索引设计

```sql
-- 常用查询索引
CREATE INDEX idx_agents_team_status ON agents(team_id, status);
CREATE INDEX idx_agents_heartbeat ON agents(last_heartbeat_at);
CREATE INDEX idx_tasks_team_status ON tasks(team_id, status);
CREATE INDEX idx_tasks_agent ON tasks(agent_id);
CREATE INDEX idx_code_snapshots_task ON code_snapshots(task_id);
CREATE INDEX idx_messages_created ON messages(created_at DESC);
```

---

**说明**: 完整版Schema见详细设计文档

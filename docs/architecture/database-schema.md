# 数据库设计文档

## 1. 节点服务数据库 (PostgreSQL)

### 1.1 已有库 (agenthive)

增强现有表，添加 Chat 和 Project 相关表：

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

## 2. Java 微服务数据库

见 `java-microservices.md`，每个服务独立数据库。

## 3. Redis 数据结构

| Key 模式 | 类型 | 用途 |
|----------|------|------|
| `session:{token}` | String | 用户会话 (TTL: 24h) |
| `agent:status:{agentId}` | Hash | Agent 实时状态 (TTL: 60s) |
| `task:progress:{taskId}` | Hash | 任务进度 |
| `chat:session:{sessionId}` | List | 消息列表 (最近 100 条) |
| `user:cart:{userId}` | Hash | 购物车商品 |
| `order:lock:{orderNo}` | String | 订单分布式锁 |
| `inventory:{productId}` | String | 库存计数 |
| `rate_limit:{ip}` | String | API 限流计数 |

# Redis & WebSocket 集成指南

## ✅ 已完成的工作

### 1. Redis 缓存服务
- ✅ 安装了 `ioredis` 客户端
- ✅ 创建了 `src/config/redis.ts` - Redis 连接配置
- ✅ 创建了 `src/services/redis-cache.ts` - 完整的缓存服务
- ✅ 创建了 `src/services/sms-redis.ts` - Redis 版短信服务
- ✅ 创建了 `src/services/sms-unified.ts` - 统一短信服务（自动降级）

### 2. WebSocket 实时通信
- ✅ 安装了 `socket.io`
- ✅ 创建了 `src/websocket/hub.ts` - WebSocket Hub
- ✅ 支持身份验证（JWT）
- ✅ 支持访客模式
- ✅ Agent 状态实时更新
- ✅ 任务进度实时推送
- ✅ 终端实时通信

## 🚀 快速开始

### 1. 安装 Redis

**Windows:**
```powershell
# 使用 Chocolatey
choco install redis-64

# 或下载 MSI 安装包
# https://github.com/MicrosoftArchive/redis/releases
```

**Mac:**
```bash
brew install redis
brew services start redis
```

**Linux:**
```bash
sudo apt-get install redis-server
sudo systemctl start redis
```

### 2. 启动 Redis

```bash
# Windows
redis-server

# Mac/Linux
redis-server
```

### 3. 启动 API 服务器

```bash
cd agenthive-cloud/apps/api
npm run dev
```

服务器启动时会自动连接 Redis 和初始化 WebSocket。

## 📦 Redis 功能

### 缓存服务 (`redisCache`)

```typescript
// 通用缓存
await redisCache.set('namespace', 'id', data, 300)
const data = await redisCache.get('namespace', 'id')

// SMS 验证码
await redisCache.setSmsCode('13800138000', '123456')
const code = await redisCache.getSmsCode('13800138000')

// 会话管理
await redisCache.setSession(token, userId, userData)
const session = await redisCache.getSession(token)

// Agent 状态
await redisCache.setAgentStatus(agentId, 'working', metadata)
const status = await redisCache.getAgentStatus(agentId)

// 任务进度
await redisCache.setTaskProgress(taskId, 50)
const progress = await redisCache.getTaskProgress(taskId)

// 日志缓存
await redisCache.addLog(agentId, 'Log message')
const logs = await redisCache.getLogs(agentId)

// 速率限制
const result = await redisCache.checkRateLimit('ip:xxx', 10, 60)
```

## 🔌 WebSocket 功能

### 连接方式

```javascript
// 访客模式
const socket = io('ws://localhost:3001')

// 认证模式
const socket = io('ws://localhost:3001', {
  auth: { token: 'Bearer xxx' }
})
```

### 事件列表

#### Agent 事件
```javascript
// 订阅 Agent 状态
socket.emit('agent:subscribe', 'agent-123')

// 接收状态更新
socket.on('agent:status', (data) => {
  console.log(data.agentId, data.status)
})

// 发送命令
socket.emit('agent:command', {
  agentId: 'agent-123',
  command: 'terminal',
  payload: { cmd: 'npm install' }
})

// Agent 心跳（由 Agent 服务发送）
socket.emit('agent:heartbeat', {
  agentId: 'agent-123',
  status: 'working',
  metadata: { progress: 50 }
})
```

#### 任务事件
```javascript
// 订阅任务进度
socket.emit('task:subscribe', 'task-456')

// 接收进度更新
socket.on('task:progress', (data) => {
  console.log(data.taskId, data.progress)
})

// 接收任务日志
socket.on('task:log', (data) => {
  console.log(data.log)
})

// 更新任务进度（由 Agent 发送）
socket.emit('task:progress', {
  taskId: 'task-456',
  progress: 75,
  metadata: { stage: 'testing' }
})

// 发送任务日志
socket.emit('task:log', {
  taskId: 'task-456',
  log: 'Build completed',
  level: 'info'
})
```

#### 终端事件
```javascript
// 订阅终端输出
socket.emit('terminal:subscribe', 'agent-123')

// 发送终端命令
socket.emit('terminal:input', {
  agentId: 'agent-123',
  input: 'ls -la'
})

// 接收终端输出
socket.on('terminal:output', (data) => {
  console.log(data.output)
})
```

#### 系统事件
```javascript
// 连接成功
socket.on('connected', (data) => {
  console.log(data.mode) // 'visitor' | 'authenticated'
})

// 错误处理
socket.on('error', (data) => {
  console.error(data.message)
})

// Ping/Pong
socket.emit('ping')
socket.on('pong', (data) => {
  console.log(data.timestamp)
})
```

## 🏗️ 架构图

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Frontend      │────▶│   API Server    │────▶│   PostgreSQL    │
│  (Vue/Nuxt)     │     │   (Express)     │     │   (Persistent)  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                       │
         │ WebSocket             │ Redis
         ▼                       ▼
┌─────────────────┐     ┌─────────────────┐
│   Real-time     │     │   Redis Cache   │
│   Updates       │     │   - SMS codes   │
│   - Agent status│     │   - Sessions    │
│   - Task progress│    │   - Agent status│
│   - Terminal    │     │   - Rate limit  │
└─────────────────┘     └─────────────────┘
```

## ⚙️ 环境变量

```env
# Redis 配置
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=        # 如果有密码
REDIS_DB=0

# WebSocket CORS
CORS_ORIGIN=http://localhost:3000
```

## 📊 性能优化

### Redis 优势
- SMS 验证码：**~1ms** (vs PostgreSQL ~10ms)
- 会话查询：**~1ms** (vs PostgreSQL ~10ms)
- Agent 状态：**~1ms** (vs PostgreSQL ~10ms)
- 自动过期，无需清理任务

### WebSocket 优势
- 实时推送，无需轮询
- 降低服务器负载
- 更好的用户体验

## 🔒 安全

- WebSocket 使用 JWT 认证
- Redis 密码可选（生产环境建议启用）
- 访客模式只读，无法发送命令
- 速率限制防止滥用

## 🧪 测试

```bash
# 测试 Redis 连接
npm run dev
# 查看控制台输出: [Redis] Connected successfully

# 测试 WebSocket
# 使用浏览器控制台或 Postman 连接到 ws://localhost:3001
```

## 📚 相关文件

| 文件 | 说明 |
|------|------|
| `src/config/redis.ts` | Redis 配置 |
| `src/services/redis-cache.ts` | 缓存服务 |
| `src/services/sms-redis.ts` | Redis 短信服务 |
| `src/services/sms-unified.ts` | 统一短信服务 |
| `src/websocket/hub.ts` | WebSocket Hub |
| `.env` | 环境变量配置 |

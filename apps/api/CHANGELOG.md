# API 变更日志 (CHANGELOG)

> **目标读者**：前端工程师、DevOps 工程师  
> **适用范围**：`apps/api` - AgentHive API 服务 (Node.js + Express)

---

## 目录

- [认证系统变更（影响前端）](#认证系统变更影响前端)
- [安全加固（影响 DevOps）](#安全加固影响-devops)
- [WebSocket 事件（影响前端）](#websocket-事件影响前端)
- [环境变量要求（影响 DevOps）](#环境变量要求影响-devops)

---

## 认证系统变更（影响前端）

### JWT 实现迁移至 `jose` 库

- **变更内容**：JWT 实现从自研逻辑迁移至行业标准库 [`jose`](https://github.com/panva/jose)
- **对前端影响**：**透明无感**，Token 格式更加标准（JWS 合规）
- **Token 结构**：
  ```json
  {
    "userId": "string",
    "username": "string",
    "role": "string",
    "iat": 1713772800,
    "exp": 1713859200
  }
  ```
- **Header 格式**：`Authorization: Bearer <token>`（保持不变）

### 密码登录增强

- **变更内容**：密码登录现在真正验证密码（使用 `bcrypt` 哈希比对）
- **接口**：`POST /api/auth/login`
- **错误码**：
  - `401` - 用户名或密码错误（用户不存在 / 密码不匹配）

### 注册与登录分离

- **变更内容**：用户名密码登录**不再自动创建不存在的用户**
- **前端注意**：
  - 新用户必须先调用 `POST /api/auth/register` 完成注册
  - 注册接口现在会正确存储 `password_hash`（bcrypt 加密）
- **注册接口**：`POST /api/auth/register`
  ```json
  // 请求体
  {
    "username": "string",
    "email": "string?",
    "password": "string",
    "phone": "string?",
    "code": "string?"
  }
  ```

### JWT Secret 强制检查

- **变更内容**：生产环境必须配置 `JWT_SECRET`，否则启动时打印安全警告
- **日志提示**：
  ```
  [SECURITY WARNING] JWT_SECRET is using the default value. Please set a strong secret in production.
  ```

---

## 安全加固（影响 DevOps）

### `ORCHESTRATOR_PATH` 路径校验

- **风险**：命令注入攻击
- **加固措施**：增加路径校验，防止通过环境变量注入恶意命令
- **配置建议**：确保 `ORCHESTRATOR_PATH` 指向合法的可执行文件路径，不包含特殊字符

### Visitor 中间件增强

- **变更内容**：
  1. **内存清理机制**：每小时自动清理超过 24 小时未访问的过期访客记录，防止内存泄漏
  2. **Rate Limit 时间窗口**：明确时间窗口为 **1 小时**，单访客最多 **60 次请求**
- **配置项**（当前为硬编码，后续可能支持环境变量）：
  - `CLEANUP_INTERVAL` = 1 小时
  - `RATE_LIMIT_WINDOW` = 1 小时
  - `MAX_REQUESTS` = 60

### SQL Search LIKE 通配符转义

- **变更内容**：SQL 搜索增加 LIKE 通配符（`%`, `_`）转义
- **影响**：防止通过搜索框进行的 SQL 注入攻击
- **对前端影响**：用户搜索时输入 `%` 或 `_` 将被视为普通字符处理

---

## WebSocket 事件（影响前端）

### 现有事件（保持不变）

| 事件名 | 方向 | 说明 |
|--------|------|------|
| `agent:register` | Agent → API | Agent 注册上线 |
| `agent:heartbeat` | Agent → API | Agent 心跳上报 |
| `task:assigned` | API → Agent | 任务分配 |
| `task:progress` | 双向 | 任务进度更新 |
| `task:completed` | Agent → API | 任务完成 |
| `log:output` | Agent → API | 日志输出 |

### 新增事件

| 事件名 | 方向 | 说明 | 版本 |
|--------|------|------|------|
| `llm:progress` | Agent → API | AgentRuntime V3 查询循环进度 | V3 独有 |

#### `llm:progress` 事件详情

- **触发时机**：AgentRuntime V3 在执行 LLM 查询循环时周期性上报
- ** Payload 示例**：
  ```json
  {
    "agentId": "agent-001",
    "iteration": 3,
    "totalTokens": 2048,
    "status": "thinking"
  }
  ```
- **前端处理建议**：订阅 `agent:{agentId}` 房间即可接收该事件，可用于展示 LLM 思考进度

---

## 环境变量要求（影响 DevOps）

### 关键环境变量清单

| 变量名 | 必填 | 默认值 | 用途 | 安全级别 |
|--------|------|--------|------|----------|
| `PORT` | 否 | `3001` | API 服务监听端口 | 低 |
| `JWT_SECRET` | **是（生产）** | `agenthive-secret-key-change-in-production` | JWT 签名密钥 | **高** |
| `CORS_ORIGIN` | 否 | `*` | 前端跨域来源 | 中 |
| `DB_HOST` | 是 | `localhost` | PostgreSQL 主机 | 中 |
| `DB_PORT` | 否 | `5432` | PostgreSQL 端口 | 低 |
| `DB_NAME` | 是 | `agenthive` | 数据库名 | 低 |
| `DB_USER` | 是 | - | 数据库用户名 | 中 |
| `DB_PASSWORD` | 是 | - | 数据库密码 | **高** |
| `REDIS_HOST` | 是 | `localhost` | Redis 主机 | 中 |
| `REDIS_PORT` | 否 | `6379` | Redis 端口 | 低 |
| `REDIS_PASSWORD` | 否 | - | Redis 密码 | **高** |
| `REDIS_DB` | 否 | `0` | Redis 数据库索引 | 低 |
| `ORCHESTRATOR_PATH` | 否 | - | Agent Runtime 可执行路径 | **高** |

### 生产环境检查清单

- [ ] `JWT_SECRET` 已设置为强随机字符串（建议 ≥ 32 字节）
- [ ] `CORS_ORIGIN` 已限制为实际前端域名（非 `*`）
- [ ] `DB_PASSWORD` 与 `REDIS_PASSWORD` 已配置且强度足够
- [ ] `ORCHESTRATOR_PATH` 指向合法路径，无注入风险
- [ ] 数据库用户权限已按最小权限原则配置

---

> 如有疑问，请联系后端团队或查阅 `api/docs/` 目录下的详细文档。

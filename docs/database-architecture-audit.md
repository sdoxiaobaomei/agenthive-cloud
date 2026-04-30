# AgentHive Cloud — 数据库架构审计报告

## 执行摘要

**严重程度: CRITICAL**

Java 微服务与 Node.js API 之间存在根本性的数据库架构不兼容，导致用户数据完全割裂，系统无法协同工作。

---

## 1. Schema 审计结果

### 1.1 Java 后端 (Database Per Service)

| 服务 | 数据库 | 核心表 | 主键类型 | 命名规范 |
|------|--------|--------|----------|----------|
| auth-service | auth_db | sys_user, sys_role, sys_user_role | BIGINT (BIGSERIAL) | sys_* |
| user-service | user_db | (待审计) | BIGINT | sys_* / t_* |
| order-service | order_db | t_order, t_order_item, t_creator_product, t_creator_earning | BIGINT | t_* |
| payment-service | payment_db | t_payment, t_user_wallet, t_refund, t_credits_account, ... | BIGINT | t_* |
| cart-service | cart_db | t_cart_item | BIGINT | t_* |
| logistics-service | logistics_db | t_logistics, t_logistics_track | BIGINT | t_* |

### 1.2 Node.js API (共享数据库)

| 表 | 主键类型 | 命名规范 |
|-----|----------|----------|
| users | UUID (gen_random_uuid) | 复数名词 |
| projects | UUID | 复数名词 |
| project_members | UUID | 复数名词 |
| chat_sessions | UUID | 复数名词 |
| chat_messages | UUID | 复数名词 |
| agent_tasks | UUID | 复数名词 |
| agents | UUID | 复数名词 |
| tasks | UUID | 复数名词 |
| code_files | UUID | 复数名词 |
| agent_logs | UUID | 复数名词 |
| project_deployments | UUID | 复数名词 |

---

## 2. 不一致性矩阵

| 维度 | Java | Node.js | 兼容? |
|------|------|---------|-------|
| **用户表名** | sys_user | users | ❌ |
| **用户ID类型** | BIGINT (1,2,3...) | UUID (550e84...) | ❌ **致命** |
| **表前缀** | sys_*, t_* | 无 | ⚠️ |
| **数据库模式** | 每服务一库 | 共享数据库 | ⚠️ |
| **主键策略** | 数据库自增 | gen_random_uuid | ❌ |
| **用户字段** | 7个字段 | 8个字段，含external_user_id | ⚠️ |
| **时间戳类型** | TIMESTAMP | TIMESTAMP WITH TIME ZONE | ⚠️ |
| **软删除** | deleted INT | 无 | ⚠️ |
| **角色字段** | 独立 sys_role 表 | users.role VARCHAR | ❌ |

---

## 3. 影响分析

### 🔴 P0 — 用户数据完全割裂

**user_id 类型不兼容是最致命的问题：**

- Java sys_user.id = BIGINT (1, 2, 3, ...)
- Node.js users.id = UUID ('550e8400-e29b-41d4-a716-446655440000')

**后果：**
1. 用户在 Node.js 注册 → Java 不认识这个用户
2. Java 创建订单 	_order.user_id = 2 → Node.js 无法关联到 users 表
3. Node.js 的 projects.owner_id (UUID) → 无法引用 Java 的 sys_user.id (BIGINT)
4. 整个系统的用户身份是**两套独立的体系**

### 🟡 P1 — 字段语义不一致

| 字段 | Java | Node.js | 问题 |
|------|------|---------|------|
| 密码 | password (BCrypt) | password_hash (?) | 加密方式可能不同 |
| 状态 | status INT (1=active) | role VARCHAR ('user') | 语义完全不同 |
| 软删除 | deleted INT (0/1) | 无 | Node.js 硬删除 |
| 手机号 | phone VARCHAR(20) | phone VARCHAR(20) UNIQUE | Node.js 要求唯一 |
| 头像 | avatar VARCHAR(500) | avatar TEXT | 类型不同 |

### 🟡 P1 — 数据库部署模式冲突

- **Java**: Database Per Service ✅（微服务最佳实践）
- **Node.js**: 共享数据库 ❌（单体遗留模式）

---

## 4. 分布式数据库管理最佳实践 (调研总结)

### 4.1 Database Per Service Pattern

> "Keep each microservice's persistent data private to that service and accessible only via its API."
> — Chris Richardson, *Microservices Patterns*

**当前状态评估：**
- ✅ Java 已实现 Database Per Service
- ❌ Node.js 仍是共享数据库模式
- ❌ 两个技术栈之间没有 API 契约

### 4.2 主键类型选择

| 类型 | 优点 | 缺点 | 适用场景 |
|------|------|------|----------|
| **BIGSERIAL** | 性能好、存储小、人类可读 | 分布式冲突、可预测 | 单库、低并发 |
| **UUIDv4** | 全局唯一、不可预测 | 索引碎片、存储大 | 分布式、高安全 |
| **UUIDv7** ⭐ | 时间排序 + 全局唯一 | 仍比 BIGINT 大 | **推荐用于新系统** |
| **Snowflake** | 趋势递增、全局唯一 | 需中心化服务 | 高并发分布式 |

### 4.3 跨服务数据一致性

**推荐模式 (按优先级)：**

1. **API Composition** — 服务间通过 API 查询所需数据
2. **CQRS + Materialized View** — 读模型本地反规范化存储
3. **Saga Pattern** — 分布式事务通过补偿操作保证最终一致
4. **Outbox Pattern** — 可靠事件发布，保证至少一次交付

### 4.4 分库分表策略

**水平分片 (Sharding) 触发条件：**
- 单表数据量 > 1000万行
- 单库 QPS > 10000
- 存储容量 > 500GB

**当前系统分片建议：**
| 数据域 | 当前状态 | 分片策略 |
|--------|----------|----------|
| 用户数据 | 未分片 | 按 user_id 哈希分片 |
| 订单数据 | 未分片 | 按 user_id 或时间范围分片 |
| 聊天记录 | 未分片 | 按 session_id 或时间分片 |
| 支付流水 | 未分片 | 按时间范围分片（冷热分离） |

---

## 5. 架构决策 (ADR-001)

### 决策 1: 统一用户模型 (短期方案)

**以 Java 的 sys_user 为权威用户源**，Node.js 通过 Gateway API 查询用户信息。

`
[Node.js API] --(HTTP)--> [Gateway] --(Feign)--> [user-service]
                                    --(Feign)--> [auth-service]
`

**理由：**
- Java 侧已有完整的 RBAC 权限体系 (sys_role + sys_user_role)
- Java 侧密码加密 (BCrypt) 更安全
- 改动量最小

**具体措施：**
1. Node.js users 表添加 external_user_id → 存储 Java sys_user.id (BIGINT)
2. Node.js 用户注册时，同步调用 Java auth-service 创建用户
3. Node.js JWT token 解析后，用 external_user_id 关联 Java 用户

### 决策 2: 统一主键类型 (长期方案)

**逐步迁移所有服务到 UUIDv7**

**迁移路线图：**
`
Phase 1 (当前): 通过映射表桥接 (external_user_id)
Phase 2 (3个月): 新表使用 UUIDv7
Phase 3 (6个月): 核心表 (sys_user, t_order) 迁移到 UUIDv7
Phase 4 (12个月): 完全弃用 BIGINT，统一 UUIDv7
`

**理由：**
- UUIDv7 有时间排序特性，解决 UUIDv4 的索引碎片问题
- 全局唯一，适合微服务独立生成 ID
- PostgreSQL 原生支持

### 决策 3: Node.js 数据库拆分

**按 Bounded Context 拆分 Node.js 数据库：**

`
agenthive_node_api (当前) → 拆分为:
├── chat_db: chat_sessions, chat_messages, agent_tasks
├── project_db: projects, project_members, project_deployments
├── agent_db: agents, tasks, agent_logs
├── code_db: code_files
`

**理由：**
- 符合 Database Per Service 原则
- 各域可独立扩展
- 减少单点故障风险

### 决策 4: 表命名规范统一

**采用统一的命名规范：**

`
系统表:     sys_{entity}      (e.g. sys_user, sys_role)
业务表:     {domain}_{entity} (e.g. order_payment, chat_session)
 Junction:  {entity1}_{entity2} (e.g. user_role, project_member)
索引:       idx_{table}_{column}
`

---

## 6. 待办 Ticket

| Ticket | 负责 Agent | 描述 | 优先级 |
|--------|-----------|------|--------|
| **JAVA-003** | java-agent | user-service 添加 external_id 字段 (UUIDv7)，支持外部系统用户关联 | P0 |
| **JAVA-004** | java-agent | auth-service 暴露 REST API: GET /api/users/{id} 和 POST /api/users | P0 |
| **NODE-005** | node-agent | 修改 users 表: external_user_id BIGINT → external_user_id VARCHAR(36) (兼容 UUID) | P0 |
| **NODE-006** | node-agent | 用户注册流程: 同步调用 Java auth-service 创建用户，存储映射关系 | P0 |
| **PLATFORM-031** | platform-agent | 创建 node_chat_db, node_project_db, node_agent_db 数据库和 StatefulSet | P1 |
| **PLATFORM-032** | platform-agent | 配置数据库用户权限隔离 (每服务独立 DB user) | P1 |

---

## 7. 附录: 当前 Java user-service schema

(待补充 — 需审计 user-service 的 schema.sql)

---

*Report generated: 2026-04-30*
*Auditor: Lead Agent*
*Status: CRITICAL — requires immediate action*

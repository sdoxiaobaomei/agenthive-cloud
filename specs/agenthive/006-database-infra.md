## 前言

本文档是 AgentHive Cloud 数据库与基础设施的"代码蓝图"级别规范，所有内容均源自实际代码库 (`e:/Git/agenthive-cloud`) 的静态分析，非推测性描写。

**关键架构决策记录 (ADR)**：
- **ADR-001**: Node.js 控制平面用 UUIDv7 (`gen_random_uuid()`)，Java 业务层用 BIGSERIAL，两套 ID 体系共存
- **ADR-002**: Node.js PostgreSQL 通过 `node-pg-migrate` 原生迁移 (非 Flyway)
- **ADR-003**: Java 微服务各自拥有独立 PostgreSQL 数据库 (per-service DB pattern)
- **ADR-004**: Secret 管理三种模式共存 — ExternalSecret / empty / Helm-managed
- **ADR-005**: 认证在 Gateway 层唯一收口，下游只认 `X-User-Id` header

---

## 1. 数据库架构总览

```
                          ┌─────────────────────────────────────┐
                          │         API Service (Node.js)        │
                          │         ┌─────────────────┐          │
                          │         │ node-pg-migrate  │          │
                          │         └────────┬────────┘          │
                          └──────────────────┼───────────────────┘
                                             │
                    ┌────────────────────────┼────────────────────────┐
                    │                        │                        │
                    ▼                        ▼                        │
    ┌──────────────────────┐   ┌──────────────────────┐   ┌──────────────────────┐
    │  PostgreSQL          │   │  PostgreSQL-Chat      │   │  PostgreSQL-Project  │
    │  agenthive           │   │                       │   │                       │
    │  (Node.js 主库)      │   │                       │   │                       │
    │  ┌────────────────┐  │   │                       │   │                       │
    │  │ users          │  │   │                       │   │                       │
    │  │ projects       │  │   │                       │   │                       │
    │  │ project_members│  │   │                       │   │                       │
    │  │ workspaces     │  │   │                       │   │                       │
    │  │ chat_sessions  │  │   │                       │   │                       │
    │  │ chat_messages  │  │   │                       │   │                       │
    │  │ chat_versions  │  │   │                       │   │                       │
    │  │ agents         │  │   │                       │   │                       │
    │  │ agent_members  │  │   │                       │   │                       │
    │  │ tasks          │  │   │                       │   │                       │
    │  │ agent_tasks    │  │   │                       │   │                       │
    │  │ agent_logs     │  │   │                       │   │                       │
    │  │ code_files     │  │   │                       │   │                       │
    │  │ project_deploy │  │   │                       │   │                       │
    │  │ audit_logs     │  │   │                       │   │                       │
    │  └────────────────┘  │   │                       │   │                       │
    └──────────────────────┘   └──────────────────────┘   └──────────────────────┘

         ┌─────────────── Redis (v7) ───────────────┐
         │  Streams, Pub/Sub, Cache, Preview         │
         └──────────────────────────────────────────┘

                    ┌──────────────────────┐
                    │   Gateway Service    │
                    │   (Spring Cloud)     │
                    │   Nacos Discovery    │
                    └──────┬───────────────┘
                           │
        ┌──────────────────┼────────────────────────┐
        │                  │                        │
        ▼                  ▼                        ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐
│ auth-service │  │ user-service │  │ payment-service          │
│ (auth_db)    │  │ (user_db)    │  │ → economy-service         │
│ ──────────── │  │ ──────────── │  │ (payment_db → economy_db) │
│ sys_user     │  │              │  │ ────────────────────────  │
│ sys_role     │  │              │  │ t_payment, t_user_wallet  │
│ sys_user_role│  │              │  │ t_refund, t_credits_*     │
└──────────────┘  └──────────────┘  │ t_marketplace_*, t_hosted_│
                                    │ t_creator_*, t_withdrawal_ │
                                    └────────────────────────────┘

  ┌─────────────────────┐
  │    RabbitMQ 3.13    │        已删除的 DB:
  │  economy.exchange   │        - order_db
  │  economy.* queues   │        - cart_db
  └─────────────────────┘        - logistics_db
```

**连接方式**:
- Node.js API 直连 `postgres` (Service: `postgres:5432`, DB: `agenthive`)，也连接 `postgres-chat` / `postgres-project` / `postgres-agent`
- Java 服务通过 Nacos 服务发现相互调用，各自连接自己的 PostgreSQL 实例
- 生产环境 Java 服务直连外部 ECS PostgreSQL (`172.24.146.165`)

---

## 2. Node.js PostgreSQL (`agenthive` DB)

### 2.1 迁移策略

**工具**: `node-pg-migrate@8.0.4`
**迁移目录**: `apps/api/src/db/migrations/`
**命名规范**: `YYYYMMDDHHmmss_description.sql` (UTC 时间戳前缀)
**执行方式**: 生产环境通过 Helm hook Job (`db-migrate-job.yaml`) 在 `PreSync` 钩子中运行

```
apps/api/src/db/migrations/
├── 20260423000000_init.sql                          (13.9 KB)  创建 15 张核心表 + 4 个权限函数 + 更新时间触发器
├── 20260502100000_ensure-migrations-table.sql        (837 B)   确保 _migrations 表存在
├── 20260503180000_add-external-user-id.sql           (674 B)   添加 users.external_user_id
├── 20260504010000_align-chat-messages.sql            (798 B)   对齐 chat_messages 字段
├── 20260504010100_add-workspaces.sql                (1.8 KB)   新增 workspaces 表
├── 20260504010200_enforce-project-session-unique.sql (1.5 KB)  强制 project_id 唯一会话
├── 20260504010300_add-message-types.sql             (1.9 KB)   消息类型枚举
├── 20260504010400_add-chat-versions.sql             (1.6 KB)   新增 chat_versions 表
├── 20260505000000_schema-alignment.sql              (3.4 KB)   agent_tasks 重对齐 + users.avatar
├── 20260505000200_add-status-to-chat-sessions.sql    (608 B)   添加 chat_sessions.status
└── 20260505000300_fix-project-deployments-schema.sql (1.3 KB)  修复 project_deployments 缺失字段
```

**迁移原则**:
- 每个迁移文件必须包含 `up` 和 `down` 两个方向
- 使用 `ADD COLUMN IF NOT EXISTS` / `DROP COLUMN IF EXISTS` 实现幂等
- PostgreSQL 16 不支持 `ADD CONSTRAINT IF NOT EXISTS`，因此使用 `DO $$` 匿名块绕过 (见 `20260505000300`)
- `schema.sql` 是静态快照 (12.3 KB)，仅用于文档和 IDE 补全，**唯一真相源是 migrations/ 目录**

### 2.2 现有 12 张核心表 DDL (精简)

| 表名 | 主键 | 关键字段 | 索引数量 | 说明 |
|------|------|----------|---------|------|
| `users` | UUID | username, email, phone, password_hash, role, status, avatar, external_user_id | 3 | 用户表 |
| `projects` | UUID | name, description, owner_id(FK), status, type, tech_stack(JSONB), git_url, is_template, workspace_id(FK) | 3 | 项目表 |
| `project_members` | UUID | project_id, user_id, role, UNIQUE(project_id,user_id) | 2 | 项目成员 |
| `workspaces` | UUID | user_id(FK), name, settings(JSONB) | 1 | 用户工作区 |
| `chat_sessions` | UUID | user_id, project_id(FK,UNIQUE WHERE NOT NULL), workspace_id(FK), title, status, session_type, current_version_id | 4 | 聊天会话 |
| `chat_messages` | UUID | session_id, role, content, message_type, is_visible_in_history, version_id(FK), parent_message_id(FK), metadata(JSONB) | 4 | 聊天消息 |
| `chat_versions` | UUID | session_id, version_number, title, base_message_id(FK), is_active, UNIQUE(session_id,version_number) | 2 | 会话版本 |
| `agents` | UUID | name, role, status, description, config(JSONB), owner_id(FK), project_id(FK) | 4 | Agent 记录 |
| `agent_members` | UUID | agent_id, user_id, role, UNIQUE(agent_id,user_id) | 2 | Agent 成员 |
| `agent_tasks` | UUID | session_id, project_id(FK), ticket_id, worker_role, status, workspace_path, result(JSONB) | 3 | Agent 任务 |
| `tasks` | UUID | title, type, status, priority, progress, assigned_to(FK), parent_id(FK), input/output(JSONB), user_id(FK), project_id(FK) | 4 | 通用任务 |
| `code_files` | UUID | project_id(FK), path, name, content, language, UNIQUE(project_id,path) | 1 | 代码文件 |
| `agent_logs` | UUID | agent_id, message, level, metadata(JSONB) | 2 | Agent 日志 |
| `project_deployments` | UUID | project_id(UNIQUE FK), status, access_url, config_json(JSONB) | 2 | 项目部署 |
| `audit_logs` | BIGSERIAL | table_name, operation, record_id, old_values/new_values(JSONB), changed_by(FK), ip_address, user_agent | 3 | 审计日志 |

**SQL 代码片段 (audit_logs 使用 BIGSERIAL, 其余全部 UUID)**:
```sql
-- 所有自定义表使用 gen_random_uuid() 作为默认主键
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ...
);

-- 唯一例外: audit_logs 使用 BIGSERIAL
CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGSERIAL PRIMARY KEY,
    ...
);
```

**权限函数** (定义于 `20260423000000_init.sql`):
- `user_can_operate_agent(p_user_id UUID, p_agent_id UUID)` — 检查用户是否是 Agent 的 owner/admin
- `user_can_operate_task(p_user_id UUID, p_task_id UUID)` — 检查用户是否可操作任务
- `user_is_project_member(p_user_id UUID, p_project_id UUID)` — 检查用户是否是项目成员
- `update_updated_at_column()` — 通用触发器，自动更新 `updated_at` 时间戳

**触发器覆盖的表**: users, projects, agents, tasks, chat_sessions, agent_tasks, agent_members, workspaces, chat_versions, project_deployments

### 2.3 需新增的 3 张表 DDL

这些表在规范中被提出但在代码仓库中尚未创建:

```sql
-- Migration: 202605XXXXXX00_add-app-templates-and-supabase.sql

-- 1. 应用模板表
CREATE TABLE IF NOT EXISTS app_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    category VARCHAR(50),
    tech_stack JSONB DEFAULT '[]',
    preview_url VARCHAR(500),
    config_json JSONB DEFAULT '{}',
    source_path VARCHAR(500),
    is_official BOOLEAN DEFAULT FALSE,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Supabase 配置表 (一一对应 project)
CREATE TABLE IF NOT EXISTS project_supabase_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    supabase_url VARCHAR(500),
    anon_key VARCHAR(500),
    service_key_encrypted VARCHAR(500),
    mode VARCHAR(20) DEFAULT 'shared' CHECK (mode IN ('shared', 'custom')),
    schema_name VARCHAR(100) DEFAULT 'public',
    migration_version VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id)
);

-- 3. projects 表增强字段 (ALTER)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS deploy_status VARCHAR(50) DEFAULT 'none'
    CHECK (deploy_status IN ('none', 'building', 'deployed', 'failed'));
ALTER TABLE projects ADD COLUMN IF NOT EXISTS deploy_url VARCHAR(500);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS custom_domain VARCHAR(253);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS seo_config JSONB DEFAULT '{}';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS ad_config JSONB DEFAULT '{}';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS generation_state JSONB DEFAULT '{}';

-- 索引
CREATE INDEX IF NOT EXISTS idx_app_templates_category ON app_templates(category);
CREATE INDEX IF NOT EXISTS idx_app_templates_is_official ON app_templates(is_official);
CREATE INDEX IF NOT EXISTS idx_projects_deploy_status ON projects(deploy_status);
```

---

## 3. Java PostgreSQL (Per-Service DBs)

### 3.1 数据库部署方式

K8s 中通过 `k8s/components/data-layer/postgres-java.yaml` (11.2 KB) 管理多个独立 PostgreSQL 实例:
- `postgres` — Node.js `agenthive` 库
- `postgres-auth` — Java `auth_db`
- `postgres-chat` / `postgres-project` / `postgres-agent` — Node.js 扩展库
- `postgres-business` — Java 业务库合集 (payment_db, order_db, cart_db, logistics_db)

每个都是独立的 StatefulSet (单副本) + PersistentVolumeClaim (5Gi~10Gi)。

生产环境阿里云 ACK 上使用**外部 ECS PostgreSQL** (`172.24.146.165`)，通过 `k8s/components/external-db/endpoint.yaml` 映射为 K8s Service + Endpoint。

### 3.2 auth_db DDL

**所属服务**: `auth-service` (端口 8081)

```sql
-- 用户表 (MyBatis-Plus 注解驱动)
CREATE TABLE sys_user (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(100),
    phone VARCHAR(20),
    avatar VARCHAR(500),
    status SMALLINT DEFAULT 1,
    deleted SMALLINT DEFAULT 0,           -- @TableLogic
    version INTEGER DEFAULT 0,             -- @Version (乐观锁)
    create_time TIMESTAMP DEFAULT NOW(),
    update_time TIMESTAMP DEFAULT NOW()
);

-- 角色表
CREATE TABLE sys_role (
    id BIGSERIAL PRIMARY KEY,
    role_code VARCHAR(50) UNIQUE NOT NULL,
    role_name VARCHAR(100) NOT NULL,
    description VARCHAR(200),
    status SMALLINT DEFAULT 1,
    create_time TIMESTAMP DEFAULT NOW(),
    update_time TIMESTAMP DEFAULT NOW()
);

-- 用户-角色关联表
CREATE TABLE sys_user_role (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    role_id BIGINT NOT NULL,
    UNIQUE(user_id, role_id)
);
```

**种子数据**:
```
sys_role:  ADMIN (role_code='ADMIN', role_name='管理员'), USER (role_code='USER', role_name='普通用户')
sys_user:  admin (admin/admin123), phone_user (phone: 13800138000)
```

### 3.3 economy_db DDL (原 payment_db)

**所属服务**: `payment-service` → `economy-service` (端口 8083)

共 15 张表 (13 张原有 + 2 张从 order-service 迁移来的 creator 表):

| 表名 | 主键 | 关键字段 | 用途 |
|------|------|----------|------|
| `t_payment` | BIGINT | payment_no, order_no, amount(DECIMAL), channel, status, third_party_no | 支付记录 |
| `t_user_wallet` | BIGINT | user_id, balance(DECIMAL), version(乐观锁) | 用户钱包 |
| `t_refund` | BIGINT | refund_no, payment_no, amount, status | 退款记录 |
| `t_credits_account` | BIGINT | user_id, balance(DECIMAL(18,4)), frozen_balance(DECIMAL(18,4)), version | 积分账户 |
| `t_credits_transaction` | BIGINT | account_id, type(ENUM), amount, source_type, source_id, balance_before, balance_after, description | 积分流水 |
| `t_agent_quota_config` | BIGINT | agent_type, quota, price | Agent 配额定价 |
| `t_marketplace_product` | BIGINT | seller_id, name, description, type, price_credits, price_fiat, status, sales, rating | 市场商品 |
| `t_marketplace_order` | BIGINT | order_no, buyer_id, product_id, channel, amount, platform_fee, seller_earning, status | 市场订单 |
| `t_marketplace_purchase` | BIGINT | buyer_id, product_id, order_no, UNIQUE(buyer_id, product_id) | 购买记录 |
| `t_hosted_website` | BIGINT | project_id, subdomain, custom_domain, status, traffic_uv, traffic_pv | 托管网站 |
| `t_traffic_record` | BIGINT | website_id, date, uv, pv, credits_earned | 流量日记录 |
| `t_traffic_conversion_config` | BIGINT | uv_to_credits, pv_to_credits | 流量兑换配置 |
| `t_withdrawal_record` | BIGINT | user_id, amount, account_info_encrypted, status, applied_at, approved_at, completed_at | 提现记录 |
| `t_creator_product` | BIGINT | creator_id, name, type, credits_price, fiat_price, status, sales_count, total_revenue | 创作者商品 (来自 order_db) |
| `t_creator_earning` | BIGINT | creator_id, product_id, buyer_id, credits_amount, fiat_amount, platform_fee, net_earning | 创作者收益 (来自 order_db) |

**关键枚举**:
- `t_credits_transaction.type`: `('CHARGE','CONSUME','REFUND','EARN','WITHDRAW')`
- `t_payment.channel`: `('WECHAT','ALIPAY','CREDITS')`

### 3.4 已删除的数据库

| 原库名 | 原服务 | 迁移目标 | 删除原因 |
|--------|--------|----------|----------|
| `order_db` | order-service | economy_db (t_creator_*) | 订单服务并入经济系统 |
| `cart_db` | cart-service | Redis (`cart:{userId}` Hash) | 购物车更适合缓存层 |
| `logistics_db` | logistics-service | 暂不实现 | 首版不做物流 |

对应的 K8s 资源应从 `10-java-services.yaml` 中移除 order-service, cart-service, logistics-service 的 Deployment + Service 定义。

---

## 4. Redis Schema

### 4.1 实例配置

**镜像**: `redis:7-alpine`
**K8s 配置**: `k8s/components/data-layer/redis.yaml` (3.2 KB)
**启动参数** (from redis.yaml Line 53-60):
```
redis-server \
  --maxmemory 256mb \
  --maxmemory-policy allkeys-lru \
  --appendonly yes \
  --appendfsync everysec \
  --save "900 1" \
  --save "300 10" \
  --save "60 10000" \
  --requirepass agenthive
```

### 4.2 键空间映射

```
┌──────────────────────────────────────────────────────────────┐
│ 类别           │ Key Pattern                    │ 数据结构 │ TTL    │
├──────────────────────────────────────────────────────────────┤
│ Agent 任务队列  │ agenthive:agent:task:queue      │ Stream   │ 无     │
├──────────────────────────────────────────────────────────────┤
│ 聊天进度       │ chat:progress                   │ Pub/Sub  │ 实时   │
│ Agent 任务进度  │ agenthive:agent:task:progress:* │ Pub/Sub  │ 实时   │
├──────────────────────────────────────────────────────────────┤
│ 购物车缓存      │ cart:{userId}                   │ Hash     │ 1h     │
│ 网关限流        │ gateway:rate:{ip}               │ Sliding  │ 窗口   │
│ 短信验证码      │ auth:sms:{phone}                │ String   │ 60s    │
│ Token 黑名单    │ auth:token:blacklist:{jti}      │ String   │ JWT剩余│
├──────────────────────────────────────────────────────────────┤
│ 预览端口池      │ agenthive:preview:allocated_ports│ SET      │ 持久   │
│ 预览服务状态    │ agenthive:preview:server:{projId}│ HASH     │ 无     │
│ 预览日志        │ agenthive:preview:log:{projId}   │ LIST     │ 1000cap│
│ 预览最后访问    │ agenthive:preview:last_access:{id}│ STRING   │ 无     │
│ 预览状态        │ agenthive:preview:status:{projId}│ STRING   │ 无     │
└──────────────────────────────────────────────────────────────┘
```

### 4.3 Stream 定义

```
Stream: agenthive:agent:task:queue
Consumer Group: agenthive:agent:task:workers
Message Fields: taskId, agentId, action, payload(JSON), timestamp
```

### 4.4 预览服务键详情

预览服务 (live preview of deployed projects) 使用一套专用 Redis 键:

```
agenthive:preview:allocated_ports    SET    {3000, 3001, 3002, ...}  已分配端口号集合
agenthive:preview:server:{projectId} HASH   {pid, port, status, startedAt, lastAccessAt}
agenthive:preview:log:{projectId}    LIST   [log_line_1, log_line_2, ...]  (capped at 1000)
agenthive:preview:last_access:{id}   STRING ISO timestamp
agenthive:preview:status:{projectId} STRING 'running' | 'stopped' | 'error'
```

---

## 5. RabbitMQ Topology

**镜像**: `rabbitmq:3.13-management-alpine`
**K8s 管理端口**: 5672 (AMQP), 15672 (Management UI)
**状态**: 开发环境启用 (`rabbitmq.enabled: true`)，生产环境禁用 (`rabbitmq.enabled: false`)

### 5.1 当前拓扑

```
Exchange: economy.exchange
Type: topic
Durable: true

Queues (pre-refactor):
┌──────────────────┬───────────────────────┬──────────────────────────┐
│ Queue            │ Routing Key           │ Consumer                 │
├──────────────────┼───────────────────────┼──────────────────────────┤
│ payment.success  │ payment.success       │ order-service            │
│ payment.refund   │ payment.refund        │ order-service            │
│ order.created    │ order.created         │ payment-service          │
│ order.cancelled  │ order.cancelled       │ payment-service          │
│ cart.updated     │ cart.updated          │ logistics-service        │
│ logistics.*      │ logistics.#           │ (various)                │
└──────────────────┴───────────────────────┴──────────────────────────┘
```

### 5.2 重构后拓扑

```
Queues (post-refactor):
┌──────────────────┬───────────────────────┬──────────────────────────┐
│ Queue            │ Routing Key           │ Consumer                 │
├──────────────────┼───────────────────────┼──────────────────────────┤
│ economy.payment  │ economy.payment.*     │ economy-service          │
│ economy.credit   │ economy.credit.*      │ economy-service          │
│ economy.order    │ economy.order.*       │ economy-service          │
└──────────────────┴───────────────────────┴──────────────────────────┘

Removed: cart.updated, logistics.*, order.* queues
Renamed: payment.* → economy.*
```

---

## 6. Docker Configuration

### 6.1 Compose 文件对比

| 特性 | dev (31.8 KB) | demo (10.2 KB) | prod (27.5 KB) |
|------|---------------|----------------|----------------|
| **PostgreSQL** | 5 个独立容器 | 1 个 (外部) | 外部 ECS |
| **Redis** | 内嵌 (v7-alpine) | 内嵌 | 外部 |
| **RabbitMQ** | 内嵌 (3.13) | 内嵌 | 禁用 |
| **Nacos** | 内嵌 (v2.3.0) | 内嵌 | 禁用 (外部) |
| **Monitoring** | 完整 LGTM + Beyla | 无 | 独立部署 |
| **用途** | 本地全栈开发 | 演示环境 | 生产部署 |

**Monitoring 独立 Compose** (`monitoring/docker-compose.yml`, 7.7 KB):
```
minio:9000/9001 → minio-init → tempo:3200/4317/4318
                             → loki:3100
prometheus:9090 ──────────────→ grafana:3003
otel-collector:4327/4328 ─────→ prometheus + tempo + loki
beyla:1.7.0 (eBPF) ──────────→ otel-collector  (profile: beyla, privileged: true)
node-exporter:9100 ───────────→ prometheus
```

### 6.2 Dockerfile 模式

**Java 服务** (6 个服务，基于 `apps/java/auth-service/Dockerfile` 等):
```
Stage 1: maven:3.9-eclipse-temurin-21-alpine
  └─ mvn clean package -pl <service> -am -DskipTests
  └─ java -Djarmode=layertools extract   (Spring Boot layered JAR)
  └─ wget opentelemetry-javaagent.jar v2.6.0

Stage 2: eclipse-temurin:21-jre-alpine
  └─ adduser appuser (uid 1001, non-root)
  └─ COPY dependencies/ + spring-boot-loader/ + snapshot-dependencies/ + application/
  └─ COPY opentelemetry-javaagent.jar
  └─ ENTRYPOINT: java ${JAVA_OPTS} -javaagent:opentelemetry-javaagent.jar JarLauncher
```

**Node.js API** (`apps/api/Dockerfile`):
```
Stage 1: node:20-alpine (builder)
  └─ pnpm@9 install --frozen-lockfile
  └─ pnpm -r build               (monorepo 全量构建)
  └─ esbuild dist/index.js → dist/bundle.cjs  (tree-shake + minify, external: pg, node-pg-migrate)
  └─ COPY migrations/

Stage 2: node:20-alpine (production)
  └─ dumb-init (PID 1 正确信号处理)
  └─ adduser appuser (uid 1001)
  └─ COPY bundle.cjs + migrations/ + templates/
  └─ npm install pg@8.11.3 node-pg-migrate@8.0.4 dotenv@16.4.0 --production
  └─ ENTRYPOINT: dumb-init -- node bundle.cjs
  └─ 预期镜像大小: ~80-120 MB (vs 323 MB before)
```

**Node.js Landing** (`apps/landing/Dockerfile`): Nuxt 3 SSR 构建，多阶段优化

**监控组件 Dockerfile**:
- `monitoring/prometheus/Dockerfile` (1.1 KB): 自定义 Prometheus 镜像 + rules
- `monitoring/grafana/Dockerfile` (1.8 KB): 预配置 dashboards + datasources
- `monitoring/node-exporter/Dockerfile` (1006 B): 标准 node-exporter

---

## 7. Kubernetes 部署拓扑

### 7.1 Namespace 布局

```
agenthive/          — 主业务命名空间 (所有应用 + 数据层)
monitoring/         — 可观测性独占命名空间 (Prometheus/Grafana/Tempo/Loki/OTel)
argocd/             — GitOps 控制器命名空间
ingress-nginx/      — 入口控制器 (独立部署)
cert-manager/       — 证书管理 (Let's Encrypt)
```

### 7.2 K8s Base 清单 (`k8s/base/`)

| # | 文件名 | 行数 | 内容 |
|---|--------|------|------|
| `00-namespace.yaml` | 107 B | agenthive namespace |
| `01-secrets.yaml` | 1.8 KB | app-secrets Secret |
| `04-api.yaml` | 6.7 KB | API ServiceAccount + Deployment + Service |
| `05-landing.yaml` | 3.4 KB | Landing Deployment + Service |
| `06-networkpolicy.yaml` | 5.9 KB | 7 NetworkPolicies |
| `07-hpa.yaml` | 1.9 KB | API + Landing HPA (CPU 70% / Mem 80%) |
| `08-configmap.yaml` | 1.7 KB | app-config ConfigMap |
| `09-ingress.yaml` | 3.8 KB | Ingress 路由规则 |
| `10-java-services.yaml` | 31.1 KB | **6** Java Deployment + Service (1135 行) |
| `11-backup-cronjob.yaml` | 3.0 KB | PostgreSQL 定时备份 |
| `12-nacos.yaml` | 4.1 KB | Nacos Deployment + Service |
| `13-rabbitmq.yaml` | 2.5 KB | RabbitMQ Deployment + Service |
| `15-rbac.yaml` | 4.2 KB | RBAC 角色和绑定 |
| `gateway-cors-config.yaml` | 1.8 KB | Gateway CORS 配置 ConfigMap |

### 7.3 K8s Components

```
k8s/components/
├── cert-manager/          cluster-issuers.yaml (Let's Encrypt prod)
├── data-layer/
│   ├── postgres.yaml           (agenthive Node.js 主库)
│   ├── postgres-auth.yaml      (auth_db, 5Gi)
│   ├── postgres-chat.yaml      (chat, 5Gi)
│   ├── postgres-project.yaml   (project, 5Gi)
│   ├── postgres-agent.yaml     (agent, 5Gi)
│   ├── postgres-java.yaml      (11.2 KB, business DB init + auth/user/payment/order/cart/logistics)
│   └── redis.yaml              (3.2 KB, maxmemory 256MB, allkeys-lru, AOF)
├── external-db/           endpoint.yaml (ECS:172.24.146.165 → K8s Service)
├── monitoring/
│   ├── namespace.yaml
│   ├── grafana-dashboard-configmap.yaml (3.0 KB)
│   ├── grafana-provisioning.yaml (1.4 KB)
│   ├── kube-prometheus-stack-values.yaml (3.3 KB)
│   ├── opentelemetry-collector.yaml (3.1 KB)
│   ├── prometheus-config.yaml (2.6 KB)
│   ├── prometheus-rules.yaml (2.8 KB, 5 alert rules)
│   ├── rbac-secret-reader.yaml
│   ├── servicemonitor-api.yaml (524 B)
│   └── servicemonitor-java.yaml (514 B)
│   ├── tempo.yaml / loki.yaml / beyla-daemonset.yaml / otel-collector.yaml
└── security/              network-policies.yaml (2.9 KB)
```

### 7.4 资源分配表

| 服务 | 副本数 (dev) | 副本数 (prod) | CPU 请求 | 内存请求 | CPU 限制 | 内存限制 |
|------|-------------|---------------|----------|----------|----------|----------|
| **api** | 1 | 3 | 250m | 256Mi | 500m | 512Mi (dev) / 1Gi (prod) |
| **landing** | 1 | 3 | 100m | 128Mi | 250m | 256Mi (dev) / 512Mi (prod) |
| **agent-runtime** | 1 (dev only) | 0 (disabled) | 250m | 256Mi | 500m | 512Mi |
| **gateway-service** | 2 (dev) / 1 (dev overlay) | 3 | 250m | 256Mi | 500m | 512Mi |
| **auth-service** | 2 (dev) / 1 (dev overlay) | 3 | 250m | 256Mi | 500m | 512Mi (dev) / 1Gi (prod) |
| **payment/economy** | disabled (dev) | 3 | - | - | 500m | 1Gi (prod) |
| **user-service** | disabled (dev) | 3 | - | - | 500m | 1Gi (prod) |
| **order/cart/logistics** | removed | removed | - | - | - | - |
| **postgres (各)** | 1 | 外部 ECS | 250m | 256Mi | 1 | 512Mi~2Gi |
| **redis** | 1 | 外部 ECS | 100m | 128Mi | 200m | 256Mi |
| **rabbitmq** | 1 (dev) | 0 (disabled) | 100m | 256Mi | 250m | 512Mi |
| **nacos** | 1 | 1 | 250m (dev) / 500m (prod) | 512Mi (dev) / 1Gi (prod) | 500m (dev) / 1 | 1Gi (dev) / 2Gi (prod) |

### 7.5 安全上下文

所有 Pod 统一遵循:
```yaml
securityContext:
  runAsNonRoot: true
  runAsUser: 1000       # (Java appuser=1001, Redis=999, RabbitMQ=999)
  runAsGroup: 1000
  seccompProfile:       # (API only)
    type: RuntimeDefault
containerSecurityContext:
  allowPrivilegeEscalation: false
  readOnlyRootFilesystem: true   # (Java + init containers)
  capabilities:
    drop:
    - ALL
```

### 7.6 HPA 扩缩行为

```yaml
scaleDown:
  stabilizationWindowSeconds: 300    # 5 分钟稳定窗口
  policies:
    - type: Percent, value: 10, periodSeconds: 60   # 每分钟最多缩 10%
scaleUp:
  stabilizationWindowSeconds: 0      # 即时扩容
  policies:
    - type: Percent, value: 100, periodSeconds: 15  # 15 秒内可翻倍
    - type: Pods, value: 4, periodSeconds: 15       # 或 15 秒增 4 个
  selectPolicy: Max
```

### 7.7 后重构变更

需从 `10-java-services.yaml` 移除的节:
- `cart-service` Deployment (lines ~570-670, 估算)
- `logistics-service` Deployment
- `order-service` Deployment

需修改: `payment-service` → `economy-service` (重命名，更新所有标签、selector、Service)

---

## 8. Helm Chart 结构

### 8.1 模板清单 (42+ 文件)

文件路径：`chart/agenthive/templates/`

```
核心应用层:
├── api-deployment.yaml              (4.9 KB)  带 env/volume/secrets
├── api-service.yaml                 (567 B)
├── api-hpa.yaml                     (957 B)
├── api-pdb.yaml                     (386 B)
├── api-ingress.yaml                 (1.3 KB)
├── landing-deployment.yaml          (3.9 KB)
├── landing-service.yaml             (599 B)
├── landing-hpa.yaml                 (997 B)
├── landing-pdb.yaml                 (406 B)
├── landing-ingress.yaml             (1.4 KB)
├── agent-runtime-deployment.yaml    (4.5 KB)
├── agent-runtime-service.yaml       (703 B)
├── agent-runtime-serviceaccount.yaml(535 B)

Java 服务层:
├── java-deployment.yaml             (7.5 KB)  循环模板 (6 services)
├── java-service.yaml                (728 B)
├── java-hpa.yaml                    (1.3 KB)
├── java-pdb.yaml                    (657 B)
├── java-ingress.yaml                (1.4 KB)

数据层:
├── postgres-deployment.yaml         (3.4 KB)
├── postgres-init-configmap.yaml     (1.1 KB)
├── postgres-pvc.yaml                (669 B)
├── postgres-service.yaml            (674 B)
├── redis-deployment.yaml            (2.8 KB)
├── redis-pvc.yaml                   (645 B)
├── redis-service.yaml               (647 B)
├── rabbitmq-deployment.yaml         (3.5 KB)
├── rabbitmq-pvc.yaml                (586 B)
├── rabbitmq-service.yaml            (835 B)
├── nacos-deployment.yaml            (3.4 KB)
├── nacos-pvc.yaml                   (599 B)
├── nacos-secret.yaml                (675 B)
├── nacos-service.yaml               (830 B)

基础设施:
├── namespace.yaml                   (296 B)
├── secret.yaml                      (4.0 KB)  3 modes (ExternalSecret/empty/Helm)
├── configmap.yaml                   (386 B)
├── registry-secret.yaml             (1.1 KB)
├── networkpolicy.yaml               (6.4 KB)
├── rbac.yaml                        (2.5 KB)
├── serviceaccount.yaml              (2.1 KB)
├── ingress.yaml                     (1.2 KB)
├── gateway-cors-configmap.yaml      (1.9 KB)
├── otel-collector.yaml              (3.6 KB)
├── db-migrate-job.yaml              (4.0 KB)  PreSync hook
└── workspace-pvc.yaml               (687 B)
```

### 8.2 Values 文件对比

| 特性 | values.yaml (23.1 KB) | values.dev.yaml (8.4 KB) | values.prod.yaml (12.2 KB) |
|------|----------------------|--------------------------|----------------------------|
| **作用** | 默认值 + 完整文档 | dev 环境覆盖 | 生产环境覆盖 |
| **NODE_ENV** | development | development | production |
| **api.replicas** | 1 | 1 | 3 |
| **api.image.tag** | latest | v1.2.0-14-g7424478 | latest |
| **javaServices.defaults.image.tag** | latest | develop-latest | v1.1.0-g6d872b4 |
| **javaServices.defaults.replicas** | 1 | 1 | 3 |
| **payment/order/cart/logistics enabled** | false (dev) / true (default) | false | true (3 replicas) |
| **postgres/redis embedded** | true | true | false (外部 ECS) |
| **rabbitmq enabled** | false | true | false |
| **networkPolicy enabled** | true | false | false |
| **registry secret** | N/A | acr-regcred | acr-regcred |
| **ingress TLS** | false (localhost) | false | true (cert-manager + Let's Encrypt prod) |
| **CORS** | localhost + agenthive.local | localhost + agenthive.local | *.xiaochaitian.asia |
| **OTEL_SDK_DISABLED** | "true" | "true" | "false" |
| **otelCollector enabled** | false | false | true |
| **HPA enabled** | false | false | true |

### 8.3 Secret 管理三模式

来自 `chart/agenthive/templates/secret.yaml` (4.0 KB):

```yaml
# 模式 A: ExternalSecret — 从阿里云 KMS 同步 (生产推荐)
#   条件: secret.enabled=true && secret.externalSecret.enabled=true
#   机制: external-secrets.io/v1beta1 ExternalSecret → ClusterSecretStore → Alicloud KMS
#   刷新间隔: 1h

# 模式 B: 空 Secret — key 存在，值由外部 setup-secrets.sh 注入 (生产备选)
#   条件: secret.enabled=true && secret.createEmpty=true
#   机制: Secret 创建时所有值为空字符串，运维脚本手动 patch

# 模式 C: Helm-managed Secret — 从 values 读取 (开发/测试)
#   条件: secret.enabled=true, 其余为 false
#   机制: 直接从 values.dev.yaml secret.data.* 渲染
```

---

## 9. 监控栈

### 9.1 信号管道

```
┌─────────────┐   OTLP gRPC (4317)   ┌───────────────────┐
│  API (Node) │─────────────────────→│                   │
│  + OTEL SDK │                      │  OTel Collector   │
└─────────────┘                      │  (Contrib 0.96.0) │
┌─────────────┐   OTLP HTTP (4318)   │                   │
│  Java (Spr.)│─────────────────────→│   memory_limiter  │──→ Prometheus (metrics)
│  + OTEL Java│                      │   batch           │──→ Tempo (traces)
└─────────────┘                      │   resource        │──→ Loki (logs)
                                     │   filter(sens.)   │
┌─────────────┐   eBPF (host)        └───────────────────┘
│  Beyla 1.7  │─────────────────────→   (auto-instrument 所有 HTTP/gRPC)
└─────────────┘
```

**Collector 配置** (`monitoring/opentelemetry/otel-collector/otel-collector.yml`, 5 KB):
```
Receivers:   otlp (gRPC:4317, HTTP:4318), prometheus (自我监控)
Processors:  memory_limiter (512MiB + 128MiB spike), batch (1024→2048),
             resource (注入 environment/project), filter (敏感数据过滤)
Exporters:   prometheus (metrics), otlp→tempo (traces), loki (logs),
             jaeger (兼容模式), debug/logging
```

### 9.2 业务 Span 定义

| Span 名称 | 关键属性 | 说明 |
|-----------|----------|------|
| `agenthive.llm.completion` | `llm.provider`, `llm.model`, `llm.tokens.input`, `llm.tokens.output`, `llm.cost_usd` | LLM 调用 |
| `agenthive.runtime.task` | `agent.id`, `task.id`, `task.type` | Agent 任务执行 |
| `agenthive.query_loop.execute` | `query_loop.iteration`, `llm.tokens.total` | 查询循环 |
| `agenthive.tool.execute` | `tool.name`, `tool.duration_ms` | 工具调用 |
| `agenthive.websocket.*` | `websocket.event_type`, `websocket.connection_id` | WebSocket 事件 |

### 9.3 仪表板清单

| 仪表板 | 文件 | 大小 | 数据源 |
|--------|------|------|--------|
| **AgentHive Overview** | `agenthive-overview.json` | 9.8 KB | Prometheus |
| **System Monitor** | `system-monitor.json` | 13.7 KB | Prometheus |
| (预配置 DataSources) | grafana provisioning | - | Prometheus, Tempo(TraceQL), Loki |

### 9.4 告警规则

来自 `k8s/components/monitoring/prometheus-rules.yaml` (2.8 KB):

| 告警 | 严重级别 | 触发条件 | 持续时间 |
|------|----------|----------|----------|
| `AgentHiveApiHighErrorRate` | warning | API 5xx 错误率 > 5% | 2 分钟 |
| `AgentHiveApiHighLatency` | warning | API P95 延迟 > 2 秒 | 5 分钟 |
| `AgentHiveApiPodCrashLooping` | critical | API Pod 15 分钟内重启 | 5 分钟 |
| `AgentHiveJavaServiceDown` | critical | Java 服务 up == 0 | 2 分钟 |
| `AgentHiveHpaMaxedOut` | warning | HPA 已达 maxReplicas | 10 分钟 |

### 9.5 ServiceMonitor

```yaml
# k8s/components/monitoring/servicemonitor-api.yaml (524 B)
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: agenthive-api
  namespace: monitoring
spec:
  selector:
    matchLabels:
      app.kubernetes.io/name: api
  endpoints:
    - port: http
      path: /metrics

# k8s/components/monitoring/servicemonitor-java.yaml (514 B)
# 匹配所有 Java 服务 (/actuator/prometheus)
```

---

## 10. CI/CD 管道

### 10.1 Workflow 依赖图

```
develop push → detect-changes ──→ build-and-push (matrix 8 services) ──→ update-manifest
                                                                              │
                                                                              ▼
                                                                     ArgoCD auto-sync
                                                                     (values.dev.yaml → helm install → agenthive-dev cluster)

PR → ci.yml: typecheck + lint + unit tests + build verification
     ├── build-gate.yml (Dockerfile lint)
     ├── file-quality-gate.yml (file structure check)
     ├── agent-compliance-check.yml (Agent code conventions)
     └── security-scan.yml (Trivy + dependency audit)

Manual / Scheduled:
  ├── iac-apply-env.yml / iac-apply-demo.yml / iac-destroy-demo.yml / iac-pr-check.yml
  ├── build-images.yml (独立镜像构建)
  ├── deploy.yml (独立部署触发)
  └── update-helm-values.yml (手动 tag 更新)
```

### 10.2 Develop CI 详细流程 (`develop-ci.yml`, 14.2 KB)

```
1. detect-changes (tj-actions/changed-files@v44)
   ├── node-api     : apps/api/**, packages/shared/**, packages/observability/**, packages/agent-runtime/**
   ├── node-landing : apps/landing/**, packages/ui/**
   ├── java-all     : apps/java/**
   └── any-service  : apps/**

2. build-and-push (matrix strategy, parallel)
   Matrix services:
   ├── api            ← Node.js (pnpm install + tsc + Docker build)
   ├── landing        ← Node.js (pnpm install + build + Docker build)
   ├── auth-service   ← Java (mvn clean install -pl auth-service -am)
   ├── cart-service   ← Java
   ├── gateway-service← Java
   ├── logistics-service← Java
   ├── order-service  ← Java
   └── payment-service← Java

   标签策略: semver (git describe --tags) || commit-sha + develop 浮动标签
   注册中心: crpi-89ktoa4wv8sjcdow.cn-beijing.personal.cr.aliyuncs.com/namespace-alpha/

3. update-manifest (条件触发)
   仅当 node-changed=true || java-changed=true
   使用 yq 更新 chart/agenthive/values.dev.yaml 中的镜像 tag
   git commit + push → ArgoCD 在 3-5 分钟内自动检测并同步
```

### 10.3 CI 验证流水线 (`ci.yml`, 5.8 KB)

PR 触发，每个服务独立 Job：
```
api-build      : cd apps/api && npm ci && npm run typecheck && npm run test
landing-build   : cd apps/landing && npm ci && npm run typecheck && npm run test
java-build      : cd apps/java && mvn -pl <service> -am verify
dockerfile-lint : hadolint on all Dockerfiles
file-quality    : file-quality-gate.yml (max file size, no sensitive patterns, etc.)
agent-compliance: agent-compliance-check.yml
security-scan   : Trivy scan + npm audit / OWASP dependency-check
```

### 10.4 ArgoCD Sync 配置

来自 `deploy/argocd/applications.yaml`:

```yaml
# agenthive-dev (develop 分支)
source:
  repoURL: https://github.com/sdoxiaobaomei/agenthive-cloud.git
  targetRevision: develop
  path: chart/agenthive
  helm:
    valueFiles:
      - values.dev.yaml
destination:
  server: https://100.76.250.86:57116    # k3d 开发集群
syncPolicy:
  automated:
    prune: true
    selfHeal: true
  retry: { limit: 5, backoff: { duration: 5s, factor: 2, maxDuration: 3m } }
  syncOptions: [CreateNamespace=true, PrunePropagationPolicy=foreground, PruneLast=true]

# agenthive-prod (master 分支)
source:
  targetRevision: master
  helm:
    valueFiles:
      - values.prod.yaml
destination:
  server: https://39.107.87.106:6443     # ACK 生产集群
# 生产环境 syncPolicy.automated = null (需要手动审批后才能同步)
```

**Helm Hook → ArgoCD Sync 映射**:
- `db-migrate-job.yaml` 使用 `helm.sh/hook: pre-install,pre-upgrade` 注解
- ArgoCD 将这些 Hook 映射为 `PreSync` 阶段
- 如果 migration Job 失败，整个 Sync 失败 (desired behavior)

---

## 附录 A: 关键文件路径索引

| 类别 | 文件 | 路径 |
|------|------|------|
| DB Schema | schema.sql | `apps/api/src/db/schema.sql` |
| DB Migrations | 11 个文件 | `apps/api/src/db/migrations/20260423*` ~ `20260505*` |
| Dockerfile (Node API) | | `apps/api/Dockerfile` |
| Dockerfile (Node Landing) | | `apps/landing/Dockerfile` |
| Dockerfile (Agent Runtime) | | `apps/agent-runtime/Dockerfile` |
| Dockerfile (Java auth) | | `apps/java/auth-service/Dockerfile` |
| Dockerfile (Java gateway) | | `apps/java/gateway-service/Dockerfile` |
| Dockerfile (Java payment) | | `apps/java/payment-service/Dockerfile` |
| Docker Compose (dev) | | `docker-compose.dev.yml` (31.8 KB) |
| Docker Compose (prod) | | `docker-compose.prod.yml` (27.5 KB) |
| Docker Compose (demo) | | `docker-compose.demo.yml` (10.2 KB) |
| Docker Compose (monitoring) | | `monitoring/docker-compose.yml` (7.7 KB) |
| K8s Base | 14 个文件 | `k8s/base/` |
| K8s Components | 20+ 个文件 | `k8s/components/` |
| K8s Overlays | | `k8s/overlays/local/`, `production/`, `demo-ask/` |
| Helm Chart | 42+ 个模板 | `chart/agenthive/templates/` |
| Helm Values (default) | | `chart/agenthive/values.yaml` (23.1 KB) |
| Helm Values (dev) | | `chart/agenthive/values.dev.yaml` (8.4 KB) |
| Helm Values (prod) | | `chart/agenthive/values.prod.yaml` (12.2 KB) |
| CI (develop) | | `.github/workflows/develop-ci.yml` (14.2 KB) |
| CI (PR) | | `.github/workflows/ci.yml` (5.8 KB) |
| CI (security) | | `.github/workflows/security-scan.yml` (5.9 KB) |
| ArgoCD Apps | | `deploy/argocd/applications.yaml` |
| Monitoring (Prom rules) | | `k8s/components/monitoring/prometheus-rules.yaml` (2.8 KB) |
| Monitoring (OTel Collector) | | `monitoring/opentelemetry/otel-collector/otel-collector.yml` (5 KB) |
| Monitoring (Prometheus) | | `monitoring/prometheus/prometheus.yml` |

## 附录 B: 后重构待办清单

- [ ] 在 `10-java-services.yaml` 中移除 cart-service, logistics-service, order-service 的所有 Deployment + Service 节
- [ ] 将 payment-service 重命名为 economy-service (Deployment name, labels, Service selector)
- [ ] 更新 `values.prod.yaml` 移除 order/cart/logistics 配置节
- [ ] 在 `develop-ci.yml` matrix 中移除 cart/logistics/order (或替换为 economy)
- [ ] 创建 `postgres-java.yaml` 中 economy_db 的 init.sql (替代 payment_db/order_db/cart_db/logistics_db)
- [ ] 更新 RabbitMQ 拓扑: 删除 cart.updated, logistics.*, order.* 队列; 重命名 payment.* → economy.*
- [ ] 执行新增 DDL migration: app_templates, project_supabase_configs, projects 增强字段
- [ ] 更新 `schema.sql` 快照

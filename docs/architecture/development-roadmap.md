# AgentHive Cloud — 后续开发方案

> **版本**: v1.0 | **日期**: 2026-04-25 | **状态**: 草案

---

## 目录

1. [项目愿景与目标](#1-项目愿景与目标)
2. [功能模块总览](#2-功能模块总览)
3. [模块一：AI Agent 平台](#3-模块一ai-agent-平台)
4. [模块二：电商 SaaS 核心](#4-模块二电商-saas-核心)
5. [模块三：开发者工作台](#5-模块三开发者工作台)
6. [模块四：可观测性与运维](#6-模块四可观测性与运维)
7. [模块五：基础设施与平台](#7-模块五基础设施与平台)
8. [技术选型总表](#8-技术选型总表)
9. [API 总量统计](#9-api-总量统计)
10. [开发阶段与里程碑](#10-开发阶段与里程碑)
11. [团队分工建议](#11-团队分工建议)

---

## 1. 项目愿景与目标

### 1.1 愿景

构建一个 **AI 驱动的软件研发平台**，用户通过自然语言 Chat 界面指挥 AI Agent 团队完成软件开发全生命周期。同时平台提供完整的 **电商 SaaS 能力**，支撑商业化订阅和增值服务。

### 1.2 目标用户

| 用户类型 | 需求 | 使用场景 |
|---------|------|----------|
| **个人开发者** | 快速搭建项目原型、自动化编码 | "帮我创建一个带登录的博客系统" |
| **初创团队** | 降低研发成本、加速 MVP 交付 | 3 个 Agent 并行开发前后端和测试 |
| **企业客户** | 标准化研发流程、代码资产沉淀 | 多项目协作、权限管控、审计追踪 |
| **平台买家** | 购买 SaaS 订阅、增值服务 | 订阅专业版、购买额外算力包 |

### 1.3 核心指标

| 指标 | 目标值 | 说明 |
|------|--------|------|
| Agent 任务完成率 | > 90% | 端到端任务成功执行比例 |
| API P99 延迟 | < 200ms | 核心 API 响应时间 |
| 平台可用性 | 99.9% | 年度 SLA |
| 并发 Agent 任务 | > 100 | 同时运行的 Agent 数量 |
| 电商订单 QPS | > 1000 | 下单峰值处理能力 |

---

## 2. 功能模块总览

```
AgentHive Cloud 功能架构
│
├── AI Agent 平台 (核心差异化)
│   ├── Agent 市场与管理
│   ├── Chat 智能会话
│   ├── 任务编排与执行
│   ├── 代码生成与审查
│   └── 项目工作区
│
├── 电商 SaaS 核心 (商业化支撑)
│   ├── 用户中心
│   ├── 订阅与计费
│   ├── 订单管理
│   ├── 支付网关
│   └── 物流追踪
│
├── 开发者工作台 (用户体验)
│   ├── 代码编辑器
│   ├── 文件管理器
│   ├── 实时终端
│   ├── 版本控制 (Git)
│   └── 预览与部署
│
├── 可观测性与运维 (生产保障)
│   ├── 分布式追踪
│   ├── 指标监控
│   ├── 日志聚合
│   ├── 告警系统
│   └── 健康检查
│
└── 基础设施与平台 (底层支撑)
    ├── 多租户隔离
    ├── 资源配额管理
    ├── API 网关
    ├── 服务注册发现
    └── 配置中心
```

---

## 3. 模块一：AI Agent 平台

### 3.1 功能清单

| 功能点 | 说明 | 优先级 |
|--------|------|--------|
| Agent 市场 | 浏览、搜索、安装、评价预置 Agent | P1 |
| 自定义 Agent | 创建、配置、调试专属 Agent | P1 |
| Agent 生命周期 | 启动、停止、暂停、恢复、重启 | P1 |
| Chat 智能会话 | 自然语言交互、意图识别、上下文管理 | P1 |
| 任务编排 | 工单创建、依赖管理、并行/串行执行 | P1 |
| 代码生成 | 根据需求生成前后端代码 | P1 |
| 代码审查 | 自动审查代码质量、安全漏洞 | P2 |
| 测试生成 | 自动生成单元测试、E2E 测试 | P2 |
| 文档生成 | 自动生成 API 文档、README | P2 |
| 部署发布 | 一键构建 Docker 镜像、部署到 K8s | P2 |
| 项目模板 | 快速创建 React/Vue/Express/Spring 项目 | P1 |
| 工作区隔离 | 每个项目独立 Git worktree / 容器 | P1 |

### 3.2 API 设计

#### Agent 管理 (14 个 API)

```
GET    /api/v1/agents                    获取 Agent 列表 (支持分页、筛选、搜索)
POST   /api/v1/agents                    创建 Agent
GET    /api/v1/agents/:id                获取 Agent 详情
PATCH  /api/v1/agents/:id                更新 Agent 配置
DELETE /api/v1/agents/:id                删除 Agent
POST   /api/v1/agents/:id/start          启动 Agent
POST   /api/v1/agents/:id/stop           停止 Agent
POST   /api/v1/agents/:id/pause          暂停 Agent
POST   /api/v1/agents/:id/resume         恢复 Agent
POST   /api/v1/agents/:id/restart        重启 Agent
POST   /api/v1/agents/:id/command        发送命令
GET    /api/v1/agents/:id/status         获取实时状态
GET    /api/v1/agents/:id/logs           获取运行日志
POST   /api/v1/agents/:id/clone          克隆 Agent
```

**请求/响应示例**：

```typescript
// POST /api/v1/agents
{
  "name": "后端开发助手",
  "role": "backend_dev",
  "description": "专注于 Node.js/Express 后端开发",
  "config": {
    "model": "qwen3:14b",
    "maxIterations": 50,
    "permissions": ["file_read", "file_write", "shell_exec", "git_commit"],
    "workspaceIsolation": "worktree"
  },
  "tags": ["nodejs", "express", "typescript"]
}

// Response
{
  "code": 201,
  "message": "success",
  "data": {
    "id": "agent-uuid",
    "name": "后端开发助手",
    "status": "idle",
    "createdAt": "2026-04-25T10:00:00Z"
  }
}
```

#### 任务管理 (12 个 API)

```
GET    /api/v1/tasks                     获取任务列表
POST   /api/v1/tasks                     创建任务
GET    /api/v1/tasks/:id                 获取任务详情
PATCH  /api/v1/tasks/:id                 更新任务
DELETE /api/v1/tasks/:id                 删除任务
POST   /api/v1/tasks/:id/execute         执行任务 (异步提交)
POST   /api/v1/tasks/:id/cancel          取消任务
POST   /api/v1/tasks/:id/retry           重试任务
GET    /api/v1/tasks/:id/progress        获取执行进度
GET    /api/v1/tasks/:id/logs            获取执行日志
GET    /api/v1/tasks/:id/subtasks        获取子任务列表
GET    /api/v1/tasks/:id/artifacts       获取产物列表
```

#### Chat 会话 (10 个 API)

```
POST   /api/v1/chat/sessions             创建会话
GET    /api/v1/chat/sessions             获取会话列表
GET    /api/v1/chat/sessions/:id         获取会话详情
PATCH  /api/v1/chat/sessions/:id         更新会话 (重命名)
DELETE /api/v1/chat/sessions/:id         删除会话
POST   /api/v1/chat/sessions/:id/messages 发送消息
GET    /api/v1/chat/sessions/:id/messages 获取消息历史
POST   /api/v1/chat/sessions/:id/execute   执行 Agent 任务
GET    /api/v1/chat/sessions/:id/tasks      获取会话关联任务
GET    /api/v1/chat/sessions/:id/progress   获取会话整体进度
```

**发送消息流程**：

```
1. 用户 POST /api/v1/chat/sessions/:id/messages { content: "创建博客系统" }
2. 系统保存用户消息到数据库
3. 系统调用 LLM 进行意图识别 (classifyIntent)
4. 系统保存系统消息 ("检测到意图: create_project")
5. 如果意图可执行，创建 Agent 任务并提交到队列
6. 系统调用 LLM 生成回复
7. 系统保存助手消息
8. 返回 { message, intent, tasks }
9. WebSocket 推送实时进度
```

#### 项目工作区 (10 个 API)

```
GET    /api/v1/projects                  获取项目列表
POST   /api/v1/projects                  创建项目
GET    /api/v1/projects/:id              获取项目详情
PATCH  /api/v1/projects/:id              更新项目
DELETE /api/v1/projects/:id              删除项目
POST   /api/v1/projects/:id/clone        克隆项目
POST   /api/v1/projects/:id/deploy       部署项目
GET    /api/v1/projects/:id/status       获取项目状态
POST   /api/v1/projects/:id/share        分享项目
POST   /api/v1/projects/:id/migrate-visitor 访客项目迁移
```

### 3.3 技术实现

| 层级 | 技术选型 | 说明 |
|------|----------|------|
| **框架** | Express.js 4.x + TypeScript | 轻量高效，已有基础 |
| **验证** | Zod | Schema 验证，已有基础 |
| **数据库** | PostgreSQL 16 | 主业务库 |
| **缓存** | Redis 7 | 会话、进度、限流 |
| **队列** | Redis Stream / RabbitMQ | 任务队列 |
| **WebSocket** | Socket.io 4.x | 实时推送 |
| **LLM** | Ollama + OpenAI 兼容 API | 本地 + 云端混合 |
| **Agent 执行** | Agent Runtime (独立部署) | 通过队列调用 |
| **文件存储** | 本地磁盘 + MinIO | 工作区文件 |
| **Git 操作** | simple-git (Node.js) | 工作区隔离 |

### 3.4 数据模型

```sql
-- Agent 表
CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(128) NOT NULL,
  role VARCHAR(50) NOT NULL,
  description TEXT,
  config JSONB NOT NULL DEFAULT '{}',
  status VARCHAR(20) DEFAULT 'idle',
  owner_id BIGINT NOT NULL,
  tags TEXT[],
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 任务表
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(200) NOT NULL,
  description TEXT,
  type VARCHAR(50) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  priority VARCHAR(20) DEFAULT 'medium',
  progress INT DEFAULT 0,
  assigned_to UUID REFERENCES agents(id),
  project_id UUID,
  input JSONB,
  output JSONB,
  error TEXT,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Chat 会话表
CREATE TABLE chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id BIGINT NOT NULL,
  project_id UUID,
  title VARCHAR(200),
  status VARCHAR(20) DEFAULT 'active',
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Chat 消息表
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES chat_sessions(id),
  role VARCHAR(20) NOT NULL, -- user, assistant, system, agent
  content TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 项目表
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(128) NOT NULL,
  description TEXT,
  repo_url VARCHAR(500),
  template VARCHAR(50),
  owner_id BIGINT NOT NULL,
  status VARCHAR(20) DEFAULT 'active',
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 4. 模块二：电商 SaaS 核心

### 4.1 功能清单

| 功能点 | 说明 | 优先级 |
|--------|------|--------|
| 用户注册/登录 | 用户名密码、短信验证码、OAuth2 (GitHub/Google) | P1 |
| 用户资料管理 | 头像、昵称、邮箱、手机、密码修改 | P1 |
| RBAC 权限 | 角色 (admin/user/guest)、资源权限、操作权限 | P1 |
| 订阅计划 | 免费版/专业版/企业版，功能差异、价格配置 | P1 |
| 计费管理 | 套餐订阅、按量计费、优惠券、发票 | P2 |
| 订单管理 | 创建订单、状态流转、取消、退款 | P1 |
| 支付网关 | 支付宝、微信支付、对公转账 | P1 |
| 钱包系统 | 余额、充值、消费记录、冻结 | P2 |
| 物流追踪 | 实体商品发货、物流状态、签收 | P3 |
| 对账系统 | 支付对账、异常处理、自动补偿 | P2 |

### 4.2 API 设计

#### 认证服务 (8 个 API) — Java auth-service

```
POST   /auth/register                    注册
POST   /auth/login                       用户名密码登录
POST   /auth/login/sms                   短信验证码登录
POST   /auth/refresh                     刷新 Token
POST   /auth/logout                      登出
GET    /auth/me                          获取当前用户
PATCH  /auth/profile                     更新资料
GET    /auth/users/:id/roles             获取用户角色
```

**技术实现**：
- 框架：Spring Boot 3.2 + Spring Security 6
- JWT：jjwt 0.12.5
- 密码：BCrypt
- 短信：阿里云短信服务
- OAuth2：Spring Security OAuth2 Client

#### 用户服务 (6 个 API) — Java user-service

```
GET    /users/:id                        获取用户详情
PUT    /users/:id                        更新用户
GET    /users/:id/permissions            获取用户权限
POST   /users/:id/avatar                 上传头像
GET    /users/:id/activities             获取用户活动记录
DELETE /users/:id                        注销账号 (软删除)
```

#### 订阅与计费 (10 个 API) — Java payment-service

```
GET    /plans                            获取订阅计划列表
GET    /plans/:id                        获取计划详情
POST   /subscriptions                    创建订阅
GET    /subscriptions/:id               获取订阅详情
PATCH  /subscriptions/:id               升级/降级订阅
DELETE /subscriptions/:id               取消订阅
GET    /billing/history                 获取账单历史
GET    /billing/usage                   获取用量统计
POST   /billing/coupons/:code/apply     应用优惠券
POST   /billing/invoices/:id/request    申请发票
```

#### 订单管理 (8 个 API) — Java order-service

```
POST   /orders                           创建订单
GET    /orders/:orderNo                 获取订单详情
GET    /orders/user/:userId             获取用户订单列表
PUT    /orders/:orderNo/cancel          取消订单
PUT    /orders/:orderNo/confirm         确认收货
GET    /orders/:orderNo/items           获取订单项
POST   /orders/:orderNo/refund          申请退款
GET    /orders/stats                    订单统计
```

**订单状态机**：

```
CREATED → PAID → SHIPPED → DELIVERED → COMPLETED
   │        │       │          │
   ▼        ▼       ▼          ▼
CANCELLED REFUNDED RETURNED   EXPIRED
```

#### 支付网关 (6 个 API) — Java payment-service

```
POST   /payments/create                  创建支付单
POST   /payments/callback                支付回调 (幂等)
POST   /payments/refund                  退款
GET    /payments/:orderNo               查询支付状态
GET    /wallets/:userId                  查询钱包余额
POST   /wallets/recharge                钱包充值
```

#### 购物车 (6 个 API) — Java cart-service

```
GET    /carts/:userId                    获取购物车
POST   /carts/items                     添加商品
PUT    /carts/items/:id                 更新数量
DELETE /carts/items/:id                 删除商品
POST   /carts/clear                     清空购物车
POST   /carts/checkout                  结算预览
```

### 4.3 技术实现

| 层级 | 技术选型 | 说明 |
|------|----------|------|
| **框架** | Spring Boot 3.2.12 | 已有基础 |
| **微服务** | Spring Cloud 2023.0.5 | 服务注册、配置、网关 |
| **注册中心** | Nacos 2.x | 阿里生态，配置+注册一体 |
| **ORM** | MyBatis Plus 3.5.9 | 简化 CRUD |
| **缓存** | Redisson 3.27.0 | 分布式锁、缓存注解 |
| **消息队列** | RabbitMQ | 异步解耦 |
| **数据库** | PostgreSQL 16 | 主业务库，按服务分库 |
| **分布式事务** | Seata AT 模式 | 支付状态强一致性 |
| **支付** | 支付宝 SDK / 微信支付 SDK | 国内主流支付 |
| **对象存储** | MinIO / 阿里云 OSS | 文件、头像存储 |

### 4.4 数据库设计（分库）

```sql
-- auth_db (auth-service)
CREATE TABLE sys_user (
  id BIGSERIAL PRIMARY KEY,
  username VARCHAR(64) UNIQUE NOT NULL,
  password VARCHAR(128) NOT NULL,
  email VARCHAR(128),
  phone VARCHAR(20),
  avatar VARCHAR(500),
  status TINYINT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sys_role (
  id BIGSERIAL PRIMARY KEY,
  role_code VARCHAR(64) UNIQUE NOT NULL,
  role_name VARCHAR(64) NOT NULL
);

CREATE TABLE sys_user_role (
  user_id BIGINT,
  role_id BIGINT,
  PRIMARY KEY (user_id, role_id)
);

-- order_db (order-service)
CREATE TABLE t_order (
  id BIGSERIAL PRIMARY KEY,
  order_no VARCHAR(32) UNIQUE NOT NULL,
  user_id BIGINT NOT NULL,
  total_amount DECIMAL(18,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'CREATED',
  pay_status VARCHAR(20) DEFAULT 'UNPAID',
  logistics_status VARCHAR(20) DEFAULT 'PENDING',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  paid_at TIMESTAMP,
  delivered_at TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE TABLE t_order_item (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL,
  product_id BIGINT NOT NULL,
  product_name VARCHAR(200),
  sku_id BIGINT,
  quantity INT NOT NULL,
  unit_price DECIMAL(18,2) NOT NULL,
  total_price DECIMAL(18,2) NOT NULL
);

-- payment_db (payment-service)
CREATE TABLE t_payment (
  id BIGSERIAL PRIMARY KEY,
  payment_no VARCHAR(32) UNIQUE NOT NULL,
  order_no VARCHAR(32) NOT NULL,
  user_id BIGINT NOT NULL,
  amount DECIMAL(18,2) NOT NULL,
  channel VARCHAR(20) NOT NULL, -- ALIPAY, WECHAT, BALANCE
  status VARCHAR(20) DEFAULT 'PENDING',
  third_party_no VARCHAR(64),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE TABLE t_user_wallet (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT UNIQUE NOT NULL,
  balance DECIMAL(18,2) DEFAULT 0.00,
  frozen_balance DECIMAL(18,2) DEFAULT 0.00,
  version BIGINT DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- cart_db (cart-service)
CREATE TABLE t_cart_item (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  product_id BIGINT NOT NULL,
  sku_id BIGINT,
  quantity INT NOT NULL DEFAULT 1,
  selected BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, product_id, sku_id)
);

-- logistics_db (logistics-service)
CREATE TABLE t_logistics (
  id BIGSERIAL PRIMARY KEY,
  order_no VARCHAR(32) NOT NULL,
  tracking_no VARCHAR(64),
  carrier VARCHAR(32), -- SF, YTO, ZTO
  status VARCHAR(20) DEFAULT 'PENDING',
  sender_info JSONB,
  receiver_info JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  shipped_at TIMESTAMP,
  delivered_at TIMESTAMP
);

CREATE TABLE t_logistics_track (
  id BIGSERIAL PRIMARY KEY,
  tracking_no VARCHAR(64) NOT NULL,
  event_time TIMESTAMP,
  event_desc VARCHAR(500),
  location VARCHAR(200)
);
```

### 4.5 消息队列事件设计

| 事件 | 生产者 | 消费者 | 用途 |
|------|--------|--------|------|
| `order.created` | order-service | payment-service | 创建支付单 |
| `payment.success` | payment-service | order-service | 更新订单已支付 |
| `payment.success` | payment-service | logistics-service | 创建物流单 |
| `order.paid` | order-service | logistics-service | 发货通知 |
| `logistics.shipped` | logistics-service | order-service | 更新已发货 |
| `logistics.delivered` | logistics-service | order-service | 更新已送达 |
| `user.registered` | auth-service | user-service | 初始化用户资料 |
| `subscription.created` | payment-service | user-service | 更新用户权限 |

---

## 5. 模块三：开发者工作台

### 5.1 功能清单

| 功能点 | 说明 | 优先级 |
|--------|------|--------|
| Monaco 代码编辑器 | 语法高亮、智能提示、代码折叠 | P1 |
| 文件树浏览 | 增删改查文件、目录 | P1 |
| 实时终端 | xterm.js  WebSocket 终端 | P1 |
| Git 操作 | status / add / commit / push / branch | P1 |
| 代码搜索 | 全文搜索、正则搜索、文件过滤 | P2 |
| 代码对比 | diff 视图、合并冲突 | P2 |
| 预览部署 | 内网预览、域名绑定 | P2 |
| 依赖管理 | package.json / pom.xml 可视化 | P3 |
| 代码审查面板 | PR 评论、审批流程 | P3 |
| 性能分析 | 构建时间、包体积分析 | P3 |

### 5.2 API 设计 — code-service (独立 Node 服务)

```
GET    /v1/workspaces/:projectId/files              获取文件列表
GET    /v1/workspaces/:projectId/files/content      获取文件内容
POST   /v1/workspaces/:projectId/files              创建文件/目录
PUT    /v1/workspaces/:projectId/files              更新文件内容
DELETE /v1/workspaces/:projectId/files              删除文件
POST   /v1/workspaces/:projectId/files/rename       重命名文件
POST   /v1/workspaces/:projectId/files/move         移动文件
GET    /v1/workspaces/:projectId/search             搜索代码
GET    /v1/workspaces/:projectId/recent             最近文件

POST   /v1/workspaces/:projectId/git/init           Git 初始化
GET    /v1/workspaces/:projectId/git/status         Git 状态
POST   /v1/workspaces/:projectId/git/add            Git 添加
POST   /v1/workspaces/:projectId/git/commit         Git 提交
POST   /v1/workspaces/:projectId/git/push           Git 推送
POST   /v1/workspaces/:projectId/git/pull           Git 拉取
GET    /v1/workspaces/:projectId/git/branches       分支列表
POST   /v1/workspaces/:projectId/git/branch         创建分支
POST   /v1/workspaces/:projectId/git/checkout       切换分支
POST   /v1/workspaces/:projectId/git/merge          合并分支

POST   /v1/workspaces/:projectId/terminal/session   创建终端会话
WS     /v1/workspaces/:projectId/terminal/:sessionId 终端 WebSocket
DELETE /v1/workspaces/:projectId/terminal/:sessionId 关闭终端

POST   /v1/workspaces/:projectId/preview            启动预览服务
GET    /v1/workspaces/:projectId/preview/status     预览状态
DELETE /v1/workspaces/:projectId/preview            停止预览

POST   /v1/workspaces/:projectId/deploy             部署项目
GET    /v1/workspaces/:projectId/deploy/status      部署状态
GET    /v1/workspaces/:projectId/deploy/logs        部署日志
```

**技术实现**：
- 框架：Express.js + TypeScript
- 文件操作：Node.js fs/promises
- Git 操作：simple-git
- 终端：node-pty + xterm.js (WebSocket)
- 预览：Vite dev server (动态启动)
- 部署：Docker 构建 + K8s apply
- 存储：本地磁盘 (开发) / NFS / S3 (生产)

---

## 6. 模块四：可观测性与运维

### 6.1 功能清单

| 功能点 | 说明 | 优先级 |
|--------|------|--------|
| 分布式追踪 | OpenTelemetry Trace，跨服务调用链路 | P1 |
| 指标监控 | Prometheus 指标，Grafana Dashboard | P1 |
| 日志聚合 | Loki 日志收集，LogQL 查询 | P1 |
| 告警系统 | 基于阈值的自动告警，钉钉/邮件/短信 | P2 |
| 健康检查 | 各服务健康端点，自动故障恢复 | P1 |
| 性能分析 | JVM 分析、Node.js heap dump、火焰图 | P2 |
| APM 仪表盘 | 服务拓扑、依赖关系、性能瓶颈 | P2 |
| 错误追踪 | Sentry 集成，自动上报异常 | P2 |

### 6.2 技术实现

| 层级 | 技术选型 | 说明 |
|------|----------|------|
| **信号采集** | OpenTelemetry SDK (Node.js + Java) | 手动埋点 + 自动注入 |
| **eBPF 采集** | Beyla | 零侵入采集 HTTP/gRPC/Redis |
| **信号汇聚** | OTel Collector (Gateway + Agent) | Batch、采样、过滤、路由 |
| **Trace 存储** | Grafana Tempo | 分布式追踪，TraceQL 查询 |
| **Metric 存储** | Prometheus | 时序指标，PromQL 查询 |
| **Log 存储** | Grafana Loki | 日志聚合，LogQL 查询 |
| **可视化** | Grafana | Dashboard、告警、联动分析 |
| **告警通知** | Alertmanager + 钉钉/邮件 | 多渠道告警 |

### 6.3 AI 业务语义化追踪

| 观测对象 | Span 名称 | 关键属性 |
|----------|-----------|----------|
| LLM 调用 | `agenthive.llm.completion` | provider, model, tokens, cost_usd |
| Agent 任务 | `agenthive.runtime.task` | agent.id, task.id, task.type |
| QueryLoop | `agenthive.query_loop.execute` | iteration, tokens.total |
| Tool 执行 | `agenthive.tool.execute` | tool.name, duration_ms |
| WebSocket | `agenthive.websocket.event` | event_type, connection_id |

---

## 7. 模块五：基础设施与平台

### 7.1 功能清单

| 功能点 | 说明 | 优先级 |
|--------|------|--------|
| 多租户隔离 | 数据隔离 (行级)、资源配额、计费分离 | P2 |
| API 网关 | 路由、鉴权、限流、熔断、日志 | P1 |
| 服务注册发现 | Nacos 服务注册，动态路由 | P1 |
| 配置中心 | Nacos 配置管理，动态刷新 | P1 |
| 密钥管理 | 数据库加密、API Key 管理、凭据轮换 | P2 |
| 资源配额 | CPU/内存/存储/Agent 并发数限制 | P2 |
| 沙箱隔离 | Agent 执行容器化隔离 | P2 |
| 备份恢复 | 数据库定时备份，灾难恢复 | P2 |

### 7.2 API 设计

#### 平台管理 (Admin API)

```
GET    /admin/v1/tenants                获取租户列表
POST   /admin/v1/tenants                创建租户
GET    /admin/v1/tenants/:id            获取租户详情
PATCH  /admin/v1/tenants/:id            更新租户配额
DELETE /admin/v1/tenants/:id            删除租户

GET    /admin/v1/users                  获取用户列表
PATCH  /admin/v1/users/:id/status      更新用户状态
GET    /admin/v1/users/:id/activities   获取用户活动

GET    /admin/v1/system/health          系统健康状态
GET    /admin/v1/system/metrics         系统指标
GET    /admin/v1/system/logs            系统日志
POST   /admin/v1/system/maintenance     进入维护模式

GET    /admin/v1/agents/templates       Agent 模板管理
POST   /admin/v1/agents/templates       创建模板
PATCH  /admin/v1/agents/templates/:id   更新模板
```

---

## 8. 技术选型总表

### 8.1 前端

| 项目 | 技术 | 版本 | 用途 |
|------|------|------|------|
| Landing | Nuxt 3 | 3.11+ | 营销官网，SSR |
| Web App | Vue 3 + Vite | 3.4+ | 控制台，SPA |
| UI 组件库 | Element Plus | 2.13+ | 企业级组件 |
| 样式 | Tailwind CSS | 3.4+ | 原子化样式 |
| 状态管理 | Pinia | 3.0+ | 组合式 Store |
| 代码编辑器 | Monaco Editor | latest | 在线 IDE |
| 终端 | xterm.js | 5.3+ | WebSocket 终端 |

### 8.2 Node.js 后端

| 项目 | 技术 | 版本 | 用途 |
|------|------|------|------|
| 运行时 | Node.js | 20 LTS | JavaScript 运行时 |
| 框架 | Express.js | 4.18+ | Web 框架 |
| 语言 | TypeScript | 5.4+ | 类型安全 |
| 编译 | tsx | 4.7+ | 开发热重载 |
| 验证 | Zod | 3.22+ | Schema 验证 |
| 数据库 | pg | 8.11+ | PostgreSQL 驱动 |
| Redis | ioredis | 5.10+ | Redis 客户端 |
| WebSocket | Socket.io | 4.8+ | 实时通信 |
| 测试 | Vitest | 1.3+ | 单元测试 |
| 文档 | Swagger | 6.2+ | API 文档 |

### 8.3 Java 后端

| 项目 | 技术 | 版本 | 用途 |
|------|------|------|------|
| JDK | Java | 21 | 语言运行时 |
| 框架 | Spring Boot | 3.2.12 | 应用框架 |
| 微服务 | Spring Cloud | 2023.0.5 | 微服务治理 |
| 阿里生态 | Spring Cloud Alibaba | 2023.0.1.0 | Nacos 等 |
| ORM | MyBatis Plus | 3.5.9 | 数据访问 |
| Redis | Redisson | 3.27.0 | 分布式锁 |
| 消息队列 | RabbitMQ | 3.12+ | 异步消息 |
| 安全 | Spring Security | 6.2+ | 安全框架 |
| JWT | jjwt | 0.12.5 | Token 处理 |
| API 文档 | SpringDoc | 2.6+ | OpenAPI |

### 8.4 基础设施

| 项目 | 技术 | 用途 |
|------|------|------|
| 容器 | Docker | 应用容器化 |
| 编排 | Kubernetes | 容器编排 |
| 网关 | Spring Cloud Gateway | API 网关 |
| 注册中心 | Nacos | 服务注册发现 + 配置中心 |
| 数据库 | PostgreSQL 16 | 主业务数据库 |
| 缓存 | Redis 7 | 缓存、会话、锁 |
| 对象存储 | MinIO | 文件、日志存储 |
| 消息队列 | RabbitMQ | 异步事件 |
| 可观测 | OpenTelemetry + Grafana LGTM | 追踪/指标/日志 |
| eBPF | Beyla | 零侵入可观测 |

---

## 9. API 总量统计

| 模块 | 服务 | API 数量 | 运行时 |
|------|------|---------|--------|
| AI Agent 平台 | api (BFF) | 46 | Node.js |
| 代码服务 | code-service | 22 | Node.js |
| LLM 网关 | llm-gateway | 5 | Node.js |
| 认证 | auth-service | 8 | Java |
| 用户 | user-service | 6 | Java |
| 订阅计费 | payment-service | 10 | Java |
| 订单 | order-service | 8 | Java |
| 购物车 | cart-service | 6 | Java |
| 物流 | logistics-service | 6 | Java |
| 平台管理 | admin-api | 12 | Java |
| **总计** | | **129** | |

---

## 10. 开发阶段与里程碑

### Sprint 1-2：基础架构（4 周）

| 任务 | 技术 | 产出 |
|------|------|------|
| 统一认证层 | Node.js + Java Gateway | Node API 移除本地 JWT |
| 拆分 code-service | Express + TypeScript | 独立部署的代码服务 |
| Java pom.xml 补全 | Maven | 所有 7 个服务可构建 |
| 完成 user-service | Spring Boot | 用户 CRUD API |

### Sprint 3-4：AI 核心（4 周）

| 任务 | 技术 | 产出 |
|------|------|------|
| 任务队列化 | Redis Stream | API 不直接 spawn Agent |
| Agent Runtime 独立 | Node.js | 独立消费队列 |
| LLM Gateway | Express | 多厂商统一入口 |
| Chat 意图识别优化 | Ollama/OpenAI | 8 种意图准确识别 |

### Sprint 5-6：电商核心（4 周）

| 任务 | 技术 | 产出 |
|------|------|------|
| auth-service 完善 | Spring Security | 短信登录、OAuth2 |
| order-service 实现 | Spring Boot | 订单状态机 |
| payment-service 实现 | Spring Boot | 支付单、钱包 |
| cart-service 实现 | Spring Boot | 购物车 CRUD |
| RabbitMQ 事件总线 | Spring AMQP | order→payment 流程 |

### Sprint 7-8：开发者体验（4 周）

| 任务 | 技术 | 产出 |
|------|------|------|
| Monaco 编辑器集成 | Vue 3 | 在线代码编辑 |
| 实时终端 | node-pty + xterm.js | WebSocket 终端 |
| Git 操作面板 | simple-git | 可视化 Git |
| 预览部署 | Vite + Docker | 一键预览 |

### Sprint 9-10：可观测与运维（4 周）

| 任务 | 技术 | 产出 |
|------|------|------|
| OTel 全链路追踪 | OpenTelemetry SDK | Node + Java 全埋点 |
| Grafana Dashboard | Grafana | 业务/系统监控面板 |
| 告警系统 | Alertmanager | P0/P1 自动告警 |
| K8s 生产部署 | Helm | 一键部署脚本 |

### Sprint 11-12：商业化与优化（4 周）

| 任务 | 技术 | 产出 |
|------|------|------|
| 订阅计费系统 | Spring Boot | 套餐、优惠券、发票 |
| 多租户隔离 | PostgreSQL RLS | 数据行级隔离 |
| 性能压测 | k6 / JMeter | 性能基线报告 |
| 安全审计 | OWASP | 安全扫描修复 |

---

## 11. 团队分工建议

### 11.1 团队结构

```
AgentHive 研发团队
│
├── 前端团队 (2-3 人)
│   ├── Landing 开发
│   ├── Web 控制台开发
│   └── 组件库/设计系统
│
├── Node.js 团队 (2-3 人)
│   ├── API BFF 开发
│   ├── code-service 开发
│   ├── LLM Gateway 开发
│   └── Agent Runtime 优化
│
├── Java 团队 (3-4 人)
│   ├── Gateway / 基础设施
│   ├── auth-service / user-service
│   ├── order-service / payment-service
│   └── cart-service / logistics-service
│
├── AI/算法团队 (1-2 人)
│   ├── Prompt 工程优化
│   ├── Agent 行为调优
│   └── 意图识别模型
│
├── DevOps 团队 (1-2 人)
│   ├── K8s 集群运维
│   ├── CI/CD 流水线
│   ├── 可观测性平台
│   └── 安全合规
│
└── QA 团队 (1-2 人)
    ├── 自动化测试
    ├── 性能测试
    └── 安全测试
```

### 11.2 代码规范

**Node.js**：
- ESLint + Prettier 统一格式
- 函数式编程优先，避免类继承
- 异步使用 async/await，禁止回调地狱
- 错误处理统一使用 AppError 类
- 日志使用结构化 JSON 格式

**Java**：
- 阿里巴巴 Java 开发手册
- 分层明确：Controller → Service → Mapper → Entity
- 使用 Lombok 减少样板代码
- 接口返回统一 Result 包装
- 异常使用全局异常处理器

### 11.3 开发流程

```
需求评审 → 技术方案评审 → 编码 → 单元测试 → Code Review
    → 集成测试 → 部署到 Staging → 验收 → 合并到 Main → 生产发布
```

**分支策略**：Git Flow
- `main`：生产分支
- `develop`：集成分支
- `feature/*`：功能分支
- `release/*`：发布分支
- `hotfix/*`：热修分支

---

## 附录：外部依赖清单

| 依赖 | 类型 | 用途 | 替代方案 |
|------|------|------|----------|
| Ollama | 开源 | 本地 LLM 推理 | vLLM, llama.cpp |
| 阿里云百炼 | 云服务 | 云端 LLM API | OpenAI, 通义千问 |
| 阿里云短信 | 云服务 | 短信验证码 | 腾讯云短信 |
| 支付宝 | 第三方支付 | 支付收款 | 微信支付 |
| 阿里云 OSS | 云服务 | 对象存储 | MinIO (自建) |
| Nacos | 开源 | 注册中心/配置 | Consul, Eureka |
| Grafana Cloud | 云服务 | 可观测性 | 自建 LGTM |

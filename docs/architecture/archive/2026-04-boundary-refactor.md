# AgentHive Cloud — Node.js 与 Java 职责边界重构方案

> **版本**: v1.0 | **日期**: 2026-04-25 | **状态**: 草案

---

## 1. 背景与目标

AgentHive Cloud 是 AI 驱动的软件研发协作平台（Hive Mode），同时承载电商 SaaS 能力。

**重构目标**：
- 职责清晰：明确 Node.js 与 Java 边界
- 故障隔离：拆分"万能单体"Node API
- 安全统一：认证在 Gateway 层收口
- 弹性伸缩：Agent 执行引擎独立部署
- 团队并行：各团队独立演进

---

## 2. 架构设计趋势

2025-2026 年行业采用 **"能力驱动型架构"**：

| 运行时 | 定位 | 优势 |
|--------|------|------|
| Node.js | BFF + 实时编排 + AI 网关 | 非阻塞 I/O、WebSocket、JSON 原生 |
| Java | 核心领域 + 事务引擎 + 安全 | 多线程、JVM、Spring 生态 |
| Python | AI/ML 推理 (可选) | ML 生态领先 |

**关键洞察**：Node.js 是 **"编排者而非执行者"**。

**BFF 原则**：BFF 不做业务逻辑，只做协议转换、数据聚合、缓存、认证透传。

---

## 3. 当前架构诊断

### Node API — "万能单体"

同时承担 6 种角色：BFF、AI 控制平面、文件服务、认证兼容层、任务执行引擎、LLM 网关。

| # | 问题 | 风险 |
|---|------|------|
| 1 | 双重认证 | Node + Gateway 都有 JWT 验证 |
| 2 | 直接 spawn Orchestrator | 任务崩溃拖垮 API |
| 3 | LLM 重复封装 | api 和 agent-runtime 都有 |
| 4 | 文件服务混杂 | 阻塞事件循环 |
| 5 | 无 Repository 层 | 直接 pool.query() |
| 6 | 访客限流在内存 | 多实例不共享 |
| 7 | Node 绕过 Java 服务 | 直接连 PostgreSQL |

### Java 微服务 — 不成熟

- pom.xml 只注册 3 模块（gateway/auth/user）
- payment/order/cart/logistics 目录存在但未激活

---

## 4. 理想职责边界

### Node.js 专属

1. **BFF / API 编排**：聚合数据给前端
2. **AI Agent 控制平面**：Agent 生命周期、任务队列、Chat 编排
3. **实时通信**：WebSocket / SSE、Redis Pub/Sub
4. **LLM 网关**：多厂商统一封装、流式转发

### Java 专属

1. **身份与访问管理**：注册/登录/JWT/RBAC/OAuth2
2. **电商核心服务**：user/order/payment/cart/logistics
3. **企业横切面**：Gateway 限流/熔断、Seata 事务、Redisson 锁、多级缓存
4. **数据计算**：报表、对账、复杂 SQL

### 边界矩阵

| 场景 | 当前 | 应该 | 理由 |
|------|------|------|------|
| 用户注册/登录 | Java + Node | Java | 安全合规 |
| JWT 验证 | Gateway + Node | Gateway | 统一入口 |
| Agent CRUD | Node | Node | AI 控制平面 |
| 任务执行 | Node spawn | Agent Runtime 独立 | 故障隔离 |
| Chat 意图识别 | Node | Node | 流式调用 |
| 代码文件操作 | Node | 独立 code-service | I/O 隔离 |
| 订单/支付 | 未实现 | Java | 事务性 |
| 全局限流 | Gateway + Node | Gateway | 共享状态 |
| WebSocket | Node | Node | 长连接优势 |
| 报表/对账 | 未实现 | Java | 数据计算 |

---

## 5. 接口拆分方案

### 立即拆分（高优先级）

**拆分 1：认证层统一**
Node API 只认 Gateway 透传的 `X-User-*` headers，移除本地 JWT 验证。

**拆分 2：任务执行外迁**
Node API XADD 任务到 Redis Stream，Agent Runtime 独立 XREADGROUP 消费。

Before: API spawn 进程 → 管道通信
After: API 提交队列 → Agent Runtime 消费 → Redis Pub/Sub 推送进度

**拆分 3：代码文件服务独立**
拆出 `apps/code-service`（Node.js）。

迁移：/api/code/* 所有接口
保留：/api/projects/* 项目元数据

### 服务化重构（中优先级）

**拆分 4：LLM 网关独立**
`apps/llm-gateway`：多厂商路由、Token 计费、流式代理、熔断降级。
接口：POST /v1/chat/completions、GET /v1/models、GET /v1/usage

**拆分 5：Java 电商微服务完成**
补全 pom.xml 所有模块，完成 payment/order/cart/logistics-service 骨架。

**拆分 6：Node API 转型 BFF**
封装 Java 客户端，通过 HTTP 调用 Java 微服务获取用户/订单/支付数据。

### 长期演进（低优先级）

**拆分 7：Agent Runtime K8s Job**
每个任务独立 Pod，支持资源配额，完成后自动清理。

**拆分 8：Node BFF 按前端拆分**
web-bff / landing-bff / open-bff / mobile-bff 独立部署。

---

## 6. 目标架构

```
前端 (Landing/Web/Mobile)
    │
Java Gateway — JWT, 限流, 路由, TraceId
    │
┌───┴────┬───────────────┐
▼        ▼               ▼
Node.js  Java           AI Agent Engine
BFF      领域服务        (独立集群)
• API    • Auth         • Orchestrator
• Chat   • User         • Worker Agents
• Projects• Payment     • LLM Gateway
• Agent  • Order
Control  • Cart
• WS     • Logistics
• Code
    │
共享基础设施: PostgreSQL, Redis, RabbitMQ, MinIO, OTel, Nacos
```

---

## 7. 实施路线图

| 阶段 | 时间 | 任务 | 收益 |
|------|------|------|------|
| Phase 1 | 1-2 周 | 统一认证、限流迁移 Gateway | 消除双重认证 |
| Phase 2 | 2-4 周 | 拆分 code-service、任务队列化、Java pom 补全 | API 轻量化 |
| Phase 3 | 1-2 月 | Java 电商微服务、Node 调用 Java、LLM Gateway | 核心业务落地 |
| Phase 4 | 2-3 月 | Agent K8s Job、多租户、压测 | 弹性伸缩 |

---

## 8. 关键决策

1. Node.js 是 **AI 控制平面 + BFF 编排层**，不是万能后端
2. Java 是 **企业级核心领域服务**，承载所有事务性业务
3. Agent 执行 **必须通过消息队列异步化**，绝不直接 spawn
4. 认证 **在 Gateway 层唯一收口**，Node 只透传信任头

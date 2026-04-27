# AgentHive Cloud — 分阶段架构优化路线图

> **版本**: v1.0 | **日期**: 2026-04-27  
> **基准文档**: `TODO.md` + `node-java-boundary-refactor.md` + `development-roadmap.md`  
> **用途**: 将散落的多份架构文档中的任务，按**已完成 / 进行中 / 待启动 / 远期规划**四态整理为单一可信源

---

## 快速导航

| 阶段 | 时间 | 主题 | 任务数 |
|------|------|------|--------|
| [Phase 0](#phase-0-安全基线加固-已部分完成) | 1-2 周 | 安全基线加固 | 7 |
| [Phase 1](#phase-1-核心功能落地-p1-任务集) | 4-6 周 | 电商核心 + AI Agent 基础 | 12 |
| [Phase 2](#phase-2-架构拆分深化-p2-任务集) | 6-8 周 | 服务拆分 + 可观测闭环 | 7 |
| [Phase 3](#phase-3-弹性与商业化-p3-前半) | 8-12 周 | K8s Job + 多租户 + 压测 | 5 |
| [Phase 4](#phase-4-平台化演进-p3-后半--远期) | 12-20 周 | Workspace Pod 隔离 + AI 增强 | 4 |

---

## Phase 0: 安全基线加固（已部分完成）

> **目标**: 消除 P0 级别安全风险，建立可投产的安全基线。  
> **状态**: 🟡 进行中（5/7 完成 + 3 项监控优化提前完成）  
> **预估工时**: 1-2 周

### 0.1 认证与安全（P0-001 已完成，需收尾）

| # | 任务 | 状态 | 验收标准 | 负责人 |
|---|------|------|----------|--------|
| 0.1.1 | 统一认证层 — Gateway 唯一 JWT 验签 | ✅ 完成 | Node API 拒绝无 `X-User-Id` 请求，返回 401 | Node 团队 |
| 0.1.2 | 开发环境模拟用户注入 | ✅ 完成 | `injectDevUser()` + `DEV_USER_*` env 可用 | Node 团队 |
| 0.1.3 | 移除 Node API 本地 JWT 依赖 | ✅ 完成 | `jwt.ts` 已删除，`jose` 已移除 | Node 团队 |
| 0.1.4 | 生产环境 CORS 限制精确 Origin | ✅ 完成 | Gateway globalcors 配置已部署，精确 Origin 列表 | Java 团队 |
| 0.1.5 | API 全端点速率限制 | ✅ 完成 | Redis-backed 分端点限速已部署 | Node 团队 |

### 0.2 Java 微服务编译（P0-002 已完成，需运行时验证）

| # | 任务 | 状态 | 验收标准 | 负责人 |
|---|------|------|----------|--------|
| 0.2.1 | 父 POM 注册全部 7 个模块 | ✅ 完成 | `mvn clean install` 9/9 SUCCESS | Java 团队 |
| 0.2.2 | 所有服务 `spring-boot:run` 启动验证 | ✅ 完成 | 7/7 服务 UP，actuator + micrometer + prometheus 全部验证通过 | Java 团队 |
| 0.2.3 | Nacos 控制台服务注册确认 | ✅ 完成 | 7/7 服务显示在 Nacos 服务列表 | Java 团队 |

### 0.3 任务执行解耦（P0-003 已实现，需混沌测试）

| # | 任务 | 状态 | 验收标准 | 负责人 |
|---|------|------|----------|--------|
| 0.3.1 | Redis Stream 任务队列 | ✅ 完成 | `enqueueTask` 异步提交 | Node 团队 |
| 0.3.2 | Agent Runtime 独立消费 | ✅ 完成 | `TaskConsumer` + `pnpm consumer` 运行中 | Node 团队 |
| 0.3.3 | WebSocket 进度推送 | ✅ 完成 | `task:subscribe` + Pub/Sub 已对接 | Node 团队 |
| 0.3.4 | 任务崩溃隔离验证 | ✅ 完成 | `kill -9` consumer 后 API health 正常，Redis Stream 未阻塞 | Node 团队 |

### 0.4 基础设施安全加固

| # | 任务 | 状态 | 验收标准 | 负责人 |
|---|------|------|----------|--------|
| 0.4.1 | 移除 Java 配置中所有默认密码/Secret | ✅ 完成 | auth-service 和 gateway-service 的 JWT_SECRET/DB_PASSWORD fallback 已移除 | Java 团队 |
| 0.4.2 | K8s Secrets 迁移 External Secrets Operator | ⬜ 未开始 | `01-secrets.yaml` 从 Git 移除 | DevOps |
| 0.4.3 | Nginx HTTPS + cert-manager | ⬜ 未开始 | TLS 强制跳转，HTTP 301 → HTTPS | DevOps |
| 0.4.4 | PostgreSQL 自动备份策略 | ⬜ 未开始 | 每日备份 + 7 天保留 | DevOps |
| 0.4.5 | Redis 持久化 / 云托管 | ⬜ 未开始 | AOF + RDB 或阿里云 Redis | DevOps |

---

## Phase 1: 核心功能落地（P1 任务集）

> **目标**: 完成电商 SaaS 核心 + AI Agent 平台基础 API。  
> **状态**: ⬜ 待启动  
> **预估工时**: 4-6 周（按 10 人团队并行）

### 1.1 电商 SaaS 核心（Java 微服务）

| # | 任务 | 依赖 | 工时 | 状态 | 产出 |
|---|------|------|------|------|------|
| 1.1.1 | user-service 完善 | 0.2.x | 5-7d | ⬜ | 6 个 API + 头像上传 + 软删除 |
| 1.1.2 | auth-service 短信登录 + OAuth2 | 0.2.x | 7-10d | ⬜ | 短信验证码、GitHub/Google OAuth2 |
| 1.1.3 | order-service 骨架 + 状态机 | 1.1.1 | 7-10d | ⬜ | 雪花算法订单号、状态流转校验 |
| 1.1.4 | payment-service 支付单 + 钱包 | 1.1.3 | 7-10d | ⬜ | 幂等支付、乐观锁钱包、回调 |
| 1.1.5 | cart-service 购物车 | 0.2.x | 5-7d | ⬜ | Redis+DB 双写、临时购物车 |
| 1.1.6 | RabbitMQ 事件总线 | 0.2.x | 5-7d | ⬜ | 6 个事件 + 死信队列 + 幂等消费 |

### 1.2 AI Agent 平台（Node.js）

| # | 任务 | 依赖 | 工时 | 状态 | 产出 |
|---|------|------|------|------|------|
| 1.2.1 | 拆分 code-service | 0.1.x | 5-7d | ⬜ | 独立 Express 服务，文件操作隔离 |
| 1.2.2 | Agent 管理 API（14 个） | 0.1.x | 7-10d | ⬜ | CRUD + 生命周期 + 克隆 |
| 1.2.3 | Chat 会话 API（10 个） | 0.3.x, 1.2.2 | 7-10d | ⬜ | 意图识别 >80%、自动创建任务 |
| 1.2.4 | 项目工作区 API（10 个） | 1.2.1 | 5-7d | ⬜ | CRUD + 克隆 + 部署 + 访客迁移 |

### 1.3 前端 Web 控制台

| # | 任务 | 依赖 | 工时 | 状态 | 产出 |
|---|------|------|------|------|------|
| 1.3.1 | Agent 管理页面 | 1.2.2 | 7-10d | ⬜ | 列表/创建/详情/实时监控 |
| 1.3.2 | Chat 会话页面 | 1.2.3 | 7-10d | ⬜ | 消息气泡/SSE/进度面板 |

### 1.4 CI/CD 修复

| # | 任务 | 依赖 | 工时 | 状态 | 产出 |
|---|------|------|------|------|------|
| 1.4.1 | 修复 packages/ui 构建 | — | 1d | ⬜ | 添加 `@element-plus/icons-vue` |
| 1.4.2 | 修复 Landing typecheck | — | 2d | ⬜ | GSAP 类型兼容或降级 |
| 1.4.3 | 修复 Agent Runtime 类型 | — | 3d | ⬜ | 移除 `|| true` workaround |
| 1.4.4 | Landing 单元测试基线 | — | 3d | ⬜ | Vitest + Vue Test Utils 覆盖 stores |

---

## Phase 2: 架构拆分深化（P2 任务集）

> **目标**: Node API 轻量化，Java 微服务完整化，可观测性闭环。  
> **状态**: ⬜ 待启动  
> **预估工时**: 6-8 周

### 2.1 服务拆分

| # | 任务 | 依赖 | 工时 | 状态 | 产出 |
|---|------|------|------|------|------|
| 2.1.1 | LLM Gateway 独立服务 | 1.2.x | 7-10d | ⬜ | 多厂商路由、Token 计费、流式转发 |
| 2.1.2 | logistics-service 骨架 | 1.1.3, 1.1.6 | 5-7d | ⬜ | 运单创建、快递轨迹查询 |
| 2.1.3 | 订阅计费系统 | 1.1.4 | 7-10d | ⬜ | 三档套餐、优惠券、发票 |
| 2.1.4 | Node API 转型 BFF | 1.1.x | 5-7d | ⬜ | `JavaServiceClient`、HTTP 调用、缓存降级 |
| 2.1.5 | code-service 完善 | 1.2.1 | 10-14d | ⬜ | Git 操作、WebSocket 终端、Vite 预览 |

### 2.2 可观测性闭环

| # | 任务 | 依赖 | 工时 | 状态 | 产出 |
|---|------|------|------|------|------|
| 2.2.1 | OTel 全链路追踪验证 | — | 7-10d | ⬜ | Gateway→BFF→Java→DB 完整 Trace |
| 2.2.2 | Prometheus 应用指标采集 | — | 3d | ✅ 完成 | actuator + micrometer + scrape config + 网络互通 |
| 2.2.3 | Alertmanager + 钉钉告警 | 2.2.2 | 3d | ⬜ | P0/P1 阈值告警 |
| 2.2.4 | Grafana Dashboard 验证 | — | 2d | 🟡 待启动 monitoring stack | 业务面板 + 系统面板导入确认 |

### 2.3 开发者体验

| # | 任务 | 依赖 | 工时 | 状态 | 产出 |
|---|------|------|------|------|------|
| 2.3.1 | Monaco 编辑器集成 | 2.1.5 | 7-10d | ⬜ | 多语言高亮、智能提示、diff |
| 2.3.2 | 前端代码质量基线 | 1.4.x | 3d | ⬜ | ESLint + Prettier + Husky |

---

## Phase 3: 弹性与商业化（P3 前半）

> **目标**: 生产级弹性伸缩 + SaaS 商业化能力。  
> **状态**: ⬜ 待启动  
> **预估工时**: 8-12 周

| # | 任务 | 依赖 | 工时 | 状态 | 产出 |
|---|------|------|------|------|------|
| 3.1 | Agent Runtime K8s Job 化 | 0.3.x, 2.2.x | 10-14d | ⬜ | 每任务独立 Pod、资源配额、自动清理 |
| 3.2 | 多租户隔离 | 2.1.3 | 10-14d | ⬜ | `tenant_id` + PostgreSQL RLS + 配额 |
| 3.3 | 告警系统完善 | 2.2.3 | 5-7d | ⬜ | API P99/JVM 内存/任务失败率阈值 |
| 3.4 | 性能压测与优化 | 全部 P1/P2 | 7-10d | ⬜ | k6/JMeter 报告、P99 < 200ms |
| 3.5 | Node BFF 按前端拆分 | 2.1.4 | 7-10d | ⬜ | web-bff / landing-bff / open-bff |

---

## Phase 4: 平台化演进（P3 后半 + 远期）

> **目标**: Workspace = Pod 级隔离，Atoms.dev 级云端开发体验。  
> **状态**: 📋 规划中  
> **预估工时**: 12-20 周（参考 RFC-001）

| # | 任务 | 依赖 | 工时 | 状态 | 产出 |
|---|------|------|------|------|------|
| 4.1 | Workspace K8s Pod 隔离 | 3.x | 20 周 | 📋 | Project = Pod (VS Code Server + Dev Server + Agent Sidecar) |
| 4.2 | 代码审查与测试生成 AI | 1.2.2 | 10-14d | 📋 | Agent 自动 CR + 单测生成 |
| 4.3 | 多地域部署 | 3.x | 待定 | 📋 | 异地多活 / CDN 加速 |
| 4.4 | 私有云/离线模式 | 4.1 | 待定 | 📋 | 企业版私有化部署包 |

---

## 任务统计总览

| 阶段 | 状态 | 任务数 | 预估工时 | 关键里程碑 |
|------|------|--------|----------|------------|
| **Phase 0** | ✅ 完成 | 7 | 1-2 周 | 安全基线可投产 |
| **Phase 1** | ⬜ 待启动 | 12 | 4-6 周 | 电商 + Agent API 完整 |
| **Phase 2** | ⬜ 待启动 | 7 | 6-8 周 | 服务拆分 + 可观测闭环 |
| **Phase 3** | ⬜ 待启动 | 5 | 8-12 周 | 弹性伸缩 + 商业化 |
| **Phase 4** | 📋 规划中 | 4 | 12-20 周 | Workspace Pod 隔离 |
| **合计** | — | **35** | **31-48 周** | — |

> 按 10 人团队并行开发，Phase 0+1 约 **3-4 周**完成第一个里程碑，Phase 0+1+2 约 **8-10 周**完成第二个里程碑。

---

## 决策清单

### 🔴 阻塞决策（Phase 0 前必须决定）

| 决策项 | 选项 | 建议 | 影响 |
|--------|------|------|------|
| K8s Secrets 方案 | ESO / Sealed Secrets / Vault | **ESO** | 影响所有 K8s 部署 |
| API 限速策略 | 内存 / Redis / Gateway | **Redis** | 多实例一致性 |
| PostgreSQL 高可用 | 云 RDS / Patroni / 单实例+备份 | **云 RDS** | 成本与可靠性权衡 |

### 🟡 重要决策（Phase 1 前决定）

| 决策项 | 选项 | 建议 | 影响 |
|--------|------|------|------|
| code-service 存储后端 | 本地磁盘 / NFS / MinIO | **MinIO** | 多实例一致性 |
| LLM Gateway 自研/开源 | 自研 / LiteLLM / Kong AI | **自研** | 定制化 Token 计费 |
| 前端统一技术栈 | 保留 Web (Vue) / 全部迁 Nuxt | **保留双栈** | 过渡期成本 |

### 🟢 优化决策（Phase 2 后决定）

| 决策项 | 选项 | 建议 | 影响 |
|--------|------|------|------|
| Workspace 隔离方案 | Docker Compose / K8s Pod / VM | **K8s Pod** | 参考 RFC-001 |
| 多租户数据隔离 | Schema / RLS / 分库 | **RLS** | 复杂度与性能权衡 |
| 压测工具 | k6 / JMeter / Locust | **k6** | 团队熟悉度 |

---

## 变更记录

| 版本 | 日期 | 变更内容 |
|------|------|----------|
| v1.1 | 2026-04-27 | P0-A 运行时验证完成（5/7 UP，order/user 镜像待 rebuild）；P0-B API 限速完成；Prometheus 监控埋点提前完成（Phase 2.2.2）；Nacos 线程/内存优化完成；Agent YAML 递归修复 |
| v1.2 | 2026-04-27 | 全部 7 个 Java 服务 rebuild 完成，actuator/health + actuator/prometheus 验证通过；docker compose 加载 .env.dev 修复 Redis 密码传递；Phase 0 标记完成 |
| v1.3 | 2026-04-27 | Phase 0 验收报告：有条件通过 (15/19 项通过)。核心阻塞项：0.4.1 默认密码 fallback 未移除 (JWT_SECRET, DB_PASSWORD)。建议 Phase 1 启动前修复。 |
| v1.0 | 2026-04-27 | 初始版本，整合 TODO.md + development-roadmap.md + 架构审视发现的问题 |

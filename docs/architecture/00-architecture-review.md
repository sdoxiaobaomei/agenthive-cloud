# AgentHive Cloud — 架构全景审视报告 v1.0

> **日期**: 2026-04-27  
> **分支**: `develop`  
> **审阅范围**: 全栈架构（前端 / Node.js 后端 / Java 微服务 / 基础设施 / 可观测性 / DevOps）  
> **状态**: 生产就绪冲刺已完成，进入功能迭代期

---

## 目录

1. [架构总览](#1-架构总览)
2. [当前架构评估](#2-当前架构评估)
3. [关键问题清单](#3-关键问题清单)
4. [优化方向与路线图](#4-优化方向与路线图)
5. [风险矩阵](#5-风险矩阵)
6. [附录：文档索引](#6-附录文档索引)

---

## 1. 架构总览

### 1.1 系统边界

```
┌─────────────────────────────────────────────────────────────────────┐
│                      AgentHive Cloud Platform                        │
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │   Landing    │  │  Chat UI     │  │    Admin Dashboard       │  │
│  │  (Nuxt 3)    │  │  (Vue 3)     │  │    (Vue 3)               │  │
│  └──────┬───────┘  └──────┬───────┘  └───────────┬──────────────┘  │
│         │                 │                      │                  │
│         └─────────────────┴──────────────────────┘                  │
│                           │                                         │
│                    ┌──────┴──────┐                                  │
│                    │   Nginx     │  ← 边缘反向代理                    │
│                    └──────┬──────┘                                  │
│                    ┌──────┴──────┐                                  │
│                    │ API Gateway │  ← Spring Cloud Gateway          │
│                    │  (JWT/限流)  │                                  │
│                    └──────┬──────┘                                  │
│         ┌─────────────────┼─────────────────┐                       │
│         ▼                 ▼                 ▼                       │
│  ┌────────────┐   ┌────────────┐   ┌──────────────────┐            │
│  │ Node.js    │   │ Java       │   │ AI Agent Engine  │            │
│  │ Services   │   │ Microsvcs  │   │                  │            │
│  │            │   │            │   │ ┌──────────────┐ │            │
│  │ • API      │   │ • Auth     │   │ │ Orchestrator │ │            │
│  │ • Chat Ctrl│   │ • User     │   │ │ Worker Agents│ │            │
│  │ • Agent RT │   │ • Payment  │   │ │ LLM Service  │ │            │
│  │            │   │ • Order    │   │ └──────────────┘ │            │
│  │            │   │ • Cart     │   │                  │            │
│  │            │   │ • Logistics│   └──────────────────┘            │
│  └────────────┘   └────────────┘                                   │
│                                                                      │
│  Infrastructure: PostgreSQL ×2, Redis, MinIO, RabbitMQ, OTel Stack │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.2 技术栈矩阵

| 层级 | 技术选型 | 版本 | 状态 |
|------|----------|------|------|
| **前端** | Nuxt 3 + Vue 3 + Element Plus + Tailwind | 3.11+ | ✅ 生产就绪 |
| **API 网关** | Spring Cloud Gateway | 2023.0.5 | ✅ 生产就绪 |
| **注册中心** | Nacos | 2.x | ✅ 开发就绪，K8s 待部署 |
| **Node.js 服务** | Express + TypeScript (ESM) | 4.18+ / 5.4+ | ✅ 生产就绪 |
| **Java 服务** | Spring Boot + Spring Cloud Alibaba | 3.2.12 / 2023.0.1.0 | ✅ 编译通过，运行时验证中 |
| **数据库** | PostgreSQL | 16 | ✅ 生产就绪 |
| **缓存** | Redis | 7 | ✅ 生产就绪 |
| **消息队列** | RabbitMQ | 3.13 | ✅ 配置就绪 |
| **对象存储** | MinIO | latest | ✅ 监控栈使用 |
| **可观测性** | OpenTelemetry + Grafana LGTM | — | ✅ 已实施 |
| **AI 推理** | Ollama (qwen3:14b) | — | ✅ 本地就绪 |
| **容器化** | Docker + Docker Compose | — | ✅ 多环境配置 |
| **编排** | Kubernetes (Kustomize) | 1.35+ | ⚠️ 基础就绪，HA 待完善 |
| **IaC** | Terraform (阿里云) | — | ⚠️ 基础就绪，漂移检测待补 |

### 1.3 服务拓扑

```
用户请求
    │
    ▼
┌─────────┐    ┌─────────────┐    ┌─────────────────────────────┐
│  Nginx  │───→│ API Gateway │───→│ Java 微服务 (8080-8086)     │
│  :80/443│    │  :8080      │    │ • auth-service    :8081     │
└─────────┘    └──────┬──────┘    │ • user-service    :8082     │
                      │           │ • payment-service :8083     │
                      │           │ • order-service   :8084     │
                      ▼           │ • cart-service    :8085     │
              ┌─────────────┐     │ • logistics-service :8086   │
              │  Node API   │     └─────────────────────────────┘
              │  :3001      │
              └──────┬──────┘
                     │
         ┌───────────┼───────────┐
         ▼           ▼           ▼
    ┌────────┐  ┌────────┐  ┌────────────┐
    │PostgreSQL│  │ Redis  │  │ Agent Runtime│
    │ :5432/5433│  │ :6379  │  │ (独立进程)   │
    └────────┘  └────────┘  └────────────┘
```

---

## 2. 当前架构评估

### 2.1 已完成的架构工作（✅ 生产就绪）

#### 2.1.1 认证层统一（P0-001）
- **状态**: ✅ 已完成
- **成果**: Node API 移除本地 JWT 验证，认证在 Gateway 层唯一收口
- **机制**: Gateway 验签后透传 `X-User-Id` / `X-User-Name` / `X-User-Role`
- **开发环境**: `injectDevUser()` + `DEV_USER_*` env 模拟用户身份

#### 2.1.2 Java 微服务骨架（P0-002）
- **状态**: ✅ 编译通过，运行时验证中
- **成果**: 7 个服务全部在父 POM 注册，`mvn clean install` 9/9 SUCCESS
- **公共模块**: common-core/web/mybatis/redis/security/rabbitmq/feign/otel

#### 2.1.3 任务执行解耦（P0-003）
- **状态**: ✅ 已实现，混沌测试待验证
- **成果**: Redis Stream (`agenthive:agent:task:queue`) + 独立 Consumer
- **机制**: API `XADD` 提交 → Agent Runtime `XREADGROUP` 消费 → Pub/Sub 推送进度

#### 2.1.4 可观测性栈
- **状态**: ✅ 已实施
- **成果**: OTel SDK (Node + Java) + Tempo + Loki + Prometheus + Grafana + Beyla
- **AI 语义追踪**: `agenthive.llm.completion` / `agenthive.runtime.task` 等自定义 Span

#### 2.1.5 部署配置
- **状态**: ✅ 多环境就绪
- **成果**: docker-compose.dev/prod/demo.yml + K8s Kustomize (base/overlays) + Terraform

### 2.2 架构优势

| 优势 | 说明 |
|------|------|
| **多语言后端** | Node.js 负责 AI 编排（快速迭代），Java 负责企业级业务（强类型/事务） |
| **Gateway-First Auth** | 统一入口鉴权，下游服务零 Token 解析开销 |
| **BFF 模式** | Landing Nuxt Server 作为 BFF，前端无需处理格式转换 |
| **Redis Streams 队列** | Agent 任务异步化，API 不阻塞，支持水平扩展 |
| **可观测性原生** | 从 Day 1 接入 OTel，AI 业务语义化追踪 |
| **分层容器化** | Java Layertools + Node `pnpm deploy`，镜像分层缓存 |

### 2.3 架构债务与风险

| 风险域 | 当前状态 | 风险等级 |
|--------|----------|----------|
| **Node API 万能单体** | 同时承担 BFF/AI 控制/文件服务/LLM 网关 | 🔴 高 |
| **数据库高可用** | PostgreSQL 单实例，Redis 单实例 | 🔴 高 |
| **K8s 生产配置** | Secrets 明文、无 HTTPS、Java 服务无 HPA | 🔴 高 |
| **安全基线** | 缺限速、缺 helmet、JWT 有 fallback | 🔴 高 |
| **测试覆盖** | Landing 零单元测试、workflow-engine 无测试 | 🟡 中 |
| **CI/CD 安全** | root SSH 部署、Java 镜像未扫描 | 🟡 中 |
| **Nacos K8s 部署** | 仅在 Docker Compose，K8s 未配置 | 🟡 中 |
| **监控告警** | Prometheus 规则存在但无 Alertmanager | 🟡 中 |

---

## 3. 关键问题清单

### 3.1 🔴 P0 — 阻塞级问题（立即处理）

| # | 问题 | 影响 | 文件/位置 | 建议修复 |
|---|------|------|-----------|----------|
| P0-SEC-1 | JWT 默认 Secret 公开 | 认证绕过 | `apps/java/*/application.yml` | 移除 fallback，缺失时崩溃 |
| P0-SEC-2 | API 无速率限制 | DoS / 短信轰炸 | `apps/api/src/middleware/` | `express-rate-limit` + 分端点策略 |
| P0-SEC-3 | Node API 打印敏感连接串 | 信息泄露 | `apps/api/src/index.ts` | Pino 结构化日志 + 脱敏 |
| P0-SEC-4 | K8s Secrets 明文提交 | 密钥泄露 | `k8s/base/01-secrets.yaml` | External Secrets Operator |
| P0-SEC-5 | CORS `*` + Credentials | 浏览器拦截 / 安全洞 | Gateway / Nginx | 生产环境限制精确 Origin |
| P0-INF-1 | PostgreSQL 单实例 | 单点故障 | `k8s/base/02-postgres.yaml` | RDS / Patroni / 定期备份 |
| P0-INF-2 | Redis 单实例 + emptyDir | 数据易失 | `k8s/base/03-redis.yaml` | Redis Sentinel / 云托管 |
| P0-INF-3 | Nginx 无 HTTPS | 明文传输 | `nginx/nginx.conf` | cert-manager + TLS 配置 |

### 3.2 🟡 P1 — 高优先级问题（第一里程碑）

| # | 问题 | 影响 | 建议修复 |
|---|------|------|----------|
| P1-ARC-1 | Node API 仍是"万能单体" | 职责不清，难以扩展 | 拆分 code-service / LLM Gateway |
| P1-ARC-2 | Java 电商服务仅骨架 | 订单/支付/购物车未实现 | 完善 order/payment/cart-service |
| P1-ARC-3 | Agent Runtime 集成用 Mock | 无真实 WebSocket 连接 | 接入真实 Agent Runtime |
| P1-CI-1 | packages/ui 构建失败 | 依赖缺失 | 添加 `@element-plus/icons-vue` |
| P1-CI-2 | Landing typecheck 失败 | GSAP 类型冲突 | 锁定兼容版本或跳过类型检查 |
| P1-CI-3 | Agent Runtime 类型错误 | CI 用 `|| true` 绕过 | 修复类型，移除 workaround |
| P1-CI-4 | 代码质量 job 需手动构建 dist | 类型指向未构建产物 | CI 中先 `pnpm build` workspace packages |
| P1-SEC-1 | 访客限流在内存 | 多实例不共享 | Redis 限流计数器 |
| P1-SEC-2 | API 缺 helmet 安全头 | XSS / Clickjacking | `helmet` + `hpp` |
| P1-TST-1 | Landing 零单元测试 | 回归风险 | Vitest + Vue Test Utils |
| P1-TST-2 | workflow-engine 无测试 | 核心编排无保障 | 补充 Orchestrator/Scheduler 测试 |

### 3.3 🟢 P2 — 中优先级问题（第二里程碑）

| # | 问题 | 影响 | 建议修复 |
|---|------|------|----------|
| P2-ARC-1 | Node API 直接访问 Java 数据表 | 边界模糊 | 通过 HTTP/Feign 调用 Java 服务 |
| P2-ARC-2 | 文件存储仅本地磁盘 | 多实例不一致 | MinIO/S3 后端 |
| P2-INF-1 | Java 服务 K8s 无 HPA/PDB | 无法自动扩缩 | 补充 HPA + PDB manifests |
| P2-INF-2 | Prometheus 未采集应用指标 | 盲点监控 | ServiceMonitor / PodMonitor |
| P2-INF-3 | 无 Alertmanager | 告警无法送达 | 配置 Alertmanager + 钉钉 webhook |
| P2-INF-4 | Terraform 无漂移检测 | 配置漂移 | 定时 `terraform plan` GitHub Action |
| P2-DEV-1 | 439 处 `console.log` | 生产噪音 | 统一 Pino + 日志级别控制 |

### 3.4 ⚪ P3 — 低优先级问题（择机处理）

| # | 问题 | 影响 | 建议修复 |
|---|------|------|----------|
| P3-ARC-1 | Playwright e2e 16 个类型错误 | 不影响运行 | 修复或忽略类型 |
| P3-ARC-2 | Nacos 默认密码 `nacos` | 演示环境风险 | 生产环境强制修改 |
| P3-DEV-1 | PowerShell 脚本编码损坏 | 可读性差 | 统一 UTF-8 BOM |
| P3-DEV-2 | `.gitignore` 忽略 `TODO_SPRINT.md` | 文档漂移 | 移除该规则 |

---

## 4. 优化方向与路线图

### 4.1 优化总纲

```
Phase 0: 安全基线加固      (1-2 周)  ← 当前阶段
Phase 1: 核心功能落地      (4-6 周)
Phase 2: 架构拆分深化      (6-8 周)
Phase 3: 弹性与商业化      (8-12 周)
Phase 4: 平台化演进        (12-20 周)
```

### 4.2 Phase 0: 安全基线加固（立即启动）

**目标**: 消除 P0 级别安全风险，建立可投产的安全基线。

| 任务 | 工时 | 负责人 | 产出 |
|------|------|--------|------|
| 移除所有 JWT/DB 默认密码 | 1d | Java 团队 | `application*.yml` 无 fallback |
| API 限速中间件 | 2d | Node 团队 | `express-rate-limit` 全端点覆盖 |
| 结构化日志替换 console.* | 3d | Node 团队 | Pino + 脱敏规则 |
| K8s Secrets 迁移 ESO | 2d | DevOps | 移除 `01-secrets.yaml` |
| Nginx HTTPS + cert-manager | 2d | DevOps | TLS 强制跳转 |
| PostgreSQL 备份策略 | 1d | DevOps | 每日自动备份脚本 |
| Redis 持久化配置 | 1d | DevOps | AOF + RDB 或云托管 |

### 4.3 Phase 1: 核心功能落地（P1 任务集）

**目标**: 完成电商 SaaS 核心 + AI Agent 平台基础 API。

#### 4.3.1 电商 SaaS 核心

| 任务 | 依赖 | 工时 | 状态 |
|------|------|------|------|
| user-service 完善 (6 API) | P0-002 | 5-7d | ⬜ 未开始 |
| auth-service 短信+OAuth2 | P0-002 | 7-10d | ⬜ 未开始 |
| order-service 骨架+状态机 | P0-002, user-service | 7-10d | ⬜ 未开始 |
| payment-service 支付+钱包 | P0-002, order-service | 7-10d | ⬜ 未开始 |
| cart-service 购物车 | P0-002 | 5-7d | ⬜ 未开始 |
| RabbitMQ 事件总线 | P0-002 | 5-7d | ⬜ 未开始 |

#### 4.3.2 AI Agent 平台

| 任务 | 依赖 | 工时 | 状态 |
|------|------|------|------|
| 拆分 code-service | P0-001 | 5-7d | ⬜ 未开始 |
| Agent 管理 API (14个) | P0-001 | 7-10d | ⬜ 未开始 |
| Chat 会话 API (10个) | P0-003, Agent API | 7-10d | ⬜ 未开始 |
| 项目工作区 API (10个) | code-service | 5-7d | ⬜ 未开始 |

#### 4.3.3 前端控制台

| 任务 | 依赖 | 工时 | 状态 |
|------|------|------|------|
| Agent 管理页面 | Agent API | 7-10d | ⬜ 未开始 |
| Chat 会话页面 | Chat API | 7-10d | ⬜ 未开始 |

### 4.4 Phase 2: 架构拆分深化（P2 任务集）

**目标**: Node API 轻量化，Java 微服务完整化，可观测性闭环。

| 任务 | 说明 | 工时 |
|------|------|------|
| LLM Gateway 独立服务 | 多厂商路由、Token 计费、熔断 | 7-10d |
| logistics-service 骨架 | 运单创建、轨迹追踪 | 5-7d |
| 订阅计费系统 | 套餐、优惠券、发票 | 7-10d |
| Node API 转型 BFF | 封装 JavaServiceClient，HTTP 调用 Java | 5-7d |
| code-service 完善 | Git + 终端 + 预览部署 | 10-14d |
| OTel 全链路追踪验证 | Gateway→BFF→Java→DB 完整链路 | 7-10d |
| Monaco 编辑器集成 | Web IDE 级编辑体验 | 7-10d |

### 4.5 Phase 3: 弹性与商业化（P3 前半）

**目标**: 生产级弹性伸缩 + SaaS 商业化能力。

| 任务 | 说明 | 工时 |
|------|------|------|
| Agent Runtime K8s Job 化 | 每任务独立 Pod，资源配额 | 10-14d |
| 多租户隔离 | PostgreSQL RLS + 资源配额 | 10-14d |
| 告警系统 | Alertmanager + 钉钉/邮件/短信 | 5-7d |
| 性能压测 | k6/JMeter 基线报告 | 7-10d |
| Node BFF 按前端拆分 | web-bff / landing-bff / open-bff | 7-10d |

### 4.6 Phase 4: 平台化演进（P3 后半 + 远期）

**目标**: Workspace = Pod 级隔离，Atoms.dev 级体验。

| 任务 | 说明 | 工时 |
|------|------|------|
| Workspace K8s Pod 隔离 | Project = Pod，VS Code Server + Dev Server + Agent Sidecar | 20 周 (RFC-001) |
| 代码审查与测试生成 AI | Agent 自动 CR + 单测生成 | 10-14d |
| 多地域部署 | 异地多活 / CDN | 待定 |
| 私有云/离线模式 | 企业版私有化部署 | 待定 |

---

## 5. 风险矩阵

| 风险 | 概率 | 影响 | 缓解措施 | 责任人 |
|------|------|------|----------|--------|
| JWT Secret 泄露导致认证绕过 | 中 | 🔴 灾难 | Phase 0 移除 fallback | Java 团队 |
| 无限速导致服务被刷 | 高 | 🔴 严重 | Phase 0 接入限速 | Node 团队 |
| DB 单点故障导致数据丢失 | 中 | 🔴 灾难 | Phase 0 备份 + Phase 1 RDS | DevOps |
| Java 服务运行时兼容问题 | 中 | 🟡 严重 | P0-002 验收测试 | Java 团队 |
| Agent 任务崩溃拖垮 API | 低 | 🟡 严重 | P0-003 混沌测试 | Node 团队 |
| K8s 成本超支 | 中 | 🟡 中等 | HPA + 定时缩容 + 预算告警 | DevOps |
| 前端技术栈分裂维护成本 | 高 | 🟢 中等 | 长期统一为 Nuxt 3 | 前端团队 |
| Workspace 文件过多导致卡顿 | 中 | 🟢 中等 | 符号链接 + 定期清理 | 已缓解 |

---

## 6. 附录：文档索引

### 6.1 架构设计文档（docs/architecture/）

| 文档 | 内容 | 状态 |
|------|------|------|
| [README.md](./README.md) | 架构文档入口索引 | ✅ 有效 |
| [overview.md](./overview.md) | 总体架构设计 v1.0 | ✅ 有效 |
| [java-microservices.md](./java-microservices.md) | Java 微服务设计 | ✅ 有效 |
| [chat-controller.md](./chat-controller.md) | Chat 控制器与 Agent 编排 | ✅ 有效 |
| [database-schema.md](./database-schema.md) | 数据库设计 | ✅ 有效 |
| [node-java-boundary-refactor.md](./node-java-boundary-refactor.md) | Node/Java 边界重构方案 | 🟡 草案 |
| [development-roadmap.md](./development-roadmap.md) | 完整开发路线图（129 API） | 🟡 草案 |
| [TODO.md](./TODO.md) | 28 项任务追踪（P0-P3） | 🟢 执行中 |
| **ARCHITECTURE-REVIEW-v1.0.md** | **本报告** | 🆕 新建 |
| **ROADMAP-PHASED.md** | **分阶段结构化路线图** | 🆕 新建 |

### 6.2 RFC 文档（docs/rfc/）

| 文档 | 内容 | 状态 |
|------|------|------|
| [RFC-001-Workspace-Architecture.md](../rfc/RFC-001-Workspace-Architecture.md) | Workspace Pod 隔离架构 | 🟡 待讨论 |
| [RFC-001-Implementation-Plan.md](../rfc/RFC-001-Implementation-Plan.md) | Workspace 实施计划（20 周） | 🟡 待评审 |
| [RFC-001-Alibaba-Cloud-Cost-Analysis.md](../rfc/RFC-001-Alibaba-Cloud-Cost-Analysis.md) | ACK 成本分析 | ✅ 完成 |

### 6.3 部署运维文档（docs/deployment/）

| 文档 | 内容 | 状态 |
|------|------|------|
| [README.md](../deployment/README.md) | 部署文档索引 | ✅ 有效 |
| [ack-demo-deployment-notes.md](../deployment/ack-demo-deployment-notes.md) | ACK 实战部署记录 | ✅ 已验证 |
| [cost-analysis.md](../deployment/cost-analysis.md) | 成本对比分析 | ✅ 有效 |
| [k3s-deployment.md](../deployment/k3s-deployment.md) | K3s 部署指南 | ✅ 有效 |
| [k8s-deployment.md](../deployment/k8s-deployment.md) | K8s 部署指南（理论版） | ⚠️ 未验证 |
| [hybrid-deployment.md](../deployment/hybrid-deployment.md) | 混合部署（理论版） | ⚠️ 未验证 |

### 6.4 其他关键文档

| 文档 | 内容 | 状态 |
|------|------|------|
| [TODO_SPRINT.md](../../TODO_SPRINT.md) | 生产就绪冲刺总结 | ✅ 完成 |
| [docs/lessons-learned.md](../lessons-learned.md) | 踩坑记录与经验教训 | ✅ 持续更新 |
| [DOCKER_CONFIG_SUMMARY.md](../../DOCKER_CONFIG_SUMMARY.md) | Docker 配置汇总 | ✅ 有效 |
| [apps/agent-runtime/docs/ARCHITECTURE.md](../../apps/agent-runtime/docs/ARCHITECTURE.md) | Agent Runtime 内部架构 | ✅ 有效 |
| [k8s/README.md](../../k8s/README.md) | K8s 配置说明 | ✅ 有效 |

---

> **审阅结论**: AgentHive Cloud 已完成从 0 到 1 的基础架构搭建，具备生产部署的基本条件。当前最紧迫的工作是 **Phase 0 安全基线加固**（1-2 周），随后进入 **Phase 1 核心功能落地**（电商 + AI Agent API）。建议在完成 Phase 0 后召开技术评审会，确认 Phase 1 的优先级排序和资源分配。

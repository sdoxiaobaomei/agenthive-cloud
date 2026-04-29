# AgentHive Cloud — 系统架构总览

> **作用**: 5 分钟理解 AgentHive 的整体架构设计  
> **详细设计**: 见 [`architecture/`](./architecture/) 目录下的编号文档  
> **日期**: 2026-04-30

---

## 1. 系统整体架构

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

---

## 2. 各子系统职责

| 子系统 | 技术栈 | 核心职责 | 详细文档 |
|--------|--------|----------|----------|
| **前端** | Nuxt 3 + Vue 3 + Element Plus + Tailwind | Landing 页、Chat UI、Admin Dashboard | — |
| **API Gateway** | Spring Cloud Gateway | 统一入口、JWT 验签、限流、路由 | [02 Java 微服务](./architecture/02-java-microservices.md) |
| **Node.js 后端** | Express + TypeScript (ESM) | AI 编排、BFF、Chat 控制器、任务队列 | [05 Node.js 后端](./architecture/05-backend-nodejs.md) |
| **Java 微服务** | Spring Boot 3.2 + Spring Cloud | 电商核心（用户/支付/订单/购物车/物流）| [02 Java 微服务](./architecture/02-java-microservices.md) |
| **AI Agent 平台** | Node.js + Redis Streams | 意图识别、Agent 调度、Workspace 隔离执行 | [03 AI Agent 平台](./architecture/03-ai-agent-platform.md) |
| **可观测性** | OTel + Grafana LGTM | 全链路追踪、日志、指标、告警 | [00 架构审视报告](./architecture/00-architecture-review.md) |

---

## 3. 服务交互拓扑

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

## 4. 技术栈总览

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

---

## 5. 架构演进阶段

```
Phase 0: 安全基线加固      (1-2 周)  ← 当前阶段
Phase 1: 核心功能落地      (4-6 周)
Phase 2: 架构拆分深化      (6-8 周)
Phase 3: 弹性与商业化      (8-12 周)
Phase 4: 平台化演进        (12-20 周)
```

详见 [04 开发与执行路线图](./architecture/04-development-roadmap.md)。

---

## 6. 详细架构文档索引

| 编号 | 文档 | 内容 |
|------|------|------|
| **00** | [架构全景审视报告](./architecture/00-architecture-review.md) | 当前架构评估、58 项问题清单（P0-P3）、风险矩阵 |
| **01** | [系统总体架构](./architecture/01-system-overview.md) | 系统边界、技术栈矩阵、通信契约、安全设计、高并发策略 |
| **02** | [Java 微服务与数据层](./architecture/02-java-microservices.md) | 7 个服务矩阵、公共模块、API 规范、数据库设计、Redis 结构 |
| **03** | [AI Agent 平台](./architecture/03-ai-agent-platform.md) | Chat 控制器、意图识别、Agent 调度、执行流程、数据模型 |
| **04** | [开发与执行路线图](./architecture/04-development-roadmap.md) | Phase 0-4 分阶段任务、决策清单、工时估算、里程碑 |
| **05** | [Node.js 后端架构](./architecture/05-backend-nodejs.md) | API 服务、Agent Runtime、Workflow Engine、通信模式、架构债务 |
| — | [数据层决策](./architecture/data-layer-decision.md) | Node/Java 数据边界与访问策略 |

---

> **审阅结论**: AgentHive Cloud 已完成从 0 到 1 的基础架构搭建，具备生产部署的基本条件。当前最紧迫的工作是 **Phase 0 安全基线加固**，随后进入 **Phase 1 核心功能落地**。

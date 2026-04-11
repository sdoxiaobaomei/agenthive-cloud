# 🏗️ 架构文档

> 系统架构设计和技术决策

---

## 🎯 架构概览

```
┌─────────────────────────────────────────────────────────┐
│                     用户层                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │   Landing   │  │    Web      │  │   Mobile    │     │
│  │   (Nuxt)    │  │   (Vue)     │  │   (Future)  │     │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘     │
└─────────┼────────────────┼────────────────┼────────────┘
          │                │                │
          └────────────────┴────────────────┘
                           │
┌──────────────────────────┼──────────────────────────────┐
│                     API 网关层                           │
│                   Nginx / Ingress                        │
└──────────────────────────┼──────────────────────────────┘
                           │
┌──────────────────────────┼──────────────────────────────┐
│                     服务层                               │
│  ┌─────────────────────────────────────────────────────┐ │
│  │                   API Service                        │ │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐            │ │
│  │  │  Auth   │  │  Task   │  │ Project │            │ │
│  │  └─────────┘  └─────────┘  └─────────┘            │ │
│  └─────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────┐ │
│  │              Agent Runtime Service                   │ │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐            │ │
│  │  │  Agent  │  │  Tool   │  │   LLM   │            │ │
│  │  │ System  │  │ System  │  │ Service │            │ │
│  │  └─────────┘  └─────────┘  └─────────┘            │ │
│  └─────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
                           │
┌──────────────────────────┼──────────────────────────────┐
│                     数据层                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │  PostgreSQL │  │    Redis    │  │   MinIO     │     │
│  │  (主数据)    │  │  (缓存/队列) │  │  (对象存储)  │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
└──────────────────────────────────────────────────────────┘
```

---

## 📚 架构文档

### 系统架构

| 文档 | 说明 |
|------|------|
| [系统概览](./system-overview.md) | 整体架构设计 |
| [多 Agent 协作机制](./multi-agent.md) | Hive 模式详解 |
| [Workspace 架构](./workspace-architecture.md) | 工作区设计 |

### Agent 系统

| 文档 | 说明 | 位置 |
|------|------|------|
| [Agent Runtime 架构](./agent-runtime.md) | 运行时设计 | `docs/architecture/` |
| [架构文档](../../agenthive-cloud/apps/agent-runtime/docs/ARCHITECTURE.md) | 详细设计 | `apps/agent-runtime/docs/` |
| [RFC: Workspace 架构](./rfc/RFC-001-Workspace-Architecture.md) | 工作区 RFC | `docs/architecture/rfc/` |

### K8s 架构

| 文档 | 说明 |
|------|------|
| [K8s 架构详解](../archive/K8S-ARCHITECTURE-EXPLAINED.md) | 三种方案对比 |
| [Kubeadm 概念澄清](../K8S-KUBEADM-CLARIFICATION.md) | 概念解释 |
| [K8s 集群搭建](../archive/K8S-CLUSTER-SETUP.md) | 搭建指南 |
| [K8s 设置总结](../archive/K8S-SETUP-SUMMARY.md) | 方案选择 |

---

## 🧩 核心组件

### 1. API 服务

- **框架**: Express.js + TypeScript
- **数据库**: PostgreSQL + TypeORM
- **缓存**: Redis
- **实时通信**: Socket.io

### 2. Agent Runtime

- **核心**: AgentSystem + QueryLoop
- **工具系统**: ToolRegistry + Tool 实现
- **LLM 集成**: OpenAI/Anthropic/Ollama
- **上下文管理**: ConversationContext

### 3. 前端应用

- **Landing**: Nuxt 3 + SSR
- **Web**: Vue 3 + SPA
- **状态管理**: Pinia
- **UI 组件**: Element Plus

---

## 📐 设计原则

### 1. 微服务边界

```
API Service: 用户认证、项目管理、任务管理
Agent Runtime: Agent 执行、工具调用、LLM 交互
```

### 2. 数据流

```
用户请求 → API Gateway → API Service → 数据库
                ↓
         Agent Runtime ←→ LLM Provider
```

### 3. 扩展性

- 水平扩展: K8s Deployment + HPA
- 垂直扩展: 资源限制和请求
- 数据库: 读写分离（未来）

---

## 🔧 技术决策

| 决策 | 选项 | 原因 |
|------|------|------|
| Monorepo | pnpm workspace | 代码共享、依赖管理 |
| API 框架 | Express | 简单、生态丰富 |
| ORM | TypeORM | TypeScript 支持好 |
| 前端 | Vue/Nuxt | 团队熟悉、性能好 |
| 部署 | Docker + K8s | 云原生、可扩展 |

---

## 📖 相关文档

- [快速参考](../reference/quick-reference.md)
- [K8s 架构详解](../archive/K8S-ARCHITECTURE-EXPLAINED.md)
- [部署指南](../deployment/README.md)

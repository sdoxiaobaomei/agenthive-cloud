# AgentHive Cloud — Kimi Agent 全局上下文

> 此文件为所有 Kimi Agent 提供项目级上下文。无论加载哪个 Agent 角色，此文件内容都会被注入。

---

## 项目概述

AgentHive Cloud 是一个 AI 驱动的多 Agent 协作开发平台（"蜂群模式"）。用户通过自然语言 Chat 界面指挥 AI Agent 团队完成软件开发全生命周期。同时平台提供电商 SaaS 能力（用户、支付、订单、购物车、物流）。

## 技术栈总览

| 层级 | 技术 |
|------|------|
| 前端 | Nuxt 3 + Vue 3 + Element Plus + Tailwind CSS |
| API 网关 | Spring Cloud Gateway + Nginx |
| Node.js 后端 | Express + TypeScript ESM + PostgreSQL + Redis |
| Java 后端 | Spring Boot 3.2 + Spring Cloud Alibaba + MyBatis Plus |
| AI 引擎 | Agent Runtime + QueryLoop + ToolRegistry |
| 基础设施 | Docker + Kubernetes + Terraform (阿里云) |
| 可观测性 | OpenTelemetry + Grafana LGTM |

## 关键目录结构

```
apps/
  api/              — Node.js API 服务 (Express)
  landing/          — Nuxt 3 前端 (BFF 模式)
  web/              — Vue 3 SPA
  agent-runtime/    — AI Agent 执行引擎
  java/             — 7 个 Spring Cloud 微服务
packages/
  types/            — 共享 TypeScript 类型
  ui/               — 共享 Vue 组件
  workflow-engine/  — 多 Agent 工作流编排
  observability/    — OpenTelemetry 工具
  cli/              — CLI 工具
docs/
  architecture/     — 架构知识库
  rfc/              — RFC 文档
  deployment/       — 部署文档
```

## 全局规范

- **编码**: UTF-8 with BOM（Windows）
- **分支策略**: Git Flow (main / develop / feature/*)
- **Commit 规范**: `type(scope): description`（英文）
- **所有应用目标**: ES2022 / TypeScript 5.4+

## 架构决策（不可违背）

1. **认证在 Gateway 层唯一收口** — 下游服务只认 `X-User-Id` header，不解析 JWT
2. **Node.js = AI 控制平面 + BFF** — 不做事务性业务，那是 Java 的领域
3. **Java = 企业级核心领域** — 承载所有事务性、高并发业务
4. **Agent 任务必须异步化** — Redis Streams 队列，绝不直接 spawn
5. **可观测性原生** — 所有服务必须接入 OTel

## 文档索引

- [架构知识库](../docs/architecture/README.md) — 编号 00-05 的架构文档
- [快速参考](../docs/reference/quick-reference.md) — 常用命令速查
- [踩坑记录](../docs/lessons-learned.md) — 已踩过的坑

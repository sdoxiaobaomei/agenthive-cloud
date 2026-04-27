# AgentHive Cloud — 架构知识库

> **用途**: 系统架构设计、技术决策、开发路线图的单一可信源  
> **维护原则**: 同类合并、定期归档、编号有序、入口统一

---

## 知识库导航

按编号顺序阅读，可完整理解系统架构：

| 编号 | 文档 | 内容 | 状态 |
|------|------|------|------|
| **00** | [架构全景审视报告](./00-architecture-review.md) | 当前架构评估、58 项问题清单（P0-P3）、风险矩阵、优化方向 | ✅ 活跃 |
| **01** | [系统总体架构](./01-system-overview.md) | 系统边界、技术栈矩阵、通信契约、安全设计、高并发策略 | ✅ 稳定 |
| **02** | [Java 微服务与数据层](./02-java-microservices.md) | 7 个服务矩阵、公共模块、API 规范、数据库设计、Redis 结构、消息队列 | ✅ 稳定 |
| **03** | [AI Agent 平台](./03-ai-agent-platform.md) | Chat 控制器、意图识别、Agent 调度、执行流程、数据模型 | ✅ 稳定 |
| **04** | [开发与执行路线图](./04-development-roadmap.md) | Phase 0-4 分阶段任务、决策清单、工时估算、里程碑 | 🟡 执行中 |
| **05** | [Node.js 后端架构](./05-backend-nodejs.md) | API 服务、Agent Runtime、Workflow Engine、通信模式、架构债务 | ✅ 活跃 |

---

## 快速查找

### 按主题

| 主题 | 推荐文档 |
|------|----------|
| 我刚加入项目，想了解整体架构 | [01 系统总体架构](./01-system-overview.md) |
| 我想知道当前有哪些问题需要修 | [00 架构审视报告 — 第 3 章](./00-architecture-review.md#3-关键问题清单) |
| 我要看接下来的开发计划 | [04 开发与执行路线图](./04-development-roadmap.md) |
| 我需要了解 Java 服务的 API 规范 | [02 Java 微服务 — 第 5 章](./02-java-microservices.md#5-api-规范) |
| 我要理解 Chat 如何调度 Agent | [03 AI Agent 平台 — 第 2 章](./03-ai-agent-platform.md#2-chat-controller-模块) |
| 我想了解 Node API 的模块结构 | [05 Node.js 后端架构](./05-backend-nodejs.md) |
| 我需要查看数据库表结构 | [02 Java 微服务 — 第 4/7/8 章](./02-java-microservices.md) |

### 按角色

| 角色 | 推荐文档 |
|------|----------|
| **架构师 / Tech Lead** | 00 → 01 → 04 |
| **Java 后端开发** | 01 → 02 → 04 (Phase 1 电商部分) |
| **Node.js 后端开发** | 01 → 05 → 03 → 04 (Phase 1 Agent 部分) |
| **前端开发** | 01 → 03 → 04 (Phase 1 前端部分) |
| **DevOps** | 00 (安全基线) → 01 (部署架构) → 04 (Phase 0) |
| **QA / 测试** | 00 (问题清单) → 04 (验收标准) |

---

## 文档状态说明

| 状态 | 含义 |
|------|------|
| ✅ **稳定** | 架构已落地，仅随重大变更更新 |
| ✅ **活跃** | 定期维护，反映当前系统状态 |
| 🟡 **执行中** | 随 Sprint 进展持续更新 |

---

## 相关文档（知识库外）

### RFC（请求评论）

| 文档 | 内容 | 状态 |
|------|------|------|
| [RFC-001-Workspace 架构](../rfc/RFC-001-Workspace-Architecture.md) | Workspace Pod 隔离方案（Atoms.dev 级体验）| 🟡 待讨论 |
| [RFC-001-实施计划](../rfc/RFC-001-Implementation-Plan.md) | Workspace 20 周实施计划 | 🟡 待评审 |
| [RFC-001-阿里云成本分析](../rfc/RFC-001-Alibaba-Cloud-Cost-Analysis.md) | ACK 详细成本拆解 | ✅ 完成 |

### 部署运维

| 文档 | 内容 |
|------|------|
| [部署文档索引](../deployment/README.md) | Docker / K8s / 混合部署入口 |
| [ACK 实战部署记录](../deployment/ack-demo-deployment-notes.md) | 真实集群踩坑记录（已验证）|
| [K8s 配置说明](../../k8s/README.md) | Kustomize 多环境部署 |

### 经验教训

| 文档 | 内容 |
|------|------|
| [踩坑记录](../lessons-learned.md) | Workspace 爆炸、SSR 错误、K8s 陷阱、Docker 启动陷阱 |
| [Docker 配置汇总](../../DOCKER_CONFIG_SUMMARY.md) | 所有 Compose 文件和 Dockerfile 索引 |

---

## 归档文档

已合并或不再维护的历史文档存放于 [archive/](./archive/) 目录：

- `2026-04-boundary-refactor.md` — Node/Java 边界重构原始方案（P0 已完成）
- `2026-04-product-spec.md` — 完整产品技术规格（935 行，内容已精简合并）
- `2026-04-task-tracking.md` — 原始任务追踪清单（已被 04 路线图取代）

> **归档原则**: 当文档的内容已被新知识库文档完全覆盖，或其描述的系统状态已发生根本性变化时，原文档移至 archive/，并在本页保留追溯链接。

---

## 维护指南

### 新增文档

1. 按主题选择合适编号（如新增安全架构 → `06-security-design.md`）
2. 在上方导航表和快速查找表中添加条目
3. 如内容与现有文档重叠 > 50%，考虑合并而非新增

### 更新文档

1. 修改正文内容即可，导航表中的链接保持不变
2. 如文档状态变化（稳定 → 活跃，或执行中 → 完成），更新状态列

### 归档文档

1. 将原文档移至 `archive/`，重命名为 `YYYY-MM-topic.md`
2. 在 `archive/README.md` 中记录归档原因
3. 在本页导航表中移除条目，在"归档文档"一节添加说明
4. 更新所有引用该文档的跨链接

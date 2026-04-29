# 📚 AgentHive 文档中心

> 统一的项目文档入口，快速找到你需要的信息

---

## 🚀 快速导航

| 如果你是... | 从这里开始 |
|------------|-----------|
| **新团队成员** | [项目简介](../README.md) → [WSL2 网络配置](./guides/WSL2-NETWORK-SETUP.md) → [开发文档](./development/README.md) |
| **开发人员** | [系统架构总览](./ARCHITECTURE.md) → [Node.js 后端架构](./architecture/05-backend-nodejs.md) → [开发文档](./development/README.md) |
| **运维人员** | [部署文档](./deployment/README.md) → [运维手册](./operation/README.md) → [K8s 部署](./deployment/k8s-deployment.md) |
| **架构师** | [架构总览](./ARCHITECTURE.md) → [架构审视报告](./architecture/00-architecture-review.md) → [开发路线图](./architecture/04-development-roadmap.md) |

---

## 📂 文档分类

### 🏗️ 架构设计 (`architecture/`)

系统架构、技术决策和开发路线图的单一可信源。

| 文档 | 说明 |
|------|------|
| [00 架构全景审视报告](./architecture/00-architecture-review.md) | 当前架构评估、58 项问题清单（P0-P3）、风险矩阵 |
| [01 系统总体架构](./architecture/01-system-overview.md) | 系统边界、技术栈矩阵、通信契约、安全设计 |
| [02 Java 微服务与数据层](./architecture/02-java-microservices.md) | 7 个服务矩阵、公共模块、API 规范、数据库设计 |
| [03 AI Agent 平台](./architecture/03-ai-agent-platform.md) | Chat 控制器、意图识别、Agent 调度、执行流程 |
| [04 开发与执行路线图](./architecture/04-development-roadmap.md) | Phase 0-4 分阶段任务、决策清单、工时估算 |
| [05 Node.js 后端架构](./architecture/05-backend-nodejs.md) | API 服务、Agent Runtime、Workflow Engine |
| [数据层决策](./architecture/data-layer-decision.md) | Node/Java 数据边界与访问策略 |

> 归档文档见 [`architecture/archive/`](./architecture/archive/)

---

### 🚀 部署运维 (`deployment/`)

部署方案、CI/CD 配置、基础设施和成本分析。

| 文档 | 说明 |
|------|------|
| [ACK 实战部署记录](./deployment/ack-demo-deployment-notes.md) | 阿里云 ACK 真实集群部署记录 |
| [成本分析](./deployment/cost-analysis.md) | 阿里云/AWS/本地成本对比 |
| [Dev-Prod 一致性报告](./deployment/dev-prod-consistency-report.md) | 开发/生产环境一致性保障 |
| [Docker 日志轮转](./deployment/docker-logging.md) | 日志限制 + 磁盘监控 + 自动清理 |
| [External Secrets Operator](./deployment/external-secrets-operator.md) | KMS 动态 Secret 注入 |
| [混合部署](./deployment/hybrid-deployment.md) | 本地+云端混合部署方案 |
| [K3s 部署指南](./deployment/k3s-deployment.md) | 轻量级 K8s 部署 |
| [K8s 部署指南](./deployment/k8s-deployment.md) | 生产环境 K8s 部署 |
| [Nginx HTTPS 证书](./deployment/nginx-https.md) | 阿里云证书部署 + TLS 强制跳转 |
| [Redis 持久化策略](./deployment/redis-persistence-strategy.md) | PVC + AOF/RDB + 云托管评估 |
| [TLS/HTTPS 配置](./deployment/tls-https-setup.md) | cert-manager + Let's Encrypt + HSTS |
| [Watchtower 自动更新](./deployment/watchtower.md) | CI/CD 镜像自动检测与安全重启 |
| [DevOps 架构](./deployment/DEVOPS-ARCHITECTURE.md) | DevOps 整体架构设计 |
| [DevOps 路线图](./deployment/devops-roadmap.md) | 基础设施演进规划 |

#### CI/CD (`deployment/ci-cd/`)

| 文档 | 说明 |
|------|------|
| [CI 构建优化](./deployment/ci-cd/CI-BUILD-OPTIMIZATION.md) | 构建速度和镜像优化 |
| [CI/CD 使用指南](./deployment/ci-cd/CI-CD-USAGE.md) | GitHub Actions 和脚本使用说明 |

#### Helm (`deployment/helm/`)

| 文档 | 说明 |
|------|------|
| [Helm 迁移差距分析](./deployment/helm/helm-migration-gaps.md) | Kustomize 到 Helm 的迁移评估 |
| [Helm Platform 007 设计](./deployment/helm/helm-platform-007-design.md) | Helm Chart 平台设计 v0.0.7 |
| [Helm Platform 008 设计](./deployment/helm/helm-platform-008-design.md) | Helm Chart 平台设计 v0.0.8 |

#### K8s (`deployment/k8s/`)

| 文档 | 说明 |
|------|------|
| [手把手 K8s 迁移](./deployment/k8s/HANDS-ON-K8S-MIGRATION.md) | 从零开始 K8s 迁移教程 |
| [Kubeadm 概念澄清](./deployment/k8s/K8S-KUBEADM-CLARIFICATION.md) | K8s 集群搭建概念解释 |
| [K3s 启动配置](./deployment/k8s/k3s-bootstrap.md) | K3s 集群初始化配置 |
| [迁移完成总结](./deployment/k8s/migration-completed.md) | Docker 到 K8s 迁移完成报告 |

#### Docker (`deployment/docker/`)

| 文档 | 说明 |
|------|------|
| [Docker 镜像加速配置](./deployment/docker/DOCKER-MIRROR-SETUP.md) | 国内 Docker 镜像源配置 |

---

### 🔧 运维操作 (`operation/`)

日常运维、故障排查和维护指南。

| 文档 | 说明 |
|------|------|
| [PostgreSQL 备份恢复](./operation/postgres-backup-restore.md) | 数据库备份与恢复操作手册 |
| [K3s 运维手册](./operation/runbook-k3s-ops.md) | K3s 集群日常运维 Runbook |
| [密钥轮换指南](./operation/security-secret-rotation.md) | 安全密钥轮换操作规范 |

---

### 💻 开发文档 (`development/`)

开发人员技术参考和最佳实践。

| 文档 | 说明 |
|------|------|
| [测试计划](./development/testing-plan.md) | 单元测试、E2E 测试、性能测试策略 |
| [Workspace 管理](./development/workspace-management.md) | 开发工作区生命周期管理规范 |

---

### 🔰 入门指南 (`guides/`)

新成员快速上手指南和环境配置。

| 文档 | 说明 |
|------|------|
| [Docker 镜像加速配置](./guides/DOCKER-MIRROR-SETUP.md) | 国内 Docker 镜像源配置指南 |
| [WSL2 网络配置](./guides/WSL2-NETWORK-SETUP.md) | Windows WSL2 网络环境配置 |

---

### 📖 参考手册 (`reference/`)

速查表、命令参考和快速查阅文档。

| 文档 | 说明 |
|------|------|
| [快速参考](./reference/quick-reference.md) | 常用运维和开发命令速查卡片 |

---

### 📋 项目文档 (`project/`)

项目状态、工作流和优化记录。

| 文档 | 说明 |
|------|------|
| [项目状态](./project/README.md) | 项目进度和状态总览 |

---

### 🗃️ 归档文档 (`archive/`)

已合并或不再维护的历史文档。

> 见 [`archive/`](./archive/) 目录

---

## 📝 文档规范

### 命名规范

| 类型 | 模式 | 示例 |
|------|------|------|
| 架构设计 | `NN-topic.md` | `00-architecture-review.md` |
| 部署文档 | `kebab-case.md` | `k8s-deployment.md` |
| 技术决策 | `UPPER-CASE.md` | `DEVOPS-ARCHITECTURE.md` |
| 操作手册 | `noun-verb.md` | `postgres-backup-restore.md` |

### 新增文档请遵循以下规则

1. **位置**: 根据类型放入对应目录，禁止无分类地放在根目录
2. **命名**: 使用短横线连接的小写英文，如 `k8s-deployment.md`
3. **格式**: 使用 Markdown，包含标题和目录
4. **索引**: 新增文档后更新本 README.md 的对应分类表格

### 文档模板

```markdown
# 文档标题

> 一句话描述

---

## 概述

## 详细内容

## 参考

- [相关文档链接](./other-doc.md)
```

---

**最后更新**: 2026-04-30

**维护者**: AgentHive Team

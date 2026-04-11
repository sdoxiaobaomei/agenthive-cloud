# 📚 AgentHive 文档中心

> 统一的项目文档入口，快速找到你需要的信息

---

## 🚀 快速导航

| 如果你是... | 从这里开始 |
|------------|-----------|
| **新团队成员** | [项目简介](../README.md) → [开发环境搭建](./guides/development-setup.md) |
| **开发人员** | [API 文档](./development/api-reference.md) → [架构设计](./architecture/system-overview.md) |
| **运维人员** | [部署指南](./deployment/docker-deployment.md) → [运维手册](./operation/maintenance.md) |
| **项目经理** | [项目文档](./project/status.md) → [工作流说明](../WORKFLOW.md) |

---

## 📂 文档分类

### 🔰 入门指南 (Guides)

| 文档 | 说明 |
|------|------|
| [开发环境搭建](./guides/development-setup.md) | 从零开始搭建本地开发环境 |
| [Docker 桌面版使用](./guides/docker-desktop-setup.md) | Windows/Mac 上的 Docker 配置 |
| [K8s 本地集群搭建](./guides/local-k8s-setup.md) | Kind/Docker Desktop K8s 教程 |
| [Git 工作流](./guides/git-workflow.md) | 分支管理、提交规范 |

### 💻 开发文档 (Development)

| 文档 | 说明 |
|------|------|
| [API 参考](./development/api-reference.md) | RESTful API 接口文档 |
| [数据库设计](./development/database-schema.md) | PostgreSQL 表结构设计 |
| [前端开发指南](./development/frontend-guide.md) | Vue 3 / Nuxt 3 开发规范 |
| [代码规范](./development/code-style.md) | ESLint、Prettier 配置 |
| [测试指南](./development/testing.md) | 单元测试、E2E 测试 |

### 🏗️ 架构文档 (Architecture)

| 文档 | 说明 |
|------|------|
| [系统架构概览](./architecture/system-overview.md) | 整体架构设计 |
| [Agent 运行时架构](./architecture/agent-runtime.md) | Agent 系统设计 |
| [多 Agent 协作机制](./architecture/multi-agent.md) | Hive 模式详解 |
| [Workspace 架构](./architecture/workspace-architecture.md) | 工作区设计 RFC |
| [K8s 架构详解](./architecture/k8s-explained.md) | Kubeadm/Kind/Docker Desktop 对比 |

### 🚀 部署运维 (Deployment & Operation)

| 文档 | 说明 |
|------|------|
| [Docker 部署](./deployment/docker-deployment.md) | Docker Compose 配置 |
| [K8s 部署](./deployment/k8s-deployment.md) | Kubernetes 部署指南 |
| [CI/CD 配置](./deployment/ci-cd.md) | GitHub Actions/GitLab CI |
| [成本分析](./deployment/cost-analysis.md) | 阿里云/AWS/本地成本对比 |
| [网络配置详解](./operation/network-explained.md) | Docker Desktop 网络原理 |
| [常见问题排查](./operation/troubleshooting.md) | FAQ 和解决方案 |

### 📖 参考手册 (Reference)

| 文档 | 说明 |
|------|------|
| [K8s 速查表](./reference/k8s-cheatsheet.md) | kubectl 常用命令 |
| [Git 速查表](./reference/git-cheatsheet.md) | Git 常用命令 |
| [Docker 速查表](./reference/docker-cheatsheet.md) | Docker 常用命令 |
| [快速参考](./reference/quick-reference.md) | 打印版参考卡片 |
| [经验教训](./reference/lessons-learned.md) | 踩坑记录 |

### 📋 项目文档 (Project)

| 文档 | 说明 |
|------|------|
| [项目状态](./project/status.md) | 当前进度和状态 |
| [Agent 系统说明](../AGENTS.md) | 多 Agent 系统介绍 |
| [工作流指南](../WORKFLOW.md) | 开发工作流 |
| [优化总结](./project/optimization-summary.md) | 性能优化记录 |

---

## 🗂️ 按主题索引

### Docker & K8s

- [Docker Desktop 网络详解](./DOCKER-DESKTOP-NETWORK-EXPLAINED.md)
- [Docker Desktop 进程隔离](./DOCKER-DESKTOP-PROCESS-ISOLATION.md)
- [npm install 与 Docker 多阶段构建](./DOCKER-NPM-INSTALL-EXPLAINED.md)
- [Docker 转 K8s 迁移指南](./archive/DOCKER-TO-K8S-MIGRATION.md)
- [K8s 架构详解](./archive/K8S-ARCHITECTURE-EXPLAINED.md)
- [K8s 集群搭建](./archive/K8S-CLUSTER-SETUP.md)
- [手把手 K8s 迁移](./HANDS-ON-K8S-MIGRATION.md)
- [Kubeadm 概念澄清](./K8S-KUBEADM-CLARIFICATION.md)

### 开发相关

- [CI 构建优化](./CI-BUILD-OPTIMIZATION.md)
- [Workspace 管理](./workspace-management.md)
- [快速参考](./quick-reference.md)
- [经验教训](./lessons-learned.md)

### 知识库

- [前端开发知识](../KNOWLEDGE_BASE/frontend-dev.md)
- [QA 工程知识](../KNOWLEDGE_BASE/qa-engineer.md)

---

## 📝 文档规范

### 新增文档请遵循以下规则：

1. **位置**: 根据类型放入对应目录
2. **命名**: 使用大写驼峰或短横线连接，如 `K8s-Deployment.md`
3. **格式**: 使用 Markdown，包含标题和目录
4. **更新**: 修改后更新此索引

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

## 🔍 搜索文档

在项目中搜索文档：

```bash
# 查找所有文档
find . -name "*.md" -type f

# 按关键词搜索
find . -name "*.md" -exec grep -l "关键词" {} \;
```

---

**最后更新**: 2026-04-07

**维护者**: AgentHive Team

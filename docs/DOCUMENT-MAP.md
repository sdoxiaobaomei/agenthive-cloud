# 🗺️ 文档地图

> 所有项目文档的完整索引

---

## 📂 文档目录结构

```
docs/
├── README.md                      # 📚 文档中心首页
├── DOCUMENT-MAP.md                # 🗺️ 本文档
│
├── guides/                        # 🔰 入门指南
│   ├── README.md
│   ├── development-setup.md
│   ├── docker-desktop-setup.md
│   ├── local-k8s-setup.md
│   ├── git-workflow.md
│   ├── code-review.md
│   └── debugging.md
│
├── development/                   # 💻 开发文档
│   ├── README.md
│   ├── api-reference.md
│   ├── database-schema.md
│   ├── frontend-guide.md
│   ├── code-style.md
│   └── testing.md
│
├── architecture/                  # 🏗️ 架构文档
│   ├── README.md
│   ├── system-overview.md
│   ├── agent-runtime.md
│   ├── multi-agent.md
│   ├── workspace-architecture.md
│   └── rfc/
│       ├── RFC-001-Workspace-Architecture.md
│       ├── RFC-001-Alibaba-Cloud-Cost-Analysis.md
│       └── RFC-001-Implementation-Plan.md
│
├── deployment/                    # 🚀 部署运维
│   ├── README.md
│   ├── docker-deployment.md
│   ├── k8s-deployment.md
│   ├── hybrid-deployment.md
│   ├── ci-cd.md
│   └── cost-analysis.md
│
├── operation/                     # 🔧 运维操作
│   ├── network-explained.md
│   ├── maintenance.md
│   └── troubleshooting.md
│
├── reference/                     # 📖 参考手册
│   ├── README.md
│   ├── k8s-cheatsheet.md
│   ├── docker-cheatsheet.md
│   ├── git-cheatsheet.md
│   ├── quick-reference.md
│   └── lessons-learned.md
│
├── project/                       # 📋 项目文档
│   ├── README.md
│   ├── status.md
│   └── optimization-summary.md
│
└── archive/                       # 📦 归档文档
    ├── ARCHITECTURE_VERIFICATION.md
    ├── DEPLOYMENT.md
    ├── DEVOPS_CLEANUP_REPORT.md
    ├── DOCKER-TO-K8S-MIGRATION.md
    ├── ECS_DEPLOYMENT_GUIDE.md
    ├── HYBRID-K8S-ARCHITECTURE.md
    ├── K8S-ARCHITECTURE-EXPLAINED.md
    ├── K8S-CHEATSHEET.md
    ├── K8S-CLUSTER-SETUP.md
    ├── K8S-COST-ANALYSIS.md
    ├── K8S-SETUP-SUMMARY.md
    ├── K8S-WINDOWS-GUIDE.md
    ├── LANDING-DOCKER-ISSUES.md
    ├── LOCAL-K8S-DOCKER-DESKTOP.md
    ├── RFC-001-Workspace-Architecture.md
    ├── git-cheatsheet.md
    └── deployment-plan/
```

---

## 📝 根目录文档

| 文档 | 说明 | 重要性 |
|------|------|--------|
| [README.md](../README.md) | 项目简介和快速开始 | ⭐⭐⭐ |
| [README-HIVE.md](../README-HIVE.md) | Hive 模式说明 | ⭐⭐⭐ |
| [AGENTS.md](../AGENTS.md) | Agent 系统详解 | ⭐⭐⭐ |
| [WORKFLOW.md](../WORKFLOW.md) | 开发工作流 | ⭐⭐⭐ |

---

## 🗂️ 按模块分类

### API 相关文档

| 位置 | 文档 | 说明 |
|------|------|------|
| `docs/development/` | [api-reference.md](./development/api-reference.md) | API 接口文档 |
| `docs/development/` | [database-schema.md](./development/database-schema.md) | 数据库设计 |
| `agenthive-cloud/apps/api/` | [API_TODO.md](../agenthive-cloud/apps/api/API_TODO.md) | 开发任务 |
| `agenthive-cloud/apps/api/` | [API_DOCUMENTATION.md](../agenthive-cloud/apps/api/API_DOCUMENTATION.md) | 接口说明 |
| `agenthive-cloud/apps/api/` | [DATABASE.md](../agenthive-cloud/apps/api/DATABASE.md) | 数据库配置 |
| `agenthive-cloud/apps/api/` | [STARTUP_GUIDE.md](../agenthive-cloud/apps/api/STARTUP_GUIDE.md) | 启动指南 |
| `agenthive-cloud/docs/api/` | [README.md](../agenthive-cloud/docs/api/README.md) | API 文档入口 |

### Frontend 相关文档

| 位置 | 文档 | 说明 |
|------|------|------|
| `docs/development/` | [frontend-guide.md](./development/frontend-guide.md) | 开发指南 |
| `agenthive-cloud/apps/landing/docs/` | [SSR-SAFETY-GUIDE.md](../agenthive-cloud/apps/landing/docs/SSR-SAFETY-GUIDE.md) | SSR 安全 |
| `docs/archive/` | [LANDING-DOCKER-ISSUES.md](./archive/LANDING-DOCKER-ISSUES.md) | Docker 问题 |

### Agent Runtime 相关文档

| 位置 | 文档 | 说明 |
|------|------|------|
| `docs/architecture/` | [agent-runtime.md](./architecture/agent-runtime.md) | 架构设计 |
| `agenthive-cloud/apps/agent-runtime/docs/` | [README.md](../agenthive-cloud/apps/agent-runtime/docs/README.md) | 文档入口 |
| `agenthive-cloud/apps/agent-runtime/docs/` | [ARCHITECTURE.md](../agenthive-cloud/apps/agent-runtime/docs/ARCHITECTURE.md) | 详细架构 |
| `agenthive-cloud/apps/agent-runtime/docs/` | [API.md](../agenthive-cloud/apps/agent-runtime/docs/API.md) | API 说明 |
| `agenthive-cloud/apps/agent-runtime/` | [OPTIMIZATION_SUMMARY.md](../agenthive-cloud/apps/agent-runtime/OPTIMIZATION_SUMMARY.md) | 优化总结 |

---

## 📚 按主题分类

### Docker & 容器化

- [DOCKER-DESKTOP-NETWORK-EXPLAINED.md](./DOCKER-DESKTOP-NETWORK-EXPLAINED.md)
- [DOCKER-DESKTOP-PROCESS-ISOLATION.md](./DOCKER-DESKTOP-PROCESS-ISOLATION.md)
- [DOCKER-NPM-INSTALL-EXPLAINED.md](./DOCKER-NPM-INSTALL-EXPLAINED.md)
- [LANDING-DOCKER-ISSUES.md](./archive/LANDING-DOCKER-ISSUES.md)
- [LOCAL-K8S-DOCKER-DESKTOP.md](./archive/LOCAL-K8S-DOCKER-DESKTOP.md)

### Kubernetes

- [DOCKER-TO-K8S-MIGRATION.md](./archive/DOCKER-TO-K8S-MIGRATION.md)
- [HANDS-ON-K8S-MIGRATION.md](./HANDS-ON-K8S-MIGRATION.md)
- [K8S-ARCHITECTURE-EXPLAINED.md](./archive/K8S-ARCHITECTURE-EXPLAINED.md)
- [K8S-CLUSTER-SETUP.md](./archive/K8S-CLUSTER-SETUP.md)
- [K8S-KUBEADM-CLARIFICATION.md](./K8S-KUBEADM-CLARIFICATION.md)
- [K8S-CHEATSHEET.md](./archive/K8S-CHEATSHEET.md)
- [K8S-SETUP-SUMMARY.md](./archive/K8S-SETUP-SUMMARY.md)
- [K8S-WINDOWS-GUIDE.md](./archive/K8S-WINDOWS-GUIDE.md)
- [K8S-COST-ANALYSIS.md](./archive/K8S-COST-ANALYSIS.md)
- [HYBRID-K8S-ARCHITECTURE.md](./archive/HYBRID-K8S-ARCHITECTURE.md)

### CI/CD & 构建

- [CI-BUILD-OPTIMIZATION.md](./CI-BUILD-OPTIMIZATION.md)
- [deployment/ci-cd.md](./deployment/ci-cd.md)

### 成本 & 部署

- [cost-analysis.md](./deployment/cost-analysis.md)
- [K8S-COST-ANALYSIS.md](./archive/K8S-COST-ANALYSIS.md)
- [RFC-001-Alibaba-Cloud-Cost-Analysis.md](./rfc/RFC-001-Alibaba-Cloud-Cost-Analysis.md)

### Workspace & 工作流

- [workspace-management.md](./workspace-management.md)
- [WORKFLOW.md](../WORKFLOW.md)
- [RFC-001-Workspace-Architecture.md](./rfc/RFC-001-Workspace-Architecture.md)

---

## 🔍 查找文档

### 按关键词搜索

```bash
# 查找包含 "K8s" 的文档
find docs -name "*.md" | xargs grep -l "K8s"

# 查找包含 "Docker" 的文档
find docs -name "*.md" | xargs grep -l "Docker"
```

### 按文件类型

```bash
# 所有 Markdown 文档
find . -name "*.md" -type f | grep -v node_modules | grep -v .git

# 所有 RFC 文档
find docs -name "RFC*.md" -type f
```

---

## 📝 文档维护

### 新增文档流程

1. **确定分类**: 根据内容放入对应目录
2. **命名规范**: 使用大写驼峰或短横线，如 `K8s-Deployment.md`
3. **添加索引**: 更新对应目录的 README.md
4. **更新地图**: 更新本文档 (DOCUMENT-MAP.md)

### 文档规范

- 使用 Markdown 格式
- 包含标题和简短描述
- 添加目录（长文档）
- 链接使用相对路径

---

**最后更新**: 2026-04-07

**文档总数**: 50+

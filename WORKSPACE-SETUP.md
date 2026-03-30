# AgentHive Cloud - Workspace Setup Guide

## 🎯 工作区总览

```
ai-digital-twin/
├── agenthive-cloud/           ← 🆕 新项目工作区 (当前目录)
│   ├── apps/                 # 应用代码
│   ├── deploy/               # K8s部署配置
│   ├── agents/               # Agent角色配置
│   ├── platform/             # 平台工具
│   ├── docs/                 # 文档
│   └── README.md
│
└── (旧项目保留，可归档)
```

## 📂 目录详解

### apps/ - 应用代码

| 目录 | 技术栈 | 说明 |
|------|--------|------|
| `web/` | Vue3 + TypeScript + Vite | Web UI，包含对话和Agent面板 |
| `supervisor/` | Go + Gin | Agent管理服务，调度器 |
| `agent-runtime/` | Go | Agent Pod运行时 |

### deploy/ - 部署配置

| 目录 | 说明 |
|------|------|
| `helm/agenthive/` | Helm chart主应用 |
| `helm/agent-runtime/` | Agent运行时子chart |
| `manifests/` | Raw K8s YAML |
| `skaffold.yaml` | 本地开发热重载配置 |

### agents/ - Agent配置

| 目录 | 说明 |
|------|------|
| `roles/` | Agent角色定义 (YAML) |
| `prompts/system/` | 系统提示词 |
| `prompts/task/` | 任务提示词模板 |

### platform/ - 平台工具

| 目录 | 说明 |
|------|------|
| `docker/` | Dockerfile集合 |
| `scripts/` | 自动化脚本 |
| `Makefile` | 常用命令 |

## 🚀 快速开始

### 1. 环境准备

```bash
# 检查依赖
make check-deps

# 输出:
# ✓ Docker
# ✓ kubectl
# ✓ Helm
# ✓ Go 1.21
# ✓ Node.js 18
```

### 2. 启动本地开发环境

```bash
# 一键启动 (Kind集群 + 应用)
make dev-up

# 或者分步执行:
make cluster-up      # 创建Kind集群
make infra-up        # 部署Redis/PostgreSQL/MinIO
make dev-skaffold    # 启动Skaffold热重载
```

### 3. 访问服务

| 服务 | URL | 说明 |
|------|-----|------|
| Web UI | http://localhost:8080 | 可视化界面 |
| Supervisor API | http://localhost:8081 | API文档 |
| Redis | localhost:6379 | 缓存服务 |
| PostgreSQL | localhost:5432 | 数据库 |

## 🛠️ 开发工作流

### 开发Web UI

```bash
cd apps/web
npm install
npm run dev    # 本地开发服务器
```

### 开发Supervisor

```bash
cd apps/supervisor
go mod tidy
go run ./cmd/server
```

### 添加新Agent角色

1. 创建角色定义
   ```bash
   cp agents/roles/backend-dev.yaml agents/roles/new-role.yaml
   # 编辑 new-role.yaml
   ```

2. 实现运行时
   ```bash
   mkdir apps/agent-runtime/roles/new-role
   # 实现角色逻辑
   ```

3. 部署测试
   ```bash
   make docker-build
   make deploy-dev
   ```

## 📋 Sprint 3 任务分配

| Agent | 负责模块 | 任务 |
|-------|---------|------|
| **Backend Dev** | Supervisor | API设计、Agent调度器 |
| **Frontend Dev** | Web UI | 对话页面改造、Agent面板 |
| **DevOps** | Deploy | Helm charts、CI/CD |
| **Tech Lead** | Architecture | 架构审查、技术选型确认 |
| **Scrum Master** | Coordination | 每日站会、进度跟踪 |
| **QA** | Testing | 测试计划、E2E测试 |

## 🔗 重要链接

- [架构文档](docs/architecture/README.md)
- [API文档](docs/api/README.md)
- [开发手册](docs/runbooks/development.md)
- [部署手册](docs/runbooks/deployment.md)

## 📝 提交规范

```bash
# 分支命名
feature/S3-001-httpx-migration
bugfix/B-001-fix-websocket
hotfix/H-001-security-patch

# Commit message
feat(supervisor): add agent state machine

- Implement agent lifecycle management
- Add state transitions: idle -> working -> completed
- Store state in Redis for persistence

Refs: S3-002
```

## 🐛 常见问题

### Q: Kind集群启动失败？
```bash
# 检查Docker是否运行
docker ps

# 清理旧集群
make cluster-down
make cluster-up
```

### Q: WebSocket连接不上？
```bash
# 检查Supervisor是否运行
kubectl get pods -n agenthive-dev

# 查看日志
kubectl logs -n agenthive-dev -l app=supervisor
```

### Q: 如何调试Agent？
```bash
# 进入Agent Pod
kubectl exec -it -n agenthive-dev agent-backend-dev-xxx -- /bin/sh

# 查看Agent日志
kubectl logs -n agenthive-dev -l role=backend-dev -f
```

## 🎉 下一步

1. **Backend Dev**: 开始设计Supervisor API
2. **Frontend Dev**: 调研WebSocket + 代码编辑器集成
3. **DevOps**: 准备CI/CD流水线
4. **所有人**: 每日站会同步进度

---

**AgentHive Cloud 工作区已就绪！** 🐝🚀

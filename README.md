# AgentHive Cloud

> 🐝 云原生多Agent协作开发平台 - 可视化AI研发团队管理

## 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                     AgentHive Cloud                          │
├─────────────────────────────────────────────────────────────┤
│  Web UI (Vue3)  ←→  Agent Supervisor  ←→  Agent Pods (K8s)  │
│  ├─ Chat View       ├─ Task Scheduler    ├─ Director        │
│  ├─ Agent Panel     ├─ State Manager     ├─ Backend Dev     │
│  ├─ Sprint Board    ├─ Event Bus         ├─ Frontend Dev    │
│  └─ Code Viewer     └─ WebSocket Hub     ├─ QA Engineer     │
│                     └─ REST API          └─ Custom Agents   │
└─────────────────────────────────────────────────────────────┘
```

## 项目结构

```
agenthive-cloud/
├── apps/                    # 应用代码
│   ├── api/                 # REST API Server (Node.js)
│   ├── web/                 # Vue3 Web UI
│   ├── landing/             # Nuxt3 Landing Page
│   └── agent-runtime/       # Agent运行时 (Node.js + K8s)
│
├── deploy/                  # K8s部署
│   ├── helm/               # Helm charts
│   └── manifests/          # Raw K8s YAML
│
├── agents/                  # Agent配置
│   ├── roles/              # 角色定义
│   └── prompts/            # LLM提示词
│
├── platform/               # 平台工具
│   ├── docker/            # Dockerfiles
│   └── scripts/           # 自动化脚本
│
└── docs/                  # 文档
```

## 快速开始

### 前置要求
- Docker Desktop + Kubernetes
- kubectl
- Helm 3
- Go 1.21+
- Node.js 18+
- Skaffold (可选，用于热重载开发)

### 本地开发

```bash
# 1. 启动本地K8s集群
make cluster-up

# 2. 部署依赖服务 (Redis, PostgreSQL, MinIO)
make infra-up

# 3. 启动所有应用 (热重载模式)
make dev-up

# 4. 访问Web UI
open http://localhost:8080
```

### 生产部署

```bash
# 使用Helm部署到生产集群
helm upgrade --install agenthive ./deploy/helm/agenthive \
  --namespace agenthive \
  --values ./deploy/helm/agenthive/values-production.yaml
```

## 开发工作流

### 添加新的Agent角色

1. 在 `agents/roles/` 创建角色定义
2. 在 `apps/agent-runtime/roles/` 实现运行时
3. 更新 Helm values 添加新角色配置
4. 部署测试

### 修改Web UI

```bash
cd apps/web
npm install
npm run dev        # 本地开发
npm run build      # 生产构建
```

### 修改Supervisor

```bash
cd apps/supervisor
go mod tidy
go run ./cmd/server  # 本地运行
make docker-build    # 构建镜像
```

## 关键文档

- [架构设计](docs/architecture/README.md)
- [API文档](docs/api/README.md)
- [部署手册](docs/runbooks/deployment.md)
- [Agent开发指南](docs/agent-development.md)

## 项目状态

| 组件 | 状态 | 说明 |
|------|------|------|
| API Server | ✅ Done | REST API + 单元测试 |
| Web UI | ✅ Done | Vue3 + Element Plus |
| Landing | ✅ Done | Nuxt3 Landing Page |
| Agent Runtime | ✅ Done | K8s-enabled Agent runtime |
| K8s部署 | ✅ Done | Helm charts + HPA |
| CI/CD | 📋 Planned | GitHub Actions |

## 贡献指南

1. 从 `main` 分支创建 feature 分支
2. 提交 PR 到 `develop` 分支
3. 通过 CI 检查和 Code Review
4. 合并后自动部署到测试环境

## 许可证

MIT License

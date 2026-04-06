# Agent Runtime 项目总结

## 🎯 项目概述

仿照 OpenClaw 设计的 Agent 单元服务，可在 Kubernetes 上运行。

## 📁 项目结构

```
agent-runtime/
├── src/
│   ├── services/
│   │   ├── agent-runtime.ts      # 核心运行时服务 (300 lines)
│   │   ├── websocket-client.ts   # WebSocket 客户端 (130 lines)
│   │   ├── task-executor.ts      # 任务执行引擎 (330 lines)
│   │   └── filesystem.ts         # 文件系统服务 (130 lines)
│   ├── types/
│   │   └── index.ts              # 类型定义 (170 lines)
│   ├── utils/
│   │   └── logger.ts             # 日志工具 (40 lines)
│   └── index.ts                  # 入口文件 (100 lines)
├── deploy/
│   ├── k8s/                      # K8s 原生部署
│   │   ├── namespace.yaml
│   │   ├── configmap.yaml
│   │   ├── deployment.yaml
│   │   ├── service.yaml
│   │   └── hpa.yaml
│   └── helm/                     # Helm Chart
│       └── agent-runtime/
│           ├── Chart.yaml
│           ├── values.yaml
│           └── templates/
├── Dockerfile                    # 容器镜像
├── deploy.sh                     # 部署脚本
├── package.json
├── tsconfig.json
└── README.md
```

## ✨ 核心功能

### 1. Agent Runtime 服务

- **生命周期管理**: 启动、停止、暂停、恢复
- **心跳机制**: 定期向 Supervisor 报告状态
- **自动重连**: WebSocket 断线自动重连
- **优雅关闭**: SIGTERM 信号处理

### 2. 任务执行引擎

内置 5 种任务执行器：

| 执行器 | 任务类型 | 功能 |
|--------|----------|------|
| ShellExecutor | shell, command | 执行 Shell 命令 |
| CodeGenerationExecutor | code_generation, feature | 代码生成 |
| CodeReviewExecutor | code_review, review | 代码审查 |
| TestExecutor | test, testing | 运行测试 |
| BuildExecutor | build, deploy | 构建部署 |

### 3. WebSocket 通信

- 实时双向通信
- 消息队列（离线缓存）
- 自动重连机制
- 心跳保活

### 4. Kubernetes 支持

#### 原生 K8s 部署
- Namespace
- ConfigMap
- Deployment
- Service
- HPA (自动伸缩)

#### Helm Chart
- 可配置 values
- ServiceAccount
- 资源限制
- 健康检查探针

## 🚀 快速开始

### 本地开发

```bash
cd agenthive-cloud/apps/agent-runtime
npm install
npm run dev
```

### Docker 运行

```bash
docker build -t agenthive/agent-runtime:latest .
docker run -e SUPERVISOR_URL=ws://host.docker.internal:3001 \
  agenthive/agent-runtime:latest
```

### Kubernetes 部署

```bash
# 原生部署
kubectl apply -f deploy/k8s/

# Helm 部署
helm install agent-runtime deploy/helm/agent-runtime
```

### 自动部署脚本

```bash
./deploy.sh latest --push
```

## ⚙️ 配置项

| 环境变量 | 默认值 | 说明 |
|----------|--------|------|
| AGENT_ID | 自动生成 | 唯一标识 |
| AGENT_NAME | Agent {id} | 显示名称 |
| AGENT_ROLE | custom | 角色类型 |
| SUPERVISOR_URL | ws://localhost:3001 | Supervisor 地址 |
| WORKSPACE_PATH | /workspace | 工作目录 |
| MAX_CONCURRENT_TASKS | 1 | 最大并发任务 |
| HEARTBEAT_INTERVAL | 30000 | 心跳间隔(ms) |

## 📊 监控与健康检查

### 健康检查端点
- **Liveness**: 30s 间隔
- **Readiness**: 10s 间隔

### HPA 配置
- **Min Replicas**: 1
- **Max Replicas**: 10
- **CPU Target**: 70%
- **Memory Target**: 80%

## 🔒 安全特性

- Non-root 用户运行 (uid: 1001)
- 资源限制 (CPU/Memory)
- 只读 root 文件系统选项
- Security Context 配置

## 📈 扩展性

### 添加自定义执行器

```typescript
class CustomExecutor implements TaskExecutor {
  name = 'CustomExecutor'
  canExecute(type: string) { return type === 'custom' }
  async execute(task, context) {
    // 自定义逻辑
  }
}
```

### 水平扩展

```bash
# 手动扩缩容
kubectl scale deployment agent-runtime --replicas=5

# 自动扩缩容
kubectl autoscale deployment agent-runtime --min=1 --max=10 --cpu-percent=70
```

## 📝 技术栈

- **Runtime**: Node.js 20
- **Language**: TypeScript 5.3
- **WebSocket**: ws library
- **Container**: Docker
- **Orchestration**: Kubernetes
- **Package Manager**: npm

## 🎉 完成状态

✅ Agent Runtime 核心服务
✅ WebSocket 客户端
✅ 任务执行引擎（5种执行器）
✅ 文件系统服务
✅ Dockerfile
✅ K8s manifests（5个文件）
✅ Helm Chart（完整）
✅ 部署脚本
✅ 完整文档

**总计代码**: ~1,500 lines
**部署方式**: 3种（本地、Docker、K8s）
**文档**: README + 本总结

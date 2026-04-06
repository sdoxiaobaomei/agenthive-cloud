# Agent Runtime + Ollama 集成方案

## 架构概览

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Docker Desktop Kubernetes                            │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        Ollama Service                               │   │
│  │                    (ollama/ollama:latest)                           │   │
│  │                          :11434                                     │   │
│  │                                                                     │   │
│  │  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐ │   │
│  │  │  llama3.2:1b    │    │ qwen2.5:0.5b    │    │   (more...)     │ │   │
│  │  │   ~1.3GB        │    │   ~397MB        │    │                 │ │   │
│  │  └─────────────────┘    └─────────────────┘    └─────────────────┘ │   │
│  └────────────────────────┬────────────────────────────────────────────┘   │
│                           │                                                 │
│              ┌────────────┼────────────┐                                   │
│              │            │            │                                   │
│  ┌───────────▼───┐  ┌────▼────┐  ┌────▼────┐                              │
│  │ Agent Runtime │  │  Agent  │  │  Agent  │                              │
│  │    Pod 1      │  │  Pod 2  │  │  Pod N  │                              │
│  │               │  │         │  │         │                              │
│  │ OLLAMA_URL=   │  │ (env    │  │ (env    │                              │
│  │ http://ollama │  │  vars)  │  │  vars)  │                              │
│  │ :11434        │  │         │  │         │                              │
│  └───────────────┘  └─────────┘  └─────────┘                              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 组件说明

| 组件 | 镜像 | 功能 | 资源 |
|------|------|------|------|
| Ollama | `ollama/ollama:latest` | LLM 推理服务 | 512Mi-4Gi, 0.5-2 CPU |
| Agent Runtime | `postgres:16-alpine` | Agent 任务执行 | 16Mi-64Mi, 5m-50m CPU |

## 部署文件

```
deploy/k8s/
├── ollama.yaml                  # Ollama Deployment + Service + Model Pull Job
├── deployment-with-ollama.yaml  # Agent Runtime (with Ollama integration)
└── service.yaml                 # Agent Runtime Services
```

## 快速开始

### 1. 部署所有组件

```bash
# 创建 Ollama 服务
kubectl apply -f deploy/k8s/ollama.yaml

# 部署 Agent Runtime (会自动等待 Ollama 就绪)
kubectl apply -f deploy/k8s/deployment-with-ollama.yaml

# 部署 Service
kubectl apply -f deploy/k8s/service.yaml
```

### 2. 查看状态

```bash
# 查看所有 Pod
kubectl get pods -n agenthive

# 查看服务
kubectl get svc -n agenthive

# 查看模型下载进度
kubectl logs -n agenthive -l job-name=ollama-pull-models -f
```

### 3. 测试 Ollama API

```bash
# 从 Agent Runtime Pod 测试 Ollama 连接
kubectl exec -n agenthive <agent-pod-name> -- \
  wget -qO- http://ollama:11434/api/tags

# 生成文本 (需要模型下载完成)
kubectl exec -n agenthive <agent-pod-name> -- \
  wget -qO- --post-data='{"model":"llama3.2:1b","prompt":"Hello"}' \
  http://ollama:11434/api/generate
```

## 环境变量

### Agent Runtime

| 变量 | 值 | 说明 |
|------|-----|------|
| `OLLAMA_URL` | `http://ollama:11434` | Ollama 服务地址 |
| `OLLAMA_MODEL` | `llama3.2:1b` | 默认模型 |

### Ollama

| 变量 | 值 | 说明 |
|------|-----|------|
| `OLLAMA_HOST` | `0.0.0.0:11434` | 监听地址 |
| `OLLAMA_MODELS` | `/root/.ollama/models` | 模型存储路径 |

## 预装模型

模型拉取 Job 会自动下载：

| 模型 | 大小 | 用途 |
|------|------|------|
| `llama3.2:1b` | ~1.3GB | 英文任务、代码生成 |
| `qwen2.5:0.5b` | ~397MB | 中文任务、轻量级推理 |

## 扩展模型

手动拉取更多模型：

```bash
# 进入 Ollama Pod
kubectl exec -it -n agenthive deployment/ollama -- /bin/sh

# 拉取新模型
ollama pull phi3:mini
ollama pull gemma:2b

# 列出已安装模型
ollama list
```

## 服务发现

### 集群内部访问

```yaml
# 其他 Pod 可以通过 Service DNS 访问 Ollama
url: http://ollama:11434
```

### 从主机访问 (port-forward)

```bash
kubectl port-forward -n agenthive svc/ollama 11434:11434

# 然后在主机上
curl http://localhost:11434/api/tags
```

## 监控与调试

```bash
# Ollama 日志
kubectl logs -n agenthive -l component=ollama -f

# Agent Runtime 日志
kubectl logs -n agenthive -l component=agent-runtime -f

# 查看模型下载进度
kubectl logs -n agenthive job/ollama-pull-models -f

# 检查资源使用
kubectl top pods -n agenthive
```

## 资源优化

### 对于 Docker Desktop 环境

| 场景 | 推荐配置 |
|------|---------|
| 开发测试 | 2 CPU, 4GB 内存 |
| 轻量级推理 | 4 CPU, 8GB 内存 |
| 完整功能 | 8 CPU, 16GB 内存 |

### 模型选择建议

| 用途 | 推荐模型 | 内存需求 |
|------|---------|---------|
| 快速原型 | `qwen2.5:0.5b` | ~512MB |
| 平衡性能 | `llama3.2:1b` | ~1.5GB |
| 中文任务 | `qwen2.5:1.5b` | ~2GB |
| 代码生成 | `codellama:7b-code` | ~8GB |

## 故障排除

### Pod 无法启动

```bash
# 检查事件
kubectl get events -n agenthive --sort-by='.lastTimestamp'

# 检查资源限制
kubectl describe node
```

### Ollama 连接失败

```bash
# 测试 Ollama 服务
kubectl exec -n agenthive <agent-pod> -- nc -zv ollama 11434

# 查看 Ollama 状态
kubectl logs -n agenthive deployment/ollama
```

### 模型下载慢

```bash
# 查看下载进度
kubectl logs -n agenthive job/ollama-pull-models -f

# 如需重试，删除 Job 重新创建
kubectl delete job -n agenthive ollama-pull-models
kubectl apply -f deploy/k8s/ollama.yaml
```

# AgentHive Cloud - Local Kubernetes Configuration

本地开发环境 Kubernetes 配置，专为 Docker Desktop Kubernetes 优化。

## 架构概览

```
┌──────────────────────────────────────────────────────────────┐
│                    Docker Desktop K8s                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Namespace: agenthive-local                           │   │
│  │                                                       │   │
│  │   ┌──────────┐      ┌──────────┐      ┌──────────┐  │   │
│  │   │    Web   │◄────►│Supervisor│◄────►│ Postgres │  │   │
│  │   │  (Nginx) │      │   API    │      │(Stateful)│  │   │
│  │   └────┬─────┘      └────┬─────┘      └──────────┘  │   │
│  │        │                 │                          │   │
│  │        └────────┬────────┘      ┌──────────┐        │   │
│  │                 │               │  Redis   │        │   │
│  │                 └──────────────►│   Cache  │        │   │
│  │                                 └──────────┘        │   │
│  │                                                       │   │
│  │   NodePort: 30080 (Web) / 30808 (API)                │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

## 文件说明

| 文件 | 用途 |
|------|------|
| `kustomization.yaml` | Kustomize 根配置，定义资源和标签 |
| `namespace.yaml` | 本地开发命名空间 |
| `configmap.yaml` | 应用配置和 Nginx 配置 |
| `secret.yaml` | 数据库密码等敏感信息 |
| `postgres.yaml` | PostgreSQL StatefulSet 和 Service |
| `redis.yaml` | Redis Deployment 和 Service |
| `supervisor.yaml` | Supervisor API Deployment 和 Service |
| `web.yaml` | Web 前端 Deployment 和 Service |
| `ingress.yaml` | NodePort 和可选的 Ingress 配置 |

## 资源限制

本地开发优化资源配置：

| 组件 | CPU 请求 | CPU 限制 | 内存请求 | 内存限制 | 副本 |
|------|---------|---------|---------|---------|------|
| Web | 50m | 100m | 64Mi | 128Mi | 1 |
| Supervisor | 100m | 250m | 128Mi | 256Mi | 1 |
| PostgreSQL | 100m | 250m | 128Mi | 256Mi | 1 |
| Redis | 50m | 100m | 64Mi | 128Mi | 1 |

## 使用方法

```bash
# 部署
kubectl apply -k k8s/local/

# 删除
kubectl delete -k k8s/local/

# 或使用脚本
./scripts/local-k8s.sh deploy
./scripts/local-k8s.sh delete
```

## 访问方式

1. **NodePort (默认)**: http://localhost:30080
2. **Port-forward**: `kubectl port-forward svc/web 8080:80 -n agenthive-local`
3. **Ingress**: 需安装 Ingress Controller 并启用配置

## 存储

- PostgreSQL: 使用 local-path StorageClass，2GB PVC
- Redis: emptyDir（非持久化）

# AgentHive Kubernetes 配置

生产级的 Kubernetes 配置，使用 Kustomize 管理多环境部署。

## 目录结构

```
k8s/
├── base/                          # 基础配置（通用）
│   ├── 00-namespace.yaml         # 命名空间
│   ├── 01-secrets.yaml           # Secrets 和 ConfigMap
│   ├── 02-postgres.yaml          # PostgreSQL StatefulSet
│   ├── 03-redis.yaml             # Redis Deployment
│   ├── 04-api.yaml               # API Deployment + Service + PDB
│   ├── 05-landing.yaml           # Landing Deployment + Service + PDB
│   └── kustomization.yaml        # Base Kustomization
│
├── overlays/                      # 环境覆盖层
│   ├── local/                    # 本地 Docker Desktop
│   │   ├── kustomization.yaml
│   │   └── nodeport-services.yaml
│   ├── staging/                  # 测试环境
│   │   ├── kustomization.yaml
│   │   └── ingress.yaml
│   └── production/               # 生产环境
│       ├── kustomization.yaml
│       ├── ingress.yaml
│       └── hpa.yaml              # 自动扩缩容
│
├── components/                    # 可选组件
│   ├── security/                 # 安全配置
│   │   └── network-policies.yaml
│   └── monitoring/               # 监控配置
│
└── README.md                     # 本文档
```

## 环境对比

| 特性 | local | staging | production |
|------|-------|---------|------------|
| **副本数** | 1 | 2 | 3+ (HPA) |
| **资源限制** | 较低 | 中等 | 高 |
| **镜像拉取** | Never | IfNotPresent | IfNotPresent |
| **Service 类型** | NodePort | ClusterIP + Ingress | ClusterIP + Ingress |
| **数据库** | 单实例 | 单实例 | 建议外部 RDS |
| **HPA** | 无 | 无 | 有 |
| **PDB** | 1 | 1 | 50% |
| **TLS** | 无 | Let's Encrypt Staging | Let's Encrypt Prod |

## 快速开始

### 本地 Docker Desktop

```bash
# 1. 构建本地镜像
./scripts/build-local-k8s.sh

# 2. 部署到本地 K8s
kubectl apply -k k8s/overlays/local/

# 3. 验证部署
kubectl get pods -n agenthive
kubectl get svc -n agenthive

# 4. 访问服务
open http://localhost:30000  # Landing
open http://localhost:30001  # API

# 5. 查看日志
kubectl logs -f deployment/local-api -n agenthive

# 6. 清理
kubectl delete -k k8s/overlays/local/
```

### 测试环境 (Staging)

```bash
# 前提：已配置镜像仓库和 Ingress Controller
kubectl apply -k k8s/overlays/staging/
```

### 生产环境 (Production)

```bash
# 前提：已配置镜像仓库、Ingress Controller、Cert Manager
kubectl apply -k k8s/overlays/production/

# 验证 HPA
kubectl get hpa -n agenthive-production
```

## 安全加固

### 应用 Network Policy

```bash
# 启用网络隔离
kubectl apply -k k8s/components/security/
```

### Secret 管理最佳实践

1. **本地开发**：使用 `01-secrets.yaml`（已提供默认值）
2. **测试/生产**：使用 External Secrets Operator

```yaml
# 示例：External Secrets 配置
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: app-secrets
spec:
  secretStoreRef:
    name: vault-backend
    kind: SecretStore
  target:
    name: app-secrets
  data:
  - secretKey: DB_PASSWORD
    remoteRef:
      key: agenthive/prod
      property: db-password
```

## 常用命令

```bash
# 查看所有资源
kubectl get all -n agenthive

# 查看日志
kubectl logs -f deployment/api -n agenthive

# 查看事件
kubectl get events -n agenthive --sort-by='.lastTimestamp'

# 端口转发（本地调试）
kubectl port-forward svc/api 3001:3001 -n agenthive

# 进入容器
kubectl exec -it deployment/api -n agenthive -- sh

# 重启部署
kubectl rollout restart deployment/api -n agenthive

# 查看 rollout 状态
kubectl rollout status deployment/api -n agenthive

# 回滚
kubectl rollout undo deployment/api -n agenthive
```

## 故障排查

### Pod 无法启动

```bash
# 查看 Pod 详情
kubectl describe pod <pod-name> -n agenthive

# 查看 Events
kubectl get events -n agenthive --field-selector involvedObject.name=<pod-name>
```

### 服务无法访问

```bash
# 检查 Service Endpoint
kubectl get endpoints -n agenthive

# 测试 DNS 解析
kubectl run -it --rm debug --image=busybox:1.36 --restart=Never -- nslookup api
```

### 资源不足

```bash
# 查看资源使用
kubectl top pods -n agenthive
kubectl top nodes

# 查看资源配额
kubectl describe resourcequota -n agenthive
```

## 扩展配置

### 添加新的环境

1. 创建目录 `k8s/overlays/<env>/`
2. 创建 `kustomization.yaml` 引用 `../../base`
3. 添加环境特定的 patch 和资源配置

### 修改资源配置

```bash
# 编辑 base 配置
vim k8s/base/04-api.yaml

# 应用变更
kubectl apply -k k8s/overlays/local/
```

## 参考文档

- [Kustomize 官方文档](https://kubectl.docs.kubernetes.io/guides/introduction/kustomize/)
- [Kubernetes Deployment 最佳实践](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/)
- [Pod 安全标准](https://kubernetes.io/docs/concepts/security/pod-security-standards/)

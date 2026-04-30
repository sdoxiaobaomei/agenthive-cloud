# AgentHive Kubernetes 配置

生产级的 Kubernetes 配置，使用 Kustomize 管理多环境部署。

## 目录结构

```
k8s/
├── base/                          # 基础配置（通用）
│   ├── 00-namespace.yaml         # 命名空间
│   ├── 01-secretstore.yaml       # External Secrets Operator ClusterSecretStore
│   ├── 01-externalsecrets.yaml   # ExternalSecret (KMS → K8s Secret 同步)
│   ├── 02-postgres.yaml          # PostgreSQL StatefulSet
│   ├── 03-redis.yaml             # Redis Deployment
│   ├── 04-api.yaml               # API Deployment + Service + PDB
│   ├── 05-landing.yaml           # Landing Deployment + Service + PDB
│   └── kustomization.yaml        # Base Kustomization
│
├── overlays/                      # 环境覆盖层
│   ├── local/                    # 本地 K3s / Docker Desktop
│   │   ├── kustomization.yaml
│   │   └── nodeport-services.yaml
│   └── production/               # 生产环境
│       ├── kustomization.yaml
│       ├── ingress.yaml
│       └── hpa.yaml              # 自动扩缩容
│
├── components/                    # 可选组件
│   ├── data-layer/               # 数据层 (Postgres + Redis)
│   │   ├── postgres.yaml
│   │   ├── postgres-java.yaml
│   │   ├── redis.yaml
│   │   └── kustomization.yaml
│   ├── security/                 # 安全配置
│   │   └── network-policies.yaml
│   └── monitoring/               # 监控配置
│
└── README.md                     # 本文档
```

## 环境对比

| 特性 | local | production |
|------|-------|------------|
| **副本数** | 1 | 3+ (HPA) |
| **资源限制** | 较低 | 高 |
| **镜像拉取** | Never (本地构建) | IfNotPresent |
| **Service 类型** | NodePort | ClusterIP + Ingress |
| **数据库** | 单实例 (data-layer component) | 建议外部 RDS |
| **HPA** | 无 | 有 |
| **PDB** | 1 | 50% |
| **TLS** | 无 | Let's Encrypt Prod |
| **Secret 管理** | K8s 原生 Secret (setup-secrets.sh) | K8s 原生 Secret |

## 快速开始

### 本地 K3s / Docker Desktop

```bash
# 1. 创建 Secret（首次部署必需）
cp .env.example .env
# 编辑 .env 填入真实值
bash scripts/setup-secrets.sh

# 2. 构建本地镜像
bash scripts/archive/build-local-k8s.sh

# 3. 部署到本地 K8s（包含数据层）
kubectl apply -k k8s/overlays/local/

# 4. 验证部署
kubectl get pods -n agenthive
kubectl get svc -n agenthive

# 5. 访问服务
open http://localhost:30000  # Landing
open http://localhost:30001  # API

# 6. 镜像 Promotion（dev 测试通过后推送统一版本到 prod）
bash scripts/promote-images.sh --tag v1.2.3-g$(git rev-parse --short HEAD)

# 7. 清理
kubectl delete -k k8s/overlays/local/
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

### Secret 管理（零成本方案）

**当前方案：K8s 原生 Secret + 注入脚本**
- 不再依赖 External Secrets Operator 和阿里云 KMS（节省云费用）
- 通过 `scripts/setup-secrets.sh` 从 `.env` 文件创建 Secret
- `.env` 和真实 Secret 绝不提交 Git（已加入 .gitignore）

```bash
# 首次部署或 Secret 变更时
cp .env.example .env
# 编辑 .env 填入真实值
bash scripts/setup-secrets.sh

# 验证 Secret 已创建
kubectl get secret app-secrets -n agenthive
```

**安全提示**：
- 生产环境建议启用 K3s etcd 加密：`k3s server --secrets-encryption`
- 定期轮换密钥：`bash scripts/security/rotate-secrets.sh`

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

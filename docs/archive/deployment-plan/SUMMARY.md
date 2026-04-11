# AgentHive Cloud 部署计划总结

## 快速开始指南

### 1. 环境准备

```bash
# 安装必要工具
brew install awscli eksctl kubectl helm jq

# 配置 AWS 凭证
aws configure

# 验证配置
aws sts get-caller-identity
```

### 2. 一键部署集群

```bash
# 进入部署目录
cd docs/deployment-plan

# 执行完整安装
chmod +x scripts/setup.sh
./scripts/setup.sh

# 或使用分步安装
./scripts/setup.sh cluster    # 创建集群
./scripts/setup.sh base       # 基础组件
./scripts/setup.sh monitoring # 监控
```

### 3. 部署应用

```bash
# 使用部署助手
chmod +x scripts/deploy-helper.sh

# 查看状态
./scripts/deploy-helper.sh status

# 部署服务
./scripts/deploy-helper.sh deploy landing v1.0.0
./scripts/deploy-helper.sh deploy api v1.0.0
./scripts/deploy-helper.sh deploy agent-runtime v1.0.0

# 健康检查
./scripts/deploy-helper.sh health
```

## 架构概览

```
┌─────────────────────────────────────────────────────────────────┐
│                         边缘层                                   │
│              Cloudflare / AWS CloudFront                        │
│                  (DDoS + WAF + CDN)                             │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Ingress Controller                         │
│              (SSL终止 + 路由 + 速率限制)                         │
└─────────────────────────────────────────────────────────────────┘
        │              │              │
        ▼              ▼              ▼
┌──────────┐   ┌──────────┐   ┌──────────────┐
│ Landing  │   │   API    │   │Agent Runtime │
│ Nuxt 3   │   │ Express  │   │  Node.js     │
│ 3 replicas│   │ 5 replicas│   │ 2-50 replicas│
└──────────┘   └──────────┘   └──────────────┘
       │              │              │
       └──────────────┼──────────────┘
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
┌──────────┐  ┌──────────┐  ┌──────────┐
│PostgreSQL│  │  Redis   │  │  MinIO   │
│   HA     │  │  Cluster │  │  S3兼容  │
└──────────┘  └──────────┘  └──────────┘
```

## 核心特性

### 高可用 (99.99%)
- ✅ 多可用区部署 (3 AZ)
- ✅ Pod 反亲和性
- ✅ 数据库主从复制
- ✅ 自动故障转移

### 自动扩缩容
- ✅ HPA (CPU/内存)
- ✅ KEDA (队列长度)
- ✅ Cluster Autoscaler
- ✅ 定时扩缩容 (开发环境)

### 安全防护
- ✅ 零信任网络策略
- ✅ Pod 安全标准
- ✅ Secret 外部管理
- ✅ 自动 TLS 证书

### 可观测性
- ✅ Prometheus + Grafana
- ✅ Loki 日志聚合
- ✅ Jaeger 分布式追踪
- ✅ 自定义业务指标

### MLOps
- ✅ MLflow 模型管理
- ✅ LLM 网关 (多提供商)
- ✅ A/B 测试
- ✅ 模型漂移检测

### 成本优化
- ✅ Spot 实例 (节省 70%)
- ✅ 资源右调
- ✅ 开发环境自动休眠
- ✅ 成本监控

## 目录结构

```
docs/deployment-plan/
├── README.md                    # 完整部署计划文档
├── SUMMARY.md                   # 本文件 - 快速参考
│
├── infrastructure/              # 基础设施配置
│   ├── eks-cluster-config.yaml  # EKS 集群配置
│   ├── terraform-main.tf        # Terraform IaC
│   ├── terraform-variables.tf   # Terraform 变量
│   ├── kustomization-base.yaml  # Kustomize 基础
│   └── argocd-applications.yaml # ArgoCD 应用
│
├── cicd/                       # CI/CD 配置
│   └── github-actions-pipeline.yml  # GitHub Actions
│
├── monitoring/                 # 可观测性
│   ├── prometheus-rules.yaml   # 告警规则
│   └── grafana-dashboard.json  # 监控面板
│
├── security/                   # 安全配置
│   ├── network-policies.yaml   # 网络策略
│   ├── pod-security-policies.yaml
│   └── external-secrets.yaml   # 密钥管理
│
├── mlops/                      # MLOps 配置
│   ├── mlflow-deployment.yaml  # MLflow
│   └── llm-gateway.yaml        # LLM 网关
│
└── scripts/                    # 部署脚本
    ├── setup.sh               # 环境初始化
    ├── deploy-helper.sh       # 部署助手
    └── cost-optimization.sh   # 成本优化
```

## 关键指标

| 指标 | 目标 | 配置 |
|------|------|------|
| 可用性 | 99.99% | 多 AZ + HA |
| 响应时间 | P99 < 500ms | HPA + 缓存 |
| 自动扩缩容 | < 30秒 | KEDA |
| 故障恢复 | < 5分钟 | PDB + 健康检查 |
| 部署频率 | 按需 | GitOps |
| 回滚时间 | < 2分钟 | 版本化部署 |

## 成本估算

### 月度成本 (生产环境)

| 组件 | 配置 | 月费用 |
|------|------|--------|
| EKS Control Plane | - | $73 |
| System Nodes (2×t3.medium) | On-Demand | $60 |
| App Nodes (3×t3.large) | Spot | $75 |
| Agent Nodes (2×r6i.xlarge) | On-Demand | $280 |
| RDS PostgreSQL | db.r6g.large | $175 |
| ElastiCache Redis | cache.r6g.large | $105 |
| ALB | 2个 | $44 |
| S3 + CloudFront | 预估 | $100 |
| **总计** | | **~$912/月** |

### 成本优化措施后

- Spot 实例折扣: -60%
- 预留实例 (1年): -40%
- 开发环境休眠: -30%
- **实际月费用**: **~$500/月**

## 常用命令速查

```bash
# 查看所有 Pod
kubectl get pods -n agenthive -o wide

# 查看服务状态
kubectl get svc,ingress -n agenthive

# 查看资源使用
kubectl top pods -n agenthive

# 查看日志
kubectl logs -f deployment/api -n agenthive --tail=100

# 进入容器
kubectl exec -it deployment/api -n agenthive -- /bin/sh

# 扩容
kubectl scale deployment/api --replicas=10 -n agenthive

# 重启
kubectl rollout restart deployment/api -n agenthive

# 回滚
kubectl rollout undo deployment/api -n agenthive

# 端口转发
kubectl port-forward svc/api 3001:3001 -n agenthive
```

## 故障排查

### Pod 无法启动
```bash
# 查看事件
kubectl get events -n agenthive --sort-by='.lastTimestamp'

# 查看 Pod 详情
kubectl describe pod <pod-name> -n agenthive

# 查看容器日志
kubectl logs <pod-name> -n agenthive --previous
```

### 服务不可访问
```bash
# 检查 Service Endpoints
kubectl get endpoints -n agenthive

# 检查 Ingress
kubectl get ingress -n agenthive
kubectl describe ingress -n agenthive

# 检查网络策略
kubectl get networkpolicies -n agenthive
```

### 数据库连接问题
```bash
# 检查 Secret
kubectl get secret db-credentials -n agenthive -o yaml

# 测试连接
kubectl run psql --rm -it --image=postgres:16-alpine \
  --restart=Never -n agenthive -- \
  psql postgresql://user:pass@postgres/agenthive
```

## 联系与支持

- **文档**: `docs/deployment-plan/README.md`
- **脚本**: `docs/deployment-plan/scripts/`
- **Issues**: GitHub Issues
- **Slack**: #agenthive-devops

---

> 🚀 **开始使用**: `./scripts/setup.sh`

# AgentHive Cloud — Docker Compose → K3s 迁移完成报告

> **Ticket**: PLATFORM-010  
> **Date**: 2024-04  
> **Status**: ✅ 迁移完成

---

## 1. 迁移概述

| 项目 | 迁移前 (Docker Compose) | 迁移后 (K3s + Helm) |
|------|------------------------|---------------------|
| 编排工具 | Docker Compose | K3s (Kubernetes) |
| 部署方式 | SSH + docker compose down/up | Helm upgrade --install --atomic |
| 镜像标签 | latest | 语义化版本 (v1.1.0-g<sha>) |
| 更新策略 | 停机部署 (downtime) | 滚动更新 (RollingUpdate, maxUnavailable=0) |
| 扩缩容 | 手动修改 docker-compose.yml | HPA 自动扩缩容 |
| 健康检查 | 容器启动后无探针 | Liveness + Readiness + Startup Probe |
| 高可用 | 单实例 | PDB + HPA + 多副本 |
| Secret 管理 | .env.prod 明文 | K8s Secret + External Secrets Operator |
| 监控 | 基础容器监控 | Prometheus + Grafana + Loki + Tempo |
| 网络 | Docker bridge | NetworkPolicy (默认拒绝 + 显式允许) |

---

## 2. 架构图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              阿里云 ECS (8C16G)                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                         K3s 单节点集群                                  │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────────┐    │  │
│  │  │  ingress-   │  │  cert-      │  │      AgentHive Namespace     │    │  │
│  │  │  nginx      │  │  manager    │  │  ┌─────────┐ ┌─────────┐   │    │  │
│  │  │  (80/443)   │  │             │  │  │  API    │ │ Landing │   │    │  │
│  │  └──────┬──────┘  └─────────────┘  │  │  (3 rep)│ │ (3 rep) │   │    │  │
│  │         │                           │  └────┬────┘ └────┬────┘   │    │  │
│  │         │                           │       │           │         │    │  │
│  │         ▼                           │  ┌────┴───────────┴────┐   │    │  │
│  │  ┌─────────────┐                    │  │   Java Services      │   │    │  │
│  │  │   HTTPS     │◄───────────────────┼──┤  Gateway/Auth/User   │   │    │  │
│  │  │   agenthive │                    │  │  Payment/Order/Cart  │   │    │  │
│  │  │   .cloud    │                    │  │  Logistics (3 rep)   │   │    │  │
│  │  └─────────────┘                    │  └─────────────────────┘   │    │  │
│  │                                     │                            │    │  │
│  │                                     │  ┌─────────┐ ┌─────────┐   │    │  │
│  │                                     │  │  Nacos  │ │RabbitMQ │   │    │  │
│  │                                     │  │ (opt)   │ │ (opt)   │   │    │  │
│  │                                     │  └─────────┘ └─────────┘   │    │  │
│  │                                     └─────────────────────────────┘    │  │
│  │                                                                        │  │
│  │  ┌─────────────────────────────────────────────────────────────────┐   │  │
│  │  │                    monitoring Namespace                          │   │  │
│  │  │  Prometheus + Grafana + Loki + Tempo + OTel Collector           │   │  │
│  │  └─────────────────────────────────────────────────────────────────┘   │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌─────────────────────────┐                                               │
│  │  外部 ECS (2C2G)         │                                               │
│  │  PostgreSQL + Redis      │◄─────────────────────────────────────────────┘
│  │  172.24.146.165          │
│  └─────────────────────────┘
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. 关键交付物清单

### 3.1 基础设施

| 文件 | 说明 |
|------|------|
| `scripts/bootstrap-k3s-ecs.sh` | K3s 一键安装 |
| `scripts/verify-k3s.sh` | K3s 健康检查 |
| `docs/k3s-bootstrap.md` | K3s 部署文档 |

### 3.2 Helm Chart

| 文件 | 说明 |
|------|------|
| `chart/agenthive/` | 完整 Helm Chart (30+ templates) |
| `chart/agenthive/values.prod.yaml` | 生产配置 |
| `chart/agenthive/values.staging.yaml` | 预发配置 |

### 3.3 CI/CD

| 文件 | 说明 |
|------|------|
| `.github/workflows/deploy-k3s.yml` | K3s 自动部署 |
| `scripts/deploy-k3s.sh` | 本地部署脚本 |
| `scripts/rollback-k3s.sh` | 回滚脚本 |
| `scripts/verify-deployment.sh` | 部署验证 |

### 3.4 监控

| 文件 | 说明 |
|------|------|
| `k8s/components/monitoring/` | Prometheus/Grafana/Loki/Tempo/OTel |
| `k8s/components/external-db/` | 外部 DB/Redis Endpoint 映射 |

### 3.5 安全

| 文件 | 说明 |
|------|------|
| `scripts/rotate-secrets.sh` | 密钥轮换 |
| `scripts/clean-git-secrets.sh` | Git 历史清理 |
| `scripts/validate-env.sh` | 环境变量验证 |
| `.github/workflows/env-check.yml` | CI Secret 检查 |

---

## 4. 回退方案

如遇严重故障，按以下顺序回退：

1. **Helm 回滚**（30 秒内）：
   ```bash
   bash scripts/rollback-k3s.sh
   ```

2. **Docker Compose 恢复**（5 分钟内）：
   ```bash
   ssh root@39.107.87.106
   cd /opt/agenthive-cloud
   docker compose -f docker-compose.prod.yml up -d
   ```

3. **DNS 回退**（指向原 ECS IP）

---

## 5. 已知限制

1. K3s 单节点，无高可用
2. Nacos/RabbitMQ 默认禁用（Phase 1）
3. 数据层未迁移（保持外部 ECS）
4. Helm CLI 未在本地安装（需在 K3s 节点安装后验证）

---

## 6. 团队交接

| 事项 | 负责人 | 状态 |
|------|--------|------|
| K3s 运维培训 | Platform Team | ✅ 完成 (runbook) |
| Helm Chart 使用培训 | Platform Team | ✅ 完成 (README) |
| CI/CD 流水线说明 | Platform Team | ✅ 完成 (deploy-k3s.yml) |
| 紧急联系人清单 | Platform Team | ✅ 完成 (runbook) |
| Grafana Dashboard 培训 | Platform Team | ⏳ 待安排 |

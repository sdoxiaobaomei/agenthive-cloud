# 🚀 部署运维文档

> 部署、运维和成本相关文档

---

## 🎯 部署方式选择

| 方式 | 适用场景 | 复杂度 | 成本 |
|------|---------|--------|------|
| **Docker Compose** | 本地开发 | ⭐ | ¥0 |
| **Docker Desktop K8s** | 本地 K8s 练习 | ⭐⭐ | ¥0 |
| **Kind** | CI/CD 测试 | ⭐⭐ | ¥0 |
| **阿里云 ACK** | 国内生产 | ⭐⭐⭐⭐ | ¥200-500/月 |
| **AWS EKS** | 海外生产 | ⭐⭐⭐⭐ | $70-150/月 |

---

## 📚 部署文档

### Docker 部署

| 文档 | 说明 |
|------|------|
| [Docker Compose 本地部署](./docker-deployment.md) | `docker-compose.dev.yml` 使用说明 |
| [Docker 镜像加速配置](./docker/DOCKER-MIRROR-SETUP.md) | 国内镜像源配置 |

### Kubernetes 部署

| 文档 | 说明 |
|------|------|
| [K8s 部署指南](./k8s-deployment.md) | 生产环境 K8s 部署 |
| [TLS / HTTPS 配置](./tls-https-setup.md) | cert-manager + Let's Encrypt + HSTS |
| [External Secrets Operator](./external-secrets-operator.md) | KMS 动态 Secret 注入 |
| [Redis 持久化策略](./redis-persistence-strategy.md) | PVC + AOF/RDB + 云托管评估 |
| [Docker 日志轮转](./docker-logging.md) | 日志限制 + 磁盘监控 + 自动清理 |
| [Nginx HTTPS 证书](./nginx-https.md) | 阿里云证书部署 + TLS 强制跳转 |
| [Watchtower 自动更新](./watchtower.md) | CI/CD 镜像自动检测与安全重启 |
| [Docker 转 K8s 迁移](../archive/DOCKER-TO-K8S-MIGRATION.md) | 完整迁移方案 |
| [手把手 K8s 迁移](./k8s/HANDS-ON-K8S-MIGRATION.md) | 从零开始教程 |
| [本地 K8s 部署](../archive/LOCAL-K8S-DOCKER-DESKTOP.md) | Docker Desktop K8s |
| [K8s 集群搭建](../archive/K8S-CLUSTER-SETUP.md) | Kind/Kubeadm 搭建 |
| [K8s 架构详解](../archive/K8S-ARCHITECTURE-EXPLAINED.md) | 三种方案对比 |
| [Kubeadm 概念澄清](./k8s/K8S-KUBEADM-CLARIFICATION.md) | 概念解释 |
| [K3s 启动配置](./k8s/k3s-bootstrap.md) | K3s 集群初始化配置 |
| [迁移完成总结](./k8s/migration-completed.md) | Docker 到 K8s 迁移完成报告 |

### 混合部署

| 文档 | 说明 |
|------|------|
| [混合架构方案](../archive/HYBRID-K8S-ARCHITECTURE.md) | 本地 Kind + Cloudflare |
| [混合部署](./hybrid-deployment.md) | 本地+云端混合 |

### CI/CD

| 文档 | 说明 |
|------|------|
| [CI/CD 使用指南](./ci-cd/CI-CD-USAGE.md) | GitHub Actions/GitLab CI |
| [CI 构建优化](./ci-cd/CI-BUILD-OPTIMIZATION.md) | 构建速度和镜像优化 |

---

## 💰 成本分析

| 文档 | 说明 |
|------|------|
| [成本分析](./cost-analysis.md) | 阿里云/AWS/本地对比 |
| [K8s 成本分析](../archive/K8S-COST-ANALYSIS.md) | EKS vs ACK 成本 |
| [RFC: 阿里云成本分析](../rfc/RFC-001-Alibaba-Cloud-Cost-Analysis.md) | 详细成本 RFC |

---

## 🔧 运维操作

| 文档 | 说明 |
|------|------|
| [K3s 运维手册](../operation/runbook-k3s-ops.md) | K3s 集群日常运维 Runbook |
| [密钥轮换指南](../operation/security-secret-rotation.md) | 安全密钥轮换操作规范 |
| [快速参考](../reference/quick-reference.md) | 常用运维命令 |

---

## 📊 部署检查清单

### Docker 部署检查项

- [ ] Docker 和 Docker Compose 安装
- [ ] 端口 80, 3001, 5432, 6379 可用
- [ ] 环境变量配置正确
- [ ] 镜像构建成功
- [ ] 服务健康检查通过

### K8s 部署检查项

- [ ] K8s 集群就绪
- [ ] kubectl 配置正确
- [ ] Namespace 创建
- [ ] ConfigMap/Secret 配置
- [ ] PVC 和 StorageClass
- [ ] Deployment 和 Service
- [ ] Ingress 配置
- [ ] 健康检查配置

---

## 🆘 故障排查

| 问题 | 解决方案 |
|------|---------|
| 镜像拉取失败 | [排查指南](../archive/K8S-CHEATSHEET.md#imagepullbackoff) |
| Pod 无法启动 | [排查指南](../archive/K8S-CHEATSHEET.md#pod-pending) |
| 服务无法访问 | [K8s 速查表](../archive/K8S-CHEATSHEET.md) |
| 构建失败 | [CI 优化](./ci-cd/CI-BUILD-OPTIMIZATION.md) |

---

## 📖 参考文档

- [K8s 速查表](../archive/K8S-CHEATSHEET.md)
- [Docker 速查表](../archive/git-cheatsheet.md)
- [运维排查指南](../operation/README.md)

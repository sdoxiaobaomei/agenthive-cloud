# Kubernetes 配置优化报告

**日期**: 2026-04-11  
**项目**: AgentHive Cloud  
**范围**: K8s 资源配置优化

---

## 📊 优化概览

本次优化为 AgentHive Cloud 添加了生产级 Kubernetes 配置，包括网络策略、自动扩缩容、配置管理和 Ingress 路由。

| 资源类型 | 数量 | 说明 |
|----------|------|------|
| NetworkPolicy | 4 | 服务间网络隔离 |
| HorizontalPodAutoscaler | 2 | 自动扩缩容配置 |
| ConfigMap | 1 | 应用配置管理 |
| Ingress | 2 | 外部访问路由 |

---

## ✅ 新增资源

### 1️⃣ NetworkPolicy (06-networkpolicy.yaml)

**作用**: 实现 Pod 间网络隔离，遵循最小权限原则

**策略**:
- ✅ API Pod: 只接受来自 Landing 和 Ingress 的流量
- ✅ Landing Pod: 只接受来自 Ingress 的流量
- ✅ Postgres Pod: 只接受来自 API 的流量（**禁止直接访问**）
- ✅ Redis Pod: 只接受来自 API 的流量（**禁止直接访问**）
- ✅ 所有 Pod: 允许 DNS 解析

**设计原则**:
- 最小权限：每个 Pod 只能访问必要的服务
- 纵深防御：多层网络隔离
- 默认拒绝：未明确允许的流量一律禁止

---

### 2️⃣ HorizontalPodAutoscaler (07-hpa.yaml)

**作用**: 根据 CPU/内存使用率自动扩缩容

**配置**:
| 服务 | 最小副本 | 最大副本 | CPU 阈值 | 内存阈值 |
|------|---------|---------|---------|---------|
| API | 2 | 10 | 70% | 80% |
| Landing | 2 | 8 | 70% | 80% |

**扩缩容行为**:
- **扩容**: 立即响应（stabilizationWindowSeconds: 0）
- **缩容**: 5 分钟稳定窗口，避免抖动
- **最大扩容速度**: 100% 每 15 秒 或 4 个 Pod 每 15 秒

---

### 3️⃣ ConfigMap (08-configmap.yaml)

**作用**: 集中管理非敏感配置

**管理的配置**:
- 环境配置（NODE_ENV）
- 数据库连接（DB_HOST, DB_PORT, DB_NAME, DB_USER）
- Redis 连接（REDIS_URL）
- 应用配置（APP_NAME, LOG_LEVEL, API_VERSION）
- 性能配置（MAX_CONNECTIONS, REQUEST_TIMEOUT, CACHE_TTL）

**优势**:
- 配置与镜像分离
- 无需重建镜像即可修改配置
- 支持热更新（挂载为 Volume 时）

---

### 4️⃣ Ingress (09-ingress.yaml)

**作用**: 提供外部访问入口

**生产配置**:
- HTTPS 强制重定向
- TLS 终端（证书管理）
- 限流配置（100 请求/分钟）
- 超时配置（连接 30s，读取/发送 60s）
- 路由规则（/api → API, / → Landing）

**本地测试配置**:
- 无 HTTPS（便于本地开发）
- 域名：agenthive.local

---

## 🔧 优化详情

### 安全性提升

| 优化项 | 描述 | 影响 |
|--------|------|------|
| NetworkPolicy | 实施网络隔离 | 🔴 高 - 防止横向移动 |
| 镜像标签 | 建议使用具体版本 | 🟡 中 - 提高可追溯性 |
| TLS 终端 | HTTPS 强制重定向 | 🟡 中 - 保护数据传输 |

### 可靠性提升

| 优化项 | 描述 | 影响 |
|--------|------|------|
| HPA | 自动扩缩容 | 🟢 高 - 应对流量高峰 |
| PDB | 已存在 | ✅ 保持 - 维护期间可用性 |
| Anti-Affinity | 已存在 | ✅ 保持 - 避免单点故障 |

### 可维护性提升

| 优化项 | 描述 | 影响 |
|--------|------|------|
| ConfigMap | 集中配置管理 | 🟢 高 - 配置变更无需重启 |
| 统一标签 | 添加 version 标签 | 🟡 中 - 便于资源管理 |

---

## 📋 部署清单

### 本地部署（Docker Desktop K8s）

```bash
# 1. 启用 K8s（Docker Desktop Settings → Kubernetes）
# 2. 部署应用
kubectl apply -k k8s/base

# 3. 验证部署
kubectl get all -n agenthive

# 4. 端口转发（本地访问）
kubectl port-forward svc/landing -n agenthive 3000:3000
kubectl port-forward svc/api -n agenthive 3001:3001

# 5. 查看 HPA 状态
kubectl get hpa -n agenthive

# 6. 查看 NetworkPolicy
kubectl get networkpolicy -n agenthive
```

### 生产部署

```bash
# 1. 使用 production overlay（需创建）
kubectl apply -k k8s/overlays/production/

# 2. 配置域名 DNS
# agenthive.example.com → Ingress IP

# 3. 配置 TLS 证书（cert-manager 或手动）
kubectl create secret tls agenthive-tls \
  --cert=path/to/tls.crt \
  --key=path/to/tls.key \
  -n agenthive
```

---

## 🔧 技术要点

### 1. 安全性（Security）

- **Pod 安全**: runAsNonRoot, readOnlyRootFilesystem, capabilities drop ALL
- **网络安全**: NetworkPolicy 实现零信任，服务间最小权限通信
- **数据安全**: Secrets 管理敏感信息，TLS 加密传输
- **镜像安全**: 使用具体版本标签，避免 :latest

### 2. 高可用性（High Availability）

- **多副本**: 最少 2 个副本，配合 PodDisruptionBudget
- **反亲和性**: Pod Anti-Affinity 避免同节点部署
- **自动扩缩**: HPA 根据负载自动调整副本数
- **健康检查**: 三种探针确保流量只到健康 Pod
- **优雅关闭**: PDB 确保维护期间有足够可用 Pod

### 3. 网络（Networking）

- **Service**: ClusterIP 提供集群内访问
- **Ingress**: 提供集群外访问和路由
- **NetworkPolicy**: 控制 Pod 间网络流量
- **DNS**: CoreDNS 提供服务发现

### 4. 扩缩容（Scaling）

- **HPA**: 基于 CPU/内存自动扩缩
- **资源配置**: 合理的 requests/limits
- **启动优化**: startupProbe 加速健康 Pod 上线
- **缩容保护**: stabilizationWindow 避免抖动

---

## ⚠️ 待办事项

### 高优先级

- [ ] **镜像标签**: 将 `:latest` 改为具体版本号（如 `v1.0.0`）
- [ ] **TLS 证书**: 配置 cert-manager 自动续期
- [ ] **监控集成**: 部署 Prometheus + Grafana（已有配置文件）

### 中优先级

- [ ] **日志收集**: 部署 EFK/ELK Stack
- [ ] **备份策略**: Velero 定期备份
- [ ] **CI/CD 集成**: GitHub Actions 自动部署

### 低优先级

- [ ] **多环境**: 创建 staging/production overlays
- [ ] **金丝雀发布**: Argo Rollouts 灰度发布
- [ ] **服务网格**: Istio 高级流量管理

---

## 📚 参考文档

- [Kubernetes 最佳实践](https://kubernetes.io/docs/concepts/configuration/overview/)
- [NetworkPolicy 指南](https://kubernetes.io/docs/concepts/services-networking/network-policies/)
- [HPA 配置](https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/)
- [Ingress 配置](https://kubernetes.io/docs/concepts/services-networking/ingress/)

---

**总结**: 本次优化为 AgentHive Cloud 添加了生产级 Kubernetes 配置，
包括网络隔离、自动扩缩容、配置管理和外部访问控制，
使项目具备完整的安全性、可靠性和可扩展性。

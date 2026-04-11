# Docker Desktop Kubernetes 本地部署方案

> **目标**: 在 Docker Desktop 内置 K8s 上部署完整 AgentHive 架构  
> **适用场景**: 本地开发、功能测试、单机演示  
> **预计时间**: 15 分钟

---

## 📋 前置要求

```bash
# 1. 启用 Docker Desktop Kubernetes
# Docker Desktop → Settings → Kubernetes → Enable Kubernetes ✅

# 2. 验证 kubectl 连接
kubectl version --client
kubectl cluster-info
# 预期输出: Kubernetes control plane is running at https://kubernetes.docker.internal:6443

# 3. 验证 StorageClass（Docker Desktop 自带）
kubectl get sc
# 预期输出: hostpath (default)
```

---

## 🏗️ 架构概览

```
┌─────────────────────────────────────────────────────────────────┐
│                    Docker Desktop (Single Node)                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Kubernetes Cluster (v1.28+)                  │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │  │
│  │  │   Landing    │  │     API      │  │   Postgres   │   │  │
│  │  │   (x2 pods)  │  │   (x2 pods)  │  │  (Stateful)  │   │  │
│  │  │   :80        │  │   :3001      │  │   :5432      │   │  │
│  │  └──────┬───────┘  └──────┬───────┘  └──────────────┘   │  │
│  │         │                  │                            │  │
│  │         └──────────────────┼──────────────────┐         │  │
│  │                            │                  │         │  │
│  │  ┌──────────────┐  ┌───────┴───────┐  ┌──────┴──────┐  │  │
│  │  │    Redis     │  │   Service     │  │   Service   │  │  │
│  │  │   :6379      │  │   landing     │  │    api      │  │  │
│  │  └──────────────┘  └───────────────┘  └─────────────┘  │  │
│  │                                                        │  │
│  └────────────────────────────────────────────────────────┘  │
│                              │                                  │
│  ┌───────────────────────────┴───────────────────────────┐    │
│  │              LoadBalancer Service (自动分配 localhost)   │    │
│  │         http://localhost:80  →  Landing                 │    │
│  │         http://localhost:3001 →  API (可选)             │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

### 服务访问方式

| 服务 | 访问地址 | 说明 |
|------|---------|------|
| Landing | http://localhost | 主入口（LoadBalancer 自动分配） |
| API | http://localhost/api | 通过 Landing 代理 |
| API 直连 | http://localhost:3001 | 可选，调试使用 |
| Postgres | localhost:5432 | NodePort 暴露，本地工具连接 |
| Redis | localhost:6379 | NodePort 暴露，本地工具连接 |

---

## 🚀 快速开始（5分钟部署）

### 步骤 1: 构建本地镜像

```bash
# 使用本地构建脚本（不推送远程仓库）
./scripts/build-local-k8s.sh
```

### 步骤 2: 一键部署

```bash
# 部署所有组件
kubectl apply -k k8s/local/

# 或使用脚本
./scripts/deploy-local-k8s.sh
```

### 步骤 3: 验证部署

```bash
# 查看所有 Pod
kubectl get pods -n agenthive -w

# 预期输出:
# NAME                        READY   STATUS    RESTARTS   AGE
# api-7d9f4b8c5-x2abc        1/1     Running   0          30s
# api-7d9f4b8c5-y3def        1/1     Running   0          30s
# landing-5c8d2a1b9-z4ghi    1/1     Running   0          30s
# landing-5c8d2a1b9-w5jkl    1/1     Running   0          30s
# postgres-0                 1/1     Running   0          45s
# redis-6f9b5c4d8-m7nop      1/1     Running   0          40s

# 等待所有 Pod Ready
kubectl wait --for=condition=ready pod --all -n agenthive --timeout=120s
```

### 步骤 4: 访问应用

```bash
# 获取访问地址
kubectl get svc -n agenthive

# 访问 Landing
curl http://localhost
# 或浏览器打开 http://localhost

# 测试 API
curl http://localhost/api/health
```

---

## 📁 本地 K8s 目录结构

```
k8s/
├── base/                          # 基础配置（通用）
│   ├── 00-namespace.yaml
│   ├── 01-secrets.yaml
│   ├── 02-postgres.yaml
│   ├── 03-redis.yaml
│   ├── 04-api.yaml
│   ├── 05-landing.yaml
│   └── kustomization.yaml
├── local/                         # 本地覆盖配置 ⭐
│   ├── kustomization.yaml
│   ├── api-service.yaml          # LoadBalancer 类型
│   ├── landing-service.yaml      # LoadBalancer 类型
│   └── postgres-service.yaml     # NodePort 暴露
└── README.md
```

---

## 🔧 详细配置说明

### 1. Namespace & Secrets

```yaml
# 本地开发使用简单密码
# k8s/local/kustomization.yaml 中通过 patch 覆盖
```

### 2. PostgreSQL (StatefulSet)

- **存储**: 使用 Docker Desktop 自带的 hostpath StorageClass
- **持久化**: 数据存储在 Docker VM 中，删除 PVC 会丢失数据
- **访问**: NodePort 5432 暴露，可用本地 psql 连接

```bash
# 本地连接 PostgreSQL
psql -h localhost -p 5432 -U agenthive -d agenthive
# 密码: dev
```

### 3. Redis

- **存储**: 持久化到 /data（PVC）
- **访问**: NodePort 6379 暴露

```bash
# 本地连接 Redis
redis-cli -h localhost -p 6379
```

### 4. API (Deployment)

- **副本数**: 2（本地资源足够）
- **镜像**: 本地构建，imagePullPolicy: Never
- **健康检查**: /api/health 端点
- **资源限制**: 512Mi 内存，500m CPU

### 5. Landing (Deployment)

- **副本数**: 2
- **镜像**: 本地构建，imagePullPolicy: Never
- **Nginx**: 静态文件服务

---

## 🛠️ 常用操作命令

### 查看状态

```bash
# 所有资源
kubectl get all -n agenthive

# Pod 日志
kubectl logs -f deployment/api -n agenthive --tail=100
kubectl logs -f deployment/landing -n agenthive --tail=100
kubectl logs -f statefulset/postgres -n agenthive --tail=50

# Pod 详情（排查问题）
kubectl describe pod <pod-name> -n agenthive
```

### 进入容器

```bash
# API 容器
kubectl exec -it deployment/api -n agenthive -- sh

# PostgreSQL
kubectl exec -it postgres-0 -n agenthive -- psql -U agenthive

# Redis
kubectl exec -it deployment/redis -n agenthive -- redis-cli
```

### 端口转发（调试）

```bash
# 转发 API 到本地 3001
kubectl port-forward svc/api 3001:3001 -n agenthive

# 转发 PostgreSQL 到本地 5432
kubectl port-forward svc/postgres 5432:5432 -n agenthive

# 转发 Redis 到本地 6379
kubectl port-forward svc/redis 6379:6379 -n agenthive
```

### 扩缩容

```bash
# 扩容 API 到 3 个副本
kubectl scale deployment/api --replicas=3 -n agenthive

# 缩容到 1 个副本
kubectl scale deployment/api --replicas=1 -n agenthive
```

### 重启部署

```bash
# 滚动重启（无中断）
kubectl rollout restart deployment/api -n agenthive
kubectl rollout restart deployment/landing -n agenthive

# 查看滚动状态
kubectl rollout status deployment/api -n agenthive

# 回滚到上一版本
kubectl rollout undo deployment/api -n agenthive
```

---

## 🔄 重新部署流程

### 场景 1: 代码更新后重新部署

```bash
# 1. 重新构建镜像
./scripts/build-local-k8s.sh

# 2. 滚动重启（K8s 会自动拉取新镜像）
kubectl rollout restart deployment/api -n agenthive
kubectl rollout restart deployment/landing -n agenthive

# 3. 等待完成
kubectl rollout status deployment/api -n agenthive
```

### 场景 2: 完全清理重新部署

```bash
# 1. 删除所有资源
kubectl delete -k k8s/local/

# 2. 验证清理
kubectl get all -n agenthive
# 应该为空

# 3. 重新部署
kubectl apply -k k8s/local/
```

### 场景 3: 只更新配置

```bash
# 修改 k8s/local/ 下的配置后
kubectl apply -k k8s/local/

# 或单独应用某个文件
kubectl apply -f k8s/local/api-service.yaml
```

---

## 🐛 常见问题

### 1. ImagePullBackOff

**原因**: K8s 无法拉取镜像

**解决**:
```bash
# 检查镜像是否存在
docker images | grep agenthive

# 确保镜像标签正确
# k8s 配置中应该是: agenthive/api:latest（本地镜像）
# 不是: registry.xxx.com/agenthive/api:latest
```

### 2. Pod 一直 Pending

**原因**: 资源不足或 PVC 未绑定

**解决**:
```bash
# 查看事件
kubectl describe pod <pod-name> -n agenthive

# 检查 PVC
kubectl get pvc -n agenthive

# Docker Desktop 资源不足时，调整设置：
# Settings → Resources → 增加内存到 4GB+
```

### 3. 无法访问 localhost

**原因**: Service 未正确创建或端口冲突

**解决**:
```bash
# 检查 Service
kubectl get svc -n agenthive

# 检查端口占用
lsof -i :80
lsof -i :3001

# 重启 Docker Desktop Kubernetes
# Settings → Kubernetes → Reset Kubernetes Cluster
```

### 4. 数据库连接失败

**原因**: Postgres 未就绪或配置错误

**解决**:
```bash
# 检查 Postgres 状态
kubectl get pod postgres-0 -n agenthive

# 查看日志
kubectl logs postgres-0 -n agenthive

# 检查 Service
kubectl get svc postgres -n agenthive
```

---

## 💡 进阶技巧

### 使用 Lens 或 K9s 图形化管理

```bash
# 安装 k9s（终端 UI）
brew install k9s  # macOS
# 或
winget install k9s  # Windows

# 启动
k9s -n agenthive
```

### 本地 DNS 配置（可选）

```bash
# 编辑 /etc/hosts（macOS/Linux）
# 或 C:\Windows\System32\drivers\etc\hosts（Windows）

127.0.0.1  agenthive.local
127.0.0.1  api.agenthive.local
```

然后修改 Ingress 配置使用这些域名。

### 资源监控

```bash
# 查看资源使用
kubectl top pods -n agenthive
kubectl top nodes

# 启用 metrics-server（如果未启用）
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
```

---

## 📊 资源需求

| 组件 | 请求内存 | 限制内存 | 请求 CPU | 限制 CPU |
|------|---------|---------|---------|---------|
| API | 256Mi | 512Mi | 250m | 500m |
| Landing | 128Mi | 256Mi | 100m | 200m |
| Postgres | 256Mi | 512Mi | 250m | 500m |
| Redis | 128Mi | 256Mi | 100m | 200m |
| **总计** | ~768Mi | ~1.5Gi | ~700m | ~1.4 |

**建议**: Docker Desktop 分配至少 **4GB 内存 + 2 CPU**

---

## 🎯 与 Docker Compose 对比

| 特性 | Docker Compose | Docker Desktop K8s |
|------|---------------|-------------------|
| 学习成本 | 低 | 中 |
| 编排能力 | 无 | 有（自愈、滚动更新） |
| 扩缩容 | 手动 | HPA 自动/手动 |
| 服务发现 | 简单 | DNS + Service |
| 生产相似度 | 低 | 高 |
| 资源占用 | 低 | 中 |
| 适合场景 | 快速开发 | K8s 技能练习、复杂编排测试 |

---

## 📝 检查清单

部署前确认：
- [ ] Docker Desktop Kubernetes 已启用
- [ ] kubectl 可以连接到集群
- [ ] Docker Desktop 资源 ≥ 4GB 内存
- [ ] 本地镜像已构建（`docker images` 能看到）

部署后确认：
- [ ] 所有 Pod Running (`kubectl get pods -n agenthive`)
- [ ] Service 有 EXTERNAL-IP (`kubectl get svc -n agenthive`)
- [ ] http://localhost 可以访问
- [ ] http://localhost/api/health 返回 200

---

## 🔗 相关文档

- [迁移到云端 K8s](./DOCKER-TO-K8S-MIGRATION.md) - 需要上云时参考
- [Docker Desktop K8s 官方文档](https://docs.docker.com/desktop/kubernetes/)
- [kubectl  cheat sheet](https://kubernetes.io/docs/reference/kubectl/cheatsheet/)

# K8s 本地集群搭建总结 - 选择适合你的方案

## 🎯 三种方案速览

| 方案 | 难度 | 资源需求 | 最适合 | 启动命令 |
|------|------|---------|--------|---------|
| **Docker Desktop** | ⭐ | 4GB 内存 | Win/Mac 快速开始 | 图形界面点击 |
| **Kind** | ⭐⭐ | 4GB 内存 | 多节点练习、CI/CD | `./scripts/setup-kind-cluster.sh` |
| **Kubeadm VM** | ⭐⭐⭐ | 8GB+ 内存 | 生产级练习 | `vagrant up` |

---

## 🚀 根据你的情况选择

### 情况 1: 我是 Windows 用户，想快速开始

**推荐**: Docker Desktop K8s

```powershell
# 1. 安装 Docker Desktop
winget install Docker.DockerDesktop

# 2. 启用 WSL2（如果需要）
wsl --install -d Ubuntu-22.04

# 3. 启动 Docker Desktop → Settings → Kubernetes → Enable

# 4. 验证
./scripts/setup-dd-k8s.sh

# 5. 部署 AgentHive
./scripts/deploy-local-k8s.sh
```

**优点**:
- ✅ 最简单，图形界面操作
- ✅ 与 Windows 集成最好
- ✅ 资源占用相对较少

---

### 情况 2: 我是 Mac 用户

**推荐**: Docker Desktop K8s 或 Kind

```bash
# 选项 A: Docker Desktop
brew install --cask docker
# 然后图形界面启用 Kubernetes

# 选项 B: Kind（更喜欢命令行）
brew install kind kubectl
./scripts/setup-kind-cluster.sh
```

---

### 情况 3: 我是 Linux 用户

**推荐**: Kind（轻量）或 Kubeadm（最接近生产）

```bash
# 选项 A: Kind（推荐）
./scripts/setup-kind-cluster.sh

# 选项 B: Kubeadm 虚拟机（如果你想练习多节点管理）
cd ~/k8s-cluster
vagrant up  # 需要 20 分钟
```

---

### 情况 4: 我想练习多节点集群管理

**推荐**: Kind 多节点 或 Kubeadm

```bash
# Kind 多节点（快速）
kind create cluster --config scripts/kind-cluster.yaml
# 得到: 1 master + 2 worker

# Kubeadm（最接近生产）
cd ~/k8s-cluster && vagrant up
# 得到: 1 master + 2 worker（真正的虚拟机）
```

---

### 情况 5: 我的电脑配置较低

**推荐**: Kind 单节点

```bash
# 编辑配置减少资源
kind create cluster --name agenthive --config - <<EOF
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
name: agenthive
nodes:
  - role: control-plane
    extraPortMappings:
      - containerPort: 80
        hostPort: 80
EOF
```

**最低要求**:
- 2 CPU
- 2GB 内存（只能跑基本应用）
- 10GB 磁盘

---

## 📋 部署 AgentHive 流程

### 1. 准备工作（选择一种）

```bash
# 方案 A: Docker Desktop
./scripts/setup-dd-k8s.sh

# 方案 B: Kind
./scripts/setup-kind-cluster.sh
```

### 2. 构建镜像

```bash
# 构建本地镜像
./scripts/build-local-k8s.sh

# 如果是 Kind，需要加载镜像
kind load docker-image agenthive/api:latest --name agenthive
kind load docker-image agenthive/landing:latest --name agenthive
```

### 3. 部署应用

```bash
# 部署到集群
kubectl apply -k k8s/local/

# 或使用脚本
./scripts/deploy-local-k8s.sh
```

### 4. 验证访问

```bash
# 查看 Pod 状态
kubectl get pods -n agenthive -w

# 访问 Landing
open http://localhost  # macOS
start http://localhost  # Windows
xdg-open http://localhost  # Linux

# 测试 API
curl http://localhost/api/health
```

---

## 🎓 学习路径建议

### Week 1: 熟悉基本操作

**目标**: 能独立部署应用

```bash
# 练习命令
kubectl get pods
kubectl logs
kubectl exec
kubectl apply
kubectl delete
```

**任务**:
- [ ] 部署 Nginx Pod
- [ ] 创建 Deployment 并扩缩容
- [ ] 暴露 Service
- [ ] 查看日志和进入容器

---

### Week 2: 深入理解资源

**目标**: 理解 K8s 核心资源

```bash
# 学习资源类型
Deployment    # 无状态应用
StatefulSet   # 有状态应用（如数据库）
Service       # 服务发现
ConfigMap     # 配置
Secret        # 密钥
PVC           # 存储
Ingress       # 入口路由
```

**任务**:
- [ ] 理解 Pod 生命周期
- [ ] 配置健康检查（liveness/readiness）
- [ ] 使用 ConfigMap 和 Secret
- [ ] 配置资源限制（requests/limits）

---

### Week 3: 存储和网络

**目标**: 掌握数据持久化和网络

```bash
# 存储
PersistentVolume
PersistentVolumeClaim
StorageClass

# 网络
Service (ClusterIP/NodePort/LoadBalancer)
Ingress
NetworkPolicy
```

**任务**:
- [ ] 部署有状态应用（如 PostgreSQL）
- [ ] 配置数据持久化
- [ ] 配置 Ingress 路由
- [ ] 理解 DNS 和服务发现

---

### Week 4: 高级特性

**目标**: 掌握生产级特性

```bash
# Helm 包管理
helm install
helm upgrade
helm rollback

# HPA 自动扩缩
kubectl autoscale deployment

# RBAC 权限
Role
RoleBinding
ServiceAccount
```

**任务**:
- [ ] 使用 Helm 部署应用
- [ ] 配置 HPA 自动扩缩容
- [ ] 配置服务账号和权限
- [ ] 配置监控（Prometheus + Grafana）

---

## 🐛 遇到问题？

### 集群起不来

1. **检查资源**
   ```bash
   # Docker Desktop
   # Settings → Resources → 至少 4GB 内存
   
   # Kind
   docker system df  # 检查磁盘空间
   ```

2. **重置集群**
   ```bash
   # Docker Desktop
   # Troubleshoot → Reset Kubernetes Cluster
   
   # Kind
   kind delete cluster --name agenthive
   kind create cluster --name agenthive
   ```

### Pod 起不来

```bash
# 查看 Pod 状态
kubectl describe pod <pod-name> -n agenthive

# 查看事件
kubectl get events -n agenthive --sort-by=.metadata.creationTimestamp

# 常见原因:
# - ImagePullBackOff: 镜像不存在
# - CrashLoopBackOff: 应用崩溃
# - Pending: 资源不足或 PVC 未绑定
```

### 无法访问服务

```bash
# 检查 Service
kubectl get svc -n agenthive

# 检查 Pod 是否 Ready
kubectl get pods -n agenthive

# 检查端口转发
kubectl port-forward svc/api 3001:3001 -n agenthive
```

---

## 📚 推荐学习资源

### 官方文档
- [Kubernetes 官方文档](https://kubernetes.io/docs/home/)
- [Kubernetes 中文文档](https://kubernetes.io/zh-cn/docs/home/)
- [Kind 文档](https://kind.sigs.k8s.io/)

### 交互式教程
- [Katacoda K8s 场景](https://www.katacoda.com/courses/kubernetes)
- [Play with Kubernetes](https://labs.play-with-k8s.com/)

### 视频教程
- [Bilibili K8s 入门](https://search.bilibili.com/all?keyword=kubernetes%E5%85%A5%E9%97%A8)

### 书籍
- 《Kubernetes in Action》
- 《深入剖析 Kubernetes》张磊

---

## ✅ 开始你的 K8s 之旅

选择你的方案，然后:

1. **Docker Desktop**: `start http://localhost`
2. **Kind**: `./scripts/setup-kind-cluster.sh`
3. **Kubeadm**: `cd ~/k8s-cluster && vagrant up`

部署完成后，你可以:
- 练习 kubectl 命令 ([参考卡片](./K8S-CHEATSHEET.md))
- 修改配置重新部署
- 探索更多 K8s 特性

**祝你学习愉快!** 🚀

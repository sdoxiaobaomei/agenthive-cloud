# AgentHive Cloud - Kubernetes 本地部署指南

本指南介绍如何在 Docker Desktop Kubernetes 上部署 AgentHive Cloud 进行本地开发和测试。

## 目录

- [环境要求](#环境要求)
- [快速开始](#快速开始)
- [部署选项](#部署选项)
- [访问应用](#访问应用)
- [日常开发工作流](#日常开发工作流)
- [故障排查](#故障排查)
- [架构说明](#架构说明)

---

## 环境要求

### 必需软件

| 软件 | 版本 | 用途 |
|------|------|------|
| Docker Desktop | 4.0+ | 容器运行时和 Kubernetes |
| kubectl | 1.28+ | Kubernetes CLI |
| (可选) Skaffold | 2.9+ | 快速迭代开发 |

### 验证环境

```bash
# 检查 Docker
docker version

# 检查 kubectl
kubectl version --client

# 检查 Kubernetes 集群
kubectl cluster-info

# 检查节点状态
kubectl get nodes
```

### 启用 Docker Desktop Kubernetes

1. 打开 Docker Desktop
2. 进入 **Settings** → **Kubernetes**
3. 勾选 **Enable Kubernetes**
4. 点击 **Apply & Restart**

---

## 快速开始

### 一键部署

```bash
# 进入项目目录
cd agenthive-cloud

# 执行部署脚本
./scripts/local-k8s.sh deploy
```

部署完成后，你将看到访问地址信息：

```
============================================
  Access Information
============================================

  Web UI:      http://localhost:30080
  API Direct:  http://localhost:30808
```

### Makefile 快捷命令

```bash
# 构建并部署到本地 K8s
make deploy

# 查看 K8s 状态
make k8s-status

# 查看日志
make k8s-logs

# 删除 K8s 资源
make k8s-delete
```

---

## 部署选项

### 选项 1: 脚本部署 (推荐)

使用提供的部署脚本，自动完成镜像构建和部署：

```bash
# 完整部署
./scripts/local-k8s.sh deploy

# 仅构建镜像
./scripts/local-k8s.sh build

# 查看状态
./scripts/local-k8s.sh status

# 查看日志
./scripts/local-k8s.sh logs

# 快速重载（修改代码后）
./scripts/local-k8s.sh reload

# 实时监控 Pod
./scripts/local-k8s.sh watch

# 启动端口转发
./scripts/local-k8s.sh port-forward

# 删除部署
./scripts/local-k8s.sh delete
```

### 选项 2: Kustomize 部署

```bash
# 直接应用配置
kubectl apply -k k8s/local/

# 等待就绪
kubectl wait --for=condition=ready pod -l app=agenthive-web -n agenthive-local --timeout=300s

# 删除
kubectl delete -k k8s/local/
```

### 选项 3: Skaffold (快速迭代)

适合频繁修改代码的开发场景：

```bash
# 启动开发模式（自动构建、部署、同步代码）
skaffold dev

# 仅运行一次部署
skaffold run

# 调试模式
skaffold debug
```

Skaffold 特性：
- 自动检测代码变更并重新构建
- 文件同步（无需重新构建容器）
- 自动端口转发到本地
- 聚合所有 Pod 日志

---

## 访问应用

### 方式 1: NodePort (默认)

部署后直接使用 NodePort 访问：

| 服务 | URL |
|------|-----|
| Web UI | http://localhost:30080 |
| API | http://localhost:30808 |

### 方式 2: Port-forward

适合临时访问或调试：

```bash
# 方式 A: 使用脚本
./scripts/local-k8s.sh port-forward

# 方式 B: 手动转发
kubectl port-forward svc/web 8080:80 -n agenthive-local &
kubectl port-forward svc/supervisor 8081:8080 -n agenthive-local &
```

访问地址：
- Web UI: http://localhost:8080
- API: http://localhost:8081

### 方式 3: Ingress (高级)

如果需要使用 Ingress，先安装 NGINX Ingress Controller：

```bash
# 安装 NGINX Ingress Controller
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/cloud/deploy.yaml

# 等待安装完成
kubectl wait --for=condition=ready pod -l app.kubernetes.io/component=controller -n ingress-nginx --timeout=120s

# 修改 k8s/local/ingress.yaml，取消 Ingress 配置的注释
# 重新部署
kubectl apply -k k8s/local/
```

添加 hosts 解析（可选）：

```bash
# Windows: 以管理员身份编辑 C:\Windows\System32\drivers\etc\hosts
# macOS/Linux: sudo vim /etc/hosts

127.0.0.1  agenthive.local
```

访问：http://agenthive.local

---

## 日常开发工作流

### 场景 1: 修改后端代码

```bash
# 1. 修改 apps/supervisor 下的代码

# 2. 快速重载
./scripts/local-k8s.sh reload

# 或使用 Skaffold 自动同步
skaffold dev
```

### 场景 2: 修改前端代码

```bash
# 使用 Skaffold 开发模式（自动同步）
skaffold dev

# 或直接修改后重载
./scripts/local-k8s.sh reload
```

### 场景 3: 查看日志

```bash
# 查看所有 Pod 日志
./scripts/local-k8s.sh logs

# 查看特定 Pod
kubectl logs -l app=agenthive-supervisor -n agenthive-local -f

# 查看之前的日志
kubectl logs -l app=agenthive-supervisor -n agenthive-local --previous
```

### 场景 4: 进入容器调试

```bash
# Supervisor
kubectl exec -it deployment/supervisor -n agenthive-local -- /bin/sh

# Web (Nginx)
kubectl exec -it deployment/web -n agenthive-local -- /bin/sh

# PostgreSQL
kubectl exec -it statefulset/postgres -n agenthive-local -- psql -U agenthive

# Redis
kubectl exec -it deployment/redis -n agenthive-local -- redis-cli -a redis_local_secret
```

---

## 故障排查

### 检查 Pod 状态

```bash
kubectl get pods -n agenthive-local

# 查看详细信息
kubectl describe pod <pod-name> -n agenthive-local
```

### 常见问题和解决

#### Pod 一直处于 Pending

```bash
# 检查事件
kubectl get events -n agenthive-local --sort-by='.lastTimestamp'

# 常见原因：
# 1. 资源不足：检查节点资源
kubectl describe nodes

# 2. PVC 未绑定：检查存储类
kubectl get pvc -n agenthive-local
```

#### ImagePullBackOff 错误

```bash
# 原因：镜像不存在或无法拉取
# 解决：确保镜像已构建且 imagePullPolicy 正确

# 检查本地镜像
docker images | grep agenthive

# 重新构建
./scripts/local-k8s.sh build
```

#### CrashLoopBackOff 错误

```bash
# 查看日志
kubectl logs <pod-name> -n agenthive-local --previous

# 常见原因：
# 1. 数据库连接失败 - 检查 postgres 和 redis 是否已启动
# 2. 配置错误 - 检查 ConfigMap 和 Secret
```

#### 无法访问应用

```bash
# 检查 Service
kubectl get svc -n agenthive-local

# 测试内部访问
kubectl run test --image=busybox -it --rm --restart=Never -n agenthive-local -- wget -O- http://web:80

# 检查 NodePort
kubectl get svc web-nodeport -n agenthive-local
```

### 重置环境

```bash
# 删除所有资源
./scripts/local-k8s.sh delete

# 或者强制删除命名空间
kubectl delete namespace agenthive-local

# 清理 Docker 镜像（可选）
docker rmi agenthive/supervisor:local agenthive/web:local
```

---

## 架构说明

### 本地部署架构

```
┌─────────────────────────────────────────────────────────────┐
│                     Docker Desktop K8s                       │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Namespace: agenthive-local                           │  │
│  │                                                       │  │
│  │   ┌──────────┐      ┌──────────┐      ┌──────────┐  │  │
│  │   │   Web    │◄────►│Supervisor│◄────►│ Postgres │  │  │
│  │   │  (Nginx) │      │   API    │      │  (StatefulSet)│  │
│  │   └────┬─────┘      └────┬─────┘      └──────────┘  │  │
│  │        │                 │                          │  │
│  │        └────────┬────────┘      ┌──────────┐        │  │
│  │                 │               │  Redis   │        │  │
│  │                 └──────────────►│   Cache  │        │  │
│  │                                 └──────────┘        │  │
│  │                                                       │  │
│  │   NodePort: 30080 (Web) / 30808 (API)                │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    http://localhost:30080
```

### 资源配置

本地部署使用了缩减的资源配置，适合开发机器：

| 组件 | CPU 请求 | CPU 限制 | 内存请求 | 内存限制 |
|------|---------|---------|---------|---------|
| Web | 50m | 100m | 64Mi | 128Mi |
| Supervisor | 100m | 250m | 128Mi | 256Mi |
| PostgreSQL | 100m | 250m | 128Mi | 256Mi |
| Redis | 50m | 100m | 64Mi | 128Mi |

### 存储配置

- **PostgreSQL**: 使用 `local-path` StorageClass，2GB 存储
- **Redis**: 使用 emptyDir（数据不持久化，重启丢失）

---

## 进阶配置

### 自定义域名

```bash
# 1. 修改 hosts 文件添加域名解析
127.0.0.1  agenthive.local
127.0.0.1  api.agenthive.local

# 2. 启用 Ingress 配置（取消 k8s/local/ingress.yaml 中的注释）

# 3. 安装 Ingress Controller
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/cloud/deploy.yaml

# 4. 重新部署
kubectl apply -k k8s/local/
```

### 使用自定义镜像仓库

```bash
# 构建并推送到私有仓库
docker build -t your-registry/agenthive/supervisor:latest apps/supervisor/
docker build -t your-registry/agenthive/web:latest apps/web/
docker push your-registry/agenthive/supervisor:latest
docker push your-registry/agenthive/web:latest

# 修改 k8s/local/kustomization.yaml
images:
  - name: agenthive/supervisor
    newName: your-registry/agenthive/supervisor
    newTag: latest
  - name: agenthive/web
    newName: your-registry/agenthive/web
    newTag: latest
```

### 多副本部署

```bash
# 扩展 Web 前端
kubectl scale deployment web --replicas=3 -n agenthive-local

# 扩展 API
kubectl scale deployment supervisor --replicas=3 -n agenthive-local

# 查看分布
kubectl get pods -n agenthive-local -o wide
```

---

## 参考链接

- [Docker Desktop K8s 文档](https://docs.docker.com/desktop/kubernetes/)
- [kubectl 参考](https://kubernetes.io/docs/reference/kubectl/)
- [Kustomize 文档](https://kustomize.io/)
- [Skaffold 文档](https://skaffold.dev/)

---

## 故障报告

如遇到问题，请收集以下信息：

```bash
# 环境信息
kubectl version
kubectl get nodes -o wide

# 部署状态
kubectl get all -n agenthive-local
kubectl get events -n agenthive-local --sort-by='.lastTimestamp'

# 日志
./scripts/local-k8s.sh logs
```

# AgentHive Cloud 本地部署验证清单

## 📋 概述

本文档提供 AgentHive Cloud 本地部署环境的完整验证清单，涵盖 Docker Desktop 和 Kubernetes 两种部署方式。

## 🚀 快速开始

### 一键测试

```bash
# 赋予执行权限
chmod +x scripts/test-local.sh

# 测试 Docker 环境
./scripts/test-local.sh docker

# 测试 K8s 环境
./scripts/test-local.sh k8s

# 详细输出模式
./scripts/test-local.sh docker -v

# 使用环境变量
TEST_MODE=docker SUPERVISOR_URL=http://localhost:8080 ./scripts/test-local.sh
```

---

## 🐳 Docker Desktop 环境验证

### 1. 前置条件检查

| 检查项 | 命令 | 预期结果 |
|--------|------|----------|
| Docker 安装 | `docker --version` | 显示版本号 (≥ 20.10) |
| Docker 运行 | `docker info` | 显示系统信息 |
| Docker Compose | `docker-compose --version` | 显示版本号 (≥ 1.29) |
| .env 文件 | `ls .env` | 文件存在 |

### 2. 配置文件验证

```bash
# 验证 compose 文件语法
docker-compose -f docker-compose.yml config

# 预期输出：无错误，显示完整配置
```

**检查点：**
- [ ] `docker-compose.yml` 语法正确
- [ ] `docker-compose.override.yml` 存在（开发模式）
- [ ] 环境变量文件 `.env` 已配置
- [ ] 所需镜像可拉取

### 3. 服务启动验证

```bash
# 启动核心服务
docker-compose up -d postgres redis supervisor web

# 查看服务状态
docker-compose ps
```

**期望状态：**

| 服务 | 容器名 | 状态 | 健康检查 |
|------|--------|------|----------|
| PostgreSQL | agenthive-postgres | Up | healthy |
| Redis | agenthive-redis | Up | healthy |
| Supervisor | agenthive-supervisor | Up | healthy |
| Web | agenthive-web | Up | healthy |

### 4. 网络与存储验证

```bash
# 检查网络
docker network ls | grep agenthive-network

# 检查卷
docker volume ls | grep agenthive

# 检查容器连通性
docker exec agenthive-supervisor ping -c 1 postgres
docker exec agenthive-supervisor ping -c 1 redis
```

**检查点：**
- [ ] `agenthive-network` 网络已创建
- [ ] 所有容器连接到同一网络
- [ ] 数据卷 `postgres_data`、`redis_data` 已创建

### 5. 服务健康检查

```bash
# PostgreSQL 健康检查
docker exec agenthive-postgres pg_isready -U agenthive

# Redis 健康检查
docker exec agenthive-redis redis-cli ping

# Supervisor 健康检查
curl http://localhost:8080/health

# Web 健康检查
curl http://localhost:80/health
```

**预期响应：**
- PostgreSQL: `accepting connections`
- Redis: `PONG`
- Supervisor: `{"status":"healthy"}`
- Web: HTTP 200

### 6. API 连通性测试

```bash
# 测试 API 端点
curl -s http://localhost:8080/health
curl -s http://localhost:8080/api/agents
curl -s http://localhost:8080/api/tasks
curl -s http://localhost:8080/api/sprints

# 带 HTTP 状态码
curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/api/agents
```

**预期结果：**

| 端点 | 方法 | 预期状态码 |
|------|------|-----------|
| /health | GET | 200 |
| /api/agents | GET | 200 |
| /api/tasks | GET | 200 |
| /api/sprints | GET | 200 |

### 7. 前端页面加载测试

```bash
# 测试页面可访问性
curl -s -o /dev/null -w "%{http_code}" http://localhost:80/
curl -s -o /dev/null -w "%{http_code}" http://localhost:80/login
curl -s -o /dev/null -w "%{http_code}" http://localhost:80/dashboard
```

**浏览器验证：**
- [ ] 首页 (http://localhost:80) 正常加载
- [ ] 登录页 (http://localhost:80/login) 正常加载
- [ ] Dashboard (http://localhost:80/dashboard) 正常加载
- [ ] 静态资源 (CSS/JS) 正确加载

### 8. WebSocket 连接测试

```bash
# 测试 WebSocket 端点
curl -i -N \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Host: localhost:8080" \
  http://localhost:8080/ws

# 预期返回 400 或 426，表示端点存在
```

---

## ☸️ Kubernetes 本地环境验证

### 1. 前置条件检查

| 检查项 | 命令 | 预期结果 |
|--------|------|----------|
| kubectl 安装 | `kubectl version --client` | 显示版本 |
| 集群连接 | `kubectl cluster-info` | 显示集群地址 |
| Kustomize | `kubectl kustomize --help` | 显示帮助 |
| Ingress Controller | `kubectl get pods -n ingress-nginx` | 运行中 |

### 2. 命名空间验证

```bash
# 检查命名空间
kubectl get namespace agenthive

# 检查标签
kubectl describe namespace agenthive
```

**检查点：**
- [ ] `agenthive` 命名空间存在
- [ ] 包含标签 `app.kubernetes.io/part-of: agenthive`

### 3. ConfigMap & Secret 验证

```bash
# ConfigMaps
kubectl get configmap agenthive-config -n agenthive -o yaml
kubectl get configmap agenthive-nginx-config -n agenthive -o yaml

# Secrets
kubectl get secret agenthive-secrets -n agenthive
```

**检查点：**
- [ ] `agenthive-config` ConfigMap 存在
- [ ] `agenthive-nginx-config` ConfigMap 存在
- [ ] `agenthive-secrets` Secret 存在

### 4. 数据库服务验证

```bash
# PostgreSQL
kubectl get deployment postgres -n agenthive
kubectl get service postgres -n agenthive
kubectl get pods -n agenthive -l app=postgres

# Redis
kubectl get deployment redis -n agenthive
kubectl get service redis -n agenthive
kubectl get pods -n agenthive -l app=redis
```

**预期状态：**
- [ ] PostgreSQL Deployment: Ready 1/1
- [ ] PostgreSQL Service: ClusterIP 可用
- [ ] Redis Deployment: Ready 1/1
- [ ] Redis Service: ClusterIP 可用

### 5. 应用部署验证

```bash
# Supervisor
kubectl get deployment supervisor -n agenthive
kubectl get service supervisor -n agenthive
kubectl get pods -n agenthive -l app=agenthive-supervisor

# Web
kubectl get deployment web -n agenthive
kubectl get service web -n agenthive
kubectl get pods -n agenthive -l app=agenthive-web
```

**检查点：**

| 组件 | Replicas | Ready | 状态 |
|------|----------|-------|------|
| supervisor | 2 | 2/2 | Available |
| web | 2 | 2/2 | Available |

### 6. 自动扩缩容验证

```bash
# 检查 HPA
kubectl get hpa -n agenthive

# 详细状态
kubectl describe hpa supervisor-hpa -n agenthive
kubectl describe hpa web-hpa -n agenthive
```

**预期配置：**

| HPA | Min | Max | CPU Target |
|-----|-----|-----|------------|
| supervisor-hpa | 2 | 10 | 70% |
| web-hpa | 2 | 5 | 70% |

### 7. Ingress 验证

```bash
# 检查 Ingress
kubectl get ingress -n agenthive

# 检查 Ingress Controller
kubectl get pods -n ingress-nginx -l app.kubernetes.io/name=ingress-nginx

# 本地 hosts 配置
echo "127.0.0.1 agenthive.local" | sudo tee -a /etc/hosts
```

**检查点：**
- [ ] `agenthive-ingress` 或 `agenthive-ingress-http` 存在
- [ ] Ingress Controller Pod 运行中
- [ ] 本地 hosts 配置正确

**路由规则验证：**

| 路径 | 后端服务 | 端口 |
|------|----------|------|
| / | web | 80 |
| /api/* | supervisor | 8080 |
| /ws | supervisor | 8080 |

### 8. 端口转发测试（本地访问）

```bash
# Supervisor 端口转发
kubectl port-forward -n agenthive svc/supervisor 8080:8080 &

# Web 端口转发
kubectl port-forward -n agenthive svc/web 8081:80 &

# 或使用 Ingress
kubectl port-forward -n ingress-nginx svc/ingress-nginx-controller 8080:80 &
```

### 9. 健康检查验证

```bash
# 通过端口转发测试
curl http://localhost:8080/health

# 或通过 Ingress
curl http://agenthive.local/health
```

**检查点：**
- [ ] Liveness Probe 配置正确
- [ ] Readiness Probe 配置正确
- [ ] 健康检查端点响应正常

---

## 🔧 问题排查指南

### Docker 常见问题

#### 1. 容器无法启动

```bash
# 查看日志
docker logs agenthive-supervisor
docker logs agenthive-web

# 检查资源限制
docker stats --no-stream
```

**可能原因：**
- 端口被占用（5432, 6379, 8080, 80）
- 内存不足
- 环境变量缺失

#### 2. 服务间无法通信

```bash
# 检查网络连接
docker network inspect agenthive-network

# 测试连通性
docker exec agenthive-supervisor nc -zv postgres 5432
docker exec agenthive-supervisor nc -zv redis 6379
```

#### 3. 数据库连接失败

```bash
# 检查 PostgreSQL 状态
docker exec agenthive-postgres pg_isready -U agenthive

# 查看连接数
docker exec agenthive-postgres psql -U agenthive -c "SELECT count(*) FROM pg_stat_activity;"
```

### K8s 常见问题

#### 1. Pod 无法启动

```bash
# 查看 Pod 状态
kubectl describe pod -n agenthive -l app=agenthive-supervisor

# 查看事件
kubectl get events -n agenthive --sort-by=.lastTimestamp

# 查看日志
kubectl logs -n agenthive -l app=agenthive-supervisor --previous
```

**常见原因：**
- 镜像拉取失败
- 资源不足（CPU/内存）
- 健康检查失败
- ConfigMap/Secret 缺失

#### 2. Service 无法访问

```bash
# 检查 Service 端点
kubectl get endpoints -n agenthive

# 测试 Service 连通性
kubectl run -it --rm debug --image=busybox -n agenthive --restart=Never -- wget -O- http://supervisor:8080/health
```

#### 3. Ingress 不工作

```bash
# 检查 Ingress 配置
kubectl describe ingress agenthive-ingress -n agenthive

# 检查 Ingress Controller 日志
kubectl logs -n ingress-nginx -l app.kubernetes.io/name=ingress-nginx

# 检查路径重写
curl -v http://agenthive.local/api/health
```

#### 4. HPA 不工作

```bash
# 检查 HPA 状态
kubectl describe hpa supervisor-hpa -n agenthive

# 检查 metrics-server
kubectl get pods -n kube-system | grep metrics-server
```

**注意：** 本地 K8s 集群（如 kind、minikube）可能需要单独安装 metrics-server。

### 网络问题排查

```bash
# 检查端口占用
lsof -i :8080
lsof -i :5432
lsof -i :6379

# 检查防火墙
sudo iptables -L -n | grep 8080

# DNS 检查
nslookup agenthive.local
```

### 性能问题排查

```bash
# Docker 资源使用
docker stats --no-stream

# K8s 资源使用
kubectl top nodes
kubectl top pods -n agenthive

# API 响应时间测试
time curl -s http://localhost:8080/health > /dev/null
```

---

## 📊 测试报告模板

### 测试环境信息

```yaml
测试日期: YYYY-MM-DD
测试人员: [姓名]
测试模式: [docker|k8s]

环境信息:
  OS: [Windows|macOS|Linux] [版本]
  Docker: [版本]
  Docker Compose: [版本]
  Kubectl: [版本]
  K8s Cluster: [kind|minikube|docker-desktop|其他]
```

### 测试结果汇总

| 测试类别 | 通过 | 失败 | 跳过 | 备注 |
|----------|------|------|------|------|
| 前置条件检查 | | | | |
| 配置验证 | | | | |
| 服务启动 | | | | |
| 健康检查 | | | | |
| API 连通性 | | | | |
| 前端页面 | | | | |
| WebSocket | | | | |
| 数据库连接 | | | | |
| 性能测试 | | | | |

### 问题记录

| ID | 问题描述 | 严重程度 | 状态 | 解决方案 |
|----|----------|----------|------|----------|
| 1 | | | | |
| 2 | | | | |

---

## 📝 附录

### 常用命令速查

```bash
# Docker
# 查看日志
docker-compose logs -f [service]

# 重启服务
docker-compose restart [service]

# 重建并启动
docker-compose up -d --build [service]

# K8s
# 查看 Pod 日志
kubectl logs -f -n agenthive -l app=agenthive-supervisor

# 进入 Pod 调试
kubectl exec -it -n agenthive deployment/supervisor -- /bin/sh

# 重新部署
kubectl rollout restart deployment/supervisor -n agenthive

# 查看 rollout 状态
kubectl rollout status deployment/supervisor -n agenthive
```

### 资源限制参考

| 服务 | CPU Request | CPU Limit | Memory Request | Memory Limit |
|------|-------------|-----------|----------------|--------------|
| supervisor | 250m | 500m | 256Mi | 512Mi |
| web | 100m | 200m | 128Mi | 256Mi |
| postgres | 250m | 500m | 256Mi | 512Mi |
| redis | 100m | 200m | 128Mi | 256Mi |

---

*最后更新：2024年*

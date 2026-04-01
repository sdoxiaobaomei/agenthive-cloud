# AgentHive Cloud - Kubernetes 快速入门

5 分钟内在 Docker Desktop Kubernetes 上运行 AgentHive Cloud。

## 前置要求

- Docker Desktop 4.0+ (已启用 Kubernetes)
- kubectl 1.28+

## 3 步部署

### 1. 验证环境

```bash
cd agenthive-cloud
./scripts/verify-k8s.sh
```

### 2. 一键部署

```bash
./scripts/local-k8s.sh deploy
```

或：

```bash
make k8s-local-deploy
```

### 3. 访问应用

```
Web UI: http://localhost:30080
API:    http://localhost:30808
```

## 常用命令

```bash
# 查看状态
./scripts/local-k8s.sh status
make k8s-local-status

# 查看日志
./scripts/local-k8s.sh logs
make k8s-local-logs

# 修改代码后快速重载
./scripts/local-k8s.sh reload
make k8s-local-reload

# 端口转发到本地
./scripts/local-k8s.sh port-forward
make k8s-local-port-forward

# 删除部署
./scripts/local-k8s.sh delete
make k8s-local-delete
```

## 快速迭代 (Skaffold)

```bash
# 安装 Skaffold: https://skaffold.dev/docs/install/

# 启动开发模式（自动重建、热重载）
skaffold dev

# 访问
# Web UI: http://localhost:8080
# API: http://localhost:8081
```

## 测试部署

```bash
./scripts/test-deployment.sh
```

## 故障排查

```bash
# Pod 状态
kubectl get pods -n agenthive-local

# 查看日志
kubectl logs -l app=agenthive-supervisor -n agenthive-local

# 进入容器
kubectl exec -it deployment/supervisor -n agenthive-local -- /bin/sh
```

## 下一步

- 完整文档: [k8s-local-setup.md](../k8s-local-setup.md)
- 添加域名解析: [安装 Ingress Controller](../k8s-local-setup.md#方式-3-ingress-高级)

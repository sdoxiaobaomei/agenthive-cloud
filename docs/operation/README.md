# 🔧 运维操作文档

> 日常运维、故障排查和维护指南

---

## 🚀 日常运维

### 查看服务状态

```bash
# Docker Compose
docker-compose ps
docker-compose logs -f api

# Kubernetes
kubectl get pods -n agenthive
kubectl logs -f deployment/api -n agenthive
```

### 重启服务

```bash
# Docker Compose
docker-compose restart api

# Kubernetes
kubectl rollout restart deployment/api -n agenthive
```

### 进入容器

```bash
# Docker
docker exec -it <container_id> sh

# Kubernetes
kubectl exec -it deployment/api -n agenthive -- sh
```

---

## 📚 运维文档

### 网络相关

| 文档 | 说明 |
|------|------|
| [Docker Desktop 网络详解](../DOCKER-DESKTOP-NETWORK-EXPLAINED.md) | 端口映射原理 |
| [Docker Desktop 进程隔离](../DOCKER-DESKTOP-PROCESS-ISOLATION.md) | 进程管理 |

### 故障排查

| 文档 | 说明 |
|------|------|
| [运维排查指南](./troubleshooting.md) | 常见问题 FAQ |
| [快速参考](../reference/quick-reference.md) | 常用命令 |

---

## 🆘 常见问题和解决方案

### Docker 问题

#### 问题: ImagePullBackOff

```bash
# 原因: 镜像拉取失败
# 解决:
1. 检查镜像是否存在: docker images
2. 检查镜像名称和标签
3. 设置 imagePullPolicy: Never（本地镜像）
```

#### 问题: 端口冲突

```bash
# 原因: 端口被占用
# 解决:
1. 查看占用: lsof -i :3001
2. 停止占用进程
3. 或修改端口映射
```

### K8s 问题

#### 问题: Pod 状态 Pending

```bash
# 原因: 资源不足或 PVC 未绑定
# 解决:
kubectl describe pod <pod-name> -n agenthive
# 查看 Events 部分的错误信息
```

#### 问题: 无法访问服务

```bash
# 原因: Service 或 Ingress 配置错误
# 解决:
1. 检查 Service: kubectl get svc -n agenthive
2. 检查 Endpoints: kubectl get endpoints -n agenthive
3. 检查 Ingress: kubectl get ingress -n agenthive
```

### 应用问题

#### 问题: API 无法连接数据库

```bash
# 原因: 数据库未启动或配置错误
# 解决:
1. 检查 Postgres Pod: kubectl get pods -n agenthive
2. 检查连接字符串
3. 检查 Secret 配置
```

---

## 📖 相关文档

- [K8s 速查表](../reference/k8s-cheatsheet.md)
- [Docker 速查表](../reference/docker-cheatsheet.md)
- [快速参考](../reference/quick-reference.md)

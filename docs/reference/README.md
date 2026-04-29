# 📖 参考手册

> 速查表、命令参考和最佳实践

---

## 🚀 快速导航

| 需求 | 文档 |
|------|------|
| **K8s 命令** | [K8s 速查表](../archive/K8S-CHEATSHEET.md) |
| **Docker 命令** | [Docker 速查表](../archive/git-cheatsheet.md) |
| **Git 命令** | [Git 速查表](../archive/git-cheatsheet.md) |
| **常用命令** | [快速参考](./quick-reference.md) |

---

## 📚 速查表

### Kubernetes

```bash
# Pod 管理
kubectl get pods -n agenthive
kubectl logs -f deployment/api -n agenthive
kubectl exec -it deployment/api -n agenthive -- sh

# 部署管理
kubectl rollout restart deployment/api -n agenthive
kubectl scale deployment/api --replicas=3 -n agenthive
```

[完整 K8s 速查表 →](../archive/K8S-CHEATSHEET.md)

### Docker

```bash
# 容器管理
docker ps
docker logs -f container_id
docker exec -it container_id sh

# 镜像管理
docker build -t myapp:latest .
docker run -p 80:80 myapp:latest
```

[完整 Docker 速查表 →](../archive/git-cheatsheet.md)

### Git

```bash
# 日常操作
git add -A
git commit -m "message"
git push origin main

# 分支管理
git checkout -b feature/T-001
git merge feature/T-001
```

[完整 Git 速查表 →](../archive/git-cheatsheet.md)

---

## 📋 最佳实践

### Docker 构建

```dockerfile
# ✅ 多阶段构建
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
CMD ["node", "dist/index.js"]
```

### K8s 配置

```yaml
# ✅ 资源限制
resources:
  requests:
    memory: "256Mi"
    cpu: "250m"
  limits:
    memory: "512Mi"
    cpu: "500m"

# ✅ 健康检查
livenessProbe:
  httpGet:
    path: /health
    port: 3001
```

---

## 📖 其他参考

| 文档 | 说明 |
|------|------|
| [快速参考](./quick-reference.md) | 打印版参考卡片 |
| [系统架构总览](../ARCHITECTURE.md) | 架构设计速览 |
| [Workspace 管理](../development/workspace-management.md) | 工作区管理 |

---

## 🔗 外部资源

- [Kubernetes 官方文档](https://kubernetes.io/docs/)
- [Docker 官方文档](https://docs.docker.com/)
- [Node.js 最佳实践](https://nodejs.org/en/docs/)

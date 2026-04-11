# 📖 参考手册

> 速查表、命令参考和最佳实践

---

## 🚀 快速导航

| 需求 | 文档 |
|------|------|
| **K8s 命令** | [K8s 速查表](./k8s-cheatsheet.md) |
| **Docker 命令** | [Docker 速查表](./docker-cheatsheet.md) |
| **Git 命令** | [Git 速查表](./git-cheatsheet.md) |
| **常用命令** | [快速参考](./quick-reference.md) |
| **经验教训** | [踩坑记录](./lessons-learned.md) |

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

[完整 K8s 速查表 →](./k8s-cheatsheet.md)

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

[完整 Docker 速查表 →](./docker-cheatsheet.md)

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

[完整 Git 速查表 →](./git-cheatsheet.md)

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

## 🎓 经验教训

### Docker 相关

| 问题 | 解决方案 |
|------|---------|
| Vite 在 Docker 中崩溃 | 使用本地开发，Nginx 代理 |
| Windows 路径问题 | 配置 `location ~ ^/_nuxt/@fs/` |
| 镜像过大 | 多阶段构建 + .dockerignore |

### K8s 相关

| 问题 | 解决方案 |
|------|---------|
| ImagePullBackOff | 检查镜像地址和拉取策略 |
| Pending | 检查资源和 PVC |
| 无法访问 | 检查 Service 和 Ingress |

[完整踩坑记录 →](./lessons-learned.md)

---

## 📖 其他参考

| 文档 | 说明 |
|------|------|
| [快速参考](./quick-reference.md) | 打印版参考卡片 |
| [经验教训](./lessons-learned.md) | 项目踩坑记录 |
| [Workspace 管理](../workspace-management.md) | 工作区管理 |

---

## 🔗 外部资源

- [Kubernetes 官方文档](https://kubernetes.io/docs/)
- [Docker 官方文档](https://docs.docker.com/)
- [Node.js 最佳实践](https://nodejs.org/en/docs/)

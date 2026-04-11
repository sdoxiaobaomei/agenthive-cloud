# 🔰 入门指南

> 新成员快速上手指南

---

## 🎯 快速开始路径

### 1. 环境搭建（15分钟）

```bash
# 1. 安装 Docker Desktop
# https://www.docker.com/products/docker-desktop

# 2. 启用 Kubernetes
# Docker Desktop → Settings → Kubernetes → Enable

# 3. 验证安装
kubectl version
```

### 2. 项目克隆和启动（10分钟）

```bash
# 克隆项目
git clone <repo-url>
cd ai-digital-twin

# 启动服务
cd agenthive-cloud
docker-compose -f docker-compose.local.yml up -d

# 验证
open http://localhost
```

---

## 📚 指南列表

### 环境搭建

| 指南 | 说明 | 预计时间 |
|------|------|---------|
| [开发环境完整搭建](./development-setup.md) | Windows/Mac/Linux 环境配置 | 30分钟 |
| [Docker Desktop 配置](./docker-desktop-setup.md) | Windows 专用配置指南 | 15分钟 |
| [K8s 本地集群搭建](./local-k8s-setup.md) | Kind/Kubeadm/Docker Desktop K8s | 20分钟 |

### 开发工作流

| 指南 | 说明 |
|------|------|
| [Git 工作流](./git-workflow.md) | 分支策略、提交规范 |
| [代码审查指南](./code-review.md) | PR 流程、审查清单 |
| [Debug 技巧](./debugging.md) | 常见问题排查 |

### 部署操作

| 指南 | 说明 |
|------|------|
| [Docker 部署](./../deployment/docker-deployment.md) | 本地 Docker Compose |
| [K8s 部署](./../deployment/k8s-deployment.md) | 生产环境 K8s |
| [CI/CD 流程](./../deployment/ci-cd.md) | 自动化部署 |

---

## 🆘 常见问题

### Q: Windows 上 Docker 启动失败？
A: 参考 [Docker Desktop Windows 指南](../archive/K8S-WINDOWS-GUIDE.md)

### Q: 端口冲突？
A: 检查 80, 3001, 5432, 6379 端口占用情况

### Q: 镜像构建失败？
A: 参考 [CI 构建优化](../CI-BUILD-OPTIMIZATION.md)

---

**下一步**: [开发文档](../development/README.md)

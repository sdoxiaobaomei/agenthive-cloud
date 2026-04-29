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
docker compose -f docker-compose.dev.yml --env-file .env.dev up -d

# 验证
open http://localhost
```

---

## 📚 指南列表

### 环境搭建

| 指南 | 说明 | 预计时间 |
|------|------|---------|
| [WSL2 网络配置](./WSL2-NETWORK-SETUP.md) | Windows WSL2 网络环境配置 | 15分钟 |
| [Docker 镜像加速配置](../deployment/docker/DOCKER-MIRROR-SETUP.md) | 国内 Docker 镜像源配置 | 10分钟 |

### 开发工作流

| 指南 | 说明 |
|------|------|
| [开发文档](../development/README.md) | 开发规范、API 文档、前端指南 |
| [系统架构总览](../ARCHITECTURE.md) | 了解整体系统设计 |

### 部署操作

| 指南 | 说明 |
|------|------|
| [部署文档](../deployment/README.md) | Docker / K8s / 混合部署入口 |
| [K8s 部署指南](../deployment/k8s-deployment.md) | 生产环境 K8s 部署 |
| [CI/CD 使用指南](../deployment/ci-cd/CI-CD-USAGE.md) | 自动化部署 |

---

## 🆘 常见问题

### Q: Windows 上 Docker 启动失败？
A: 参考 [WSL2 网络配置](./WSL2-NETWORK-SETUP.md) 和 [Docker 镜像加速配置](../deployment/docker/DOCKER-MIRROR-SETUP.md)

### Q: 端口冲突？
A: 检查 80, 3001, 5432, 6379 端口占用情况

### Q: 镜像构建失败？
A: 参考 [CI 构建优化](../deployment/ci-cd/CI-BUILD-OPTIMIZATION.md)

---

**下一步**: [开发文档](../development/README.md)

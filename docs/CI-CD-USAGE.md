# CI/CD 使用指南

> ⚠️ **部分信息需验证更新** (最后检查: 2026-04-22)
>
> 本文档引用的部分脚本和配置可能已过时，未经过近期实际运行验证。
> 特别是镜像仓库已迁移到阿里云 ACR，文档中的 GHCR 和 ECR 示例需更新。
>
> ---
>
> **原标注**:
> 完整的从 Git Clone 到 Docker 镜像构建的指南

---

## 📦 提供的脚本

| 脚本 | 用途 | 位置 |
|------|------|------|
| `build-docker-images.ps1` | **简单构建 Docker 镜像** | `scripts/` |
| `ci-build-deploy.ps1` | **完整 CI/CD 流程** | `scripts/` |
| `build-and-deploy.yml` | **GitHub Actions** | `.github/workflows/` |

---

## 🚀 快速开始

### 方式 1：本地构建 Docker 镜像（最简单）

```powershell
# 进入项目目录
cd ai-digital-twin

# 执行构建脚本
.\scripts\build-docker-images.ps1

# 构建完成后的输出：
# ========================================
#   Build Complete!
# ========================================
# Images:
#   API:     agenthive-api:abc1234
#   Landing: agenthive-landing:abc1234
```

#### 带参数使用

```powershell
# 指定镜像仓库（用于推送）
.\scripts\build-docker-images.ps1 -Registry "registry.cn-hangzhou.aliyuncs.com/myrepo"

# 指定标签
.\scripts\build-docker-images.ps1 -Tag "v1.0.0"

# 构建并推送到仓库
.\scripts\build-docker-images.ps1 -Registry "my-registry.com" -Push

# 组合使用
.\scripts\build-docker-images.ps1 -Registry "my-registry.com" -Tag "v1.0.0" -Push
```

---

### 方式 2：完整 CI/CD 流程

```powershell
# 执行完整流程（从 git clone 到部署）
.\scripts\ci-build-deploy.ps1

# 启用 K8s 部署
.\scripts\ci-build-deploy.ps1 -DeployToK8s

# 指定镜像仓库
.\scripts\ci-build-deploy.ps1 -Registry "my-registry.com"

# 推送镜像
.\scripts\ci-build-deploy.ps1 -PushImage

# 跳过测试
.\scripts\ci-build-deploy.ps1 -SkipTests
```

#### 完整流程步骤

```
1. Git Clone          → 克隆代码
2. Install Deps       → 安装依赖
3. Lint Check         → 代码检查
4. Run Tests          → 运行测试
5. Build Apps         → 构建应用
6. Build Docker       → 构建镜像 ⭐
7. Push Images        → 推送镜像
8. Deploy to K8s      → 部署到 K8s
```

---

### 方式 3：GitHub Actions

#### 自动触发

推送代码到 `main` 分支时自动触发：

```yaml
# .github/workflows/build-and-deploy.yml
on:
  push:
    branches: [main]
    paths:
      - 'agenthive-cloud/**'
```

#### GitHub Actions 流程

```
1. Checkout          → 检出代码
2. Setup Node.js     → 配置 Node
3. Setup pnpm        → 配置 pnpm
4. Cache deps        → 缓存依赖
5. Install deps      → 安装依赖
6. Type check        → 类型检查
7. Build apps        → 构建应用
8. Setup Docker      → 配置 Docker
9. Login Registry    → 登录仓库
10. Build API image  → 构建 API 镜像 ⭐
11. Build Landing    → 构建 Landing 镜像 ⭐
12. Push images      → 推送镜像
13. Deploy (可选)    → 部署到 K8s
```

#### 配置 Secrets

在 GitHub 仓库 Settings → Secrets → Actions 中设置：

| Secret | 说明 |
|--------|------|
| `GITHUB_TOKEN` | 自动提供，用于推送镜像到 GHCR |
| `KUBECONFIG` | （可选）base64 编码的 kubeconfig，用于部署 |

---

## 🔧 配置说明

### 1. 修改镜像仓库地址

#### PowerShell 脚本

```powershell
# scripts/build-docker-images.ps1 中修改默认值
param(
    [string]$Registry = "your-registry.com/project",  # 修改这里
    ...
)
```

#### GitHub Actions

```yaml
# .github/workflows/build-and-deploy.yml
env:
  REGISTRY: your-registry.com/project  # 修改这里
```

### 2. 配置阿里云 ACR

```powershell
# 登录阿里云
docker login --username=your-username registry.cn-hangzhou.aliyuncs.com

# 构建并推送
.\scripts\build-docker-images.ps1 `
    -Registry "registry.cn-hangzhou.aliyuncs.com/your-namespace" `
    -Push
```

### 3. 配置 AWS ECR

```powershell
# 登录 AWS
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin your-account.dkr.ecr.us-east-1.amazonaws.com

# 构建并推送
.\scripts\build-docker-images.ps1 `
    -Registry "your-account.dkr.ecr.us-east-1.amazonaws.com/your-repo" `
    -Push
```

---

## 📋 Dockerfile 要求

确保以下 Dockerfile 存在：

```
agenthive-cloud/
├── apps/
│   ├── api/
│   │   └── Dockerfile.minimal      ← API Dockerfile
│   └── landing/
│       └── Dockerfile.minimal      ← Landing Dockerfile
```

如果没有 `Dockerfile.minimal`，脚本会自动尝试：
1. `Dockerfile.ci`
2. `Dockerfile.prod`

---

## 🎯 常用命令

### 本地测试镜像

```powershell
# 运行 API
docker run -p 3001:3001 agenthive-api:latest

# 运行 Landing
docker run -p 80:80 agenthive-landing:latest

# 查看镜像
docker images | findstr agenthive

# 删除镜像
docker rmi agenthive-api:latest agenthive-landing:latest
```

### 推送到仓库

```powershell
# 手动推送
docker push registry.cn-hangzhou.aliyuncs.com/myrepo/agenthive-api:latest
docker push registry.cn-hangzhou.aliyuncs.com/myrepo/agenthive-landing:latest
```

---

## 🐛 故障排查

### 问题 1: "Docker 未运行"

```powershell
# 启动 Docker Desktop 后再执行脚本
```

### 问题 2: "pnpm 未找到"

```powershell
# 安装 pnpm
npm install -g pnpm
```

### 问题 3: 构建失败

```powershell
# 检查 Dockerfile 路径是否正确
# 检查 agenthive-cloud 目录是否存在
```

### 问题 4: 推送失败

```powershell
# 先登录镜像仓库
docker login your-registry.com
```

---

## 📊 CI/CD 流程图

```
┌─────────────────────────────────────────────────────────────┐
│                      本地开发                                 │
│  修改代码 → 测试 → Git Commit → Git Push                      │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    GitHub Actions                             │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │ Checkout│→ │Install  │→ │  Build  │→ │ Docker  │        │
│  │  Code   │  │  Deps   │  │  Apps   │  │  Build  │        │
│  └─────────┘  └─────────┘  └─────────┘  └────┬────┘        │
│                                               │             │
│                                               ▼             │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │  K8s    │← │  Push   │← │  Login  │← │  Tag    │        │
│  │ Deploy  │  │ Images  │  │Registry │  │ Images  │        │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘        │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    Kubernetes Cluster                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │     API     │  │   Landing   │  │  Postgres   │         │
│  │   Pod x2    │  │   Pod x2    │  │   Stateful  │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔗 相关文档

- [CI 构建优化](./CI-BUILD-OPTIMIZATION.md)
- [Docker 多阶段构建](./DOCKER-NPM-INSTALL-EXPLAINED.md)
- [K8s 部署指南](./deployment/k8s-deployment.md)

---

**需要修改配置？** 编辑 `scripts/build-docker-images.ps1` 或 `.github/workflows/build-and-deploy.yml`

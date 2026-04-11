# 项目迁移说明

## 迁移概览

项目已成功从 `ai-digital-twin/agenthive-cloud` 结构迁移到独立的 `agenthive-cloud` 目录。

## 新目录结构

```
E:\Git\agenthive-cloud/
├── apps/                      # 核心应用代码（原 agenthive-cloud/）
│   ├── apps/
│   │   ├── landing/           # Nuxt 3 前端
│   │   ├── api/               # Express API
│   │   └── agent-runtime/     # Agent 运行时
│   ├── packages/              # 共享包
│   └── docs/                  # 应用文档
├── AGENTS/                    # 多 Agent 开发系统
├── packages/                  # monorepo 共享包
│   ├── cli/                   # CLI 工具
│   ├── types/                 # 共享类型
│   ├── ui/                    # UI 组件库
│   └── workflow-engine/       # 工作流引擎
├── scripts/                   # 构建和部署脚本
├── nginx/                     # Nginx 配置
├── k8s/                       # Kubernetes 配置
├── docs/                      # 项目文档
├── docker-compose.yml         # Docker 配置
├── docker-compose.local.yml   # 本地开发配置
├── docker-compose.full.yml    # 完整配置
└── .env.example               # 环境变量示例
```

## 路径变更汇总

### 1. Docker Compose
- 原: `context: ./agenthive-cloud`
- 新: `context: ./apps`

- 原: `./agenthive-cloud/apps/api:/app`
- 新: `./apps/apps/api:/app`

### 2. AGENTS 系统
- 原: `TARGET_REPO=../agenthive-cloud`
- 新: `TARGET_REPO=./apps`

### 3. Scripts
- 原: `agenthive-cloud/apps/...`
- 新: `apps/apps/...`

### 4. Packages
- 原: `path.join(ROOT, 'agenthive-cloud')`
- 新: `path.join(ROOT, 'apps')`

## 使用说明

### 启动开发环境

```powershell
# 进入新目录
cd E:\Git\agenthive-cloud

# 启动 Docker 服务
docker-compose -f docker-compose.local.yml up -d

# 或使用本地开发
 cd apps/apps/landing && npm run dev
```

### AGENTS 系统使用

```powershell
cd E:\Git\agenthive-cloud\AGENTS

# 配置 TARGET_REPO（已默认配置好）
# .env 文件中 TARGET_REPO=./apps

# 运行 Agent
npx tsx orchestrator.ts "你的需求"
```

### 构建镜像

```powershell
cd E:\Git\agenthive-cloud

# PowerShell
.\scripts\build-docker-images.ps1

# Bash
./scripts/build-and-push.sh
```

## 注意事项

1. **旧目录残留**: 原 `ai-digital-twin` 目录中可能还有 Git 历史、IDE 配置等文件，如需可手动删除
2. **环境变量**: 需要重新复制 `.env.example` 到 `.env` 并根据需要调整
3. **Node Modules**: 需要在新路径下重新安装依赖
4. **Git 历史**: 如需保留完整的 Git 提交历史，需要从原目录复制 `.git` 文件夹

## 已知问题

- `apps/apps/` 双重目录结构是因为原 `agenthive-cloud` 内部有 `apps/` 目录
- 如需简化，可考虑将 `apps/apps/*` 移动到 `apps/` 根目录（需要更新更多路径引用）

## 迁移完成时间

2026-04-08

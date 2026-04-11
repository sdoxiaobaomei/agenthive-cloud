# AgentHive Cloud - AI 数字孪生平台

> 🐝 **Hive Mode (蜂群模式)**: 多 Agent 协作的 AI 驱动开发系统

## 项目概述

AgentHive Cloud 是一个 AI 数字孪生平台，采用多 Agent 协作架构（称为"蜂群模式"），模拟软件开发团队的协作方式。

## 📁 项目结构

```
agenthive-cloud/              # 项目根目录
├── apps/                     # 核心应用代码
│   ├── apps/
│   │   ├── landing/          # Nuxt 3 营销官网
│   │   ├── api/              # Express API 服务
│   │   └── agent-runtime/    # Agent 运行时服务
│   ├── packages/             # 共享包
│   └── docs/                 # 应用文档
│
├── AGENTS/                   # Multi-Agent 开发系统
│   ├── orchestrator.ts       # 阿黄 - 任务调度器 (Tech Lead)
│   ├── workers/              # Worker Agents
│   └── tools/                # Agent 工具集
│
├── packages/                 # monorepo 共享包
│   ├── cli/                  # CLI 工具
│   ├── types/                # 共享类型定义
│   ├── ui/                   # UI 组件库
│   └── workflow-engine/      # 工作流引擎
│
├── scripts/                  # 自动化脚本
├── nginx/                    # Nginx 配置
├── k8s/                      # Kubernetes 配置
├── docs/                     # 项目文档
└── docker-compose*.yml       # Docker 配置
```

## 🚀 快速开始

### 环境要求

- Node.js 20+
- Docker & Docker Compose
- pnpm (推荐) 或 npm

### 安装依赖

```bash
cd apps
pnpm install
```

### 启动开发环境

**方式 1: Docker Compose（推荐）**

```bash
# 本地开发模式（使用宿主机 Ollama）
docker-compose -f docker-compose.local.yml up -d

# 完整模式
docker-compose -f docker-compose.full.yml up -d
```

**方式 2: 本地开发**

```bash
# 终端 1 - Landing
cd apps/apps/landing && npm run dev

# 终端 2 - API
cd apps/apps/api && npm run dev
```

### AGENTS 系统使用

```bash
cd AGENTS

# 创建 .env 文件
cp .env.example .env
# 编辑 .env，填入你的 LLM API Key

# 运行 Agent
npx tsx orchestrator.ts "给 Dashboard 增加导出功能"

# 恢复任务
npx tsx orchestrator.ts --resume T001
```

## 🏗️ 技术栈

### 前端
| 应用 | 框架 | 技术细节 |
|------|------|----------|
| **Landing** | Nuxt 3 | Vue 3 + TypeScript + Element Plus + Tailwind CSS |

### 后端
| 服务 | 运行时 | 技术细节 |
|------|--------|----------|
| **API** | Node.js + Express | TypeScript + REST API + JWT 认证 |
| **Agent Runtime** | Node.js | WebSocket + Zod 验证 + LLM 集成 |

### 基础设施
- **容器化**: Docker + Kubernetes
- **数据库**: PostgreSQL + Redis
- **反向代理**: Nginx

## 📚 相关文档

- [AGENTS.md](./AGENTS.md) - Multi-Agent 系统说明
- [WORKFLOW.md](./WORKFLOW.md) - 工作流指南
- [MIGRATION-NOTES.md](./MIGRATION-NOTES.md) - 迁移说明

## 📝 项目历史

本项目已从 `ai-digital-twin` 整合为独立的 `agenthive-cloud` 项目。

---

> **Hive Mode**: *Many minds, one goal.* 🐝

# AgentHive Cloud - AI 数字孪生项目

> **Hive Mode (蜂群模式)**: 多 Agent 协作的 AI 驱动开发系统

## 项目概述

AgentHive Cloud 是一个 AI 数字孪生平台，采用多 Agent 协作架构（称为"蜂群模式"），模拟软件开发团队的协作方式。项目整合了控制中心和多 Agent 系统，所有代码统一在一个仓库中管理。

---

## 技术栈

### 前端应用

| 应用 | 框架 | 技术细节 |
|------|------|----------|
| **Landing** | Nuxt 3 | Vue 3 + TypeScript + Element Plus + Tailwind CSS + Pinia |
| **Web** | Vue 3 + Vite | TypeScript + Element Plus + Pinia + Monaco Editor + XTerm |

### 后端服务

| 服务 | 运行时 | 技术细节 |
|------|--------|----------|
| **API** | Node.js + Express | TypeScript + REST API + JWT 认证 |
| **Agent Runtime** | Node.js | WebSocket + Zod 验证 + LLM 集成 |

### 基础设施

- **容器化**: Docker + Kubernetes (Helm charts)
- **数据库**: PostgreSQL + Redis
- **对象存储**: MinIO
- **监控**: Prometheus + Grafana
- **反向代理**: Nginx

---

## 项目结构

```
ai-digital-twin/                      # Hive 控制中心
├── AGENTS/                           # Multi-Agent 系统
│   ├── orchestrator.ts               # 阿黄 - 任务调度器 (Tech Lead)
│   ├── workers/                      # Worker Agents
│   │   ├── frontend-dev.ts           # 小花 - 前端开发
│   │   ├── backend-dev.ts            # 阿铁 - 后端开发
│   │   └── qa-engineer.ts            # 阿镜 - QA 工程师
│   ├── shared/prompts/               # 系统 Prompts
│   │   ├── system-frontend-dev.md
│   │   ├── system-backend-dev.md
│   │   ├── system-qa-engineer.md
│   │   └── system-orchestrator.md
│   ├── tools/                        # Agent 工具集
│   └── workspace/                    # Ticket 工作区
│       ├── T-001/                    # 具体 Ticket 工作目录
│       └── staging/                  # 集成测试区
│
├── apps/                  # 实际应用代码
│   ├── apps/
│   │   ├── landing/                  # 营销官网 (Nuxt 3)
│   │   │   ├── pages/                # 页面文件
│   │   │   ├── components/           # Vue 组件
│   │   │   ├── composables/          # 组合式函数
│   │   │   ├── stores/               # Pinia Store
│   │   │   └── server/               # API 路由
│   │   │
│   │   ├── web/                      # Web 应用 (Vue 3 + Vite)
│   │   │   ├── src/views/            # 页面视图
│   │   │   ├── src/components/       # 组件
│   │   │   ├── src/stores/           # Pinia Store
│   │   │   ├── src/api/              # API 调用
│   │   │   └── src/router/           # 路由配置
│   │   │
│   │   ├── api/                      # API 服务 (Express)
│   │   │   ├── src/routes/           # 路由定义
│   │   │   ├── src/controllers/      # 控制器
│   │   │   ├── src/services/         # 业务逻辑
│   │   │   ├── src/middleware/       # 中间件
│   │   │   └── src/websocket/        # WebSocket 处理
│   │   │
│   │   └── agent-runtime/            # Agent 运行时服务
│   │       ├── src/services/         # 核心服务
│   │       ├── src/agent/            # Agent 系统
│   │       ├── src/tools/            # 工具集
│   │       └── deploy/               # K8s/Helm 部署配置
│   │
│   └── docs/                         # 项目文档
│
├── scripts/                          # 自动化脚本
│   ├── workspace-lifecycle.js        # 工作区生命周期管理 ⭐
│   ├── cleanup-workspaces.js         # 清理工作区
│   ├── check-imports.js              # 检查导入问题
│   └── health-check/                 # 健康检查脚本
│
└── docs/                             # 共享文档
    ├── quick-reference.md            # 快速参考卡片 ⭐
    ├── lessons-learned.md            # 经验教训
    └── workspace-management.md       # 工作区管理指南
```

---

## 构建和开发命令

### Landing (Nuxt 3)

```bash
cd apps/apps/landing

# 开发服务器
npm run dev              # http://localhost:3000

# 构建
npm run build            # 生产构建
npm run generate         # 静态生成
npm run preview          # 预览构建结果

# 类型检查
npm run typecheck

# 测试
npm run test             # Vitest 单元测试
npm run test:e2e         # Playwright E2E 测试
```

### Web (Vue 3 + Vite)

```bash
cd apps/apps/web

# 开发服务器
npm run dev              # http://localhost:5173/app/

# 构建
npm run build            # 生产构建
npm run preview          # 预览

# 代码质量
npm run lint             # ESLint
npm run format           # Prettier
npm run type-check       # TypeScript 检查

# 测试
npm run test:unit        # Vitest
npm run test:e2e         # Playwright
```

### API (Express)

```bash
cd apps/apps/api

# 开发
npm run dev              # tsx watch 热重载

# 构建和启动
npm run build            # tsc 编译
npm run start            # node dist/index.js

# 测试
npm run test             # Vitest
npm run test:coverage    # 覆盖率报告
npm run test:ui          # Vitest UI
```

### Agent Runtime

```bash
cd apps/apps/agent-runtime

# 开发
npm run dev              # tsx watch

# 构建
npm run build
npm run start

# Docker
npm run docker:build
npm run docker:push

# Kubernetes
npm run k8s:deploy
npm run helm:install
```

---

## Multi-Agent 工作流

### 核心角色

| 角色 | 名称 | 职责 |
|------|------|------|
| **Orchestrator** | 阿黄 (Tech Lead) | 需求分析、任务拆解、调度协调 |
| **Frontend Dev** | 小花 | Vue 3/Nuxt 3 前端开发 |
| **Backend Dev** | 阿铁 | Node.js/API/数据库开发 |
| **QA Engineer** | 阿镜 | 代码审查、质量把控 |

### 工作流命令

```bash
# 阶段 1: 需求分析与规划
/plan 给 Dashboard 增加导出功能

# 阶段 2: 执行具体 Ticket
/ticket T-001           # 切换到 Worker 角色执行

# 阶段 3: QA 审查
/qa                     # 或 /ticket T-003

# 阶段 4: 恢复任务
/resume T-001
```

### 工作区管理

```bash
# 初始化工作区
node scripts/workspace-lifecycle.js init T-001 "任务描述"

# 查看工作区列表
node scripts/workspace-lifecycle.js list

# 更新状态
node scripts/workspace-lifecycle.js status T-001 active
node scripts/workspace-lifecycle.js status T-001 completed
node scripts/workspace-lifecycle.js status T-001 merged <commit-hash>

# 自动清理（每日执行）
node scripts/workspace-lifecycle.js cleanup

# 归档和恢复
node scripts/workspace-lifecycle.js archive T-001
node scripts/workspace-lifecycle.js restore T-001
```

---

## 代码规范

### TypeScript 配置

所有应用使用 **ES2022** 目标:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}
```

### 前端规范 (Landing/Web)

- **框架**: Vue 3 Composition API + `<script setup>`
- **状态管理**: Pinia (组合式 Store)
- **样式**: Tailwind CSS + Element Plus
- **组件命名**: PascalCase (如 `AgentTracker.vue`)
- **组合式函数**: 使用 `use` 前缀 (如 `useAgentTracker.ts`)

```typescript
// Store 示例 (组合式 API)
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useExampleStore = defineStore('example', () => {
  const items = ref<any[]>([])
  const loading = ref(false)
  const count = computed(() => items.value.length)
  
  const fetchItems = async () => {
    loading.value = true
    // ... API call
    loading.value = false
  }
  
  return { items, loading, count, fetchItems }
})
```

### SSR 安全代码

```vue
<script setup>
const isClient = ref(false)

onMounted(() => {
  isClient.value = true
  // 客户端代码在这里执行
  localStorage.setItem('key', 'value')
})
</script>

<template>
  <ClientOnly>
    <!-- 只在客户端渲染 -->
    <BrowserOnlyComponent />
  </ClientOnly>
</template>
```

### 后端规范 (API)

- **架构**: Express + TypeScript
- **路由**: 按功能模块分离
- **错误处理**: 统一错误中间件
- **验证**: Zod 或类似库进行输入验证

---

## 测试策略

### 单元测试

- **框架**: Vitest
- **前端**: Vue Test Utils
- **后端**: Supertest (API 测试)

```bash
# 运行所有测试
npm run test

# 覆盖率报告
npm run test:coverage

# UI 模式
npm run test:ui
```

### E2E 测试

- **框架**: Playwright
- **配置**: `playwright.config.ts`

```bash
npm run test:e2e
```

---

## 环境配置

### 环境文件

```bash
apps/
├── .env                  # 生产环境
├── .env.development      # 开发环境
├── .env.local            # 本地覆盖（不提交）
└── .env.example          # 示例配置
```

### 关键环境变量

```env
# 数据库
DB_HOST=localhost
DB_PORT=5432
DB_USER=agenthive
DB_PASSWORD=secret
DB_NAME=agenthive

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=your_secret
JWT_EXPIRATION=24h

# 服务端口
SUPERVISOR_PORT=8080
LANDING_PORT=3000
WEB_PORT=80

# 前端 API 配置
VITE_API_BASE_URL=http://localhost:8080/api
VITE_WS_URL=ws://localhost:8080/ws
```

---

## 部署架构

### Docker 支持

- **Landing**: Nuxt 3 SSR 容器
- **Web**: Nginx 静态托管
- **API**: Node.js 容器
- **Agent Runtime**: 独立容器 + K8s 支持

### Kubernetes

```bash
# Agent Runtime 部署
cd apps/apps/agent-runtime
kubectl apply -f deploy/k8s/

# 或使用 Helm
helm install agent-runtime deploy/helm/agent-runtime
```

---

## 维护与监控

### 性能指标

| 指标 | 健康阈值 | 警告阈值 |
|------|----------|----------|
| VS Code 内存 | < 1.5GB | > 2GB |
| node_modules 数量 | < 5 | > 5 |
| 工作区数量 | < 10 | > 15 |
| 文件搜索响应 | < 1秒 | > 3秒 |

### 定期维护

```bash
# 清理工作区（建议每周）
node scripts/cleanup-workspaces.js

# 检查导入问题
node scripts/check-imports.js

# 健康检查
node scripts/health-check/basic.sh
```

### 常见问题

| 问题 | 解决方式 |
|------|----------|
| VS Code 卡顿/内存高 | 运行 `node scripts/cleanup-workspaces.js` |
| `Failed to resolve import "pinia"` | `cd apps/landing && npm install` |
| `window is not defined` | 使用 `if (import.meta.client)` 或 `<ClientOnly>` |
| 端口被占用 | `Get-NetTCPConnection -LocalPort 3000` 查找并杀死进程 |

---

## 安全注意事项

1. **环境变量**: 敏感配置（API Keys、密码）只保存在 `.env.local`，不提交到 Git
2. **JWT Secret**: 生产环境必须使用强随机字符串
3. **CORS**: 生产环境限制允许的 Origin
4. **Rate Limiting**: 启用 API 速率限制
5. **文件权限**: Agent Runtime 以非 root 用户运行

---

## 相关文档

- [快速参考](docs/quick-reference.md) - 打印贴显示器旁！
- [工作流指南](WORKFLOW.md) - 完整生命周期说明
- [经验教训](docs/lessons-learned.md) - 踩坑记录
- [AGENTS 说明](AGENTS/README.md) - Multi-Agent 系统架构

---

## 快速开始（新项目成员）

### 1. 克隆和安装

```bash
cd apps/apps/landing
npm install

cd ../web
npm install

cd ../api
npm install
```

### 2. 配置环境

```bash
cd agenthive-cloud
cp .env.example .env.local
# 编辑 .env.local 填入本地配置
```

### 3. 启动开发

```bash
# 终端 1 - Landing
cd apps/apps/landing
npm run dev

# 终端 2 - Web
cd apps/apps/web
npm run dev

# 终端 3 - API
cd apps/apps/api
npm run dev
```

### 4. 访问

- Landing: http://localhost:3000
- Web App: http://localhost:5173/app/
- API: http://localhost:8080

---

> **Hive Mode**: *Many minds, one goal.* 🐝

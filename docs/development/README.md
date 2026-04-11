# 💻 开发文档

> 开发人员技术参考

---

## 🏗️ 项目结构

```
agenthive-cloud/
├── apps/
│   ├── api/              # Express + TypeScript API
│   ├── landing/          # Nuxt 3 前端
│   ├── web/              # Vue 3 管理后台
│   └── agent-runtime/    # Agent 运行时
├── packages/
│   └── types/            # 共享类型定义
└── docs/
    └── api/              # API 文档
```

---

## 📚 文档列表

### API 开发

| 文档 | 说明 | 位置 |
|------|------|------|
| [API 接口文档](./api-reference.md) | RESTful API 详细说明 | `docs/development/` |
| [API TODO](../../agenthive-cloud/apps/api/API_TODO.md) | API 开发任务 | `apps/api/` |
| [数据库设计](./database-schema.md) | PostgreSQL 表结构 | `docs/development/` |
| [数据库配置](../../agenthive-cloud/apps/api/DATABASE.md) | Postgres/Redis 配置 | `apps/api/` |
| [WebSocket 说明](../../agenthive-cloud/apps/api/REDIS_WEBSOCKET.md) | Redis + WebSocket | `apps/api/` |

### 前端开发

| 文档 | 说明 | 位置 |
|------|------|------|
| [前端开发指南](./frontend-guide.md) | Vue/Nuxt 规范 | `docs/development/` |
| [SSR 安全指南](../../agenthive-cloud/apps/landing/docs/SSR-SAFETY-GUIDE.md) | Nuxt SSR 注意事项 | `apps/landing/docs/` |
| [Landing Docker 问题](../archive/LANDING-DOCKER-ISSUES.md) | Vite + Docker 问题 | `docs/archive/` |

### Agent 运行时

| 文档 | 说明 | 位置 |
|------|------|------|
| [Agent Runtime 架构](../architecture/agent-runtime.md) | 系统设计 | `docs/architecture/` |
| [API 文档](../../agenthive-cloud/apps/agent-runtime/docs/API.md) | API 使用说明 | `apps/agent-runtime/docs/` |
| [架构文档](../../agenthive-cloud/apps/agent-runtime/docs/ARCHITECTURE.md) | 详细架构 | `apps/agent-runtime/docs/` |
| [优化总结](../../agenthive-cloud/apps/agent-runtime/OPTIMIZATION_SUMMARY.md) | 性能优化 | `apps/agent-runtime/` |

### 开发工具

| 文档 | 说明 |
|------|------|
| [代码规范](./code-style.md) | ESLint、Prettier、命名规范 |
| [测试指南](./testing.md) | 单元测试、E2E 测试 |
| [CI 构建优化](../CI-BUILD-OPTIMIZATION.md) | Docker 构建优化 |

---

## 🎯 开发工作流

### 1. 创建功能分支

```bash
git checkout -b feature/T-XXX-description
```

### 2. 开发和测试

```bash
# 本地开发
cd agenthive-cloud/apps/api
npm run dev

# 运行测试
npm test
```

### 3. 构建和部署

```bash
# 构建镜像
./scripts/build-api-minimal.sh

# 部署到 K8s
./scripts/quick-deploy-k8s.sh
```

---

## 🔧 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Vue 3, Nuxt 3, TypeScript, Tailwind CSS, Element Plus |
| 后端 | Node.js, Express, TypeScript, Socket.io |
| 数据库 | PostgreSQL, Redis |
| 部署 | Docker, Kubernetes, Nginx |
| CI/CD | GitHub Actions |

---

## 📖 推荐阅读

1. [快速参考](../reference/quick-reference.md) - 常用命令速查
2. [Docker 网络详解](../DOCKER-DESKTOP-NETWORK-EXPLAINED.md)
3. [K8s 速查表](../reference/k8s-cheatsheet.md)

---

**遇到问题？** 查看 [运维排查指南](../operation/troubleshooting.md)

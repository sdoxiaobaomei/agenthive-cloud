# 📚 AgentHive Apps 文档索引

> agenthive-cloud/apps 目录下所有文档的完整清单

---

## 📊 文档统计

| 应用 | 文档数 | 主要类型 |
|------|--------|----------|
| agent-runtime | 18 | README、优化、迁移、架构 |
| api | 10 | API、数据库、测试、启动 |
| landing | 5 | 功能计划、SSR指南、README |
| **总计** | **33** | |

---

## 📁 Docs 目录结构

```
apps/
├── agent-runtime/
│   └── docs/                    # 6篇文档
│       ├── README.md
│       ├── API.md
│       ├── ARCHITECTURE.md
│       ├── CHANGELOG.md
│       ├── PROGRESS.md
│       └── QUICK_REFERENCE.md
│
├── api/
│   └── tests/                   # 3篇测试文档
│       ├── README.md
│       ├── TEST_SUMMARY.md
│       └── unit/
│           └── TEST_SUMMARY.md
│
├── landing/
│   ├── docs/                    # 1篇文档
│   │   └── SSR-SAFETY-GUIDE.md
│   │
│   └── .kimi/tasks/             # 3篇任务文档
│       ├── README.md
│       ├── atoms-feature-plan.md
│       └── progress.md
│
└── API_SUMMARY.md               # 1篇汇总文档
```

---

## 🚀 Agent Runtime (18篇)

### 根目录文档 (12篇)

| 文档 | 类型 | 说明 |
|------|------|------|
| [README.md](./agent-runtime/README.md) | 主文档 | 项目介绍和快速开始 |
| [README_ENHANCED.md](./agent-runtime/README_ENHANCED.md) | 增强版 | 详细功能说明 |
| [README_V2.md](./agent-runtime/README_V2.md) | V2版本 | 新版本说明 |
| [README-OLLAMA.md](./agent-runtime/README-OLLAMA.md) | 集成文档 | Ollama 集成指南 |
| [CHANGELOG.md](./agent-runtime/CHANGELOG.md) | 变更日志 | 版本更新记录 |
| [CLAUDE_CODE_OPTIMIZATIONS.md](./agent-runtime/CLAUDE_CODE_OPTIMIZATIONS.md) | 优化 | Claude Code 优化 |
| [MIGRATION_GUIDE.md](./agent-runtime/MIGRATION_GUIDE.md) | 迁移 | 迁移指南 |
| [MIGRATION_PLAN.md](./agent-runtime/MIGRATION_PLAN.md) | 迁移 | 迁移计划 |
| [OPTIMIZATION.md](./agent-runtime/OPTIMIZATION.md) | 优化 | 性能优化 |
| [OPTIMIZATION_PLAN.md](./agent-runtime/OPTIMIZATION_PLAN.md) | 优化 | 优化计划 |
| [OPTIMIZATION_SUMMARY.md](./agent-runtime/OPTIMIZATION_SUMMARY.md) | 优化 | 优化总结 |
| [OPTIMIZATIONS_SUMMARY.md](./agent-runtime/OPTIMIZATIONS_SUMMARY.md) | 优化 | 优化汇总 |
| [PROGRESS.md](./agent-runtime/PROGRESS.md) | 进度 | 开发进度 |
| [PROJECT_SUMMARY.md](./agent-runtime/PROJECT_SUMMARY.md) | 总结 | 项目总结 |

### docs/ 目录 (6篇)

| 文档 | 类型 | 说明 |
|------|------|------|
| [docs/README.md](./agent-runtime/docs/README.md) | 文档入口 | 文档首页 |
| [docs/API.md](./agent-runtime/docs/API.md) | API文档 | API使用说明 |
| [docs/ARCHITECTURE.md](./agent-runtime/docs/ARCHITECTURE.md) | 架构 | 系统架构设计 |
| [docs/CHANGELOG.md](./agent-runtime/docs/CHANGELOG.md) | 变更日志 | 详细变更记录 |
| [docs/PROGRESS.md](./agent-runtime/docs/PROGRESS.md) | 进度 | 开发进度跟踪 |
| [docs/QUICK_REFERENCE.md](./agent-runtime/docs/QUICK_REFERENCE.md) | 参考 | 快速参考卡片 |

---

## 🌐 API (10篇)

### 根目录文档 (8篇)

| 文档 | 类型 | 说明 |
|------|------|------|
| [API_DOCUMENTATION.md](./api/API_DOCUMENTATION.md) | API文档 | 接口详细文档 |
| [API_TODO.md](./api/API_TODO.md) | 任务 | 开发任务清单 |
| [DATABASE.md](./api/DATABASE.md) | 数据库 | 数据库配置说明 |
| [POSTGRESQL_SETUP.md](./api/POSTGRESQL_SETUP.md) | 数据库 | PostgreSQL 安装配置 |
| [REDIS_WEBSOCKET.md](./api/REDIS_WEBSOCKET.md) | 架构 | Redis + WebSocket 设计 |
| [SETUP_SUMMARY.md](./api/SETUP_SUMMARY.md) | 启动 | 环境搭建总结 |
| [STARTUP_GUIDE.md](./api/STARTUP_GUIDE.md) | 启动 | 启动指南 |

### 测试文档 (3篇)

| 文档 | 类型 | 说明 |
|------|------|------|
| [tests/README.md](./api/tests/README.md) | 测试 | 测试说明 |
| [tests/TEST_SUMMARY.md](./api/tests/TEST_SUMMARY.md) | 测试 | 测试总结 |
| [tests/unit/TEST_SUMMARY.md](./api/tests/unit/TEST_SUMMARY.md) | 测试 | 单元测试总结 |

---

## 🎨 Landing (5篇)

### 根目录文档 (2篇)

| 文档 | 类型 | 说明 |
|------|------|------|
| [README.md](./landing/README.md) | 主文档 | 项目介绍 |
| [docs/SSR-SAFETY-GUIDE.md](./landing/docs/SSR-SAFETY-GUIDE.md) | 指南 | SSR 安全开发指南 |

### .kimi/tasks/ 目录 (3篇)

| 文档 | 类型 | 说明 |
|------|------|------|
| [.kimi/tasks/README.md](./landing/.kimi/tasks/README.md) | 任务 | 任务说明 |
| [.kimi/tasks/atoms-feature-plan.md](./landing/.kimi/tasks/atoms-feature-plan.md) | 规划 | Atoms 功能规划 |
| [.kimi/tasks/progress.md](./landing/.kimi/tasks/progress.md) | 进度 | 任务进度 |

---

## 📱 API_SUMMARY.md (1篇)

位于 `apps/` 根目录：

| 文档 | 类型 | 说明 |
|------|------|------|
| [API_SUMMARY.md](./API_SUMMARY.md) | 总结 | 所有 API 汇总说明 |

---

## 🗂️ 按类型分类

### README 文档 (7篇)
- agent-runtime/README.md
- agent-runtime/docs/README.md
- landing/README.md
- landing/.kimi/tasks/README.md
- api/tests/README.md

### API 文档 (3篇)
- agent-runtime/docs/API.md
- api/API_DOCUMENTATION.md
- API_SUMMARY.md

### 架构设计 (2篇)
- agent-runtime/docs/ARCHITECTURE.md
- api/REDIS_WEBSOCKET.md

### 数据库 (3篇)
- api/DATABASE.md
- api/POSTGRESQL_SETUP.md
- api/REDIS_WEBSOCKET.md

### 优化相关 (6篇)
- agent-runtime/OPTIMIZATION.md
- agent-runtime/OPTIMIZATION_PLAN.md
- agent-runtime/OPTIMIZATION_SUMMARY.md
- agent-runtime/OPTIMIZATIONS_SUMMARY.md
- agent-runtime/CLAUDE_CODE_OPTIMIZATIONS.md

### 迁移文档 (2篇)
- agent-runtime/MIGRATION_GUIDE.md
- agent-runtime/MIGRATION_PLAN.md

### 进度跟踪 (4篇)
- agent-runtime/PROGRESS.md
- agent-runtime/docs/PROGRESS.md
- agent-runtime/docs/CHANGELOG.md
- agent-runtime/CHANGELOG.md
- landing/.kimi/tasks/progress.md

### 测试文档 (3篇)
- api/tests/README.md
- api/tests/TEST_SUMMARY.md
- api/tests/unit/TEST_SUMMARY.md

### 启动配置 (2篇)
- api/SETUP_SUMMARY.md
- api/STARTUP_GUIDE.md

### 任务规划 (1篇)
- landing/.kimi/tasks/atoms-feature-plan.md

---

## 🔍 文档查找指南

### 如果你是...

**Agent Runtime 开发者**:
→ 先看 `agent-runtime/README.md`
→ 再看 `agent-runtime/docs/API.md` 和 `agent-runtime/docs/ARCHITECTURE.md`
→ 优化相关查看 `OPTIMIZATION_SUMMARY.md`

**API 开发者**:
→ 先看 `api/API_TODO.md` 了解任务
→ 再看 `api/API_DOCUMENTATION.md`
→ 数据库配置查看 `DATABASE.md` 和 `POSTGRESQL_SETUP.md`

**Landing 开发者**:
→ 先看 `landing/README.md`
→ SSR 问题查看 `landing/docs/SSR-SAFETY-GUIDE.md`

**运维人员**:
→ 启动查看 `api/STARTUP_GUIDE.md`
→ 测试查看 `api/tests/README.md`

---

## 📝 建议的整理

### 重复/冗余文档

| 文档 | 建议 |
|------|------|
| OPTIMIZATION_SUMMARY.md + OPTIMIZATIONS_SUMMARY.md | 合并为一个 |
| README.md + README_ENHANCED.md + README_V2.md | 合并为一个主 README |
| PROGRESS.md (根目录) + docs/PROGRESS.md | 合并或删除根目录版本 |
| CHANGELOG.md (根目录) + docs/CHANGELOG.md | 合并或删除根目录版本 |

### 应删除的文档

- 临时文件
- 已完成的迁移计划（保留 MIGRATION_GUIDE，删除 MIGRATION_PLAN）

### 应移动的文档

- `API_SUMMARY.md` 建议移动到 `api/` 目录下

---

## 📊 文档大小统计

| 应用 | 估算总大小 | 说明 |
|------|-----------|------|
| agent-runtime | ~200 KB | 大量优化和 README 文档 |
| api | ~100 KB | API 和数据库文档 |
| landing | ~50 KB | 功能规划和指南 |

---

**最后更新**: 2026-04-07

**维护者**: AgentHive Team

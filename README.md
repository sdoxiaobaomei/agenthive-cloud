# AgentHive Cloud - 蜂群 Agent 平台

> 🐝 **无代码构建 AI 应用 | 蜂群协作 | 一键部署**

**让每个人都能像养蜂一样管理 AI Agent 团队**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)](https://www.docker.com/)
[![Kubernetes](https://img.shields.io/badge/K8s-Supported-326CE5.svg)](https://kubernetes.io/)

---

## 🌟 什么是 AgentHive Cloud？

AgentHive Cloud 是一个**无代码蜂群 Agent 平台**，让你无需编写复杂代码，即可构建、部署和管理多 Agent 协作的 AI 应用。

### 核心特性

- 🎯 **无代码构建**: 通过可视化界面配置 Agent 角色、工作流和工具
- 🐝 **蜂群协作**: 多个 Agent 分工合作，自动完成复杂任务
- 🚀 **一键部署**: 支持 Docker Compose 和 Kubernetes，本地/云端随意切换
- 📦 **开箱即用**: 预置常见 Agent 模板（开发、测试、文档、运维）
- 🔌 **灵活扩展**: 轻松接入自定义工具、API 和 LLM 模型

---

## 🎯 适用场景

| 场景 | 说明 |
|------|------|
| **AI 应用开发** | 无需从零编码，配置 Agent 团队即可构建完整应用 |
| **自动化工作流** | 让 Agent 协作处理重复性任务（数据处理、内容生成、代码审查） |
| **快速原型** | 1 小时搭建可演示的 AI 产品原型 |
| **企业知识库** | 部署专属问答 Agent，接入内部文档系统 |
| **DevOps 自动化** | 自动执行 CI/CD、监控告警、故障排查 |

---

## 🏗️ 平台架构

```
┌─────────────────────────────────────────────────────────┐
│                    AgentHive Cloud                       │
├─────────────────────────────────────────────────────────┤
│  🎨 Web 控制台 (Nuxt 3 + Vue 3)                          │
│     - Agent 配置中心                                    │
│     - 工作流可视化                                      │
│     - 实时监控面板                                      │
├─────────────────────────────────────────────────────────┤
│  🐝 蜂群引擎 (Agent Runtime)                            │
│     - 任务调度器 (Orchestrator)                         │
│     - Worker Agents (执行单元)                          │
│     - 工具注册表 (Tool Registry)                        │
├─────────────────────────────────────────────────────────┤
│  🔌 集成层                                               │
│     - LLM 适配器 (Ollama/OpenAI/通义千问)               │
│     - 数据库 (PostgreSQL + Redis)                       │
│     - 消息队列 (WebSocket)                              │
├─────────────────────────────────────────────────────────┤
│  🚀 部署层                                               │
│     - Docker Compose (本地开发)                         │
│     - Kubernetes (生产环境)                             │
│     - Nginx 反向代理                                    │
└─────────────────────────────────────────────────────────┘
```

---

## 📁 项目结构

```
agenthive-cloud/
├── apps/                        # 应用服务
│   ├── landing/                 # Nuxt 3 官网/控制台
│   └── api/                     # Express API 后端
│
├── AGENTS/                      # 蜂群引擎核心
│   ├── orchestrator.ts          # 蜂后 - 任务调度器
│   ├── workers/                 # 工蜂 - 执行 Agent
│   │   ├── backend-dev.ts       # 后端开发 Agent
│   │   ├── frontend-dev.ts      # 前端开发 Agent
│   │   └── qa-engineer.ts       # 测试 Agent
│   ├── tools/                   # 工具集
│   └── adapters/                # LLM 适配器
│
├── packages/                    # 共享包
│   ├── cli/                     # 命令行工具
│   ├── types/                   # TypeScript 类型定义
│   ├── ui/                      # Vue 3 组件库
│   └── workflow-engine/         # 工作流引擎
│
├── k8s/                         # Kubernetes 配置
│   ├── base/                    # 基础资源
│   ├── overlays/                # 环境覆盖 (local/staging/prod)
│   └── components/              # 可复用组件
│
├── scripts/                     # 自动化脚本
├── nginx/                       # Nginx 配置
├── docs/                        # 完整文档
└── docker-compose*.yml          # Docker 配置
```

---

## 🚀 快速开始

### 环境要求

- Node.js 20+
- Docker & Docker Compose
- pnpm (推荐)

### 1️⃣ 克隆项目

```bash
git clone https://github.com/sdoxiaobaomei/agenthive-cloud.git
cd agenthive-cloud
```

### 2️⃣ 安装依赖

```bash
cd apps
pnpm install
```

### 3️⃣ 配置环境变量

```bash
# 复制示例配置
cp .env.example .env

# 编辑 .env，填入你的 LLM 配置
# 支持：Ollama (本地)、OpenAI、通义千问、DeepSeek 等
```

### 4️⃣ 启动平台

**方式 A: Docker Compose（推荐新手）**

```bash
# 本地开发模式（使用宿主机 Ollama）
docker-compose -f docker-compose.local.yml up -d

# 完整模式（包含所有服务）
docker-compose -f docker-compose.full.yml up -d

# 查看日志
docker-compose logs -f
```

**方式 B: 本地开发**

```bash
# 终端 1 - 启动控制台
cd apps/landing && npm run dev

# 终端 2 - 启动 API
cd apps/api && npm run dev
```

访问 http://localhost:3000 打开控制台

---

## 🐝 使用蜂群系统

### 命令行模式

```bash
cd AGENTS

# 运行任务
npx tsx orchestrator.ts "给 Dashboard 增加导出功能"

# 查看任务历史
npx tsx orchestrator.ts --list

# 恢复暂停的任务
npx tsx orchestrator.ts --resume T001
```

### Web 控制台模式（推荐）

1. 打开 http://localhost:3000
2. 创建新应用
3. 配置 Agent 团队（选择角色、分配工具）
4. 定义工作流（拖拽式编排）
5. 点击"运行"，观察蜂群协作

---

## 🛠️ 技术栈

### 前端
| 组件 | 技术 |
|------|------|
| **控制台** | Nuxt 3 + Vue 3 + TypeScript |
| **UI 框架** | Element Plus + Tailwind CSS |
| **状态管理** | Pinia |
| **实时通信** | WebSocket |

### 后端
| 服务 | 技术 |
|------|------|
| **API** | Express + TypeScript + JWT |
| **Agent Runtime** | Node.js + Zod 验证 |
| **数据库** | PostgreSQL 15 + Redis 7 |
| **消息队列** | WebSocket + 内存队列 |

### 基础设施
| 用途 | 技术 |
|------|------|
| **容器化** | Docker + Docker Compose |
| **编排** | Kubernetes 1.28+ |
| **反向代理** | Nginx |
| **监控** | Prometheus + Grafana (可选) |

---

## 📚 文档导航

| 文档 | 说明 |
|------|------|
| [AGENTS.md](./AGENTS.md) | 蜂群系统详解 |
| [WORKFLOW.md](./WORKFLOW.md) | 工作流编排指南 |
| [docs/deployment/](./docs/deployment/) | 部署文档（Docker/K8s） |
| [docs/guides/](./docs/guides/) | 使用教程 |
| [docs/rfc/](./docs/rfc/) | 架构决策记录 |

---

## 🎯 路线图

### Phase 1 (已完成) ✅
- [x] 蜂群引擎核心
- [x] 基础 Agent 角色（开发/测试）
- [x] Docker Compose 部署
- [x] Web 控制台 MVP

### Phase 2 (进行中) 🚧
- [ ] 可视化工作流编辑器
- [ ] 更多预置 Agent 模板
- [ ] 插件市场
- [ ] 多租户支持

### Phase 3 (计划中) 📅
- [ ] 企业级权限管理
- [ ] Agent 性能分析
- [ ] 协作编辑功能
- [ ] SaaS 版本

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

---

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE)

---

## 🙏 致谢

感谢所有为开源生态做出贡献的开发者！

---

<div align="center">

**🐝 AgentHive Cloud - 让 AI 协作像蜂群一样自然**

[GitHub](https://github.com/sdoxiaobaomei/agenthive-cloud) · [文档](./docs/) · [Issues](https://github.com/sdoxiaobaomei/agenthive-cloud/issues)

</div>

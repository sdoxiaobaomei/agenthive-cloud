# AgentHive Cloud — Agent 阅读与协作原则

> **本文档面向所有接入 AgentHive Cloud 的 AI Agent。**
> 
> 它定义了本项目文档体系的核心设计原则，确保任何 Agent 在首次加载时即可：
> 1. **自动获得上下文**（无需手动搜索）
> 2. **自动知晓边界**（不可违背的规约）
> 3. **自动找到知识**（索引即导航）

---

## 原则一：自动加载索引（AGENTS.md 层级体系）

AgentHive Cloud 采用**目录级 AGENTS.md 注入机制**。当 Agent 访问任何文件时，系统会自动加载其所在目录及上级目录中的 `AGENTS.md`，越靠近目标文件的目录优先级越高。

### 当前层级结构

```
agenthive-cloud/
├── AGENTS.md                 ← 根级：全项目通用上下文（技术栈、全局规范）
├── .kimi/
│   └── AGENTS.md             ← Kimi 级：Kimi Agent 专用注入（合并根级 + 补充）
├── apps/
│   └── AGENTS.md             ← 应用级：Lead Agent 硬边界（禁止直接修改 apps/）
├── docs/
│   └── agent.md              ← 本文档：Agent 阅读舒适区原则说明
└── ...
```

### 对 Agent 的要求

- **读取任何文件前**，先确认当前目录及上级是否存在 `AGENTS.md`
- **发现冲突时**，以最深层级目录的 `AGENTS.md` 为准
- **修改任何文件前**，检查当前层级 `AGENTS.md` 是否有角色硬边界限制

---

## 原则二：自动加载第一优先级规约（不可违背）

以下规约**不以任何 Agent 的意志为转移**。它们通过三个通道同时生效，确保无论使用何种 IDE 或 Agent 框架，核心约束都会被自动加载：

### 通道 1：通用规约（`AGENT_COLLABORATION_SPEC.md`）

被 `.kimi/AGENTS.md` 显式索引，包含：
- **7 条架构决策（ADR）**：认证收口 Gateway、Node.js = BFF、Java = 核心域、Agent 异步化、OTel 强制、UUIDv7、Database Per Service
- **5 角色 RBAC 硬边界**：Lead / Frontend Dev / Backend Dev / QA Engineer / Platform Engineer 的读写权限
- **编码与协作铁律**：Commit 规范、跨角色提交流程、升级机制

### 通道 2：Cursor 规约（`.cursorrules`）

Cursor IDE 自动读取根目录该文件，包含：
- 架构决策摘要（与通用规约一致）
- 角色权限 HARD GATES
- 编码铁律（Vue 3 Composition API、TypeScript ESM、PG 16 陷阱等）
- 已知陷阱清单（Helm maxUnavailable、Secret 三模式、Migration 同步等）
- 验证铁律：`NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE`

### 通道 3：GitHub Copilot 规约（`.github/copilot-instructions.md`）

Copilot 自动读取，内容与上述规约英文对齐，增加：
- 验证清单（tsc / 单元测试 / DB migration replay / Helm template）
- 快速诊断命令（kubectl / psql / port-forward）

### 对 Agent 的要求

- **操作前**：确认当前角色与目标目录的权限是否匹配
- **发现矛盾**：若任何规约与 `AGENTS.md` 冲突，以 `AGENT_COLLABORATION_SPEC.md` 为准；若架构决策本身存在矛盾，标记 `[ESCALATE]` 升级人类架构师
- **完成声明**：必须附带验证证据（完整命令 + 输出 + exit code）

---

## 原则三：索引指向知识库（文档即导航）

AgentHive Cloud 的文档体系设计为**"Agent 无需记忆路径，只需跟随索引"**。所有入口文档均采用"表格 + 编号 + 状态标记"的机械可读格式。

### 核心索引链路

```
┌─────────────────────────┐
│   .kimi/AGENTS.md       │  ← 自动注入，Agent 的第一触点
│   (或根目录 AGENTS.md)   │
└───────────┬─────────────┘
            │
    ┌───────┼───────┐
    ▼       ▼       ▼
┌───────┐ ┌─────────────┐ ┌─────────────────┐
│ 协作   │ │ 架构知识库   │ │ 快速参考 & 踩坑  │
│ 规约   │ │ 入口         │ │ 记录            │
└───┬───┘ └──────┬──────┘ └────────┬────────┘
    │            │                 │
    ▼            ▼                 ▼
AGENT_COLLAB.  architecture/    reference/
SPEC.md        README.md        quick-reference.md
               │                lessons-learned.md
    ┌──────────┼──────────┐
    ▼          ▼          ▼
  00-全景    01-总览     02-Java
  审视报告    系统架构    微服务
    │          │          │
  03-AI      04-路线     05-Node.js
  Agent      图          后端
  平台
```

### 索引设计规范（Agent 可依赖的格式）

| 格式元素 | 用途 | 示例 |
|---------|------|------|
| **编号** | 确定阅读顺序 | `00-architecture-review.md` 优先于 `01-system-overview.md` |
| **状态标记** | 判断信息新鲜度 | `✅ 稳定` / `✅ 活跃` / `🟡 执行中` |
| **按角色路由** | 快速定位相关文档 | "Java 后端开发 → 01 → 02 → 04" |
| **按主题路由** | 问题导向检索 | "我要看问题清单 → 00 第 3 章" |
| **相对链接** | Agent 可直接跳转 | `[快速参考](../reference/quick-reference.md)` |

### 对 Agent 的要求

- **遇到不确定的问题**：优先查阅 `docs/reference/quick-reference.md` 和 `shared/lessons-learned.md`
- **需要理解架构**：从 `docs/architecture/README.md` 的"按主题"或"按角色"路由表出发
- **发现新坑**：在执行任务过程中遇到的新陷阱，应追加到 `shared/lessons-learned.md`，并注明来源和 Action

---

## 快速导航表

| 如果 Agent 想... | 去读... |
|------------------|---------|
| 了解项目技术栈和全局规范 | 根目录 `AGENTS.md` 或 `.kimi/AGENTS.md` |
| 知道什么能做、什么绝对不能做 | `AGENT_COLLABORATION_SPEC.md` |
| 查看当前架构问题和优化方向 | `docs/architecture/00-architecture-review.md` |
| 理解系统总体设计 | `docs/architecture/01-system-overview.md` |
| 查看 Java 微服务 API 和数据库设计 | `docs/architecture/02-java-microservices.md` |
| 理解 Chat 如何调度 Agent | `docs/architecture/03-ai-agent-platform.md` |
| 查看当前 Sprint 任务和里程碑 | `docs/architecture/04-development-roadmap.md` |
| 查看 Node.js API 模块结构 | `docs/architecture/05-backend-nodejs.md` |
| 快速查找常用命令和调试技巧 | `docs/reference/quick-reference.md` |
| 了解已踩过的坑和避坑方案 | `shared/lessons-learned.md` |
| 确认当前角色的文件权限边界 | 当前目录最近的 `AGENTS.md` |

---

## 附：Agent 加载上下文时的检查清单

在每次新会话或切换工作目录时，建议 Agent 按以下顺序确认上下文：

1. [ ] 当前目录及上级是否有 `AGENTS.md`？内容是否已加载？
2. [ ] 当前角色（Lead/Frontend/Backend/QA/Platform）是否允许操作目标目录？
3. [ ] 是否已知悉 7 条 ADR 架构决策？
4. [ ] 如操作涉及 `apps/`，是否确认 `apps/AGENTS.md` 的硬边界？
5. [ ] 如需架构知识，是否从 `docs/architecture/README.md` 开始导航？
6. [ ] 完成声明前，是否已执行验证并保留证据？

---

> **Hive Mode**: *Many minds, one goal.* 🐝

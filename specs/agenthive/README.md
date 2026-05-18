# AgentHive Cloud — 施工图纸索引

> **蜂群模式 (Hive Mode)**: 多 Agent 协作的 AI 低代码应用生成平台
>
> 本目录包含 7 份子规格文档，覆盖从架构到测试的完整施工图纸，每份规格达到"代码蓝图"级别精度。

---

## 规格文件清单

| # | 文件 | 行数 | 核心内容 |
|---|------|------|----------|
| 000 | [000-architecture.md](./000-architecture.md) | ~660 | 系统架构图、Gateway JWT 验证流、X-User-Id 头注入、路由表、请求全链路、数据归属矩阵、错误处理策略、ADR 附录 |
| 001 | [001-generation-pipeline.md](./001-generation-pipeline.md) | ~1,740 | 意图分类扩展、AppTemplate 系统、DesignScheme 配色、工作区初始化、Orchestrator Ticket 生成、验证管线（含重试+回滚）、增量修改引擎 |
| 002 | [002-agent-runtime.md](./002-agent-runtime.md) | ~1,970 | AgentType 扩展、frontend_gen 系统 prompt、SupabaseTool、PreviewTool、TemplateTool、QueryLoopV2Enhanced、ConversationContextV3、TokenBudgetManager |
| 003 | [003-preview-system.md](./003-preview-system.md) | ~1,790 | PreviewServerManager（端口分配+健康检查+LRU 淘汰）、Proxy 端点、Nuxt BFF passthrough、PreviewPanel.vue 组件（4 态+设备切换）、WebSocket 集成 |
| 004 | [004-java-services.md](./004-java-services.md) | ~1,190 | Gateway/Auth/Economy 三服务完整设计、Economy 服务 Credits/Marketplace/HostedWebsite/Withdrawal/Creator 子系统、Flyway migration、RabbitMQ 拓扑、删除策略 |
| 005 | [005-frontend.md](./005-frontend.md) | ~1,220 | ChatPage 5-Tab 增强、TypeScript 类型定义、PreviewPanel/ChatPanel 组件增强、Store 真实化（marketplace/creator/credits）、Generation Store、Composables、实施序列 |
| 006 | [006-database-infra.md](./006-database-infra.md) | ~940 | 全部 DDL（Node.js 15 表 + Java auth 3 表 + economy 15 表）、Redis 键空间、RabbitMQ 拓扑、Docker Compose、K8s 部署拓扑、Helm Chart、监控栈、CI/CD 管线 |
| 007 | [007-testing-strategy.md](./007-testing-strategy.md) | ~1,710 | 测试金字塔、46 个现有测试用例详述、5 个新增测试文件（含代码）、3 个新增 E2E 场景、21 个测试场景矩阵（生成管线 6 + 经济系统 8 + 前端 7）、CI 测试管线、Phase 验证清单 |

**总计**: 约 **11,250 行** 施工图纸级规格文档

---

## 按角色阅读导航

### 🏗️ 架构师 / Tech Lead

| 阅读顺序 | 文件 | 重点关注 |
|----------|------|----------|
| 1 | [000-architecture.md](./000-architecture.md) | 全览架构、ADR 决策、组件契约 |
| 2 | [004-java-services.md](./004-java-services.md) | 服务拓扑、Gateway 路由、批量删除策略 |
| 3 | [006-database-infra.md](./006-database-infra.md) | 数据库归属、K8s 部署、CI/CD |
| 4 | [007-testing-strategy.md](./007-testing-strategy.md) | CI 门禁、覆盖率目标 |

### 💻 Java 后端开发

| 阅读顺序 | 文件 | 重点关注 |
|----------|------|----------|
| 1 | [000-architecture.md](./000-architecture.md) | Gateway JWT 流、X-User-Id 机制 |
| 2 | [004-java-services.md](./004-java-services.md) | **必读全部** — 三个服务的完整 Controller/Service/Entity/SQL 设计 |
| 3 | [006-database-infra.md](./006-database-infra.md) | Java 侧 DDL、RabbitMQ 拓扑、K8s 部署 |
| 4 | [007-testing-strategy.md](./007-testing-strategy.md) | Java 测试策略、场景矩阵 |

### 🟢 Node.js / AI 开发

| 阅读顺序 | 文件 | 重点关注 |
|----------|------|----------|
| 1 | [000-architecture.md](./000-architecture.md) | X-User-Id 映射、Node.js 数据流 |
| 2 | [001-generation-pipeline.md](./001-generation-pipeline.md) | **必读全部** — 意图分类、模板系统、验证管线 |
| 3 | [002-agent-runtime.md](./002-agent-runtime.md) | **必读全部** — QueryLoop、Tool 系统、Token 预算 |
| 4 | [003-preview-system.md](./003-preview-system.md) | PreviewServerManager、Proxy、WebSocket |
| 5 | [007-testing-strategy.md](./007-testing-strategy.md) | Node.js 测试策略、新增测试用例 |

### 🎨 前端开发

| 阅读顺序 | 文件 | 重点关注 |
|----------|------|----------|
| 1 | [005-frontend.md](./005-frontend.md) | **必读全部** — 组件增强、Store 重构、实施序列 |
| 2 | [003-preview-system.md](./003-preview-system.md) | PreviewPanel 组件、设备切换、状态管理 |
| 3 | [001-generation-pipeline.md](./001-generation-pipeline.md) | 意图分类、前端交互流 |
| 4 | [007-testing-strategy.md](./007-testing-strategy.md) | 前端 E2E 场景、Playwright 测试 |

### 🛠️ DevOps / SRE

| 阅读顺序 | 文件 | 重点关注 |
|----------|------|----------|
| 1 | [006-database-infra.md](./006-database-infra.md) | **必读全部** — K8s、Helm、监控、CI/CD |
| 2 | [000-architecture.md](./000-architecture.md) | 可观测性架构、Nacos 发现 |
| 3 | [004-java-services.md](./004-java-services.md) | K8s 资源分配、部署变更 |
| 4 | [007-testing-strategy.md](./007-testing-strategy.md) | CI 管线设计、质量门禁 |

### 🧪 QA / 测试工程师

| 阅读顺序 | 文件 | 重点关注 |
|----------|------|----------|
| 1 | [007-testing-strategy.md](./007-testing-strategy.md) | **必读全部** — 21 个场景、46 个测试、CI 门禁 |
| 2 | [001-generation-pipeline.md](./001-generation-pipeline.md) | 验证管线、回滚机制（测试重点） |
| 3 | [005-frontend.md](./005-frontend.md) | E2E 场景设计 |

---

## 核心设计原则速查

| 原则 | 说明 | 详见 |
|------|------|------|
| 稳定性优先 | 自由生成 + 严格验证管线（5 步验证，3 次重试，失败回滚） | [001](./001-generation-pipeline.md) |
| 模板约束 | 生成的 App 受模板技术栈约束，Agent 不可自由选择框架 | [001](./001-generation-pipeline.md) |
| 增量修改 | 只修改受影响文件，非全量重写 | [001](./001-generation-pipeline.md) |
| 单语言全栈 | 生成的应用只含前端代码，后端用 Supabase 替代 | [001](./001-generation-pipeline.md) |
| Java 守门人 | 认证/Gateway/计费 统一在 Java 侧，不可在 Node.js 绕行 | [000](./000-architecture.md) |
| 双重消息总线 | RabbitMQ (Java 间) + Redis Streams (Node.js) 独立运作 | [000](./000-architecture.md) [006](./006-database-infra.md) |
| 失败不收费 | 验证未通过或 Agent 执行异常时，不扣除 Credits | [004](./004-java-services.md) |
| Auth 单一收口 | 只在 Gateway 验证 JWT，下游只信任 X-User-Id header | [000](./000-architecture.md) |

---

## 如何使用这些规格

### 实施前
1. 根据角色阅读对应规格
2. 理解跨服务的交互契约
3. 确认文件清单和实施顺序

### 实施中
1. 严格遵循规格中的接口签名和数据结构
2. 按指定文件路径创建/修改文件
3. 遇到歧义时参考 ADR 决策上下文

### Code Review 时
1. 对照规格检查实现是否偏离设计意图
2. 关注跨边界的数据格式和错误处理
3. 验证测试覆盖是否达到矩阵要求

### 更新规格
- 实施过程中发现的规格错误 → 直接修改对应 spec 文件并注明原因
- 重大架构变更 → 先更新 [000-architecture.md](./000-architecture.md) 的 ADR，再传播到其他 spec
- 版本兼容性 → 新增 ADR 说明向后兼容策略

---

## 关联文档

- 主 spec: `e:\Git\agenthive-cloud\.qoder\specs\agenthive-cloud-spec.md`
- 项目规范: `e:\Git\agenthive-cloud\AGENTS.md`
- Agent 协作规范: `e:\Git\agenthive-cloud\CLAUDE.md`
- 快速参考: `e:\Git\agenthive-cloud\docs\quick-reference.md`

---

> **Hive Mode**: *Many minds, one goal.*
>
> 最后更新: 2026-05-09 — 基于 `e:\Git\agenthive-cloud\` 实际代码库编写

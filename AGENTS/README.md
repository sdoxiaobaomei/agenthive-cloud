# AgentHive Builders — 柴犬装修队

一个最小可用的 Multi-Agent 构建系统，用来迭代开发 `agenthive-cloud`。最终成熟的 agent 逻辑和配置可直接迁移到 `agenthive-cloud` 内部。

## 架构

```
agents/
├── orchestrator.ts          # 阿黄 (Tech Lead) — 任务拆解、调度、合并
├── workers/
│   ├── frontend-dev.ts      # 小花 — Vue / Nuxt / TS
│   ├── backend-dev.ts       # 阿铁 — Node.js / API / DB
│   └── qa-engineer.ts       # 阿镜 — 代码审查
├── shared/prompts/          # 各角色的 system prompt
├── tools/                   # LLM 客户端、文件工具、Git 工具
└── workspace/               # 每个 ticket 的隔离工作区
```

## 快速开始

### 1. 安装依赖

```bash
cd agents
npm install
```

### 2. 配置 LLM

复制示例环境变量文件并填写你的 API Key：

```bash
cp .env.example .env
```

编辑 `.env`：

```env
LLM_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
LLM_API_KEY=sk-your-dashscope-key
LLM_MODEL=qwen-coder-plus-latest
```

> 默认使用 DashScope（通义千问），也兼容 OpenAI / 任意 OpenAI-compatible 端点。

### 3. 运行一次构建任务

```bash
npx tsx orchestrator.ts "给 agenthive-cloud 的 web app 加一个项目工作室页面"
```

Orchestrator 会：
1. 分析需求并拆解成 Tickets
2. 按顺序启动对应的 Worker Agent
3. 收集 Worker 的修改，合并到 `workspace/staging/repo`
4. 最后交给 QA Agent 审查
5. **如果 QA 通过**，自动将修改同步回 `../agenthive-cloud` 并提交 Git

## 工作流示例

### 单前端任务
```bash
npx tsx orchestrator.ts "在 Dashboard 顶部增加柴犬头像展示区"
```

### 前后端联动任务
```bash
npx tsx orchestrator.ts "给任务看板增加优先级筛选功能，前端加 UI，后端加查询参数"
```

### 纯审查（手动触发 QA）
直接在生成的 tickets 里确保最后一个 ticket 的 `role` 是 `qa_engineer`。

## 核心设计原则

1. **单一决策者** — 只有 Orchestrator 能把代码写回 `agenthive-cloud`。
2. **文件隔离** — 每个 Worker 在独立的 workspace 里工作，互不干扰。
3. **完整文件输出** — Worker 返回完整文件内容，而不是 diff patch，避免 LLM 生成错误 patch。
4. **结构化通信** — Ticket 是唯一的通信协议，不依赖 agent 之间自由聊天。

## 限制与注意事项

- **LLM 成本**：每次运行会调用多次 LLM API（Plan + 每个 Worker + QA）。复杂任务可能消耗较多 token。
- **冲突处理**：当前版本没有真正的文件锁。如果一次任务同时拆给 FE 和 BE，它们分别改不同文件是安全的；如果改同一文件，后 apply 的会覆盖先 apply 的。Orchestrator 会在未来版本加入文件锁。
- **测试覆盖**：QA Agent 目前只做静态审查，不能真正运行测试。建议在 Orchestrator 合并后手动跑一次 `npm run test`。
- **Git 提交**：自动 commit 的消息是固定的 `Auto-commit by AgentHive builders`，建议在推送前用 `git rebase -i` 整理。

## 迭代方向

1. **加入文件锁** — Orchestrator 在拆分任务时检测文件冲突，避免并行覆盖。
2. **加入自动测试** — QA Worker 在 sandbox 里执行 `npm run test:unit`，把失败信息带回。
3. **加入对话式修复** — QA Reject 后，Orchestrator 自动创建 Fix Ticket 并重新分配给原 Worker。
4. **迁移进 AgentHive** — 将 `orchestrator.ts` 和 worker 逻辑封装为 `agenthive-cloud/apps/api/src/agents/` 下的服务，让 UI 里的柴犬团队真正"活"起来。

## 迁移路径

当这个外部 CLI 的 prompt 和调度逻辑稳定后，迁移到 `agenthive-cloud` 内部的步骤：

1. 将 `shared/prompts/*.md` 迁移到数据库或配置中心
2. 将 `orchestrator.ts` 改为一个 HTTP service（接收用户需求，返回 SSE 流式事件）
3. 将 Worker 改为异步 job consumer（BullMQ / RabbitMQ）
4. 前端 `Workspace.vue` 的柴犬 Dock 变成真正的任务进度监控面板

# 内置 Agent (Built-in Agents)

本目录包含 AI Digital Twin 的内置专业化 Agent。这些 Agent 设计为**轻量、快速、可 Fork**，用于处理特定类型的子任务。

## Agent 列表

| Agent | 用途 | 特点 |
|-------|------|------|
| `explore` | 代码库探索、搜索、理解 | 只读，无写权限，适合快速 fork |
| `plan` | 架构设计、方案规划 | 禁止写实现代码，输出设计文档 |
| `verify` | 测试运行、代码审查、质量检查 | 只读/低风险，可后台运行 |
| `general-purpose` | 通用委托 fallback | 继承父 Agent 权限，无特殊限制 |

## 使用方式

### 直接调用（通过 Agent Dispatcher）

```typescript
import { agentDispatcher } from '../core';

// 让 explore Agent 搜索所有 API 端点
const result = await agentDispatcher.spawn({
  agentType: 'explore',
  task: '找出 codebase 中所有的 REST API 端点',
  description: 'find-api-endpoints',
  isAsync: true
});
```

### 在自定义 Agent 中委托

任何角色 Agent（如 `backend-dev`）都可以通过 `agent_spawn` 工具调用内置 Agent：

```json
{
  "tool": "agent_spawn",
  "input": {
    "agent_type": "explore",
    "task": "探索 auth 模块的实现",
    "mode": "async_fork"
  }
}
```

## 内置 Agent vs 角色 Agent

- **角色 Agent**（`backend-dev`, `frontend-dev` 等）：代表团队中的固定角色，拥有 Gene/Skills/Memory/Duty/Reflection 的完整生命周期
- **内置 Agent**（`explore`, `plan`, `verify` 等）：代表临时任务的专业化分工，轻量、快速、用完即走

## 设计原则

1. **单一职责**：每个内置 Agent 只做一类事，界限清晰
2. **Fail-Closed**：默认禁用危险工具（如 `explore` 禁用 `file_write`）
3. **继承友好**：支持上下文继承，子 Agent 可以读取父 Agent 的 messages / filesTouched / decisions
4. **后台优先**：除 `plan` 外，其他内置 Agent 默认 `background: true`，适合 Fork 模式

## 扩展内置 Agent

如需新增内置 Agent：

1. 在本目录下新建 `{agentType}.md`
2. 文件顶部使用 YAML frontmatter 定义元数据
3. 在 `AGENTS/core/agent-registry.ts` 的 `BUILTIN_AGENTS` 列表中注册（如未自动扫描）
4. 更新本文档

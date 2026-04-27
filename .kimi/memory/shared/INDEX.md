# AgentHive Cloud — Shared Memory Index

> 所有 Agent 启动时的第一站。用于快速定位需要读取的记忆文件。
> 不要在这里存具体内容，只存索引和指针。

## 快速导航

| 需要做什么 | 读哪里 |
|-----------|--------|
| 了解协作规则 | `.kimi/memory/shared/collaboration-protocol.md` |
| 了解记忆如何管理 | `.kimi/memory/shared/memory-lifecycle.md` |
| 查看跨角色经验教训 | `.kimi/memory/shared/lessons-learned.md` |
| 查看历史任务 | `.kimi/memory/episodes/` (只读最近 5 个) |
| 查看已沉淀的技能 | `.kimi/memory/skills/<role>/README.md` |
| 写本次任务反思 | `.kimi/templates/reflection-template.md` |

## 记忆检索策略（必读）

1. **不要全读** — 永远不要用 Glob 读取整个 memory/ 目录
2. **先读索引** — 读本文件 + protocol + memory-lifecycle（<3KB 固定开销）
3. **按需搜索** — 用 Grep 根据当前 Ticket 关键词搜索相关文件
4. **选择性读取** — 只读与当前任务直接相关的 1-3 个文件
5. **用完即走** — 读到的记忆用完即可，不需要保留在后续上下文中

## 各角色技能库索引

### Java Agent
- `.kimi/memory/skills/java/README.md`
- 关注: `official/patterns/`, `official/fixes/`

### Node Agent
- `.kimi/memory/skills/node/README.md`
- 关注: `official/patterns/`, `official/fixes/`

### Frontend Agent
- `.kimi/memory/skills/frontend/README.md`
- 关注: `official/patterns/`, `official/fixes/`

### Platform Agent
- `.kimi/memory/skills/platform/README.md`
- 关注: `official/patterns/`, `official/fixes/`

## 记忆健康状态（最后更新: 2026-04-27）

| 目录 | 文件数 | 状态 |
|------|--------|------|
| reflections/ | 0 | 健康 |
| episodes/ | 0 | 健康 |
| skills/*/official/ | 0 | 健康 |
| skills/*/draft/ | 0 | 健康 |
| shared/ | 4 | 健康 |

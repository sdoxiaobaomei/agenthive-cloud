# AgentHive Cloud — Shared Memory Index

> 所有 Agent 启动时的第一站。纯索引文件，<500 tokens。
> 不要在这里存具体内容，只存索引和指针。

## 快速导航

| 需要做什么 | 读哪里 | Token 预算 |
|-----------|--------|-----------|
| 了解协作规则 | `collaboration-protocol.md` | ~1K |
| 了解记忆如何管理（token 预算） | `memory-lifecycle.md` | ~2K（摘要） |
| 了解 Ticket 执行流程 | `AGENTS/workflow-checklist.md` | ~1K |
| 查看跨角色经验教训 | `lessons-learned.md` | ~3K |
| 查看历史任务 | `episodes/` (最近 3 个) | ~6K |
| 查看已沉淀的技能 | `skills/<role>/README.md` | ~500 |
| 写本次任务反思 | `.kimi/templates/reflection-template.md` | — |

## 记忆检索策略（必读）

1. **不要全读** — 启动时工作记忆严格控制在 ~28K tokens 内
2. **先读索引** — 读本文件 + protocol + lifecycle 摘要（<3K tokens 固定开销）
3. **按需搜索** — 用 Grep 根据当前 Ticket 关键词搜索相关文件
4. **分层加载** — L0 核心协议 → L1 技能索引 → L2 相关 skill → L3 episode → L4 reflection
5. **用完即走** — 读到的记忆用完即可，不需要保留在后续上下文中

## 各角色技能库索引

| 角色 | README | official/ 预算 |
|------|--------|---------------|
| Java Agent | `skills/java/README.md` | ≤1.5K / skill |
| Node Agent | `skills/node/README.md` | ≤1.5K / skill |
| Frontend Agent | `skills/frontend/README.md` | ≤1.5K / skill |
| Platform Agent | `skills/platform/README.md` | ≤1.5K / skill |

## Token 预算分层速查

```
总上下文窗口: 128K tokens
└─ 工作记忆预算: ~28K tokens (22%)
    ├─ L0 核心协议:        ~2.0K
    ├─ L1 技能索引:        ~0.5K
    ├─ L2 相关技能:        ~4.5K  (1-3 个 skill)
    ├─ L3 情景记忆:        ~6.0K  (最近 3 个 episode)
    ├─ L4 反思记录:        ~4.5K  (3-5 个相关 reflection)
    ├─ L5 经验教训:        ~3.0K  (lessons-learned.md 硬上限)
    └─ L6 任务上下文:      ~7.5K  (当前 TICKET + 代码)
```

## 记忆健康状态（Token-Based）

> 估算公式: `tokens ≈ bytes × 0.5` (UTF-8 中文文本经验值)
> 最后更新: 2026-04-29 (维护后)

| 目录 | 文件数 | 总 Bytes | 总 Token 估算 | 阈值 | 状态 |
|------|--------|----------|--------------|------|------|
| reflections/ (active) | 7 | ~17.3K | ~8.6K | >15K 触发压缩 | 🟢 健康 |
| reflections/ (archived) | 28 | ~84.6K | ~42.3K | — | 🟢 已归档 |
| episodes/ | 6 | ~24.8K | ~12.4K | >30K 触发合并 | 🟢 健康 |
| skills/*/official/ | **30** | ~31.7K | ~15.8K | >20K 触发审查 | 🟢 健康 |
| skills/*/draft/ | **4** | ~6.6K | ~3.3K | >10 个触发审查 | 🟢 健康 |
| shared/lessons-learned.md | 1 | ~3.8K | ~1.9K | >3K 触发归档 | 🟢 健康 |
| shared/lessons-learned-archive.md | 1 | ~2.7K | ~1.4K | — | 🟢 健康 |
| shared/ | 7 | — | — | — | 🟢 健康 |

> ✅ 2026-04-29 维护完成：6 个 approved reflections 归档，8 个 draft skills 晋升 official，4 个 draft 保留考察。
> ✅ 所有指标均在健康阈值内，Agent 系统可正常运行。

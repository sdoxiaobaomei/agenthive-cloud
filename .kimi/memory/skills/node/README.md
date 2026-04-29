# Node.js Agent — Procedural Memory / Skills

可复用的 Node.js/TypeScript 开发模式、代码模板、问题解决方案。

## 目录结构

```
skills/node/
├── README.md                 # 本文件（索引）
├── official/                 # 已验证的、可复用的技能
│   └── patterns/             # 代码模式与最佳实践
├── draft/                    # 候选技能，考察期 30 天
└── retired/                  # 已淘汰（技术栈变更导致过时）
```

## 当前技能库

### official/patterns/（已验证）

- `app-error.md` — 应用错误类与错误码规范
- `database-access.md` — 数据库访问模式
- `redis-stream-consumer.md` — Redis Stream 消费者
- `structured-logging.md` — 结构化日志
- `zod-validation.md` — Zod 校验模式
- `filesystem-async-patterns.md` — 文件系统异步操作模式（TICKET-FEAT-002a）
- `redis-set-uv-dedup.md` — Redis Set UV 去重（TICKET-NODE-MKT-002）

## 添加新技能（最小可行流程）

当任务中发现新的可复用模式时：

1. **任务完成后**， Specialist 在 reflection 中标记 `skill_candidate: true`
2. **Lead 审查时**，若认可该模式的价值，指令 Specialist 写入 `draft/`
3. **30 天内**：若该 draft 被引用/使用 ≥ 1 次，Lead 将其移至 `official/`
4. **30 天后**：若无人引用，Lead 决定是否删除或归档至 `retired/`

> ⚠️ 注意：当前不支持自动 Curator 写入。所有 skill 新增需经 Lead 审查后手动/指令写入。

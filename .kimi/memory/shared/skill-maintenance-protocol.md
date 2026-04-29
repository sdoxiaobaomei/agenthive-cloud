# Skill 最小可行维护流程（MVMP）

> 替代原设计中"自动 Curator 写入"的方案。当前 Agent 基础设施不支持自动 skill 沉淀，改为**人工引导式流程**。
> 版本: v1.0 | 生效日期: 2026-04-27

---

## 1. 核心原则

- **不追求完美自动化**：当前阶段，所有 skill 写入需经 Lead 审查后触发
- **最小可行**：流程不超过 3 步，不增加 Specialist 额外负担
- **价值驱动**：只有"被重复遇到 2 次以上"或"踩过坑的教训"才值得沉淀

---

## 2. 角色职责

| 角色 | 职责 |
|------|------|
| **Specialist** | 任务完成后，在 RESPONSE.yaml 中标记 `skill_candidate: true` 并简述候选 skill 内容 |
| **Lead** | 审查时评估 skill 价值，决定是否指令 Specialist 写入 `draft/` |
| **Lead（月度）** | 每月检查 `draft/` 内容，执行晋升/淘汰/归档 |

---

## 3. 写入流程（3 步）

```
Step 1: 发现
  Specialist 在完成任务后，判断是否有可复用的模式/教训
  → 在 RESPONSE.yaml 中增加字段：
    skill_candidate: true
    skill_summary: "发现了 XX 问题，解决方案是 YY"

Step 2: 审查
  Lead 审阅 RESPONSE.yaml 时，看到 skill_candidate
  → 判断标准：
    - 这个模式是否会在未来 3 个月内再次出现？
    - 这个教训的踩坑成本是否高？（>30 分钟调试）
    - 是否已有现有 skill 覆盖？（查重）
  → 决策：
    - 有价值 → 指令 Specialist "将此模式写入 skills/<role>/draft/<name>.md"
    - 无价值 → 忽略，不在 reflection 中记录

Step 3: 写入
  Specialist 按模板写入 draft 文件
  → 必须包含：场景描述、代码示例、踩坑经过、注意事项
  → 文件头格式：
    # [Draft] Skill 名称
    > 来源: TICKET-XXX
    > 创建日期: YYYY-MM-DD
    > 考察期截止: YYYY-MM-DD + 30天
```

---

## 4. 晋升/淘汰规则

> 📎 详细规则参见 `memory-lifecycle.md` "Skill 精选与淘汰策略"章节。
> 本文件仅保留触发条件摘要：

- **晋升**：draft 被引用/使用 ≥ 1 次（30 天内）→ Lead 移至 `official/`
- **延长**：零引用但有长期价值 → 延长至 60 天
- **删除**：零引用且价值存疑 → 删除
- **归档**：技术栈升级导致过时 → 移至 `retired/`
- **合并**：与现有 official 重复 → 保留更高质量版本

---

## 5. 质量门槛

一个合格的 skill 必须回答：

1. **何时使用？** — 具体场景，不是泛泛而谈
2. **代码怎么写？** — 可直接复制粘贴的示例
3. **注意事项？** — 边界条件、常见错误
4. **来源？** — 哪个 TICKET 中发现的（可追溯）

不合格示例：
```markdown
# Pattern: 使用 Redis

Redis 很快，建议用 Redis 缓存数据。
```

合格示例：
```markdown
# Pattern: Redis Stream 消费者显式 ACK

## 场景
使用 Redis Stream 作为消息队列时，消费者处理消息后必须显式 ACK，否则消息会保留在 Pending Entries List 中导致内存泄漏。

## 代码
XREADGROUP GROUP mygroup myconsumer STREAMS mystream >
XACK mystream mygroup $messageId

## 踩坑经过
TICKET-NODE-003 中，消费者崩溃后重启，发现旧消息不断堆积。原因是只 XREADGROUP 没有 XACK。

## 注意事项
- 必须在业务逻辑成功执行后才 ACK
- 若先 ACK 后执行业务，可能导致消息丢失
```

---

## 6. 当前已知问题

| 问题 | 状态 | 跟踪 |
|------|------|------|
| 现有 21 个 official skill 为批量初始化，非实战沉淀 | 🟡 接受 | 后续执行 Ticket 时逐步替换/充实 |
| 部分 skill 存在 UTF-8 编码损坏 | 🔴 待修复 | 下次编辑时修复 |
| 无自动 Curator 支持 | 🟡 接受 | 当前阶段使用本 MVMP 替代 |

---

## 7. 与现有协议的衔接

本协议是对 `collaboration-protocol.md` 和 `memory-lifecycle.md` 中 Skill 章节的**降级实现**：

- 原设计：Curator 自动发现 → 自动写入 draft → 自动晋升
- 本协议：Specialist 标记 → Lead 审查 → 指令写入 → 月度晋升

当未来 Agent 基础设施支持自动 Curator 时，可平滑升级回原设计。

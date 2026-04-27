# AgentHive Cloud — Memory Lifecycle Management v1.0

> 解决记忆膨胀问题：不是"记住一切"，而是"记住该记住的，忘掉该忘掉的"。
> Based on: Generative Agents (Memory Stream + Reflection), Mem0 (consolidation + dedup),
> Agentic Memory (RL-driven forgetting), and practical context window economics.

---

## 核心原则

1. **Context Window ≠ Memory** — 记忆可以存很多，但注入上下文的必须精选
2. **Not remembering everything is a feature** — 遗忘是设计，不是 bug
3. **Treat procedural memory as code** — Skills 是代码资产，需要版本化和审查
4. **Raw records + Synthesized insights** — 原始记录和综合洞察分开存储

---

## 记忆分层与生命周期

```
Tier 1: WORKING MEMORY (工作记忆)
  ├── 位置: In-context (当前 Kimi 会话)
  ├── 内容: 当前 Ticket 上下文、已修改文件列表、中间推理
  ├── 容量: 受限于模型上下文窗口 (~128K-200K tokens)
  ├── 生命周期: SESSION — 会话结束即丢弃
  └── 管理策略: 自动 — 由 Kimi CLI 管理

Tier 2: REFLECTIONS (反思记录)
  ├── 位置: .kimi/memory/reflections/
  ├── 内容: 每次任务的 Generator-Reflector-Curator 输出
  ├── 生命周期: 30 DAYS ACTIVE → COMPRESS → ARCHIVE
  └── 管理策略: 见下文 "Reflection 压缩策略"

Tier 3: EPISODES (情景记忆)
  ├── 位置: .kimi/memory/episodes/
  ├── 内容: Lead 归档的完整任务摘要（跨角色视角）
  ├── 生命周期: 90 DAYS ACTIVE → MERGE → ARCHIVE
  └── 管理策略: 见下文 "Episode 合并策略"

Tier 4: PROCEDURAL MEMORY / SKILLS (程序记忆)
  ├── 位置: .kimi/memory/skills/<role>/
  ├── 内容: 可复用的代码模式、解决方案、最佳实践
  ├── 生命周期: PERMANENT — 但需定期审查 (quarterly review)
  └── 管理策略: 见下文 "Skill 精选与淘汰策略"

Tier 5: SHARED CONTEXT (共享上下文)
  ├── 位置: .kimi/memory/shared/
  ├── 内容: 协作协议、经验教训、架构决策
  ├── 生命周期: PERMANENT — 但需去重和更新
  └── 管理策略: 见下文 "Shared Context 维护策略"
```

---

## Tier 2: Reflection 压缩策略

### 问题
每个任务产生一个 reflection（~300-500 字）。100 个任务 = 50KB 纯文本，全部读入上下文 = 灾难。

### 解决方案：30-60-90 规则

```
Day 0-30:   ACTIVE — 完整保留，Agent 启动时按需读取
Day 31-60:  COMPRESSED — Lead 每月运行压缩脚本，合并为"月度摘要"
Day 61-90:  ARCHIVED — 移入 .kimi/memory/archive/reflections/YYYY-MM/
Day 91+:    PURGED — 彻底删除（月度摘要已保留精华）
```

### 压缩模板（月度摘要）

```markdown
# Reflection Summary: 2026-04

## High-Frequency Patterns (出现 3+ 次)
- [Pattern] 流式响应处理 — 3 个任务涉及大文件导出
- [Anti-Pattern] Pinia Store 中直接调用 localStorage

## One-Time Insights (仅出现 1 次但高价值)
- [Insight] Redis Stream 消费者需要显式 ACK

## Mistakes to Avoid
- [Mistake] T042: Java Agent 误用 ${} 导致 SQL 注入风险

## Skill Additions
- skills/java/patterns/streaming-response.md ← 新增
```

---

## Tier 3: Episode 合并策略

### 问题
Lead 每次完成复杂任务都写一个 episode。长期积累后，查找相关历史变得困难。

### 解决方案：季度合并 + 主题索引

```
Active Episodes (0-90 天):
  ├── episodes/2026-Q2/
  │   ├── dashboard-export.md
  │   └── auth-refactor.md
  └── 按时间倒序，Agent 启动时只读最近 5 个

Archived Episodes (90+ 天):
  ├── episodes/archive/
  │   └── 2026-Q1-summary.md
  └── 不再自动读取，只有明确搜索时才读
```

### Episode 读取策略（不是全读！）

1. 读取 episodes/ 目录下的文件列表
2. 按修改时间排序，只读最近 5 个（约 2-3KB）
3. 如果有明确相关主题，额外搜索包含该关键词的 episode
4. 90 天前的 episode 不读，除非明确指定

类比：就像人类工程师不会把公司过去 3 年的所有 PR 描述都背下来，只记得最近几个 + 搜索需要的。

---

## Tier 4: Skill 精选与淘汰策略

### 问题
Skills 是"程序记忆"，最容易膨胀。每个 Agent 每次发现新 pattern 就写一个 skill，很快变成垃圾堆。

### 解决方案：Skill 必须通过"价值审查"才能永久保留

```
新 Skill 诞生流程：

Curator 发现 pattern
    ↓
写入 skills/java/draft/streaming-response.md
    ↓
标记为 DRAFT，有效期 30 天
    ↓
30 天内被引用/使用 >= 2 次？
    ↓
YES → 晋升为 OFFICIAL
NO  → 删除或降级为 note
```

### Skill 目录结构

```
skills/
├── java/
│   ├── official/     ← 已验证的、可复用的技能
│   │   ├── patterns/
│   │   ├── fixes/
│   │   └── snippets/
│   ├── draft/        ← 候选技能，30 天考察期
│   └── retired/      ← 已淘汰（技术栈变更导致过时）
├── node/
│   ├── official/
│   ├── draft/
│   └── retired/
├── frontend/
│   └── ...
└── platform/
    └── ...
```

### Skill 淘汰规则（每季度由 Lead 审查）

| 条件 | 动作 |
|------|------|
| 技术栈已升级，skill 不再适用 | 移入 retired/，保留但不再读取 |
| 有更好的替代方案出现 | 更新原 skill 或标记 deprecated |
| 90 天内零引用 | 降级为 draft，再 30 天无引用则删除 |
| 与现有 skill 重复 | 合并，保留质量更高的版本 |

### Skill 读取策略（JiT - Just in Time）

不是启动时全读！

Agent 启动时:
1. 读取 skills/<role>/README.md（索引文件，<500 字）
2. 根据当前 Ticket 的技术关键词，选择性读取 1-3 个相关 skill

执行过程中:
3. 遇到具体问题时，再读对应的 skill 文件
4. 用完即走，不保留在上下文中

---

## Tier 5: Shared Context 维护策略

### 问题
lessons-learned.md 和 collaboration-protocol.md 会无限增长。

### 解决方案：版本化 + 去重 + 年度重构

```
shared/
├── collaboration-protocol.md      ← 核心协议，精简常驻（<5KB）
├── lessons-learned.md             ← 活跃教训（最近 90 天），定期清理
├── lessons-learned-archive.md     ← 归档教训（90+ 天），按需搜索
├── architecture-decisions/        ← 重大架构决策记录（ADR）
│   ├── 001-message-queue-choice.md
│   └── 002-auth-unification.md
└── INDEX.md                       ← 所有共享文件的索引/目录
```

### 去重规则

写入 lessons-learned.md 前检查：
1. 这条教训是否已存在？（相似度 > 80%）→ 合并或跳过
2. 这条教训是否已被某个 skill 覆盖？→ 指向 skill 而不是重复
3. 这条教训是否还适用当前技术栈？→ 过时则归档

---

## 记忆检索策略：不是"读全部"，而是"搜相关的"

### 错误做法（必须避免）

❌ 启动时读取整个 memory/ 目录
  ReadFile: .kimi/memory/episodes/*          → 50KB
  ReadFile: .kimi/memory/skills/java/*       → 30KB
  ReadFile: .kimi/memory/reflections/*       → 100KB
  ReadFile: .kimi/memory/shared/*            → 20KB
  ─────────────────────────────────────────────────
  Total: ~200KB 注入上下文，其中 80% 与当前任务无关

### 正确做法 — 按需检索，分层加载

Step 1: 读取索引（固定，<1KB）
  → ReadFile: .kimi/memory/shared/collaboration-protocol.md
  → ReadFile: .kimi/memory/shared/INDEX.md

Step 2: 根据 Ticket 关键词检索相关记忆（动态，<5KB）
  → Grep "导出" in .kimi/memory/episodes/  → 找到 dashboard-export.md
  → Grep "流式" in .kimi/memory/skills/java/  → 找到 streaming-response.md
  → ReadFile: 只读这 2 个文件

Step 3: 执行过程中按需加载
  → 遇到 Redis Stream 问题 → Grep "Redis Stream" in skills/node/
  → 找到相关 skill → ReadFile → 使用 → 不保留

Total: ~5KB 高度相关的上下文

---

## 自动化维护脚本

### 脚本 1: 月度 Reflection 压缩

```powershell
# scripts/maintenance/compress-reflections.ps1
# 每月 1 号运行
# 输入: .kimi/memory/reflections/*.md
# 输出: .kimi/memory/reflections/summary-YYYY-MM.md + archive/
```

### 脚本 2: 季度 Skill 审查

```powershell
# scripts/maintenance/review-skills.ps1
# 每季度运行
# 检查: draft/ 中 30+ 天未晋升的文件
# 检查: official/ 中 90+ 天零引用的文件
# 输出: 审查报告，建议删除/降级/保留
```

### 脚本 3: 记忆健康检查

```powershell
# scripts/maintenance/memory-health-check.ps1
# 每周运行
# 指标:
#   - reflections/ 文件数 > 30 → 警告，建议压缩
#   - skills/*/official/ 文件数 > 50 → 警告，建议审查
#   - lessons-learned.md 大小 > 10KB → 警告，建议归档
#   - archive/ 总大小 > 500KB → 警告，可考虑清理
```

---

## 记忆经济学：成本控制

| 操作 | 成本 | 策略 |
|------|------|------|
| 读 1 个 reflection (500 字) | ~750 tokens | 只读最近 5 个 |
| 读 1 个 skill (1KB) | ~1500 tokens | JiT 加载，只读相关的 |
| 读全部 episodes (50KB) | ~75K tokens | 禁止，用 Grep 筛选 |
| 写 1 个 reflection | ~500 tokens | 必须写，但 30 天后压缩 |
| 月度压缩（LLM 总结） | ~3K tokens | 一次性，节省未来 100K+ tokens |

结论：月度压缩的投入产出比约为 1:30。

---

## Anti-Patterns（记忆管理中的禁忌）

- ❌ Memory hoarding: 从不清理，认为"存着总没坏处"
- ❌ Greedy loading: 启动时加载整个 memory/ 目录
- ❌ Stale skills: 技术栈升级后，旧 skill 仍在被读取
- ❌ Duplicate insights: 同样的教训写 10 次，不去重
- ❌ No raw records: 只存总结，没有原始记录可追溯
- ❌ Context stuffing: 把无关记忆硬塞进 prompt，稀释核心指令

# AgentHive Cloud — Memory Lifecycle Management v2.0 (Token-Based)

> 解决记忆膨胀问题：不是"记住一切"，而是"在 token 预算内记住最有价值的东西"。
> Based on: Deer-Flow Context Engineering, Hermes Agent Bounded Memory, Generative Agents (Memory Stream + Reflection), Mem0.
> 
> **核心变更 (v1.0 → v2.0)**: 管理单位从"天数"改为"token 数量"。上下文窗口是 Agent 的稀缺资源，天数是无意义单位。

---

## 核心原则

1. **Context Window = 核心约束** — 不是"能存多少"，而是"能注入多少而不稀释任务上下文"
2. **Token 是唯一通用单位** — 1 个汉字 ≈ 1.5 tokens，1 个英文单词 ≈ 1.3 tokens
3. **Bounded Memory 强制精选** — 每个记忆文件有硬 token 上限，超出时必须丢弃或归档
4. **渐进加载（Progressive Loading）** — 不是启动时全读，而是按任务相关性逐层加载
5. **闭环学习（Closed-Loop Learning）** — Execute → Evaluate → Abstract → Refine，skill 从实战中自动/半自动提炼

---

## 上下文窗口预算分配

假设模型上下文窗口 **128K tokens**。工作记忆（注入上下文的）严格控制在 **~28K tokens（22%）**，为任务执行保留 **~100K tokens**。

```
Total Context Window: 128K tokens
├─ Workload (任务执行): ~100K tokens (78%) ← 留给实际工作
└─ Working Memory (工作记忆): ~28K tokens (22%) ← 严格控制
    ├─ L0 核心协议:        ~2.0K  (INDEX + protocol + workflow)
    ├─ L1 技能索引:        ~0.5K  (skills/<role>/README.md)
    ├─ L2 相关技能:        ~4.5K  (1-3 个 skill，每个 ≤1.5K)
    ├─ L3 情景记忆:        ~6.0K  (最近 3 个 episode，每个 ≤2K)
    ├─ L4 反思记录:        ~4.5K  (3-5 个相关 reflection，每个 ≤1.5K)
    ├─ L5 经验教训:        ~3.0K  (lessons-learned.md 硬上限)
    └─ L6 任务上下文:      ~7.5K  (当前 TICKET + 相关代码)
```

**超载时的丢弃优先级**（从低到高）：
1. L6 中最旧的代码上下文 → 丢弃
2. L4 中相关性最低的 reflection → 丢弃
3. L3 中最旧的 episode → 丢弃
4. L2 中相关性最低的 skill → 不加载
5. L5 压缩为摘要 → 归档到 `lessons-learned-archive.md`

---

## 记忆分层与 Token 预算

### Tier 0: CORE PROTOCOLS（核心协议）

| 属性 | 值 |
|------|-----|
| 位置 | `.kimi/memory/shared/{INDEX, collaboration-protocol, workflow-checklist}.md` |
| Token 预算 | **2K tokens**（合计） |
| 加载策略 | 每次启动必载 |
| 生命周期 | PERMANENT |

**约束**：
- `INDEX.md` ≤ 500 tokens（纯索引，无详细内容）
- `collaboration-protocol.md` ≤ 1K tokens（通信格式 + 质量门）
- `workflow-checklist.md` ≤ 1K tokens（6 步检查项摘要）
- 超出预算时：删除冗余描述，保留结构化表格

### Tier 1: SKILL INDEX（技能索引）

| 属性 | 值 |
|------|-----|
| 位置 | `.kimi/memory/skills/<role>/README.md` |
| Token 预算 | **500 tokens / 角色** |
| 加载策略 | 每次启动必载（只读自己角色的） |
| 生命周期 | PERMANENT |

**约束**：
- 只列出 skill 名称和一句话描述
- 禁止在 README 中写完整 skill 内容（内容在 official/ 下）

### Tier 2: PROCEDURAL MEMORY / SKILLS（程序记忆）

| 属性 | 值 |
|------|-----|
| 位置 | `.kimi/memory/skills/<role>/official/*.md` |
| Token 预算 | **1.5K tokens / skill** |
| 加载策略 | JiT（Just in Time），按任务关键词匹配 1-3 个 |
| 生命周期 | PERMANENT，但需定期审查 |

**目录结构**：
```
skills/
├── java/
│   ├── README.md                 # ≤500 tokens
│   ├── official/
│   │   └── patterns/
│   │       └── *.md              # 每个 ≤1.5K tokens
│   ├── draft/                    # 候选 skill
│   └── retired/                  # 已淘汰
├── node/
├── frontend/
└── platform/
```

**硬约束**：
- 单个 skill 文件 > 1.5K tokens → 必须拆分为多个 skill 或压缩
- `skills/*/official/` 总 token 数 > 20K → 触发审查，考虑归档或合并

### Tier 3: EPISODES（情景记忆）

| 属性 | 值 |
|------|-----|
| 位置 | `.kimi/memory/episodes/*.md` |
| Token 预算 | **2K tokens / episode** |
| 加载策略 | 启动时读取最近 3 个（~6K tokens）；关键词匹配时额外加载 |
| 生命周期 | 90 个 episode 或总 token > 30K 时触发合并 |

**硬约束**：
- 单个 episode > 2K tokens → 必须压缩（删除冗余细节，保留决策和教训）
- `episodes/` 总 token 数 > 30K → 合并为季度摘要，归档到 `episodes/archive/`

### Tier 4: REFLECTIONS（反思记录）

| 属性 | 值 |
|------|-----|
| 位置 | `.kimi/memory/reflections/*.md` |
| Token 预算 | **1.5K tokens / reflection** |
| 加载策略 | Grep 关键词匹配后选择性读取 3-5 个 |
| 生命周期 | 总 token > 15K 时触发压缩为月度摘要 |

**硬约束**：
- 单个 reflection > 1.5K tokens → 压缩（删除代码细节，保留模式和教训）
- `reflections/` 总 token 数 > 15K → 生成 `summary-YYYY-MM.md`，归档原始

### Tier 5: SHARED CONTEXT（共享上下文）

| 属性 | 值 |
|------|-----|
| 位置 | `.kimi/memory/shared/lessons-learned.md` |
| Token 预算 | **3K tokens** |
| 加载策略 | 每次启动加载 |
| 生命周期 | PERMANENT，但超出时归档 |

**硬约束**：
- > 3K tokens → 将最旧的条目移至 `lessons-learned-archive.md`
- 禁止重复记录技术细节（应指向 skill 或 episode）
- 只保留跨角色洞察（架构、协作、流程教训）

---

## Token 压缩策略

### Reflection 压缩（总 token > 15K 触发）

不是按时间压缩，而是按 **信息密度** 压缩：

```
输入: 15K tokens 的 reflections（约 10 个）
↓
步骤 1: 去重 — 删除与现有 skill/lessons 重复的内容
步骤 2: 提取高频模式 — 出现 ≥2 次的模式提炼为 bullet point
步骤 3: 保留唯一洞察 — 只出现 1 次但高价值的教训保留
步骤 4: 生成摘要 — 输出 ≤3K tokens 的月度摘要
步骤 5: 归档 — 原始 reflections 移至 archive/
```

### Episode 合并（总 token > 30K 触发）

```
输入: 30K tokens 的 episodes（约 15 个）
↓
步骤 1: 按主题分组（如 "Java 部署"、"编码事故"）
步骤 2: 每组生成一个摘要 episode（≤2K tokens）
步骤 3: 原始 episodes 移至 archive/
```

### Skill 审查（official/ 总 token > 20K 触发）

```
输入: 20K tokens 的 official skills（约 13 个）
↓
步骤 1: 标记近 30 天内零引用的 skill
步骤 2: 评估是否过时或与现有 skill 重复
步骤 3: 过时/重复 → 移至 retired/ 或合并
步骤 4: 更新 README 索引
```

---

## Skill 闭环学习（Closed-Loop Learning）

基于 Hermes Agent 的四阶段循环，适配 AgentHive 的多 Agent 协作场景：

```
┌─────────┐    ┌──────────┐    ┌──────────┐    ┌─────────┐
│ Execute │ → │ Evaluate │ → │ Abstract │ → │ Refine  │
│ (Specialist│   │ (Specialist│   │ (Lead +   │   │ (Lead    │
│  执行代码) │   │  自评结果) │   │  Specialist│   │  月度审查)│
└─────────┘    └──────────┘    └────┬─────┘    └────┬────┘
     ↑______________________________│_______________│
```

### 触发条件（Token-Based）

不是"每 3 个 Ticket"或"每 30 天"，而是：

| 触发条件 | 动作 |
|----------|------|
| 同一问题模式被 **2 个以上 Ticket** 遇到 | Specialist 在 reflection 中标记 `skill_candidate: true` |
| 单个 Ticket 消耗 **>10K tokens** 调试 | 强制要求产出 skill（踩坑成本高） |
| `skills/*/draft/` 中有 **≥1 个** 候选 | Lead 月度审查时评估晋升 |
| `skills/*/official/` 总 token **>20K** | 触发淘汰/合并审查 |

### 质量门槛（必须回答 4 个问题）

一个合格的 skill 必须包含：
1. **何时使用？** — 具体场景（不是"使用 Redis"）
2. **代码怎么写？** — 可直接复制粘贴的示例
3. **注意事项？** — 边界条件、常见错误
4. **来源？** — 哪个 TICKET 中发现的（可追溯）

---

## 记忆检索策略（Token-Aware）

### 错误做法（贪婪加载）

```
❌ 启动时加载整个 memory/ 目录
  ReadFile: .kimi/memory/episodes/*          → ~30K tokens
  ReadFile: .kimi/memory/skills/java/*       → ~20K tokens
  ReadFile: .kimi/memory/reflections/*       → ~22K tokens
  ReadFile: .kimi/memory/shared/*            → ~10K tokens
  ─────────────────────────────────────────────────
  Total: ~82K tokens 注入上下文，稀释任务指令
  实际可用给任务执行: 128K - 82K = 46K tokens
```

### 正确做法（分层按需加载）

```
Step 1: 加载 L0 + L1（固定开销，~2.5K tokens）
  → ReadFile: INDEX.md (500 tokens)
  → ReadFile: memory-lifecycle.md 摘要 (1000 tokens) ← 只读摘要部分
  → ReadFile: skills/<role>/README.md (500 tokens)

Step 2: 根据 TICKET 关键词动态加载（~15K tokens）
  → Grep "Redis" in skills/node/ → 找到 redis-stream-consumer.md
  → Grep "deploy" in episodes/ → 找到 2 个相关 episode
  → ReadFile: 只读这 3 个文件 (~4.5K tokens)

Step 3: 执行过程中按需加载（~8K tokens）
  → 遇到具体问题时再搜索相关 memory
  → 用完即走，不保留在上下文中

Total: ~25K tokens 工作记忆，留给任务执行: ~103K tokens
```

---

## 自动化维护触发器

| 检查项 | 阈值 | 状态 | 动作 |
|--------|------|------|------|
| `reflections/` 总 tokens | > 15K | 🟡 警告 | 生成月度摘要，归档原始 |
| `episodes/` 总 tokens | > 30K | 🟡 警告 | 按主题合并，归档原始 |
| `skills/*/official/` 总 tokens | > 20K | 🟡 警告 | 审查淘汰/合并 |
| `lessons-learned.md` | > 3K | 🔴 超载 | 归档最旧条目 |
| 单个 skill | > 1.5K | 🔴 超载 | 拆分或压缩 |
| 单个 reflection | > 1.5K | 🔴 超载 | 压缩 |
| 单个 episode | > 2K | 🔴 超载 | 压缩 |

---

## Anti-Patterns（记忆管理中的禁忌）

- ❌ **Memory hoarding**: 从不清理，认为"存着总没坏处"
- ❌ **Greedy loading**: 启动时加载整个 memory/ 目录
- ❌ **Time-based eviction**: 按天数删除记忆（应该用 token 预算和信息密度）
- ❌ **Stale skills**: 技术栈升级后，旧 skill 仍在被读取
- ❌ **Duplicate insights**: 同样的教训写 10 次，不去重
- ❌ **Context stuffing**: 把无关记忆硬塞进 prompt，稀释核心指令
- ❌ **Unbounded growth**: 任何记忆文件无上限增长

---

## 版本历史

- **v2.0** (2026-04-27): 核心变更 — 管理单位从"天数"改为"token 数量"；引入分层 token 预算；闭环学习触发条件改为 token-based。
- **v1.0** (2026-04-27): 初始版本，基于时间的天数管理（30-60-90 规则）。

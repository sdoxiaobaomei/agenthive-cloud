# AgentHive Cloud — Ticket 执行 Workflow 检查清单

> 版本: v1.0 | 生效日期: 2026-04-27
> 适用对象: Lead (阿黄) + 所有 Specialist Agents

---

## Workflow 概览

```
[需求] → Lead 分解 → TICKET.yaml
            ↓
      Lead 派发 → Agent dispatch
            ↓
      Specialist 执行 → 修改代码 + 测试
            ↓
      Specialist 输出 → RESPONSE.yaml
            ↓
      Lead 审查 → LEAD_REVIEW.yaml
            ↓
      Lead 状态更新 → TICKET.yaml status = approved/completed
            ↓
      Specialist 反思 → reflection/*.md
            ↓
      [可选] Skill 沉淀 → skills/<role>/draft/*.md
```

---

## Step 1: 需求分解（Lead 独有）

**输入**: 用户需求 / 产品规划 / 技术债务
**输出**: `AGENTS/workspace/TICKET-XXX/TICKET.yaml`

### 检查项

- [ ] `ticket_id` 符合命名规范（`TICKET-{DOMAIN}-{NNN}`）
- [ ] `type` 为 `feature|bugfix|refactor|docs|security` 之一
- [ ] `priority` 为 `P0|P1|P2|P3` 之一
- [ ] `acceptance_criteria` 可验证、可量化
- [ ] `relevant_files` 列出关键文件路径
- [ ] `depends_on` 明确标注依赖 Ticket
- [ ] `status` 初始化为 `pending`

---

## Step 2: 派工执行（Lead → Specialist）

**输入**: TICKET.yaml
**动作**: `Agent` 工具派发 或 人工指派

### 检查项

- [ ] Specialist 确认理解 acceptance criteria
- [ ] Specialist 读取相关 skills（`skills/<role>/README.md` + 1-3 个相关 pattern）
- [ ] Specialist 读取相关 episodes（最近 5 个或关键词匹配）
- [ ] Lead 确认 Specialist 已就绪，标记 `status: in_progress`

### ⚠️ Agent 工具故障时的回退

若 `Agent` 工具失败：
1. [ ] 记录故障现象和尝试过的修复
2. [ ] **上报人类用户**，请求指示
3. [ ] 仅在获得明确授权后，方可由 Lead 直接 Shell 执行
4. [ ] 所有 Shell 执行的变更必须在 `lessons-learned.md` 记录为技术债务

---

## Step 3: 执行与自验（Specialist 独有）

**输入**: TICKET.yaml 中的任务描述和验收标准
**输出**: 代码修改 + `AGENTS/workspace/TICKET-XXX/RESPONSE.yaml`

### 检查项（Definition of Done）

- [ ] 所有 `acceptance_criteria` 已实现
- [ ] 代码通过类型检查 / 编译（`tsc` / `mvn`）
- [ ] 新增功能有单元测试覆盖
- [ ] 现有测试全部通过
- [ ] 无新的安全漏洞引入（无硬编码 secret、无 SQL 注入风险）
- [ ] 代码风格符合团队规范
- [ ] 公共 API 变更已更新文档
- [ ] **Token 消耗评估**: 记录本 Ticket 消耗的总 tokens（估算值）
- [ ] **Skill 强制检查点**:
  - 若调试时间 >30 分钟 → 必须标记 `skill_candidate: true`
  - 若同一问题模式在本 Ticket 中被遇到 ≥2 次 → 必须标记 `skill_candidate: true`
  - 若 Token 消耗 >10K → 强烈建议标记 `skill_candidate: true`

### RESPONSE.yaml 必须字段

```yaml
ticket_id: TICKET-XXX
status: completed|blocked|needs_review
confidence_score: 0.0-1.0        # 按 objective-confidence-standard.md 计算，非自评
objective_breakdown:              # 必填，逐项客观评分
  acceptance_criteria: { score: 0.0-0.25, note: "说明" }
  compile_passed: { score: 0.0-0.10, note: "说明" }
  test_coverage: { score: 0.0-0.15, note: "说明" }
  security_scan: { score: 0.0-0.10, note: "说明" }
  reflection_quality: { score: 0.0-0.10, note: "说明" }
  skill_precipitation: { score: 0.0-0.15, note: "说明" }
  code_style: { score: 0.0-0.10, note: "说明" }
  documentation: { score: 0.0-0.05, note: "说明" }
summary: "做了什么"
files_modified:
  - path/to/file
verification_status:
  self_review_passed: true|false
  tests_added: true|false
  tests_passed: true|false        # 新增：测试通过数/总数
  security_check_passed: true|false
blockers: []
learnings: "关键洞察"
skill_candidate: true|false      # 强制字段，不满足 DoD 则打回
skill_summary: ""                # skill_candidate=true 时必须填写，≥50 字
```

---

## Step 4: Lead 审查（Lead 独有）

**输入**: RESPONSE.yaml + 代码 diff
**输出**: `AGENTS/workspace/TICKET-XXX/LEAD_REVIEW.yaml`

### 检查项

- [ ] 所有 acceptance criteria 已满足（逐项核对）
- [ ] `files_modified` 与 diff 一致，无遗漏
- [ ] `confidence_score` 与代码质量匹配（<0.7 需重派，0.7-0.89 需详细审查）
- [ ] 无跨服务接口破坏（检查依赖 Ticket 的契约）
- [ ] 安全扫描通过（无新增 secret、权限合理）
- [ ] `skill_candidate` 若为 true，评估是否值得沉淀

### LEAD_REVIEW.yaml 必须字段

```yaml
ticket_id: TICKET-XXX
review_decision: approved|needs_revision|rejected
review_score: 0.0-1.0
issues:
  - "发现的问题 1"
  - "发现的问题 2"
next_action: " Specialist 需修复的问题，或 'none'"
verdict: "审查结论摘要"
```

### 审查后动作

| 决策 | 动作 |
|------|------|
| `approved` | 更新 TICKET.yaml `status: approved`，合并代码 |
| `needs_revision` | 在 LEAD_REVIEW.yaml 中标注问题，打回 Specialist 修复 |
| `rejected` | 更新 TICKET.yaml `status: cancelled`，记录原因 |

---

## Step 5: 反思沉淀（Specialist + Lead）

**输入**: 已完成的 Ticket + LEAD_REVIEW.yaml
**输出**: `.kimi/memory/reflections/TICKET-XXX.md`

### Specialist 检查项

- [ ] Generator → Reflector → Curator 三步已完成
- [ ] reflection 包含：任务概述、架构决策、遇到的坑、测试策略、代码规范检查
- [ ] 若 `skill_candidate=true`，说明候选 skill 的具体内容

### Lead 检查项

- [ ] 读取 reflection，确认质量
- [ ] 若 skill 有价值，指令 Specialist 写入 `skills/<role>/draft/`
- [ ] 编写 episode（仅当 Ticket 为跨角色复杂任务时）

---

## Step 6: Skill 沉淀（强制，Token-Based 触发）

**输入**: reflection 中的 skill_candidate
**输出**: `skills/<role>/draft/*.md`

### 触发条件（满足任一即强制产出）

| 条件 | 说明 |
|------|------|
| 同一问题模式被 **≥2 个 Ticket** 遇到 | 说明是系统性问题，必须沉淀 |
| 单个 Ticket 调试消耗 **>10K tokens** | 踩坑成本高，必须沉淀避免重复 |
| Specialist 主动标记 `skill_candidate: true` | Lead 审查时必须评估 |

### 检查项

- [ ] Specialist 按模板写入 draft（场景描述 + 代码示例 + 踩坑经过 + 注意事项）
- [ ] 文件头包含来源 TICKET 和考察期截止日期
- [ ] **Token 预算检查**: draft ≤1.5K tokens，超出则拆分或压缩
- [ ] Lead 审查时: 若 skill_candidate=true 但无 draft → **打回补充**
- [ ] Lead 月度审查: 检查 `skills/*/draft/`，执行晋升/淘汰/合并

---

## 常见 Workflow 断裂点

| 断裂现象 | 根因 | 修复方法 |
|----------|------|----------|
| 有 RESPONSE 无 LEAD_REVIEW | Lead 跳过审查步骤 | 强制要求：无 LEAD_REVIEW 不准合并 |
| 有 TICKET 无 RESPONSE | Specialist 未执行或执行失败 | 检查 Agent 工具状态，或重新派工 |
| FE-MKT-002 无 TICKET 有 RESPONSE | 流程异常 | 补建 TICKET.yaml 或归档 RESPONSE |
| skill_candidate 标记但无 draft | Specialist 未实际写入 | Lead 审查时明确要求写入 |
| reflection 缺失 | Specialist 省略 Curator 步骤 | 纳入 DoD 检查项 |

---

## 历史问题追踪

- [2026-04-27] 41 个 Ticket 中 16 个有 RESPONSE 但无 LEAD_REVIEW（审查缺失率 39%）
- [2026-04-27] 3 个 Ticket 无 RESPONSE（从未执行）
- [2026-04-27] 0 个 skill_candidate 成功转化为 draft（沉淀机制失效）
- [2026-04-27] 本 checklist 建立，后续 Ticket 必须逐项通过
- [2026-04-28] Strategy A 严格审查执行：17 个 Ticket 中 14 个 needs_revision，3 个 blocked
- [2026-04-29] 当前 draft 共 12 个：6 个有 TICKET 来源（skill_candidate 机制恢复中），6 个无来源需补标或淘汰）
- [2026-04-29] 启动自检路径修复：system.md 自检路径从相对根目录改为 `.kimi/memory/shared/`，阈值从 v1.0 数量制升级为 v2.0 token-based

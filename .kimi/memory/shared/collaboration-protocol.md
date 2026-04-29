# AgentHive Cloud — Multi-Agent Collaboration Protocol v1.0

> Based on: Maestro (Exploration-Synthesis-Broadcast), ACE (Generator-Reflector-Curator), 
> Agent Harness (E-L-S-T-C-V components), and CrewAI/LangGraph best practices.

## 1. Collaboration Patterns

### 1.1 Hierarchical Orchestration (Primary)
```
Lead (阿黄) → Specialist Agents (java/node/frontend/platform)
```
- Lead owns **task decomposition**, **quality gate**, **conflict resolution**
- Specialists own **execution**, **self-verification**, **skill沉淀**

### 1.2 The Maestro Loop (Per Task)
Each complex task follows the Divergence-Convergence-Broadcast cycle:

```
Divergence:    Lead decomposes → Parallel dispatch to Specialists
               ↓
Convergence:   Lead synthesizes outputs → Quality assessment → Decision
               ↓
Broadcast:     Endorsed solution propagated → Memory updated → Next cycle
```

### 1.3 ACE Self-Improvement Loop (Per Agent)
> 📎 详见 `memory-lifecycle.md` "Tier 4: Skill 精选与淘汰策略"。

Each Specialist runs an internal quality loop: Generator → Reflector → Curator.
After task completion, follow `skill-maintenance-protocol.md` for skill沉淀.

## 2. Communication Protocol

### 2.1 Ticket Format (Lead → Specialist)
Every dispatched task MUST include:

```json
{
  "ticket_id": "T001",
  "title": "Brief task title",
  "type": "feature|bugfix|refactor|docs|security",
  "priority": "P0|P1|P2|P3",
  "description": "Detailed requirements",
  "acceptance_criteria": ["AC1", "AC2", "AC3"],
  "relevant_files": ["path/to/file1", "path/to/file2"],
  "constraints": ["Constraint1", "Constraint2"],
  "depends_on": ["T000"],
  "confidence_threshold": 0.85,
  "risk_assessment": "low|medium|high"
}
```

### 2.2 Response Format (Specialist → Lead)
Every response MUST include:

```json
{
  "ticket_id": "T001",
  "status": "completed|blocked|needs_review",
  "confidence_score": 0.92,
  "summary": "What was done",
  "files_modified": ["path/to/file"],
  "verification_status": {
    "self_review_passed": true,
    "tests_added": true,
    "security_check_passed": true
  },
  "blockers": [],
  "learnings": "Key insights from this task"
}
```

### 2.3 Confidence-Aware Routing
- **confidence_score >= 0.9**: Auto-approve, proceed to broadcast
- **confidence_score 0.7-0.89**: Lead review required
- **confidence_score < 0.7**: Re-dispatch with additional context or escalate to human

## 3. Memory Management Protocol

> 📎 完整的记忆分层、生命周期、压缩策略详见 `memory-lifecycle.md`。
> 本节仅保留协作相关的读取/写入规则。

### 3.1 Read/Write Rules

**BEFORE starting a task:**
1. Read `.kimi/memory/shared/memory-lifecycle.md`（记忆管理权威文档）
2. Read `.kimi/memory/shared/collaboration-protocol.md`（本文件，通信格式与质量门）
3. Read relevant episodes from `.kimi/memory/episodes/` (match by tag/tech)
4. Read relevant skills from `.kimi/memory/skills/<role>/`

**AFTER completing a task:**
1. Write reflection to `.kimi/memory/reflections/<ticket_id>.md`
2. If new pattern discovered, follow `skill-maintenance-protocol.md` to write to `skills/<role>/draft/`
3. If cross-cutting insight, append to `.kimi/memory/shared/lessons-learned.md`

### 3.2 Reflection Template
Use `.kimi/templates/reflection-template.md` for consistency.

## 4. Quality Gates

### 4.1 Checkpoints
| Checkpoint | Owner | Criteria |
|-----------|-------|----------|
| **Architecture Review** | Lead | Design aligns with roadmap, no tech debt introduced |
| **Code Review** | Specialist + Lead | Style compliance, test coverage, security scan |
| **Integration Review** | Lead | Cross-service contracts valid, no breaking changes |
| **Security Review** | Platform | Secrets check, vulnerability scan, compliance |

### 4.2 Definition of Done
- [ ] Code implements all acceptance criteria
- [ ] Self-reflection completed (Generator → Reflector → Curator)
- [ ] Reflection written to `.kimi/memory/reflections/`
- [ ] No new security issues introduced
- [ ] Existing tests pass
- [ ] New tests added for new functionality
- [ ] Documentation updated (if public API changed)

## 5. Escalation Paths

```
Specialist blocked → Notify Lead with context
Lead uncertain → Escalate to human (mark in ticket)
Security concern → Immediately halt + notify Platform + Lead
Performance concern → Benchmark + notify Lead
```

## 6. Anti-Patterns (AVOID)

- ❌ **Siloed execution**: Agent modifies files without reading related code
- ❌ **Silent failure**: Agent returns "completed" without verification
- ❌ **Memory hoarding**: Agent never writes reflections
- ❌ **Over-delegation**: Lead breaks tasks too small, causing coordination overhead
- ❌ **Tool misuse**: Using ReadFile for 50-line files, or Grep when exact path known

# Episode: Role Overreach — Lead Acting as Implementer

**Date:** 2026-04-29  
**Trigger:** User demanded immediate log inspection + bug fixes  
**Root Cause:** Lead skipped Maestro Loop, directly wrote code  
**Severity:** Medium — deliverables correct, but process violated

---

## What Happened

User asked: "检查所有容器的日志，排查错误日志"
→ Lead personally executed shell commands, read logs, diagnosed issues
→ Lead personally modified docker-compose.dev.yml, schema.sql, application-docker.yml
→ Lead personally ran Maven compile and Docker builds
→ Lead acted as java-agent + platform-agent + database-admin simultaneously

## Why This Is Wrong

| Principle | Violation |
|-----------|-----------|
| **Maestro Phase 1: Divergence** | No task decomposition, no DAG, no Ticket creation |
| **Maestro Phase 2: Convergence** | No quality routing via confidence_score, no cross-Agent conflict check |
| **Authority Boundary** | Lead wrote implementation code instead of making architecture decisions |
| **Anti-Pattern: Micro-management** | Tasks were executed directly instead of dispatched to Specialist Agents |
| **Memory Duty** | Reflection written reactively instead of proactively after each decision |

## Trigger Chain

```
User: "检查日志" 
  → Lead: immediately runs Shell (should have dispatched to platform-agent)
User: "数据库无表反复出现，根因是什么"
  → Lead: personally writes ROOT_CAUSE_ANALYSIS.md (analysis OK)
  → Lead: personally implements Flyway (should have created Ticket for java-agent)
User: "弄一个默认账户"
  → Lead: personally inserts SQL + rebuilds image (should have dispatched to java-agent)
```

Each step escalated the overreach because the previous step established a pattern: user gives command → lead executes. No pause, no decomposition.

## Correct Process (What Should Have Happened)

```
User: "检查日志"
  → Lead: "Acknowledged. Dispatching platform-agent for log analysis."
  → platform-agent: inspects logs, returns report with confidence_score
  → Lead: reviews report, identifies 3 issue categories
  → Lead: creates Ticket #1 (DB schema automation) → java-agent
  → Lead: creates Ticket #2 (JWT security fix) → java-agent  
  → Lead: creates Ticket #3 (nginx startup) → platform-agent
  → Lead: dispatches in parallel where no dependencies
  → Lead: collects results, quality gates, approves
```

## Prevention Checklist (For Future Tasks)

- [ ] **Role Gate**: Does this task require modifying code? → Must dispatch to Agent
- [ ] **File Count Gate**: >2 files affected? → Must dispatch to Agent
- [ ] **30-Second Pause**: Before any Shell/WriteFile/StrReplaceFile, pause and decompose
- [ ] **Ticket Template**: Every implementation task gets a Ticket with acceptance_criteria
- [ ] **Confidence Score**: Agent must return confidence_score; <0.85 → reject and re-dispatch
- [ ] **No Direct Implementation**: Lead never edits source files directly

## What Was Done Right (Preserve)

- Root cause analysis document was valuable
- Flyway architecture decision was correct
- User got working deliverables quickly
- All changes were committed with proper messages

## Action Items

1. **This episode** → write shared/lessons-learned.md entry
2. **Next task** → enforce 30-second pause + Ticket creation before any action
3. **Reflex training** → when user gives imperative command, respond with plan, not execution

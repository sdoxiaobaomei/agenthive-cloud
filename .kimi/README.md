# .kimi/ — AgentHive Cloud Agent Configuration

本目录包含 Kimi CLI 多角色 Agent 配置体系，支持 **Hierarchical Orchestration** 协作模式。

## 架构概览

```
.kimi/
├── agents/                    # Agent 配置（YAML + System Prompt）
│   ├── lead/                  # 阿黄 — Tech Lead / Orchestrator
│   │   ├── agent.yaml         # 主配置，定义 4 个子 Agent
│   │   └── system.md          # 系统提示词
│   ├── java/                  # 阿铁 — Java Backend
│   ├── node/                  # 阿铁(Node) — Node.js Backend
│   ├── frontend/              # 小花 — Frontend
│   └── platform/              # 阿维 — Platform & DevOps
│
├── memory/                    # 共享记忆体系
│   ├── episodes/              # 情景记忆（历史任务摘要）
│   ├── skills/                # 程序记忆（各角色技能库）
│   │   ├── java/
│   │   ├── node/
│   │   ├── frontend/
│   │   └── platform/
│   ├── reflections/           # 反思记录（每次任务的 Generator-Reflector-Curator）
│   └── shared/                # 共享上下文
│       ├── collaboration-protocol.md   # 协作协议
│       └── lessons-learned.md          # 跨角色经验教训
│
├── templates/                 # 模板
│   └── reflection-template.md # 反思模板
│
└── README.md                  # 本文件
```

## 协作模式

基于 **Maestro**（Exploration-Synthesis-Broadcast）+ **ACE**（Generator-Reflector-Curator）设计：

```
┌─────────────────────────────────────────────────────────┐
│  Lead Agent (阿黄)                                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │ Divergence  │→ │ Convergence │→ │ Broadcast   │     │
│  │ 任务分解     │  │ 质量评估     │  │ 知识沉淀     │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
│         ↓                                              │
│    ┌────┴────┬────────┬──────────┐                     │
│    ↓         ↓        ↓          ↓                     │
│  Java      Node    Frontend   Platform                 │
│  Agent    Agent    Agent      Agent                    │
│  (阿铁)   (阿铁)   (小花)      (阿维)                   │
│    │         │        │          │                     │
│    └────┬────┴────────┴────┬─────┘                     │
│         ↓                   ↓                          │
│   ┌─────────┐         ┌─────────┐                      │
│   │Self-    │         │ Memory  │                      │
│   │Reflect  │         │ Store   │                      │
│   └─────────┘         └─────────┘                      │
└─────────────────────────────────────────────────────────┘
```

### 每个 Specialist 内部循环（ACE）
```
Generator（生成代码/配置）
    ↓
Reflector（自检：编译/测试/安全/性能）
    ↓
Curator（沉淀：写 reflection + 更新 skills）
```

## 启动方式

### Windows (PowerShell)
```powershell
# 启动全部 5 个 Agent（推荐）
.\scripts\start-agents.ps1

# 只启动特定角色
.\scripts\start-agents.ps1 -Java -Node

# 查看列表
.\scripts\start-agents.ps1 -List
```

### Linux/macOS (Bash)
```bash
# 启动全部
./scripts/start-agents.sh

# 只启动特定角色
./scripts/start-agents.sh java node

# 查看列表
./scripts/start-agents.sh --list
```

### 手动启动
```bash
# Tech Lead
kimi --agent-file .kimi/agents/lead/agent.yaml

# Java
kimi --agent-file .kimi/agents/java/agent.yaml

# Node.js
kimi --agent-file .kimi/agents/node/agent.yaml

# Frontend
kimi --agent-file .kimi/agents/frontend/agent.yaml

# Platform
kimi --agent-file .kimi/agents/platform/agent.yaml
```

## 设计原则

1. **运行时分离**: 按运行时（JVM/V8/Browser/Docker）分角色，不按业务域
2. **Lead 不编码**: Lead 只做架构设计、任务分解、质量审查
3. **置信度路由**: 每个 Specialist 返回 confidence_score，Lead 据此决策
4. **记忆沉淀**: 每次任务完成后必须写 reflection，可复用模式更新 skills
5. **安全红线**: 每个角色有不可妥协的安全基线

## 参考文献

- **Maestro**: "Learning to Collaborate via Conditional Listwise Policy Optimization for Multi-Agent LLMs" (arXiv:2511.06134)
- **ACE**: "Agentic Context Engineering" (2025) — Generator-Reflector-Curator 三Agent循环
- **Agent Harness Survey**: "Agent Harness for Large Language Model Agents: A Survey" (2026)
- **Evolving Orchestration**: "Multi-Agent Collaboration via Evolving Orchestration" (2025)
- **Mem0 / Generative Agents**: 分层记忆架构（情景/语义/程序）
- **CrewAI / LangGraph / AutoGen**: 角色驱动 vs 图驱动 vs 对话驱动
- **Skill Learning (Letta)**: 持续学习提升 36.8% 性能
- **Spring Boot 2025-2026 Best Practices**: DDD, Event Sourcing, Saga, Resilience4j
- **Vue 3 2025-2026 Best Practices**: Domain-driven, Composition API, Hybrid Rendering

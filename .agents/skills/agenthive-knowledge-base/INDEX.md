# AgentHive Knowledge Base — Document Index

> Last updated: 2026-05-05
> Total indexed documents: ~80 (excluding node_modules, archive, and vendor docs)

---

## Architecture & Design

| Path | Priority | Summary | Audience | Tags |
|------|----------|---------|----------|------|
| `docs/architecture/01-system-overview.md` | P0 | System boundaries, tech stack matrix, communication contracts, security design | All | overview, boundaries, tech-stack, security |
| `docs/architecture/00-architecture-review.md` | P0 | Current architecture assessment, 58 issues (P0-P3), risk matrix, optimization directions | Lead, Architect | audit, issues, risks, debt |
| `docs/architecture/02-java-microservices.md` | P1 | 7 Java services matrix, shared modules, API specs, DB design, Redis structures, MQ | Java Dev | microservices, database, redis, api |
| `docs/architecture/03-ai-agent-platform.md` | P1 | Chat controller, intent recognition, agent scheduling, execution flow, data models | Node Dev, AI | chat, agent, llm, orchestration |
| `docs/architecture/05-backend-nodejs.md` | P1 | API service, Agent Runtime, Workflow Engine, communication patterns, architecture debt | Node Dev | api, runtime, workflow, debt |
| `docs/architecture/04-development-roadmap.md` | P1 | Phase 0-4 roadmap, decision checklists, effort estimates, milestones | Lead, PM | roadmap, phases, milestones |
| `docs/adr/001-data-layer-on-2c2g.md` | P1 | ADR: Why Java services run on 2C2G (cost vs performance tradeoff) | Platform | adr, cost, resources |
| `docs/architecture/data-layer-decision.md` | P2 | Data layer design decisions and rationale | Architect | data, design-decisions |
| `docs/ARCHITECTURE.md` | P2 | High-level system architecture overview (legacy, see 01 for current) | All | overview, legacy |

---

## API & Backend (Node.js)

| Path | Priority | Summary | Audience | Tags |
|------|----------|---------|----------|------|
| `apps/api/docs/API_REFERENCE.md` | P0 | Complete API endpoint reference, request/response schemas, auth headers | All | api, endpoints, rest, swagger |
| `apps/api/docs/guides/STARTUP_GUIDE.md` | P1 | How to start API service locally, env vars, DB setup | Node Dev | startup, local-dev, env |
| `apps/api/docs/guides/UNIT_TESTING.md` | P1 | Unit testing guide, Vitest setup, Supertest patterns | Node Dev, QA | testing, vitest, supertest |
| `apps/api/docs/database/POSTGRESQL_SETUP.md` | P1 | PostgreSQL setup, connection config, schema management | Node Dev, Platform | postgres, database, setup |
| `apps/api/docs/database/REDIS_WEBSOCKET.md` | P1 | Redis adapter for WebSocket horizontal scaling | Node Dev | redis, websocket, scaling |
| `apps/api/README.md` | P2 | API service overview, build commands, directory structure | Node Dev | overview, build |
| `apps/api/docs/README.md` | P2 | API docs index | All | index |
| `apps/api/docs/TODO.md` | P2 | Known TODOs and planned improvements for API service | Node Dev | todo, roadmap |
| `apps/api/tests/TEST_SUMMARY.md` | P2 | Test coverage summary | QA | testing, coverage |

**Node.js Patterns** (`.kimi/memory/skills/node/official/patterns/`)

| Path | Summary | Tags |
|------|---------|------|
| `app-error.md` | Standardized error class with HTTP status codes | error-handling |
| `database-access.md` | PostgreSQL pool patterns, query builders | database, pg |
| `filesystem-async-patterns.md` | Async fs operations, path handling | fs, async |
| `redis-set-uv-dedup.md` | Redis SET for unique visitor deduplication | redis, dedup |
| `redis-stream-consumer.md` | Redis Streams consumer group pattern | redis, streams |
| `structured-logging.md` | JSON structured logging with correlation IDs | logging, observability |
| `zod-validation.md` | Input validation patterns with Zod | validation, zod |

---

## Frontend

| Path | Priority | Summary | Audience | Tags |
|------|----------|---------|----------|------|
| `apps/landing/docs/SSR-SAFETY-GUIDE.md` | P0 | SSR safety patterns: `onMounted`, `<ClientOnly>`, `import.meta.client` | Frontend | ssr, nuxt, vue, safety |
| `apps/landing/docs/API_INTEGRATION.md` | P1 | How frontend integrates with backend APIs | Frontend | api, integration, fetch |
| `apps/landing/README.md` | P1 | Landing app overview, Nuxt 3 setup, build commands | Frontend | nuxt, landing, build |
| `apps/landing/PROJECT_CLEANUP.md` | P2 | Cleanup tasks and refactoring notes for landing | Frontend | cleanup, refactor |

**Frontend Patterns** (`.kimi/memory/skills/frontend/official/patterns/`)

| Path | Summary | Tags |
|------|---------|------|
| `composition-api.md` | Vue 3 Composition API best practices | vue, composition-api |
| `e2e-testing.md` | Playwright E2E testing patterns | testing, playwright |
| `iframe-sandbox-preview.md` | iframe sandbox for code preview | iframe, sandbox, preview |
| `landing-vitest-playwright-setup.md` | Test setup for landing app | testing, vitest, playwright |
| `monaco-editor-dynamic-import.md` | Dynamic import for Monaco Editor | monaco, dynamic-import |
| `nuxt-bff-proxy.md` | Nuxt BFF proxy patterns | nuxt, bff, proxy |
| `performance-optimization.md` | Frontend performance tips | performance, optimization |
| `pinia-setup-store.md` | Pinia setup store pattern | pinia, state-management |
| `ssr-safety.md` | SSR-safe coding patterns | ssr, safety |

---

## Database

| Path | Priority | Summary | Audience | Tags |
|------|----------|---------|----------|------|
| `apps/api/docs/database/README.md` | P1 | Database docs index, migration workflow | All | index, migrations |
| `docs/database-architecture-audit.md` | P1 | Database architecture audit findings | Architect, Platform | audit, schema, architecture |
| `docs/DATABASE-MAINTENANCE-ARCHITECTURE.md` | P1 | DB maintenance architecture and procedures | Platform, DBA | maintenance, backup, ops |
| `apps/api/src/db/migrations/` | P0 | Actual migration files (source of truth for schema) | All | schema, migrations, sql |
| `docs/operation/postgres-backup-restore.md` | P1 | PostgreSQL backup and restore procedures | Platform | backup, restore, postgres |

---

## Deployment & DevOps

| Path | Priority | Summary | Audience | Tags |
|------|----------|---------|----------|------|
| `docs/deployment/DEVOPS-ARCHITECTURE.md` | P0 | Overall DevOps architecture: CI/CD, K8s, Terraform, monitoring | Platform | devops, architecture, cicd |
| `docs/deployment/ci-cd/CI-CD-USAGE.md` | P1 | How to use the CI/CD pipeline | All | cicd, github-actions, usage |
| `docs/deployment/ci-cd/CI-BUILD-OPTIMIZATION.md` | P1 | Build optimization strategies and results | Platform | build, optimization, docker |
| `docs/deployment/k3s-deployment.md` | P1 | K3s deployment guide (local dev cluster) | Platform | k3s, kubernetes, local |
| `docs/deployment/k8s/k3s-bootstrap.md` | P1 | Bootstrap a k3s cluster from scratch | Platform | k3s, bootstrap, setup |
| `docs/deployment/helm/helm-migration-gaps.md` | P1 | Helm migration gap analysis and fixes | Platform | helm, migration, gaps |
| `chart/agenthive/README.md` | P1 | Helm chart documentation | Platform | helm, chart, k8s |
| `docs/deployment/external-secrets-operator.md` | P1 | External Secrets Operator setup for secret management | Platform | secrets, external-secrets, security |
| `docs/deployment/hybrid-deployment.md` | P2 | Hybrid cloud deployment strategy | Platform | hybrid, cloud, strategy |
| `docs/deployment/dev-prod-consistency-report.md` | P2 | Dev/prod environment consistency analysis | Platform | consistency, environments |
| `docs/deployment/cost-analysis.md` | P2 | Cloud cost analysis and optimization | Platform | cost, optimization |
| `.github/workflows/README.md` | P2 | GitHub Actions workflows documentation | Platform | github-actions, ci |
| `.github/workflows/DEPLOY_GUIDE.md` | P2 | Deployment guide for GitHub Actions workflows | Platform | deploy, github-actions |

**Platform Patterns** (`.kimi/memory/skills/platform/official/patterns/`)

| Path | Summary | Tags |
|------|---------|------|
| `dev-prod-config-separation.md` | Separate dev/prod config patterns | config, environments |
| `kustomize-multi-env.md` | Kustomize multi-environment setup | kustomize, k8s |
| `network-policy.md` | K8s NetworkPolicy patterns | network-policy, security |
| `otel-java-agent-springboot.md` | OpenTelemetry Java agent for Spring Boot | otel, observability, java |
| `secret-management.md` | Secret management patterns (3-mode: ExternalSecret/empty/Helm) | secrets, security, helm |
| `secure-container.md` | Container security hardening | security, container, hardening |
| `terraform-module.md` | Terraform module patterns | terraform, iac |

---

## Operations & Runbooks

| Path | Priority | Summary | Audience | Tags |
|------|----------|---------|----------|------|
| `docs/reference/quick-reference.md` | P0 | Quick reference card: common commands, debugging tips, performance thresholds | All | quick-ref, commands, debug |
| `docs/operation/runbook-k3s-ops.md` | P1 | K3s operational runbook: troubleshooting, upgrades, maintenance | Platform | k3s, runbook, ops |
| `docs/operation/security-secret-rotation.md` | P1 | Secret rotation procedures and schedule | Platform | security, secrets, rotation |
| `docs/operation/README.md` | P2 | Operations docs index | Platform | index |
| `.agents/skills/agenthive-dev-operations/SKILL.md` | P1 | Dev operations skill: deploy, verify, troubleshoot workflow | All | devops, deploy, verify |
| `DOCKER_CONFIG_SUMMARY.md` | P2 | Index of all Dockerfiles and docker-compose files | Platform | docker, index |
| `docs/guides/WSL2-NETWORK-SETUP.md` | P2 | WSL2 network setup guide (Windows dev) | All | wsl2, network, windows |

---

## Security

| Path | Priority | Summary | Audience | Tags |
|------|----------|---------|----------|------|
| `AGENT_COLLABORATION_SPEC.md` | P0 | Agent collaboration spec: auth flow, RBAC, secret handling, compliance | All | security, auth, rbac, agents |
| `docs/deployment/external-secrets-operator.md` | P1 | External secret management | Platform | secrets, security |
| `docs/operation/security-secret-rotation.md` | P1 | Secret rotation procedures | Platform | security, rotation |
| `.github/workflows/agent-compliance-check.yml` | P2 | Agent commit compliance check workflow | All | compliance, ci, agents |
| `AGENTS/objective-confidence-standard.md` | P2 | Objective confidence scoring standard | Lead | confidence, quality |

---

## Agent System & Collaboration

| Path | Priority | Summary | Audience | Tags |
|------|----------|---------|----------|------|
| `AGENT_COLLABORATION_SPEC.md` | P0 | Comprehensive agent collaboration standard: architecture, protocols, coding standards, quality gates | All | agents, collaboration, standards |
| `AGENTS/README.md` | P1 | Multi-Agent system overview | All | agents, overview |
| `AGENTS/workflow-checklist.md` | P1 | Agent workflow checklists | All | agents, workflow, checklist |
| `AGENTS/shared/prompts/system-orchestrator.md` | P1 | Orchestrator (Tech Lead) system prompt | Lead | prompts, orchestrator |
| `AGENTS/shared/prompts/system-frontend-dev.md` | P1 | Frontend dev agent system prompt | Frontend | prompts, frontend |
| `AGENTS/shared/prompts/system-backend-dev.md` | P1 | Backend dev agent system prompt | Node Dev | prompts, backend |
| `AGENTS/shared/prompts/system-qa-engineer.md` | P1 | QA engineer agent system prompt | QA | prompts, qa |
| `docs/development/workspace-management.md` | P1 | Workspace (ticket) management guide | All | workspace, tickets, management |
| `.cursorrules` | P2 | Cursor IDE conventions (points to AGENT_COLLABORATION_SPEC.md) | All | cursor, conventions |
| `CLAUDE.md` | P2 | Claude Code conventions (points to AGENT_COLLABORATION_SPEC.md) | All | claude, conventions |
| `.github/copilot-instructions.md` | P2 | GitHub Copilot conventions (points to AGENT_COLLABORATION_SPEC.md) | All | copilot, conventions |

---

## Java Services

| Path | Priority | Summary | Audience | Tags |
|------|----------|---------|----------|------|
| `apps/java/README.md` | P1 | Java services overview, all 7 services | Java Dev | overview, microservices |
| `apps/java/DEPLOY.md` | P1 | Java service deployment guide | Java Dev, Platform | deploy, java |
| `apps/java/CHANGELOG.md` | P2 | Java services changelog | Java Dev | changelog |

**Java Patterns** (`.kimi/memory/skills/java/official/patterns/`)

| Path | Summary | Tags |
|------|---------|------|
| `api-response-wrapper.md` | Unified API response wrapper pattern | api, response |
| `ddd-layered-architecture.md` | DDD layered architecture guide | ddd, architecture |
| `global-exception-handler.md` | Global exception handling pattern | exception, error |
| `lombok-rules.md` | Lombok usage rules and conventions | lombok |
| `resilience-patterns.md` | Circuit breaker, retry, bulkhead patterns | resilience, circuit-breaker |
| `structured-logging.md` | Structured logging with MDC | logging, observability |
| `traffic-settlement-scheduler.md` | Traffic settlement scheduler pattern | scheduler, settlement |

---

## AI / Agent Runtime

| Path | Priority | Summary | Audience | Tags |
|------|----------|---------|----------|------|
| `apps/agent-runtime/docs/README.md` | P1 | Agent Runtime service overview | Node Dev, AI | runtime, overview |
| `apps/agent-runtime/docs/ARCHITECTURE.md` | P1 | Agent Runtime architecture | Node Dev, AI | runtime, architecture |
| `apps/agent-runtime/docs/API.md` | P1 | Agent Runtime API documentation | Node Dev, AI | runtime, api |
| `apps/agent-runtime/docs/QUICK_REFERENCE.md` | P2 | Agent Runtime quick reference | All | runtime, quick-ref |

---

## Testing & Quality

| Path | Priority | Summary | Audience | Tags |
|------|----------|---------|----------|------|
| `docs/development/testing-plan.md` | P1 | Overall testing strategy and plan | QA, All | testing, strategy |
| `apps/api/docs/guides/UNIT_TESTING.md` | P1 | API unit testing guide | Node Dev, QA | testing, unit |
| `AGENTS/agent-scorecard.md` | P2 | Agent output quality scorecard | Lead, QA | quality, scorecard |

---

## Project Management

| Path | Priority | Summary | Audience | Tags |
|------|----------|---------|----------|------|
| `docs/development/workspace-management.md` | P1 | Ticket workspace lifecycle management | All | workspace, tickets, lifecycle |
| `docs/project/README.md` | P2 | Project management docs index | PM | index |
| `AGENTS/archive/tickets/` | P2 | Archived ticket reports and analysis | Lead | archive, tickets |

---

## RFCs & Proposals

| Path | Priority | Summary | Audience | Tags |
|------|----------|---------|----------|------|
| `docs/rfc/RFC-001-Workspace-Architecture.md` | P1 | Workspace Pod isolation proposal | Architect | rfc, workspace, architecture |
| `docs/rfc/RFC-001-Implementation-Plan.md` | P2 | Workspace 20-week implementation plan | Lead, PM | rfc, plan, roadmap |
| `docs/rfc/RFC-001-Alibaba-Cloud-Cost-Analysis.md` | P2 | ACK detailed cost breakdown | Platform | rfc, cost, alibaba-cloud |

---

## Lessons Learned & Memory

| Path | Priority | Summary | Audience | Tags |
|------|----------|---------|----------|------|
| `.kimi/memory/shared/lessons-learned.md` | P1 | Shared lessons learned across all agents | All | lessons, pitfalls |
| `.kimi/memory/shared/INDEX.md` | P1 | Memory index: how to use agent memory system | All | memory, index |
| `.kimi/memory/reflections/` | P2 | Per-ticket reflection documents | All | reflections, post-mortem |
| `.kimi/memory/episodes/` | P2 | Episode records (significant events) | All | episodes, events |

---

## How to Use This Index

1. **Browse by category** — find your domain, scan the table
2. **Search by tag** — use Ctrl+F to find documents tagged with your keyword
3. **Check priority** — P0 = read before coding, P1 = read when relevant, P2 = reference as needed
4. **Follow cross-references** — documents often link to each other; follow the trail

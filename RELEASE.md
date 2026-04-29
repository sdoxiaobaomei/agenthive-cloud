# Release v1.1.0 — AgentHive Cloud

**Release Date**: 2026-04-29  
**Branch**: `develop`  
**Total Commits**: 8 feature commits  
**Tickets Closed**: 57 (54 approved, 2 completed, 1 cancelled)

---

## Executive Summary

This release delivers **Project & Workspace core infrastructure**, a full **Economy system** (marketplace, credits, creator center), comprehensive **security hardening**, and **observability** foundations across the AgentHive Cloud platform.

| Metric | Value |
|--------|-------|
| New Features | 33 tickets |
| Security Fixes | 7 tickets |
| Infrastructure | 7 tickets |
| Bug Fixes | 4 tickets |
| Files Changed | 450+ |
| Insertions | ~36,000 |

---

## Feature Groups

### 🔐 Security Hardening (7 tickets)
- **P0** Remove password plaintext leaks from auth-service and frontend
- **P0** Node API structured logging with sensitive data masking
- **P0** Gateway CORS precise Origin validation for production
- **P0** Nginx HTTPS certificate configuration with TLS redirect
- **P0** Java default password fallback cleanup
- **P0** Fix auth-service entity serialization and logging leaks
- Migrate sensitive tokens (Nacos identity) from config to `.env`

**Commits**: `security(*): harden auth, logging, CORS, HTTPS and secrets management`

---

### 🏗️ Infrastructure & DevOps (13 tickets)
- Docker Compose dev/demo/prod configuration parity
- K8s base manifests and environment overlays (staging, production, demo)
- PostgreSQL automated backup strategy and cronjobs
- Redis persistence configuration completion
- Docker log rotation and disk monitoring
- Watchtower automatic image updates
- Unified JWT Secret and `.env.dev` integrity checks
- Dev environment health check scripts (PowerShell + Bash)
- Config consistency gate between docker-compose and application.yml
- Container network optimization for China dev environment
- E2E dev environment rebuild and automated acceptance

**Commits**: `infra(*): Docker, K8s, CI/CD, backup, monitoring and dev environment`

---

### 📊 Observability (1 ticket)
- OpenTelemetry collector configuration for dev/prod parity
- Tempo distributed tracing backend setup
- Node API telemetry instrumentation
- Structured logging with correlation IDs

**Commits**: `feat(observability): unified OpenTelemetry tracing and metrics`

---

### 🗂️ Project & Workspace (16 tickets)
- Project data model extension and database migration
- Project member management API
- Project creation with Workspace initialization
- Workspace directory operations and file upload/download API
- Workspace batch operations and content search API
- Workspace Git status query API
- Migrate Code Files from DB storage to file system
- Project list, creation wizard, dashboard and settings pages
- Workspace page skeleton with file tree
- Monaco Editor multi-tab integration
- File operation context menu and auto-save
- Chat page UI refactor (header, sidebar, project nav redesign)
- Agent Runtime QueryLoop v2 improvements

**Commits**: `feat(project): Project & Workspace core — models, API, UI, file system`

---

### 🛒 Marketplace & Economy (16 tickets)
- Marketplace product browsing and purchase flow
- Creator center for publishing and managing products
- Credits center (balance, transactions, recharge, withdrawal)
- Shared UI infrastructure for economy system (Mock data, common components)
- Java Credits account and transaction system
- Marketplace product and order core
- Website hosting and traffic statistics foundation
- Credits withdrawal and fee system
- Agent quota billing API
- Traffic revenue settlement scheduled tasks
- Node API task billing and balance check integration
- Website hosting deployment and traffic reporting

**Commits**: `feat(marketplace): Economy system — credits, marketplace, creator center, hosting`

---

### 🤖 Agent System (meta)
- Register explore agent with system prompt and agent.yaml
- Update lead, java, node, frontend, platform agent system prompts
- Memory v2.0 token-based lifecycle management
- Archive 6 approved reflections; promote 8 draft skills to official
- Add 8 new official skills
- Fix system.md self-check paths and thresholds
- Add Judge→Analyze→Decide→Execute methodology to lead dispatch protocol

**Commits**: `chore(agents): Agent system configs, memory maintenance, skills and workflows`

---

## Upgrade Notes

### Environment Variables
Several sensitive configurations have been migrated to `.env` files:
- `NACOS_IDENTITY_KEY` / `NACOS_IDENTITY_VALUE`
- `JWT_SECRET`
- Database credentials

Ensure `.env.dev` and `.env.prod` are properly populated before deployment.

### Database Migrations
- `apps/api/src/db/schema.sql` — Node API schema updates
- `apps/java/auth-service/src/main/resources/db/schema.sql` — Auth service updates
- `apps/java/order-service/src/main/resources/db/schema.sql` — Order service updates
- `apps/java/payment-service/src/main/resources/db/schema.sql` — Payment service updates

### Docker Images
All Java services have updated Dockerfiles. Rebuild required:
```bash
docker-compose -f docker-compose.dev.yml build
```

---

## Known Issues

| Issue | Severity | Ticket | Workaround |
|-------|----------|--------|------------|
| 4 draft skills pending evaluation | Low | — | Review window: 2026-05-28 |

---

## Full Commit List

```
02d2130 chore(cleanup): remove temp files, build artifacts and update .gitignore
2bb6af0 chore(archive): archive 57 completed tickets to 2026-04 with index
13494da chore(agents): Agent system configs, memory maintenance, skills and workflows
19e1009 feat(marketplace): Economy system — credits, marketplace, creator center, hosting
ca58552 feat(project): Project & Workspace core — models, API, UI, file system
0f38846 feat(observability): unified OpenTelemetry tracing and metrics
439c5ba infra(*): Docker, K8s, CI/CD, backup, monitoring and dev environment
5a569a4 security(*): harden auth, logging, CORS, HTTPS and secrets management
```

---

## Artifacts

- **Ticket Archive**: `AGENTS/archive/tickets/2026-04/`
- **Archive Index**: `AGENTS/archive/tickets/2026-04/INDEX.md`

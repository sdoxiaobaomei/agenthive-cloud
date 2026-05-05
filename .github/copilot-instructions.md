# AgentHive Cloud — Copilot Instructions

## Project Overview

AgentHive Cloud is an AI-driven multi-agent collaborative development platform ("Hive Mode") with e-commerce SaaS capabilities (users, payments, orders, cart, logistics).

**Architecture:**
- Frontend: Nuxt 3 + Vue 3 + Element Plus + Tailwind CSS
- API Gateway: Spring Cloud Gateway + Nginx
- Node.js Backend: Express + TypeScript ESM + PostgreSQL + Redis
- Java Backend: Spring Boot 3.2 + Spring Cloud Alibaba + MyBatis Plus
- AI Engine: Agent Runtime + QueryLoop + ToolRegistry
- Infrastructure: Docker + Kubernetes (k3d dev / ACK prod) + Helm 3
- Observability: OpenTelemetry + Grafana LGTM

## Hard Rules (Non-Negotiable)

1. **Authentication at Gateway only** — Downstream services read `X-User-Id` header, never parse JWT
2. **Node.js = AI Control Plane + BFF only** — No transactional business logic
3. **Java = Enterprise Core Domain** — All transactional, high-concurrency business
4. **Agent tasks must be async** — Redis Streams queue, never direct spawn
5. **Observability is mandatory** — All services must expose OTel signals
6. **Unified ID: UUIDv7** — Legacy: Java uses BIGINT, Node.js uses UUID

## Role Boundaries

- **Frontend Agent**: `apps/landing/`, `apps/web/`, `packages/ui/` only
- **Backend Agent**: `apps/api/`, `apps/agent-runtime/`, `packages/types/` only
- **Platform Agent**: `chart/`, `k8s/`, `iac/`, `monitoring/` only
- **Lead Agent**: `.kimi/`, `docs/` only — NEVER writes application code

## Coding Standards

### TypeScript / Node.js (ESM)
- `import/export` with `.js` extensions
- `tsc --noEmit` must pass before claiming completion
- Input validation with Zod or manual validators
- Structured JSON logging
- UUID validation: all IDs must pass `isValidUuid()` check

### Vue 3 / Nuxt 3
- Composition API with `<script setup>`
- Pinia composable stores
- Tailwind CSS + Element Plus
- SSR-safe: client APIs only in `onMounted`

### PostgreSQL 16
- Migration naming: `YYYYMMDDhhmmss_description.sql`
- **PG 16 trap**: No `ADD CONSTRAINT IF NOT EXISTS` → use `DO $$` block
- JSONB defense: string input must be `JSON.stringify([value])`
- Manual ALTER TABLE → must sync `_migrations` table record

## Known Pitfalls

1. **Chat session uniqueness**: Each `project_id` can have only one active session. Check before INSERT.
2. **tech_stack JSONB**: Frontend sends `"react"` → Backend must convert to `["react"]`.
3. **Helm Secret modes**: Must preserve 3 modes (ExternalSecret / empty / Helm-managed).
4. **k3d single-node deadlock**: `maxUnavailable: 0` blocks rolling update → use `1`.
5. **Migration ordering**: Manual schema changes without `_migrations` insert cause `node-pg-migrate` failures.

## Verification Requirements

Before claiming completion:
1. Type check passes: `cd apps/api && npx tsc --noEmit`
2. New code has unit tests and they pass
3. DB changes: clean database full migration replay passes
4. Helm changes: `helm template` renders correctly

## Quick Commands

```bash
# Cluster status
kubectl get pods -n agenthive

# API error logs
kubectl logs -l app.kubernetes.io/name=api -n agenthive --tail=50 | grep -i error

# Check migrations
kubectl exec <postgres-pod> -n agenthive -- psql -U agenthive -c "SELECT name FROM _migrations ORDER BY run_on;"

# Type check
cd apps/api && npx tsc --noEmit

# Local API test
kubectl port-forward deployment/api 3001:3001 -n agenthive
curl http://localhost:3001/api/health
```

## Reference

- Full specification: `AGENT_COLLABORATION_SPEC.md`
- Operations runbook: `docs/operation/runbook-k3s-ops.md`
- Architecture review: `docs/architecture/00-architecture-review.md`

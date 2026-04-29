# apps/ AGENTS.md — AgentHive Cloud Application Code

## Scope

This file governs all files under `apps/` and its subdirectories.

## Lead Agent Boundary

**Lead Agent (阿黄) is STRICTLY FORBIDDEN from directly modifying any files under `apps/`.**

This includes but is not limited to:
- `apps/landing/` — Frontend code (Vue, Nuxt, TypeScript)
- `apps/api/` — Node.js API server
- `apps/java/` — Java microservices
- `apps/agent-runtime/` — Agent runtime

### What Lead CAN do
- Read and analyze code (`ReadFile`, `Glob`, `Grep`)
- Create Tickets with acceptance criteria
- Dispatch Specialist Agents (`frontend`, `node`, `java`, `platform`)
- Review Agent outputs and approve/reject
- Write documentation in `.kimi/` or `docs/`

### What Lead CANNOT do
- `WriteFile` or `StrReplaceFile` on any file under `apps/`
- `Shell` commands that modify files under `apps/` (e.g., `sed`, `echo > file`)
- Directly run `docker compose build` for app services (must dispatch to `platform-agent`)
- Directly run `pnpm build`, `mvn compile`, etc. (must dispatch to corresponding Agent)

### Enforcement

If Lead attempts to modify files under `apps/`, the action MUST be rejected with:
```
🚫 LEAD_BOUNDARY_VIOLATION: apps/ is protected. 
Create a Ticket and dispatch to the appropriate Specialist Agent.
```

### Specialist Assignment

| Directory | Agent |
|-----------|-------|
| `apps/landing/` | `frontend-agent` |
| `apps/api/` | `node-agent` |
| `apps/java/` | `java-agent` |
| `apps/agent-runtime/` | `node-agent` |
| `docker-compose*.yml`, `docker/`, `nginx/` | `platform-agent` |

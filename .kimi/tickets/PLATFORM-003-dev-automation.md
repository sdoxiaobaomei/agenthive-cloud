# Ticket: PLATFORM-003 — Dev Environment Auto-Build & Acceptance Script

## Type: feature
## Priority: P2
## Risk: low

---

## Problem

After every code change, the developer must manually:
1. Figure out which Docker services need rebuilding
2. Run `docker compose build <service>`
3. Run `docker compose up -d <service>`
4. Wait and check if services are healthy
5. Open browser to verify

This is repetitive, error-prone, and wastes time. The Lead should be able to run a single command that automates the entire "build → restart → health-check → report" flow before acceptance testing.

## Requirements

Create a script `scripts/dev-acceptance.py` (or `.ps1` / `.sh`) that:

### 1. Detect Changed Services
- Compare `git diff HEAD~1 --name-only` (or since last tag) against service source directories
- Mapping:
  - `apps/landing/**` → `landing` service
  - `apps/api/**` → `api` service
  - `apps/java/**` → multiple Java services (gateway, auth, user, order, payment, cart, logistics)
  - `docker/**` or `docker-compose*.yml` → all services
  - `nginx/**` or `nginx*.conf` → `nginx` service

### 2. Build & Restart
- For each affected service: `docker compose -f docker-compose.dev.yml build <service>`
- Then `docker compose -f docker-compose.dev.yml up -d <service>`
- Build order should respect dependencies (e.g., java services after postgres/redis/nacos are healthy)

### 3. Health Check
- Wait for each restarted service to become healthy
- Check `docker compose ps` for health status
- For services without explicit healthcheck, probe their HTTP endpoint:
  - API: `GET http://localhost:3001/api/health`
  - Landing: `GET http://localhost:3000` (or via nginx:8088)
  - Gateway: `GET http://localhost:8080/actuator/health`
  - Nginx: `GET http://localhost:8088`
- Timeout: 120 seconds per service, with 5-second polling interval

### 4. Report
- Print summary table:
  ```
  Service    Action     Status    Health    URL
  ---------  ---------  --------  --------  ------------------
  api        rebuilt    ✅ OK     ✅ UP     http://localhost:3001
  landing    skipped    —         ✅ UP     http://localhost:3000
  nginx      restarted  ✅ OK     ✅ UP     http://localhost:8088
  ```
- Print total time elapsed
- If any service fails health check, exit with non-zero code and print logs tail

### 5. Integration with Workflow
- The script should be callable as: `python scripts/dev-acceptance.py` or `powershell scripts/dev-acceptance.ps1`
- Optional flag: `--all` to rebuild all services regardless of git changes
- Optional flag: `--service api landing` to rebuild specific services

## Acceptance Criteria

- [ ] Script exists at `scripts/dev-acceptance.py` (or `.ps1`)
- [ ] Running the script after a code change correctly detects affected services, builds, restarts, and reports health
- [ ] Script handles failures gracefully (prints logs, exits non-zero)
- [ ] Script runs successfully in the current dev environment (Windows PowerShell + Docker Desktop)
- [ ] README update: document how to use the script for acceptance testing

## Relevant Files

- `docker-compose.dev.yml` (service names and health checks)
- `scripts/` (new script location)
- `README.md` (documentation)

## Constraints

- Do NOT modify docker-compose.dev.yml unless necessary for health checks
- Use existing docker compose commands (no custom Docker networking changes)
- Script must work on Windows PowerShell with Docker Desktop
- Keep it simple — no Kubernetes, no CI/CD pipeline integration needed yet

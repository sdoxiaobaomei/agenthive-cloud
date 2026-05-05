# Reference: Known Issues & Active Workarounds

> Current active issues, tech debt, and their workarounds.
> Last updated: 2026-05-05

---

## 🟡 Active Issues

### 1. LLM API Key Invalid (401)

**Status**: Config issue, not code bug  
**Impact**: Agent Runtime cannot call LLM APIs  
**Workaround**: Set valid `LLM_API_KEY` in Secret/ConfigMap  
**Location**: `apps/api/.env` / K8s Secret  
**Details**: Dev secret has `LLM_API_KEY: REPLACE_ME`

### 2. Frontend Mock Data Modules Still Active

**Status**: Backend APIs exist but return mock/empty data  
**Impact**: Frontend uses fake data for economy features  
**Modules affected**:
- `useMockCredits`
- `useMockTransactions`
- `useMockRecharge`
- `useMockWithdraw`
- `useMockProducts`
- `useMockSales`

**Action needed**: Wire these to real backend endpoints.

### 3. File Tree Default Fallback

**Status**: By design (demo behavior)  
**Impact**: When `projectId` is null, `defaultFileTree` is shown  
**Location**: `landing/stores/file-tree.ts`  
**Note**: This is intentional for demo purposes, but should be reviewed for production.

### 4. Java Services Not Running in Dev

**Status**: Disabled to save memory  
**Impact**: Cannot test Java features locally  
**Workaround**: Deploy to staging or enable locally (needs +~3GB memory)  
**Note**: Java services require Nacos registry. Node API runs standalone.

---

## ✅ Recently Fixed (Keep in Mind)

### Schema Mismatches (2026-05-05)

Fixed via migrations:
- `projects.repo_url` missing → migration `20260505000100`
- `chat_sessions.status` missing → migration `20260505000200`
- `project_deployments` schema mismatch → migration `20260505000300`

### Duplicate Session Creation (500)

**Fix**: Added existing active session check in `createSession()`  
**Location**: `apps/api/src/chat-controller/service.ts`

### `tech_stack` JSONB Insert Error

**Fix**: Added `normalizeTechStack()` in `project/service.ts`  
**Pattern**: Always normalize JSONB inputs before DB insert.

### Helm Chart Destructive Changes

**Fix**: Restored `secret.yaml` three-mode logic and `values.prod.yaml` production config.

---

## 🔧 Tech Debt

| Item | Severity | Location | Notes |
|------|----------|----------|-------|
| No monitoring stack deployed | Medium | `monitoring/docker-compose.yml` | Needs ~3.5GB memory; use `kubectl logs` instead |
| PG 16 constraint syntax | Low | All migrations | Must use `DO $$` wrapper for constraints |
| esbuild bundling complexity | Medium | `apps/api/Dockerfile` | Needed for image size (-31%) |
| Frontend mock modules | High | `landing/composables/useMock*` | Should be removed |
| ArgoCD manual intervention | Medium | `deploy/argocd/` | Sometimes needs `terminate-op` + manual sync |

---

## 🛡️ Security Notes

- JWT validation happens ONLY in Gateway layer
- Dev secrets are in `chart/agenthive/values.yaml` — NEVER commit real secrets
- `WITHDRAWAL_ENCRYPT_KEY` must be 32+ chars for AES-256
- API rate limiting: enabled via `express-rate-limit`

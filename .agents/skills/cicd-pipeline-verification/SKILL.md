---
name: cicd-pipeline-verification
description: End-to-end CI/CD pipeline verification for AgentHive Cloud. Verifies GitHub Actions builds, ArgoCD deployments, K8s pod health, and runtime correctness after any code change.
---

# CI/CD Pipeline Verification

## Overview

This skill provides a systematic workflow to verify the entire CI/CD pipeline after any code change, from Git push through GitHub Actions build, ArgoCD sync, Kubernetes deployment, to runtime health checks.

**Pipeline Stages:**

```
Git Push → GitHub Actions (Build + Push to ACR) → ArgoCD Sync → K8s Deploy → Health Verification
```

## When to Use

- After pushing code to `develop` or `main`
- After fixing build/type/migration issues
- When debugging why deployments aren't reaching the cluster
- To verify ArgoCD auto-sync is working
- Before declaring any fix "complete"

## Prerequisites

| Tool | Purpose | Check Command |
|------|---------|---------------|
| `git` | Source control | `git --version` |
| `gh` | GitHub Actions status | `gh auth status` |
| `docker` | Image verification | `docker --version` |
| `kubectl` | K8s cluster access | `kubectl cluster-info` |
| `helm` | Helm releases (optional) | `helm version` |
| `curl` | API health checks | `curl --version` |

**Required Environment Variables/Config:**
- `ARGOCD_URL` — e.g. `https://100.73.49.93:30443`
- `ARGOCD_USER` / `ARGOCD_PASSWORD` — for API token acquisition
- `ACR_REGISTRY` — e.g. `crpi-89ktoa4wv8sjcdow.cn-beijing.personal.cr.aliyuncs.com`
- `K8S_NAMESPACE` — e.g. `agenthive`
- `HELM_RELEASE` — e.g. `agenthive-dev`

## Stage 1: GitHub Actions Verification

### 1.1 List Recent Runs

```bash
gh run list --limit 5 --branch develop
```

**Expected:** Latest run for your commit should appear within 30 seconds of push.

### 1.2 Watch the Run

```bash
gh run watch <run-id> --exit-status
```

**What to verify:**
- `detect-changes` job succeeds
- All `build-and-push` jobs succeed (no TypeScript/Java build errors)
- `update-manifest` job updates `values.dev.yaml` image tags
- **No annotations with `X` (error) markers**

### 1.3 Check for TypeScript Errors

If landing/api builds fail, look for:
```
X Property 'xxx' does not exist on type 'Partial<...>'
```

**Fix:** Add missing optional fields to `packages/types/src/*.ts` AND `apps/api/src/types/index.ts`.

### 1.4 Verify Image Was Pushed

```bash
docker pull <acr-registry>/<repo>/<image>:<tag>
```

**For k3d clusters:** Import image if registry auth fails:
```bash
k3d image import <acr-registry>/<repo>/<image>:<tag> -c <cluster-name>
```

## Stage 2: ArgoCD Verification

### 2.1 Acquire API Token

```bash
curl -k -s -X POST \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"<password>"}' \
  "<argocd-url>/api/v1/session"
```

Store the returned `token`.

### 2.2 Check Application Status

```bash
curl -k -s -H "Authorization: Bearer <token>" \
  "<argocd-url>/api/v1/applications/<app-name>"
```

**Key fields to verify:**

| Field | Healthy Value | Unhealthy Value |
|-------|---------------|-----------------|
| `status.sync.status` | `Synced` | `OutOfSync` |
| `status.health.status` | `Healthy` | `Degraded`, `Missing` |
| `status.operationState.phase` | `Succeeded` | `Failed`, `Running` (stuck) |
| `status.sync.revision` | matches your git SHA | stale/old SHA |

### 2.3 Diagnose Sync Failures

If `operationState.phase == "Failed"`, check `syncResult.resources`:

```json
{
  "kind": "Job",
  "name": "agenthive-dev-db-migrate-1",
  "hookPhase": "Failed",
  "message": "Job has reached the specified backoff limit"
}
```

**Common causes:**
- Migration markers in wrong format (v8 uses `-- up migration`, not `-- ${node-pg-migrate}-up`)
- TypeScript build errors in container
- Missing `DATABASE_URL` or DB credentials
- Image pull failures (missing imagePullSecret)

## Stage 3: Kubernetes Deployment Verification

### 3.1 Check Pod Status

```bash
kubectl get pods -n <namespace> -o wide
```

**Healthy:**
- Pods show `Running` and `1/1` (or expected replica count)
- No `CrashLoopBackOff`, `ErrImagePull`, `ImagePullBackOff`
- Age reflects recent deployment

### 3.2 Verify Pod Image

```bash
kubectl get pod <pod-name> -n <namespace> -o jsonpath='{.spec.containers[0].image}'
```

**Must match** the tag built by GitHub Actions.

### 3.3 Check Pod Logs

```bash
kubectl logs <pod-name> -n <namespace> --tail=50
```

**Look for:**
- Server started successfully
- Database connection OK
- No unhandled exceptions
- Expected startup messages

### 3.4 Check Hook Jobs

```bash
kubectl get jobs -n <namespace>
```

**For `pre-upgrade` hooks:** Should show `Completed` (or be auto-deleted if `hook-delete-policy: hook-succeeded`).

### 3.5 Database Verification

```bash
kubectl exec -it <postgres-pod> -n <namespace> -- \
  psql -U <user> -d <db> -c "\dt"
```

**Verify:**
- Expected tables exist
- `_migrations` table exists and is populated
- No missing tables from failed migrations

## Stage 4: Runtime Health Verification

### 4.1 Port-Forward and Test (if no ingress)

```bash
kubectl port-forward pod/<api-pod> 3001:3001 -n <namespace>
curl http://localhost:3001/api/health
```

### 4.2 Check Health Endpoint from Pod

```bash
kubectl exec <api-pod> -n <namespace> -- \
  node -e "const http=require('http'); http.get('http://localhost:3001/api/health',(res)=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>console.log(res.statusCode,d))})"
```

**Expected:** `200 {"ok":true,...}` with `database: ok`, `redis: ok`.

### 4.3 Key Health Fields

| Service | Expected |
|---------|----------|
| `database.ok` | `true` |
| `redis.ok` | `true` |
| `llm.ok` | `false` is OK if `LLM_API_KEY=REPLACE_ME` in dev |

## Quick Verification Checklist

After any code push, run through this checklist:

- [ ] GitHub Actions run completed successfully
- [ ] All build-and-push jobs passed (no `X` annotations)
- [ ] Image tag in ACR matches expected version
- [ ] ArgoCD `sync.status` is `Synced` (or `OutOfSync` → `Synced` within 5 min)
- [ ] ArgoCD `sync.revision` matches latest git SHA
- [ ] K8s pods are `Running` with correct image tag
- [ ] Pod logs show clean startup (no errors)
- [ ] Hook jobs completed successfully
- [ ] Database tables are correct
- [ ] Health endpoint returns 200

## Troubleshooting Matrix

| Symptom | Stage | Likely Cause | Fix |
|---------|-------|--------------|-----|
| GitHub Actions fails with TS errors | Stage 1 | Missing types in `packages/types` | Add optional fields to interfaces |
| GitHub Actions fails with Docker build | Stage 1 | Dockerfile issue | Check `pnpm -r build` output |
| ArgoCD `OutOfSync` + stale revision | Stage 2 | Git not pushed / CI didn't update manifest | Push code / check `update-manifest` job |
| ArgoCD sync `Failed` with Job error | Stage 2 | Hook job crashes | Check migration markers, DB connectivity |
| Pod `ErrImagePull` | Stage 3 | Missing imagePullSecret / wrong tag | Verify ACR auth, image exists in registry |
| Pod `CrashLoopBackOff` | Stage 3 | App crashes on startup | Check pod logs for runtime errors |
| Health check DB fails | Stage 4 | Migrations didn't run | Check hook job logs, `\dt` in postgres |
| `_migrations` exists but tables missing | Stage 4 | Migration markers wrong | Fix SQL markers, reset DB, re-run |

## ArgoCD ↔ Helm Hook Compatibility Notes

ArgoCD treats Helm hooks as its own sync hooks:
- `helm.sh/hook: pre-install,pre-upgrade` → ArgoCD `PreSync`
- `helm.sh/hook: post-install,post-upgrade` → ArgoCD `PostSync`
- `helm.sh/hook-delete-policy: hook-succeeded` → Auto-deletes after success

**Critical:** If a PreSync hook fails, ArgoCD **aborts the entire sync** and retries up to `syncPolicy.retry.limit` times.

## One-Command Full Verification

```bash
# Requires: ARGOCD_TOKEN, ARGOCD_URL, K8S_NAMESPACE set

echo "=== GitHub Actions ==="
gh run list --limit 1 --branch develop

echo "=== ArgoCD Status ==="
curl -k -s -H "Authorization: Bearer $ARGOCD_TOKEN" \
  "$ARGOCD_URL/api/v1/applications/agenthive-dev" | \
  jq -r '{sync: .status.sync.status, health: .status.health.status, revision: .status.sync.revision, phase: .status.operationState.phase}'

echo "=== K8s Pods ==="
kubectl get pods -n $K8S_NAMESPACE

echo "=== API Health ==="
kubectl exec deploy/api -n $K8S_NAMESPACE -- \
  node -e "http.get('http://localhost:3001/api/health',(r)=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>console.log(r.statusCode,d))})"
```

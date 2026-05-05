# Reference: Deployment Checklist

> Quick reference for deploying and troubleshooting the dev environment.

---

## Dev Environment (k3d)

### Prerequisites
- Docker Desktop with WSL2 backend
- k3d installed
- kubectl configured
- Helm 3 installed

### Cluster Info

| Item | Value |
|------|-------|
| Cluster name | `agenthive-dev` |
| API server | `https://100.76.250.86:57116` |
| Namespace | `agenthive` |
| Helm release | `agenthive-dev` |
| Current revision | 20 |

### Quick Deploy Steps

```bash
# 1. Build image
$env:IMAGE_TAG="v0.1.0-dev.1-$(git rev-parse --short HEAD)"
docker build -t crpi-89ktoa4wv8sjcdow.cn-beijing.personal.cr.aliyuncs.com/namespace-alpha/agenthive-api:$env:IMAGE_TAG -f apps/api/Dockerfile .

# 2. Push to ACR
docker push crpi-89ktoa4wv8sjcdow.cn-beijing.personal.cr.aliyuncs.com/namespace-alpha/agenthive-api:$env:IMAGE_TAG

# 3. Import to k3d
k3d image import crpi-89ktoa4wv8sjcdow.cn-beijing.personal.cr.aliyuncs.com/namespace-alpha/agenthive-api:$env:IMAGE_TAG -c agenthive-dev

# 4. Upgrade Helm
helm upgrade agenthive-dev ./chart/agenthive -n agenthive -f ./chart/agenthive/values.yaml --set api.image.tag=$env:IMAGE_TAG

# 5. Verify
kubectl get pods -n agenthive
kubectl logs -n agenthive deployment/api --tail=50
```

### CI/CD Pipeline

GitHub Actions → ACR build & push → k3d import → Helm upgrade

Workflow: `.github/workflows/agenthive-ci-cd.yml`

---

## Helm Secret Modes

The chart supports three secret management modes:

| Mode | Values | Use Case |
|------|--------|----------|
| **A: ExternalSecret** | `secret.externalSecret.enabled=true` | Production with alicloud-kms |
| **B: Empty Secret** | `secret.createEmpty=true` | Values injected by external script |
| **C: Helm-managed** | (default) | Dev environment, secrets in values |

**Dev uses Mode C** — secrets in `chart/agenthive/values.yaml` under `secret.data`.

**Critical keys**:
- `INTERNAL_API_TOKEN`
- `WITHDRAWAL_ENCRYPT_KEY`
- `LLM_API_KEY`
- `DB_PASSWORD`
- `REDIS_PASSWORD`

---

## Troubleshooting

### ImagePullBackOff

```bash
# Check image name
echo "Expected: namespace-alpha/agenthive-api:<tag>"
kubectl describe pod -n agenthive <pod-name>

# Verify image is imported
k3d image list -c agenthive-dev | grep agenthive-api

# Re-import if missing
k3d image import <image>:<tag> -c agenthive-dev
```

### CrashLoopBackOff

```bash
# Check logs
kubectl logs -n agenthive <pod-name> --previous

# Common causes:
# - DB connection failed (check DB host/port)
# - Missing env var (check secret values)
# - Migration failed (check db-migrate job logs)
```

### DB Migration Failures

```bash
# Check migration job
kubectl logs -n agenthive job/db-migrate

# Clean up failed jobs
kubectl delete job -n agenthive db-migrate-1 db-migrate-2 ...

# Test migrations locally
node scripts/test-migrations.js
```

### ArgoCD Sync Issues

```bash
# Check app status
argocd app get agenthive-dev

# If operation is stuck:
argocd app terminate-op agenthive-dev

# Manual sync
argocd app sync agenthive-dev
```

---

## Memory Budget

| Component | Memory |
|-----------|--------|
| k3d total | ~5.2GB |
| k3d agent node | ~2.95GB |
| k3d server node | ~2.24GB |
| API pod | ~200-400MB |
| Java services (when running) | ~400-500MB each |

**Rule**: Java services disabled in dev to save memory. Enable only when testing Java features.

---

## Production Config (Reference)

See `chart/agenthive/values.prod.yaml`:
- API replicas: 3
- HPA: min=3, max=15
- PDB: minAvailable=2
- Java services: replicas=3, HPA, PDB
- Ingress: TLS + cert-manager
- Registry auth: node-level (not in values)

# Develop → Production Consistency Analysis Report

**Version**: v1.1.0  
**Date**: 2026-04-29  
**Scope**: Docker Compose, K8s Overlays, Java Configs, Environment Variables

---

## Executive Summary

| Dimension | Status | Risk |
|-----------|--------|------|
| Docker Compose Service Parity | ⚠️ Partial | Low |
| K8s Overlay Consistency | ✅ Good | Low |
| Java Application Configs | ❌ Gaps | **Medium** |
| Environment Variable Alignment | ❌ Misalignment | **Medium** |
| Database Schema Consistency | ✅ Good | Low |
| Container Image Tags | ❌ Outdated | **High** |

**Overall**: 3/6 dimensions fully aligned. 3 require action before production release.

---

## 1. Docker Compose Service Parity

### Service Matrix

| Service | Dev | Prod | Notes |
|---------|-----|------|-------|
| api | ✅ | ✅ | Same build context |
| landing | ✅ | ✅ | Same build context |
| nginx | ✅ | ✅ | Reverse proxy |
| nacos | ✅ | ✅ | Service discovery |
| rabbitmq | ✅ | ✅ | Message queue |
| prometheus | ✅ | ✅ | Metrics |
| grafana | ✅ | ✅ | Dashboards |
| tempo | ✅ | ✅ | Tracing |
| loki | ✅ | ✅ | Logging |
| postgres | ✅ | ❌ | Dev-only local DB |
| redis | ✅ | ❌ | Dev-only local cache |
| jaeger | ✅ | ❌ | Dev-only tracing UI |
| watchtower | ❌ | ✅ | Prod-only auto-update |

**Assessment**: ✅ Expected differences. Prod uses external managed DB/Redis (ECS).

---

## 2. K8s Overlay Consistency

### Staging vs Production Comparison

| Aspect | Staging | Production | Assessment |
|--------|---------|------------|------------|
| Namespace | agenthive-staging | agenthive-production | ✅ |
| API Replicas | 2 | 3 | ✅ Expected |
| Landing Replicas | 2 | 3 | ✅ Expected |
| API Memory Limit | 512Mi | 1Gi | ✅ Expected |
| API CPU Limit | 500m | 1000m | ✅ Expected |
| HPA | ❌ | ✅ | ⚠️ Staging lacks HPA |
| PDB | ❌ | ✅ | ⚠️ Staging lacks PDB |
| Rate Limiting | ❌ | ✅ 100/1m | ⚠️ Staging lacks rate limit |
| TLS Issuer | letsencrypt-staging | letsencrypt-prod | ✅ |
| Image Tag | staging | **v1.0.0** | ❌ **Must update to v1.1.0** |

**Critical Finding**: Production overlay references image tag `v1.0.0`. Must be updated to `v1.1.0` for this release.

---

## 3. Java Application Configs

### Profile Coverage Gap

| Service | application.yml | application-docker.yml | application-dev.yml | application-prod.yml |
|---------|-----------------|------------------------|---------------------|----------------------|
| gateway-service | ✅ | ✅ | ✅ | ✅ |
| auth-service | ✅ | ✅ | ✅ | ❌ |
| user-service | ✅ | ✅ | ✅ | ❌ |
| payment-service | ✅ | ✅ | ❌ | ❌ |
| order-service | ✅ | ✅ | ❌ | ❌ |
| cart-service | ✅ | ✅ | ❌ | ❌ |
| logistics-service | ✅ | ✅ | ❌ | ❌ |

**Assessment**: Only gateway-service has complete profile coverage. **4 of 7 services lack production-specific configs.**

### Gateway CORS Config (Valid Difference)

```yaml
# dev
allowedOrigins:
  - "http://localhost:3000"
  - "http://localhost:3001"

# prod
allowedOrigins:
  - "https://agenthive.cloud"
  - "https://app.agenthive.cloud"
```

✅ This is correct and expected.

---

## 4. Environment Variable Alignment

### Config Consistency Check Results

**Tool**: `scripts/config-consistency-check.py`

| Metric | Count |
|--------|-------|
| Warnings | 8 |
| Errors | 9 |

### Missing from .env.dev.example (6 variables)

- `ALIYUN_SMS_DEFAULT_SIGN_NAME`
- `ALIYUN_SMS_OIDC_PROVIDER_ARN`
- `ALIYUN_SMS_OIDC_ROLE_ARN`
- `ALIYUN_SMS_TEMPLATE_CODE_RESET_PASSWORD`
- `JAVA_PAYMENT_URL`
- `NACOS_NAMESPACE`

### Variable Name Mismatches (7 services)

**Issue**: docker-compose injects `SPRING_CLOUD_NACOS_SERVER_ADDR` but Java apps consume `NACOS_SERVER`.

**Affected Services**: gateway-service, auth-service, user-service, payment-service, order-service, cart-service, logistics-service

**Impact**: Spring Cloud Nacos bootstrap may fail to resolve server address in containerized environments.

### .env File Differences (Expected)

| Variable | Dev | Prod |
|----------|-----|------|
| DB_HOST | postgres | 172.24.146.165 |
| DB_PORT | 5433 | 5432 |
| DB_PASSWORD | dev | *(empty in template)* |
| REDIS_PASSWORD | *(not set)* | *(empty in template)* |

✅ These differences are expected and correct.

---

## 5. Database Schema Consistency

| Service | Schema File | Size | Assessment |
|---------|-------------|------|------------|
| Node API | apps/api/src/db/schema.sql | 8,461 bytes | ✅ Current |
| auth-service | apps/java/auth-service/.../schema.sql | 1,106 bytes | ✅ Current |
| order-service | apps/java/order-service/.../schema.sql | 2,784 bytes | ✅ Current |
| payment-service | apps/java/payment-service/.../schema.sql | 8,130 bytes | ✅ Current |

**Note**: No Flyway/Liquibase migration files detected. Schema changes require manual deployment coordination.

---

## 6. Risks & Recommendations

### 🔴 High Risk

| # | Risk | Impact | Mitigation |
|---|------|--------|------------|
| 1 | **Production K8s image tag is v1.0.0** | Deploys old version | Update `k8s/overlays/production/kustomization.yaml` image tags to `v1.1.0` before release |

### 🟡 Medium Risk

| # | Risk | Impact | Mitigation |
|---|------|--------|------------|
| 2 | **4 Java services lack application-prod.yml** | Prod config falls back to defaults | Create application-prod.yml for auth-service, user-service, payment-service, order-service |
| 3 | **Nacos variable name mismatch** | Service discovery failure | Align docker-compose injection key with Spring property key, or add alias |
| 4 | **Missing .env.dev.example variables** | New devs missing required env | Add all 6 missing variables to .env.dev.example |

### 🟢 Low Risk

| # | Risk | Impact | Mitigation |
|---|------|--------|------------|
| 5 | **Staging lacks HPA/PDB/rate-limit** | Staging-prod behavior divergence | Add to staging overlay for realistic pre-prod testing |
| 6 | **No automated schema migration** | Manual deployment risk | Consider adopting Flyway in future release |

---

## 7. Production Release Checklist

### Pre-Release (Must Complete)

- [ ] Update `k8s/overlays/production/kustomization.yaml` image tags: `v1.0.0` → `v1.1.0`
- [ ] Create `application-prod.yml` for: auth-service, user-service, payment-service, order-service
- [ ] Fix Nacos variable alignment (`SPRING_CLOUD_NACOS_SERVER_ADDR` ↔ `NACOS_SERVER`)
- [ ] Update `.env.dev.example` with 6 missing variables
- [ ] Verify all schema.sql files are deployed to production database
- [ ] Run `scripts/config-consistency-check.py` and confirm exit code 0

### Release Day

- [ ] Tag release: `git tag -a v1.1.0 -m "Release v1.1.0"`
- [ ] Build and push container images to `registry.cn-hangzhou.aliyuncs.com/agenthive/`
- [ ] Apply K8s production overlay: `kubectl apply -k k8s/overlays/production/`
- [ ] Verify health checks pass for all services
- [ ] Run smoke tests against production endpoints

### Post-Release

- [ ] Monitor error rates and latency for 24 hours
- [ ] Verify OpenTelemetry traces flowing to Tempo
- [ ] Confirm backup cronjobs are running

---

## Appendix: Commands for Verification

```bash
# Config consistency check
python scripts/config-consistency-check.py

# K8s manifest validation
kubectl kustomize k8s/overlays/production/ | kubectl apply --dry-run=client -f -

# Docker Compose config validation
docker-compose -f docker-compose.prod.yml config

# Java config profile check
for svc in auth-service user-service payment-service order-service; do
  if [ ! -f "apps/java/$svc/src/main/resources/application-prod.yml" ]; then
    echo "MISSING: $svc/application-prod.yml"
  fi
done
```

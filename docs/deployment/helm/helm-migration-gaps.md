# Helm Migration Gaps and Risks

> **Status**: Analysis Document  
> **Scope**: Docker-Compose ↔ K8s Manifests parity gaps for PLATFORM-007/008  
> **Tickets**: PLATFORM-007 (Node.js), PLATFORM-008 (Java), PLATFORM-006 (Helm skeleton)

---

## 1. Environment Variable Gaps

### 1.1 In `docker-compose.prod.yml` but NOT in K8s manifests

These variables are actively used in production Docker Compose but are absent from current K8s manifests. They **must** be added to Helm templates.

#### API Service

| Variable | Source | Impact | Action |
|----------|--------|--------|--------|
| `REDIS_PASSWORD` | `.env.prod` | Redis auth fails if password enabled | Add to Secret, inject via env |
| `CORS_ORIGIN` | `.env.prod` | CORS blocks frontend requests | Add to ConfigMap or values.yaml |
| `UV_THREADPOOL_SIZE` | hardcoded (`4`) | Async crypto/FS performance | Add to deployment env |
| `LLM_BASE_URL` | `.env.prod` | LLM API unreachable | Add to ConfigMap |
| `LLM_MODEL` | `.env.prod` | Wrong model selected | Add to ConfigMap |
| `LLM_USER_AGENT` | `.env.prod` | API rejects requests | Add to ConfigMap |
| `OTEL_SERVICE_NAME` | hardcoded (`agenthive-api`) | OTel spans unlabeled | Add to deployment env |
| `OTEL_RESOURCE_ATTRIBUTES` | hardcoded | Missing deployment tags | Add to deployment env |

#### Landing Service

| Variable | Source | Impact | Action |
|----------|--------|--------|--------|
| `NITRO_PORT` | hardcoded (`3000`) | Nuxt may bind wrong port | Add to deployment env |
| `GATEWAY_URL` | hardcoded | Landing talks to wrong backend | **CRITICAL**: Currently `API_URL` points to `api:3001` in K8s but `java-gateway:8080` in Docker. Must be configurable per environment |
| `NUXT_PUBLIC_API_BASE` | hardcoded (`/api`) | Nuxt public config missing | Add to deployment env |

#### Java Services (ALL)

| Variable | Source | Impact | Action |
|----------|--------|--------|--------|
| `NACOS_USERNAME` / `NACOS_PASSWORD` | `.env.prod` | Nacos auth fails | Add to Secret, inject via env |
| `SPRING_CLOUD_NACOS_DISCOVERY_USERNAME` | derived | Discovery auth fails | Add alongside NACOS_USERNAME |
| `SPRING_CLOUD_NACOS_CONFIG_USERNAME` | derived | Config auth fails | Add alongside NACOS_USERNAME |
| `SPRING_DATA_REDIS_PASSWORD` | `.env.prod` | Redis auth fails | Add to Secret |
| `OTEL_SERVICE_NAME` | per-service | Spans unlabeled | Add per-service |
| `OTEL_TRACES_EXPORTER` | hardcoded (`otlp`) | Traces not exported | Add to deployment env |
| `OTEL_METRICS_EXPORTER` | hardcoded (`otlp`) | Metrics not exported | Add to deployment env |
| `OTEL_LOGS_EXPORTER` | hardcoded (`otlp`) | Logs not exported | Add to deployment env |
| `OTEL_INSTRUMENTATION_LOGBACK_APPENDER_EXPERIMENTAL_CAPTURE_KEY_VALUE_PAIR_ATTRIBUTES` | hardcoded (`true`) | Missing trace context in logs | Add to deployment env |
| `LOGGING_PATTERN_CONSOLE` | hardcoded | Logs lack trace IDs | Add to deployment env |

#### Java Services (Payment, Order, Cart, Logistics)

| Variable | Source | Impact | Action |
|----------|--------|--------|--------|
| `SPRING_RABBITMQ_USERNAME` | `.env.prod` | RabbitMQ auth fails | Add to Secret |
| `SPRING_RABBITMQ_PASSWORD` | `.env.prod` | RabbitMQ auth fails | Add to Secret |
| `SPRING_MAIN_ALLOW_BEAN_DEFINITION_OVERRIDING` | hardcoded (`true`) | Bean conflict on startup | Add to Payment/Order deployment env |

#### Java Services (Payment only)

| Variable | Source | Impact | Action |
|----------|--------|--------|--------|
| `INTERNAL_API_TOKEN` | `.env.prod` | Internal API calls rejected | Add to Secret |
| `WITHDRAWAL_ENCRYPT_KEY` | `.env.prod` | Payment encryption broken | Add to Secret |

#### Java Services (Auth only)

| Variable | Source | Impact | Action |
|----------|--------|--------|--------|
| `ALIYUN_SMS_ENABLED` | `.env.prod` | SMS features misconfigured | Add to ConfigMap |
| `ALIBABA_CLOUD_ACCESS_KEY_ID` | `.env.prod` | SMS auth fails | Add to Secret |
| `ALIBABA_CLOUD_ACCESS_KEY_SECRET` | `.env.prod` | SMS auth fails | Add to Secret |
| `ALIYUN_SMS_DEFAULT_SIGN_NAME` | `.env.prod` | SMS sending fails | Add to ConfigMap/Secret |
| `ALIYUN_SMS_OIDC_PROVIDER_ARN` | `.env.prod` | OIDC SMS auth fails | Add to Secret |
| `ALIYUN_SMS_OIDC_ROLE_ARN` | `.env.prod` | OIDC SMS auth fails | Add to Secret |
| `ALIYUN_SMS_TEMPLATE_CODE_RESET_PASSWORD` | `.env.prod` | SMS template missing | Add to ConfigMap |

### 1.2 In K8s manifests but NOT in `docker-compose.prod.yml`

| Variable / Config | K8s Location | Docker-Compose | Impact | Action |
|-------------------|-------------|----------------|--------|--------|
| `app-config` ConfigMap | `k8s/base/08-configmap.yaml` | Hardcoded env vars | Docker lacks central config management | Helm should centralize; docker-compose may continue hardcoding for simplicity |
| `OTEL_EXPORTER_OTLP_INSECURE` | ConfigMap (`true`) | Not set in Docker | Docker uses HTTP (4318) vs K8s gRPC (4317) | Docker-compose uses `:4318` (HTTP); K8s ConfigMap uses `:4317` (gRPC). Both work but are inconsistent. |
| `STRUCTURED_LOGGING` | ConfigMap (`true`) | Not set | JSON logs in K8s, plain in Docker | Minor; align if desired |
| `MAX_CONNECTIONS` | ConfigMap (`100`) | Not set | Connection pool size | Minor |
| `REQUEST_TIMEOUT` | ConfigMap (`30000`) | Not set | HTTP timeout | Minor |
| `CACHE_TTL` | ConfigMap (`3600`) | Not set | Cache TTL | Minor |

---

## 2. Security Gaps

### 2.1 Java Services Missing Security Controls

Current `k8s/base/10-java-services.yaml` is significantly less hardened than Node.js manifests.

| Control | API/Landing | Java Services | Risk Level |
|---------|------------|---------------|------------|
| `readOnlyRootFilesystem: true` | ✅ | ❌ **Missing** | 🔴 **High** — Container root FS is writable; compromised containers can modify binaries |
| `capabilities: drop: [ALL]` | ✅ | ❌ **Missing** | 🔴 **High** — Unnecessary Linux capabilities available |
| `allowPrivilegeEscalation: false` | ✅ | ❌ **Missing** | 🟡 **Medium** — Privilege escalation possible via setuid |
| `seccompProfile: RuntimeDefault` | ✅ | ❌ **Missing** | 🟡 **Medium** — No syscall filtering |
| `ServiceAccount` per service | ✅ | ❌ **Missing** | 🟡 **Medium** — Default SA used; broader permissions |
| `automountServiceAccountToken: false` | ✅ | N/A | 🟡 **Medium** — Not applicable without custom SA |
| `startupProbe` | ✅ | ❌ **Missing** | 🟡 **Medium** — Kubernetes may kill slow-starting Java pods prematurely |
| `PodDisruptionBudget` | ✅ | ❌ **Missing** | 🟡 **Medium** — No availability guarantee during node drains |
| `NetworkPolicy` | ✅ | ❌ **Missing** | 🔴 **High** — Java services can talk to any pod in namespace; lateral movement risk |
| `HPA` | ✅ | ❌ **Missing** | 🟢 **Low** — Manual scaling only |

### 2.2 UID/GID Mismatch

| Component | Dockerfile UID | K8s Manifest UID | Helm Target |
|-----------|---------------|------------------|-------------|
| API | `1000` (base image) | `1000` | `1000` ✅ |
| Landing | `1000` (base image) | `1000` | `1000` ✅ |
| Java services | `1001` (`appuser`) | `1000` | **Must be `1001`** ⚠️ |

> **Risk**: Running Java containers as UID `1000` when the image only has user `1001` (`appuser`) means the process runs as an unmapped UID. While `runAsNonRoot: true` prevents root, the mismatch may cause file permission issues if the container writes to volumes.

### 2.3 Secret Management

Current K8s uses `ExternalSecret` + `ClusterSecretStore` (AliCloud KMS). This is **advanced** and requires:
- ACK cluster with OIDC Provider enabled
- RAM Role with KMS permissions
- External Secrets Operator installed

**Risk**: If Helm is deployed to a cluster without External Secrets Operator, all Secret references will fail.

**Mitigation**: Helm chart should support both modes:
```yaml
secrets:
  mode: "external"   # or "inline" for dev/minikube
  externalSecret:
    enabled: true
    storeRef: alicloud-kms
  inline:
    enabled: false
    data: {}
```

---

## 3. Resource Limit Mismatches

### 3.1 Docker-Compose vs K8s Base

| Service | Docker Limit | K8s Request | K8s Limit | Verdict |
|---------|-------------|-------------|-----------|---------|
| API | 512M | 256Mi / 250m | 512Mi / 500m | ✅ Aligned |
| Landing | **1G** | 128Mi / 100m | **256Mi** / 250m | 🔴 **MAJOR GAP** — Docker allows 4× memory |
| Gateway | 512M | 256Mi / 250m | 512Mi / 500m | ✅ Aligned |
| Auth | **768M** | 256Mi / 250m | 512Mi / 500m | 🟡 Gap — Docker allows 50% more |
| User | 512M | 256Mi / 250m | 512Mi / 500m | ✅ Aligned |
| Payment | 512M | 256Mi / 250m | 512Mi / 500m | ✅ Aligned |
| Order | 512M | 256Mi / 250m | 512Mi / 500m | ✅ Aligned |
| Cart | 512M | 256Mi / 250m | 512Mi / 500m | ✅ Aligned |
| Logistics | 512M | 256Mi / 250m | 512Mi / 500m | ✅ Aligned |

### 3.2 Production Kustomize vs Docker-Compose

| Service | Docker Limit | Prod Kustomize Limit | Verdict |
|---------|-------------|---------------------|---------|
| API | 512M | 1Gi / 1000m | 🟡 Prod higher — acceptable |
| Landing | 1G | 512Mi / 500m | 🔴 **Prod is LOWER than Docker** |

> **Risk**: Landing in production Kustomize has `512Mi` limit vs `1G` in docker-compose. Nuxt SSR with large pages may OOM. Recommend Helm production default `1Gi` for Landing to match docker-compose reality.

### 3.3 Java Services: Docker-Compose Memory Limits

Docker-compose sets Java heap explicitly (`-Xmx384m` / `-Xmx512m`) but container memory limit equals heap + overhead. The K8s memory limits (`512Mi`) barely cover JVM heap + metaspace + native memory.

> **Recommendation**: Java services should set K8s memory request = JVM max heap + 128Mi overhead, limit = request × 1.5. For `-Xmx384m`: request `512Mi`, limit `768Mi`.

---

## 4. Health Check Differences

### 4.1 API

| Aspect | K8s | Docker-Compose | Delta |
|--------|-----|---------------|-------|
| Endpoint | `/api/health` | `/api/health` | ✅ Same |
| Liveness interval | 10s | 15s | Minor |
| Liveness start delay | 30s | 30s | ✅ Same |
| Startup probe | ✅ Yes (failureThreshold: 12) | start_period: 30s | K8s more granular |

### 4.2 Landing

| Aspect | K8s | Docker-Compose | Delta |
|--------|-----|---------------|-------|
| Endpoint | `/` | `/` | ✅ Same |
| Liveness interval | 10s | 15s | Minor |
| Startup probe | ✅ Yes | start_period: 30s | K8s more granular |

### 4.3 Java Services

| Aspect | K8s | Docker-Compose | Delta |
|--------|-----|---------------|-------|
| Gateway endpoint | `/health` | `/actuator/health` | 🔴 **DIFFERENT** — Gateway K8s uses `/health`, Docker uses `/actuator/health` |
| Other endpoints | `/actuator/health` | `/actuator/health` | ✅ Same |
| Liveness start delay | 60s | 60s | ✅ Same |
| Startup probe | ❌ Missing | start_period: 60s | 🔴 **K8s missing startup protection** |
| Probe types | liveness + readiness | N/A (single healthcheck) | K8s richer |

> **Critical**: Gateway health path mismatch. `k8s/base/10-java-services.yaml` uses `/health` but the Spring Boot actuator exposes `/actuator/health`. The Dockerfile health check also uses `/actuator/health`. The K8s manifest may be relying on a custom `/health` endpoint that exists in the Gateway code — verify this before Helm implementation.

---

## 5. Ingress Configuration Gaps

### 5.1 Path-Based vs Subdomain-Based Routing

| Environment | API Routing | Landing Routing |
|-------------|------------|----------------|
| Base K8s | `agenthive.example.com/api` → API | `agenthive.example.com/` → Landing |
| Production Kustomize | `api.agenthive.cloud/` → API | `agenthive.cloud/` → Landing |
| Docker-Compose | Nginx routes `/api` → API | Nginx routes `/` → Landing |

> **Gap**: Production uses **subdomain-based** API access (`api.agenthive.cloud`), while base uses **path-based** (`/api`). The Gateway service is NOT exposed via Ingress in current manifests — it is `LoadBalancer` type. Landing in Docker talks to Gateway (`java-gateway:8080`), but in K8s Ingress routes directly to API.

> **Design Decision**: In Helm, Landing should point to Gateway for API calls (consistent with Docker), but Ingress should route `/api` to Gateway (not direct to API) for production. This requires Ingress rules for Gateway too.

### 5.2 Missing Java Service Ingress Exposure

Gateway is currently `LoadBalancer` type. In a typical K8s + Ingress setup:
- Gateway should be `ClusterIP`
- Ingress should route `/api/*` to Gateway
- Gateway then routes to individual Java services via Nacos/Spring Cloud Gateway

Current manifests skip this abstraction and expose API directly. Helm should decide whether to:
1. **Preserve current behavior** (API direct, Gateway LoadBalancer)
2. **Fix architecture** (Gateway behind Ingress, API internal only)

> **Recommendation**: Preserve current behavior in Helm v1 to minimize migration risk. Document Gateway Ingress exposure as PLATFORM-009 enhancement.

---

## 6. Database Architecture Gaps

### 6.1 Docker-Compose: Single External DB

Docker-compose.prod.yml uses a single external PostgreSQL host (`172.24.146.165`) for all services. Multiple DB names are created on this instance.

### 6.2 K8s: Multiple PostgreSQL StatefulSets

K8s deploys:
- `postgres` — for Node API (`agenthive` DB)
- `postgres-auth` — for Auth service (`auth_db`)
- `postgres-user` — for User service (`user_db`)
- `postgres-business` — for Payment/Order/Cart/Logistics (`payment_db`, `order_db`, `cart_db`, `logistics_db`)

### 6.3 Gap

| Aspect | Docker | K8s | Risk |
|--------|--------|-----|------|
| DB instances | 1 external | 4 in-cluster | Data consistency / backup complexity |
| Persistence | External managed | PVC (5-10Gi each) | K8s storage class must support RWO |
| Connection strings | Same host, different DB names | Different hostnames | Java service env vars differ |

> **Note**: `k8s/base/02-postgres-java.yaml` comment says "3 independent PostgreSQL instances (legacy architecture, consider using single instance with multi-db)". Helm design should consider deploying a single PostgreSQL instance with multiple databases to reduce overhead, or keep current architecture for isolation.

---

## 7. Infrastructure Services Missing from K8s

| Service | Docker-Compose | K8s Manifest | Status |
|---------|---------------|--------------|--------|
| Nacos | ✅ Yes (`nacos/nacos-server:v2.3.0`) | ❌ Missing | Java services reference `nacos:8848` but no Service/Endpoints defined |
| RabbitMQ | ✅ Yes (`rabbitmq:3.13-management-alpine`) | ❌ Missing | Referenced by 4 Java services |
| Watchtower | ✅ Yes | ❌ N/A | Docker-only concern |

> **Risk**: If K8s cluster does not have Nacos and RabbitMQ deployed separately, Java services will fail to start. Helm chart should either:
> 1. Include `ExternalName` Services pointing to external infrastructure
> 2. Include conditional subcharts for Nacos/RabbitMQ
> 3. Document prerequisite infrastructure deployment

---

## 8. Monitoring Stack Differences

| Component | Docker-Compose | K8s | Gap |
|-----------|---------------|-----|-----|
| Prometheus | `v2.48.0` | Not in base manifests | Deployed separately or via Helm |
| Grafana | `10.0.0` | Not in base manifests | Deployed separately or via Helm |
| Tempo | `2.5.0` | Not in base manifests | Deployed separately or via Helm |
| Loki | `3.0.0` | Not in base manifests | Deployed separately or via Helm |
| OTel Collector | `0.96.0` | Not in base manifests | Deployed separately or via Helm |
| Jaeger | `1.55` (dev only) | Not present | Dev-only, not needed in K8s |

> **Note**: These are out of scope for PLATFORM-007/008 but are dependencies. The `monitoring/` directory contains docker-compose configs. K8s monitoring should be deployed via separate Helm chart or existing cluster add-ons.

---

## 9. Risks Summary

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|------------|
| R1 | Landing OOM in production due to 512Mi limit vs 1G in Docker | High | High | Set Helm prod default to 1Gi for Landing |
| R2 | Java services fail to start due to missing Nacos/RabbitMQ in K8s | High | High | Add ExternalName Services or infrastructure prerequisites doc |
| R3 | Java security context gaps (`readOnlyRootFilesystem`, capabilities) | High | High | Add all missing security controls in Helm |
| R4 | UID mismatch (1000 vs 1001) causes Java volume permission errors | Medium | Medium | Set `runAsUser: 1001` in Helm for Java services |
| R5 | Gateway health path `/health` vs `/actuator/health` causes probe failures | Medium | High | Verify Gateway code; align probe path |
| R6 | Missing env vars (OTEL, RabbitMQ, SMS) cause silent feature degradation | High | Medium | Audit all docker-compose env vars; add to Helm |
| R7 | NetworkPolicy absence allows lateral movement if pod compromised | Medium | High | Add NetworkPolicies for all Java services |
| R8 | `ExternalSecret` dependency on AliCloud KMS blocks deployment to non-ACK clusters | Medium | Medium | Support inline Secret mode in Helm values |
| R9 | Landing `API_URL` points to API in K8s but Gateway in Docker | Medium | Medium | Make `API_URL` configurable per overlay |
| R10 | HPA absence for Java services means no auto-scaling | Low | Medium | Add optional HPA to Helm |

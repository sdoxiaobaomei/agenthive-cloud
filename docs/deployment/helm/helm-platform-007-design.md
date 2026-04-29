# PLATFORM-007: Helm Chart Design — Node.js Services (API + Landing)

> **Status**: Design Document  
> **Scope**: API (Express) + Landing (Nuxt 3)  
> **Depends on**: PLATFORM-006 (Helm Chart skeleton)  
> **Target**: `helm/nodejs-services/`

---

## 1. Service Inventory

| Service | Type | Container Port | K8s Service Port | Health Path | Probe Type |
|---------|------|---------------|------------------|-------------|------------|
| `api` | Backend | 3001 | 3001 | `/api/health` | liveness + readiness + startup |
| `landing` | Frontend | 3000 | 3000 | `/` | liveness + readiness + startup |

---

## 2. Required Environment Variables

### 2.1 API Service

| Var | Source | Key | Sensitive | Notes |
|-----|--------|-----|-----------|-------|
| `PORT` | hardcoded | — | No | `"3001"` |
| `NODE_ENV` | ConfigMap | `NODE_ENV` | No | — |
| `DB_HOST` | ConfigMap | `DB_HOST` | No | — |
| `DB_PORT` | ConfigMap | `DB_PORT` | No | — |
| `DB_NAME` | ConfigMap | `DB_NAME` | No | — |
| `DB_USER` | ConfigMap | `DB_USER` | No | — |
| `DB_PASSWORD` | Secret | `DB_PASSWORD` | **Yes** | — |
| `REDIS_URL` | ConfigMap | `REDIS_URL` | No | `redis://redis:6379` |
| `JWT_SECRET` | Secret | `JWT_SECRET` | **Yes** | — |
| `LLM_API_KEY` | Secret | `LLM_API_KEY` | **Yes** | — |

**Docker-Compose extras (NOT in current K8s manifests — must be added to Helm):**

| Var | Default | Notes |
|-----|---------|-------|
| `REDIS_PASSWORD` | `""` | Required if Redis has auth enabled |
| `CORS_ORIGIN` | `http://localhost,https://localhost` | Multi-origin CORS |
| `UV_THREADPOOL_SIZE` | `4` | libuv threadpool for crypto/FS |
| `LLM_BASE_URL` | `https://api.kimi.com/coding/v1` | Moonshot API endpoint |
| `LLM_MODEL` | `kimi-for-coding` | Default model |
| `LLM_USER_AGENT` | `claude-code/0.1.0` | Required for Coding Plan |
| `OTEL_SERVICE_NAME` | `agenthive-api` | OTel service identifier |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | from ConfigMap | Already in ConfigMap |
| `OTEL_RESOURCE_ATTRIBUTES` | `service.namespace=agenthive,deployment.environment=production` | Add in Helm |

### 2.2 Landing Service

| Var | Source | Key | Sensitive | Notes |
|-----|--------|-----|-----------|-------|
| `API_URL` | ConfigMap | `API_URL` | No | Points to API or Gateway |
| `NODE_ENV` | ConfigMap | `NODE_ENV` | No | — |

**Docker-Compose extras (NOT in current K8s manifests — must be added to Helm):**

| Var | Default | Notes |
|-----|---------|-------|
| `NITRO_PORT` | `3000` | Nuxt runtime port |
| `GATEWAY_URL` | `http://java-gateway:8080` | **CRITICAL**: Docker uses Gateway; K8s base Ingress uses `api:3001` directly. Prod Kustomize uses `prod-api:3001`. Must be configurable per overlay. |
| `NUXT_PUBLIC_API_BASE` | `/api` | Public runtime config for Nuxt |

> ⚠️ **Design Decision**: `API_URL` in K8s base is `http://api:3001`, but docker-compose.prod.yml sets `API_URL=http://java-gateway:8080` and `GATEWAY_URL=http://java-gateway:8080`. Landing should talk to Gateway in production for auth/routing consistency. Helm `values.yaml` should default `API_URL` to Gateway in prod overlay.

---

## 3. Resource Limits

### 3.1 Base (dev/staging)

| Service | CPU Request | CPU Limit | Memory Request | Memory Limit |
|---------|------------|-----------|----------------|--------------|
| API | 250m | 500m | 256Mi | 512Mi |
| Landing | 100m | 250m | 128Mi | 256Mi |

### 3.2 Production (from Kustomize overlay)

| Service | CPU Request | CPU Limit | Memory Request | Memory Limit |
|---------|------------|-----------|----------------|--------------|
| API | 500m | 1000m | 512Mi | 1Gi |
| Landing | 250m | 500m | 256Mi | 512Mi |

### 3.3 Docker-Compose Reference (for comparison)

| Service | Memory Limit |
|---------|-------------|
| API | 512M |
| Landing | **1G** |

> ⚠️ **Gap**: Docker-compose gives Landing 1G, but K8s base limits to 256Mi. Production Kustomize raises to 512Mi. The 1G docker-compose limit suggests Nuxt SSR may need more under load. Recommend Helm default to 512Mi/512Mi for Landing in production.

---

## 4. Health Check Specifications

### 4.1 API

```yaml
livenessProbe:
  httpGet:
    path: /api/health
    port: http
  initialDelaySeconds: 30
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 3
readinessProbe:
  httpGet:
    path: /api/health
    port: http
  initialDelaySeconds: 5
  periodSeconds: 5
  timeoutSeconds: 3
  failureThreshold: 3
startupProbe:
  httpGet:
    path: /api/health
    port: http
  initialDelaySeconds: 10
  periodSeconds: 5
  timeoutSeconds: 3
  failureThreshold: 12   # 60s max startup
```

### 4.2 Landing

```yaml
livenessProbe:
  httpGet:
    path: /
    port: http
  initialDelaySeconds: 30
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 3
readinessProbe:
  httpGet:
    path: /
    port: http
  initialDelaySeconds: 5
  periodSeconds: 5
  timeoutSeconds: 3
  failureThreshold: 3
startupProbe:
  httpGet:
    path: /
    port: http
  initialDelaySeconds: 10
  periodSeconds: 5
  timeoutSeconds: 3
  failureThreshold: 12
```

> **Docker-Compose delta**: Docker health checks use `wget` every 15s with 5 retries and 30s start_period. K8s probes are more granular. Keep K8s semantics in Helm.

---

## 5. Recommended `values.yaml` Structure

```yaml
# ============================================================================
# Node.js Services — Helm Values
# ============================================================================

global:
  namespace: agenthive
  imageRegistry: "registry.cn-hangzhou.aliyuncs.com/agenthive"
  imagePullPolicy: IfNotPresent

  # ConfigMap reference (shared across all services)
  configMapName: app-config
  # Secret reference (shared)
  secretName: app-secrets

api:
  enabled: true
  replicas: 2

  image:
    repository: api
    tag: latest

  service:
    type: ClusterIP
    port: 3001
    targetPort: 3001

  env:
    # Hardcoded
    PORT: "3001"
    # From ConfigMap
    NODE_ENV: "production"
    # Extra env vars (merged into container env)
    extra:
      UV_THREADPOOL_SIZE: "4"
      CORS_ORIGIN: "https://agenthive.cloud,https://www.agenthive.cloud"
      OTEL_SERVICE_NAME: "agenthive-api"
      OTEL_RESOURCE_ATTRIBUTES: "service.namespace=agenthive,deployment.environment=production"
      # OTEL_EXPORTER_OTLP_ENDPOINT pulled from ConfigMap

  envFrom:
    configMapRef:
      - name: app-config
    secretRef:
      - name: app-secrets

  resources:
    requests:
      memory: "256Mi"
      cpu: "250m"
    limits:
      memory: "512Mi"
      cpu: "500m"

  probes:
    liveness:
      path: /api/health
      initialDelaySeconds: 30
      periodSeconds: 10
      timeoutSeconds: 5
      failureThreshold: 3
    readiness:
      path: /api/health
      initialDelaySeconds: 5
      periodSeconds: 5
      timeoutSeconds: 3
      failureThreshold: 3
    startup:
      path: /api/health
      initialDelaySeconds: 10
      periodSeconds: 5
      timeoutSeconds: 3
      failureThreshold: 12

  pdb:
    enabled: true
    minAvailable: 1

  serviceAccount:
    create: true
    automountToken: false

  securityContext:
    runAsNonRoot: true
    runAsUser: 1000
    runAsGroup: 1000
    fsGroup: 1000
    seccompProfile:
      type: RuntimeDefault

  containerSecurityContext:
    allowPrivilegeEscalation: false
    readOnlyRootFilesystem: true
    capabilities:
      drop:
        - ALL

  volumes:
    - name: tmp
      emptyDir: {}

  volumeMounts:
    - name: tmp
      mountPath: /tmp

  affinity:
    podAntiAffinity:
      preferredDuringSchedulingIgnoredDuringExecution:
        - weight: 100
          podAffinityTerm:
            labelSelector:
              matchExpressions:
                - key: app.kubernetes.io/name
                  operator: In
                  values:
                    - api
            topologyKey: kubernetes.io/hostname

  hpa:
    enabled: true
    minReplicas: 2
    maxReplicas: 10
    targetCPUUtilizationPercentage: 70
    targetMemoryUtilizationPercentage: 80
    behavior:
      scaleDown:
        stabilizationWindowSeconds: 300
        policies:
          - type: Percent
            value: 10
            periodSeconds: 60
      scaleUp:
        stabilizationWindowSeconds: 0
        policies:
          - type: Percent
            value: 100
            periodSeconds: 15
          - type: Pods
            value: 4
            periodSeconds: 15
        selectPolicy: Max

  ingress:
    enabled: false   # API is behind Gateway; Ingress routes to Landing + Gateway

landing:
  enabled: true
  replicas: 2

  image:
    repository: landing
    tag: latest

  service:
    type: ClusterIP
    port: 3000
    targetPort: 3000

  env:
    NITRO_PORT: "3000"
    NUXT_PUBLIC_API_BASE: "/api"
    GATEWAY_URL: "http://gateway-service:8080"
    API_URL: "http://gateway-service:8080"   # Prefer Gateway over direct API
    OTEL_SDK_DISABLED: "true"   # Landing currently disables OTel

  envFrom:
    configMapRef:
      - name: app-config

  resources:
    requests:
      memory: "128Mi"
      cpu: "100m"
    limits:
      memory: "256Mi"
      cpu: "250m"

  probes:
    liveness:
      path: /
      initialDelaySeconds: 30
      periodSeconds: 10
      timeoutSeconds: 5
      failureThreshold: 3
    readiness:
      path: /
      initialDelaySeconds: 5
      periodSeconds: 5
      timeoutSeconds: 3
      failureThreshold: 3
    startup:
      path: /
      initialDelaySeconds: 10
      periodSeconds: 5
      timeoutSeconds: 3
      failureThreshold: 12

  pdb:
    enabled: true
    minAvailable: 1

  serviceAccount:
    create: true
    automountToken: false

  securityContext:
    runAsNonRoot: true
    runAsUser: 1000
    runAsGroup: 1000
    fsGroup: 1000
    seccompProfile:
      type: RuntimeDefault

  containerSecurityContext:
    allowPrivilegeEscalation: false
    readOnlyRootFilesystem: true
    capabilities:
      drop:
        - ALL

  volumes:
    - name: tmp
      emptyDir: {}
    - name: cache
      emptyDir: {}

  volumeMounts:
    - name: tmp
      mountPath: /tmp
    - name: cache
      mountPath: /app/.cache

  affinity:
    podAntiAffinity:
      preferredDuringSchedulingIgnoredDuringExecution:
        - weight: 100
          podAffinityTerm:
            labelSelector:
              matchExpressions:
                - key: app.kubernetes.io/name
                  operator: In
                  values:
                    - landing
            topologyKey: kubernetes.io/hostname

  hpa:
    enabled: true
    minReplicas: 2
    maxReplicas: 8
    targetCPUUtilizationPercentage: 70
    targetMemoryUtilizationPercentage: 80
    behavior:
      scaleDown:
        stabilizationWindowSeconds: 300
        policies:
          - type: Percent
            value: 10
            periodSeconds: 60
      scaleUp:
        stabilizationWindowSeconds: 0
        policies:
          - type: Percent
            value: 100
            periodSeconds: 15
        selectPolicy: Max

  ingress:
    enabled: true
    hosts:
      - host: agenthive.cloud
        paths:
          - path: /
            pathType: Prefix
      - host: www.agenthive.cloud
        paths:
          - path: /
            pathType: Prefix
    tls:
      - secretName: production-tls-secret
        hosts:
          - agenthive.cloud
          - www.agenthive.cloud
```

---

## 6. Ingress Host Rules and TLS Config

### 6.1 Production (from `k8s/overlays/production/`)

| Host | Path | Backend Service | Port |
|------|------|----------------|------|
| `agenthive.cloud` | `/` | landing | 3000 |
| `www.agenthive.cloud` | `/` | landing | 3000 |
| `api.agenthive.cloud` | `/` | api | 3001 |

**TLS**: `production-tls-secret` (managed by cert-manager + letsencrypt-prod)

**Annotations**:
- `nginx.ingress.kubernetes.io/ssl-redirect: "true"`
- `nginx.ingress.kubernetes.io/force-ssl-redirect: "true"`
- `nginx.ingress.kubernetes.io/hsts: "true"`
- `nginx.ingress.kubernetes.io/hsts-max-age: "31536000"`
- `nginx.ingress.kubernetes.io/hsts-include-subdomains: "true"`
- `nginx.ingress.kubernetes.io/proxy-body-size: "50m"`
- `nginx.ingress.kubernetes.io/proxy-read-timeout: "300"`
- `nginx.ingress.kubernetes.io/proxy-send-timeout: "300"`
- `nginx.ingress.kubernetes.io/rate-limit: "100"`
- `nginx.ingress.kubernetes.io/rate-limit-window: "1m"`
- `cert-manager.io/cluster-issuer: "letsencrypt-prod"`
- `configuration-snippet` for security headers (X-Frame-Options, X-Content-Type-Options, Referrer-Policy)

### 6.2 Base / Dev

| Host | Path | Backend Service | Port |
|------|------|----------------|------|
| `agenthive.example.com` | `/api` | api | 3001 |
| `agenthive.example.com` | `/` | landing | 3000 |

**TLS**: `agenthive-tls`

> **Note**: In production, the API is exposed via `api.agenthive.cloud` (dedicated subdomain), not path-based `/api`. This differs from base manifest. Helm should support both patterns via `values-production.yaml`.

---

## 7. HPA Thresholds

| Service | Min | Max | CPU Target | Memory Target | Scale-Up Window | Scale-Down Window |
|---------|-----|-----|-----------|---------------|-----------------|-------------------|
| API | 2 (3 prod) | 10 | 70% | 80% | 0s (base) / 60s (prod) | 300s |
| Landing | 2 (3 prod) | 8 (10 prod) | 70% | 80% | 0s (base) / 60s (prod) | 300s |

> **Prod delta**: Production overlay changes scaleUp stabilization from `0s` to `60s` and removes the Pods-based policy. Helm `values-production.yaml` should reflect this.

---

## 8. PodDisruptionBudget

| Service | Base minAvailable | Prod minAvailable |
|---------|------------------|-------------------|
| API | 1 | 2 |
| Landing | 1 | 2 |

---

## 9. Init Containers

API requires a `wait-for-db` init container:

```yaml
initContainers:
  - name: wait-for-db
    image: busybox:1.36
    command: ['sh', '-c', 'until nc -z postgres 5432; do echo waiting for db; sleep 2; done;']
    resources:
      requests:
        memory: "16Mi"
        cpu: "10m"
      limits:
        memory: "32Mi"
        cpu: "50m"
    securityContext:
      allowPrivilegeEscalation: false
      readOnlyRootFilesystem: true
      capabilities:
        drop:
        - ALL
```

Landing does **not** need an init container (depends on API at Ingress level, not startup).

---

## 10. NetworkPolicy (to be generated by Helm)

Current `k8s/base/06-networkpolicy.yaml` only covers API and Landing egress/ingress with Postgres and Redis. **Java services are missing NetworkPolicies entirely.**

For Node.js services in Helm, retain:
- API: Ingress from Landing + Ingress Controller; Egress to Postgres + Redis + DNS
- Landing: Ingress from Ingress Controller only; Egress to API + DNS

> **Design note**: When PLATFORM-008 adds Java services, the NetworkPolicy must be expanded to allow:
> - Landing → Gateway (8080)
> - Gateway → API (3001)
> - All Java services → Postgres-*, Redis, RabbitMQ, Nacos

---

## 11. Prod-Specific Patches (from Kustomize → Helm values-production.yaml)

| Patch | Target | Base Value | Prod Value |
|-------|--------|-----------|------------|
| Image registry | both | `agenthive/*` | `registry.cn-hangzhou.aliyuncs.com/agenthive/*` |
| Image tag | both | `latest` | `v1.1.0` |
| Replicas | api | 2 | 3 |
| Replicas | landing | 2 | 3 |
| CPU request | api | 250m | 500m |
| CPU limit | api | 500m | 1000m |
| Memory request | api | 256Mi | 512Mi |
| Memory limit | api | 512Mi | 1Gi |
| CPU request | landing | 100m | 250m |
| CPU limit | landing | 250m | 500m |
| Memory request | landing | 128Mi | 256Mi |
| Memory limit | landing | 256Mi | 512Mi |
| PDB minAvailable | api | 1 | 2 |
| PDB minAvailable | landing | 1 | 2 |
| HPA scaleUp window | api | 0s | 60s |
| HPA scaleUp window | landing | 0s | 60s |
| Ingress hosts | landing | `agenthive.example.com` | `agenthive.cloud`, `www.agenthive.cloud` |
| Ingress API host | api | path `/api` on same host | `api.agenthive.cloud` |
| TLS secret | both | `agenthive-tls` | `production-tls-secret` |
| cert-manager | both | absent | `letsencrypt-prod` |

---

## 12. Template Design Notes for PLATFORM-006 Executor

1. **Use a single `_helpers.tpl`** with named templates:
   - `nodejs.labels` — standard labels
   - `nodejs.selectorLabels` — selector labels
   - `nodejs.serviceAccountName` — conditional SA
   - `nodejs.probes` — parameterized probe block

2. **Create one generic `deployment.yaml` template** that loops over `.Values.services` OR create separate `api-deployment.yaml` and `landing-deployment.yaml`. **Recommendation**: separate files because API has initContainer, Landing does not; probe paths differ; resource profiles differ.

3. **Shared templates**:
   - `service.yaml` — can be generic, one per service
   - `hpa.yaml` — generic, enabled per service
   - `pdb.yaml` — generic, enabled per service
   - `networkpolicy.yaml` — one manifest per service (or one with loops)
   - `serviceaccount.yaml` — one per service

4. **ConfigMap/Secret references**: Use `envFrom` for bulk import, but individual `env` entries for hardcoded vars. This matches current K8s manifest pattern.

5. **Ingress**: Separate `ingress.yaml` using `{{- if .Values.ingress.enabled }}`. Support multiple hosts and TLS blocks.

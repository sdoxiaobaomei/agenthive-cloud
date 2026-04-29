# PLATFORM-008: Helm Chart Design — Java Microservices

> **Status**: Design Document  
> **Scope**: Gateway, Auth, User, Payment, Order, Cart, Logistics  
> **Depends on**: PLATFORM-006 (Helm Chart skeleton)  
> **Target**: `helm/java-services/`

---

## 1. Service Inventory

| Service | K8s Deployment Name | Container Port | Service Type | Health Path | K8s DB Host | Docker DB Host |
|---------|--------------------|----------------|--------------|-------------|-------------|----------------|
| Gateway | `gateway-service` | 8080 | **LoadBalancer** | `/health` | N/A (no DB) | N/A |
| Auth | `auth-service` | 8081 | ClusterIP | `/actuator/health` | `postgres-auth` | external |
| User | `user-service` | 8082 | ClusterIP | `/actuator/health` | `postgres-user` | external |
| Payment | `payment-service` | 8083 | ClusterIP | `/actuator/health` | `postgres-business` | external |
| Order | `order-service` | 8084 | ClusterIP | `/actuator/health` | `postgres-business` | external |
| Cart | `cart-service` | 8085 | ClusterIP | `/actuator/health` | `postgres-business` | external |
| Logistics | `logistics-service` | 8086 | ClusterIP | `/actuator/health` | `postgres-business` | external |

> **Note**: Gateway is the only service exposed via `LoadBalancer` in current K8s manifests. In a typical K8s setup with Ingress, Gateway should probably be `ClusterIP` and reached via Ingress or internal Service mesh. The current manifest uses `LoadBalancer` — Helm should preserve this but make it configurable.

---

## 2. Per-Service Configuration Matrix

### 2.1 JVM Arguments

| Service | Docker-Compose `JAVA_OPTS` | Dockerfile Default | Recommended K8s |
|---------|---------------------------|-------------------|-----------------|
| Gateway | `-Xms256m -Xmx384m -XX:+UseG1GC -XX:MaxGCPauseMillis=100` | `-XX:MaxRAMPercentage=75.0 -XX:InitialRAMPercentage=50.0` | Use Dockerfile defaults + explicit heap for predictability |
| Auth | `-Xms256m -Xmx512m -XX:+UseG1GC -XX:MaxGCPauseMillis=100` | same as above | same |
| User | `-Xms256m -Xmx384m -XX:+UseG1GC -XX:MaxGCPauseMillis=100` | same as above | same |
| Payment | `-Xms256m -Xmx384m -XX:+UseG1GC -XX:MaxGCPauseMillis=100` | same as above | same |
| Order | `-Xms256m -Xmx384m -XX:+UseG1GC -XX:MaxGCPauseMillis=100` | same as above | same |
| Cart | `-Xms256m -Xmx384m -XX:+UseG1GC -XX:MaxGCPauseMillis=100` | same as above | same |
| Logistics | `-Xms256m -Xmx384m -XX:+UseG1GC -XX:MaxGCPauseMillis=100` | same as above | same |

> **Design Decision**: The Dockerfile already sets `JAVA_OPTS` via ENV. In Helm, override `JAVA_OPTS` per service via the `env` block. Do NOT bake K8s-specific heap sizes into the image.

### 2.2 Environment Variables by Service

#### Common Env Vars (ALL Java services)

| Var | Value / Source | Notes |
|-----|---------------|-------|
| `SPRING_PROFILES_ACTIVE` | `docker` | Uses `application-docker.yml` |
| `SPRING_CLOUD_NACOS_CONFIG_IMPORT_CHECK_ENABLED` | `false` | Disables import check for K8s bootstrap |
| `NACOS_SERVER` | `nacos:8848` | Service discovery DNS |
| `NACOS_HOST` | `nacos` | — |
| `NACOS_PORT` | `8848` | — |
| `SPRING_CLOUD_NACOS_DISCOVERY_SERVER_ADDR` | `nacos:8848` | — |
| `SPRING_CLOUD_NACOS_CONFIG_SERVER_ADDR` | `nacos:8848` | — |
| `NACOS_USERNAME` | Secret / ConfigMap | Default `nacos` |
| `NACOS_PASSWORD` | Secret | Default `nacos` |
| `SPRING_CLOUD_NACOS_DISCOVERY_USERNAME` | Same as NACOS_USERNAME | — |
| `SPRING_CLOUD_NACOS_DISCOVERY_PASSWORD` | Same as NACOS_PASSWORD | — |
| `SPRING_CLOUD_NACOS_CONFIG_USERNAME` | Same as NACOS_USERNAME | — |
| `SPRING_CLOUD_NACOS_CONFIG_PASSWORD` | Same as NACOS_PASSWORD | — |
| `SPRING_DATA_REDIS_HOST` | `redis` | — |
| `SPRING_DATA_REDIS_PORT` | `6379` | — |
| `SPRING_DATA_REDIS_PASSWORD` | Secret | — |
| `JWT_SECRET` | Secret | — |
| `OTEL_SERVICE_NAME` | `<service-name>` | e.g. `gateway-service` |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | ConfigMap / hardcoded | `http://otel-collector-gateway.monitoring:4317` |
| `OTEL_RESOURCE_ATTRIBUTES` | `service.namespace=agenthive,deployment.environment=production` | — |
| `OTEL_TRACES_EXPORTER` | `otlp` | — |
| `OTEL_METRICS_EXPORTER` | `otlp` | — |
| `OTEL_LOGS_EXPORTER` | `otlp` | — |
| `OTEL_INSTRUMENTATION_LOGBACK_APPENDER_EXPERIMENTAL_CAPTURE_KEY_VALUE_PAIR_ATTRIBUTES` | `true` | — |
| `LOGGING_PATTERN_CONSOLE` | `%d{yyyy-MM-dd HH:mm:ss.SSS} %-5level [trace_id=%X{trace_id},span_id=%X{span_id}] [%thread] %logger{36} - %msg%n` | — |

#### Gateway-Specific

| Var | Value | Notes |
|-----|-------|-------|
| `SPRING_DATA_REDIS_HOST` | `redis` | Used for rate limiting / token caching |
| `JWT_SECRET` | Secret | Verifies tokens |
| `ALIYUN_SMS_ENABLED` | `false` | Gateway may not need this; remove if unused |
| `ALIBABA_CLOUD_ACCESS_KEY_ID` | Secret | Only if Gateway uses SMS |
| `ALIBABA_CLOUD_ACCESS_KEY_SECRET` | Secret | Only if Gateway uses SMS |

#### Auth-Specific

| Var | Value | Notes |
|-----|-------|-------|
| `DB_HOST` | `postgres-auth` | K8s headless service |
| `DB_PORT` | `5432` | — |
| `DB_NAME` | `auth_db` | — |
| `DB_USER` | Secret / ConfigMap | — |
| `DB_PASSWORD` | Secret | — |
| `ALIYUN_SMS_ENABLED` | `false` | Configurable |
| `ALIBABA_CLOUD_ACCESS_KEY_ID` | Secret | SMS credentials |
| `ALIBABA_CLOUD_ACCESS_KEY_SECRET` | Secret | SMS credentials |
| `ALIYUN_SMS_DEFAULT_SIGN_NAME` | Secret/ConfigMap | — |
| `ALIYUN_SMS_OIDC_PROVIDER_ARN` | Secret | — |
| `ALIYUN_SMS_OIDC_ROLE_ARN` | Secret | — |
| `ALIYUN_SMS_TEMPLATE_CODE_RESET_PASSWORD` | Secret | — |

#### User-Specific

| Var | Value | Notes |
|-----|-------|-------|
| `DB_HOST` | `postgres-user` | K8s headless service |
| `DB_PORT` | `5432` | — |
| `DB_NAME` | `user_db` | — |
| `DB_USER` | Secret / ConfigMap | — |
| `DB_PASSWORD` | Secret | — |

#### Payment-Specific

| Var | Value | Notes |
|-----|-------|-------|
| `DB_HOST` | `postgres-business` | K8s headless service |
| `DB_PORT` | `5432` | — |
| `DB_NAME` | `payment_db` | — |
| `DB_USER` | Secret / ConfigMap | — |
| `DB_PASSWORD` | Secret | — |
| `SPRING_RABBITMQ_HOST` | `rabbitmq` | — |
| `SPRING_RABBITMQ_PORT` | `5672` | — |
| `SPRING_RABBITMQ_USERNAME` | Secret / ConfigMap | Default `agenthive` |
| `SPRING_RABBITMQ_PASSWORD` | Secret | Default `agenthive-secret` |
| `SPRING_MAIN_ALLOW_BEAN_DEFINITION_OVERRIDING` | `true` | Resolves bean conflicts |
| `INTERNAL_API_TOKEN` | Secret | Internal API auth |
| `WITHDRAWAL_ENCRYPT_KEY` | Secret | Payment encryption |

#### Order-Specific

| Var | Value | Notes |
|-----|-------|-------|
| `DB_HOST` | `postgres-business` | — |
| `DB_NAME` | `order_db` | — |
| `SPRING_RABBITMQ_HOST` | `rabbitmq` | — |
| `SPRING_RABBITMQ_USERNAME` | Secret / ConfigMap | — |
| `SPRING_RABBITMQ_PASSWORD` | Secret | — |
| `SPRING_MAIN_ALLOW_BEAN_DEFINITION_OVERRIDING` | `true` | — |

#### Cart-Specific

| Var | Value | Notes |
|-----|-------|-------|
| `DB_HOST` | `postgres-business` | — |
| `DB_NAME` | `cart_db` | — |
| `SPRING_RABBITMQ_HOST` | `rabbitmq` | — |
| `SPRING_RABBITMQ_USERNAME` | Secret / ConfigMap | — |
| `SPRING_RABBITMQ_PASSWORD` | Secret | — |

#### Logistics-Specific

| Var | Value | Notes |
|-----|-------|-------|
| `DB_HOST` | `postgres-business` | — |
| `DB_NAME` | `logistics_db` | — |
| `SPRING_RABBITMQ_HOST` | `rabbitmq` | — |
| `SPRING_RABBITMQ_USERNAME` | Secret / ConfigMap | — |
| `SPRING_RABBITMQ_PASSWORD` | Secret | — |

---

## 3. Nacos Configuration

### 3.1 In K8s

Current K8s manifests do **NOT** deploy Nacos. Java services reference `nacos:8848` as an external service. In K8s, this would require either:
- A `Service` + `Endpoints` pointing to an external Nacos instance
- Or Nacos deployed as a StatefulSet within the cluster

### 3.2 Docker-Compose Configuration

```yaml
nacos:
  image: nacos/nacos-server:v2.3.0
  environment:
    MODE: standalone
    PREFER_HOST_MODE: hostname
    NACOS_AUTH_ENABLE: "true"
    NACOS_AUTH_TOKEN: <base64-token>
    NACOS_AUTH_IDENTITY_KEY: agenthive
    NACOS_AUTH_IDENTITY_VALUE: agenthive-secret-2024
```

### 3.3 Helm Design for Nacos

**Option A (External Nacos)**: Create an `ExternalName` Service or EndpointSlice:
```yaml
apiVersion: v1
kind: Service
metadata:
  name: nacos
spec:
  type: ExternalName
  externalName: nacos.agenthive.svc.cluster.local  # or external DNS
```

**Option B (In-cluster Nacos)**: Deploy as dependency subchart or separate chart:
- StatefulSet with persistent volume
- Ports: 8848 (HTTP), 9848 (gRPC)
- Auth enabled with secrets for token/identity
- Resource limits: 1Gi memory (from docker-compose)

> **Recommendation**: For PLATFORM-008, assume **Option A** (external Nacos) to match current docker-compose architecture. Document Option B as future enhancement. The Java services Helm chart should reference Nacos via a configurable host.

---

## 4. RabbitMQ Configuration

### 4.1 In K8s

Current K8s manifests do **NOT** deploy RabbitMQ. Services that need it (Payment, Order, Cart, Logistics) reference `rabbitmq:5672`.

### 4.2 Docker-Compose Configuration

```yaml
rabbitmq:
  image: rabbitmq:3.13-management-alpine
  environment:
    RABBITMQ_DEFAULT_USER: ${RABBITMQ_USER:-agenthive}
    RABBITMQ_DEFAULT_PASS: ${RABBITMQ_PASSWORD:-agenthive-secret}
```

### 4.3 Helm Design for RabbitMQ

Same as Nacos — recommend **ExternalName Service** for now, or deploy via Bitnami RabbitMQ Helm chart as dependency.

```yaml
# values.yaml
rabbitmq:
  enabled: false   # Set to true if deploying in-cluster
  host: "rabbitmq"  # K8s service name or external DNS
  port: 5672
  username: agenthive
  existingSecret: app-secrets
  existingSecretPasswordKey: RABBITMQ_PASSWORD
```

---

## 5. Recommended Shared Template Approach

### 5.1 Design Philosophy

All 7 Java services share ~80% of their K8s manifest structure. Use **one generic Deployment template** with service-specific overrides in `values.yaml`.

### 5.2 `values.yaml` Structure

```yaml
# ============================================================================
# Java Microservices — Helm Values
# ============================================================================

global:
  namespace: agenthive
  imageRegistry: "registry.cn-hangzhou.aliyuncs.com/agenthive"
  imagePullPolicy: IfNotPresent
  imageTag: latest

  # Shared infrastructure references
  nacos:
    host: "nacos"
    port: 8848
    username: "nacos"
    existingSecret: "app-secrets"
    existingSecretPasswordKey: "NACOS_PASSWORD"

  redis:
    host: "redis"
    port: 6379
    existingSecret: "app-secrets"
    existingSecretPasswordKey: "REDIS_PASSWORD"

  rabbitmq:
    host: "rabbitmq"
    port: 5672
    username: "agenthive"
    existingSecret: "app-secrets"
    existingSecretPasswordKey: "RABBITMQ_PASSWORD"

  otel:
    endpoint: "http://otel-collector-gateway.monitoring:4317"
    resourceAttributes: "service.namespace=agenthive,deployment.environment=production"

  # Common secrets
  secretName: app-secrets
  configMapName: app-config

# ---------------------------------------------------------------------------
# Service definitions — looped over by templates
# ---------------------------------------------------------------------------
javaServices:
  gateway-service:
    enabled: true
    replicas: 2
    component: gateway
    port: 8080
    serviceType: LoadBalancer   # Special case
    db:
      enabled: false
    rabbitmq:
      enabled: false
    jvmOpts: "-Xms256m -Xmx384m -XX:+UseG1GC -XX:MaxGCPauseMillis=100"
    resources:
      requests:
        memory: "256Mi"
        cpu: "250m"
      limits:
        memory: "512Mi"
        cpu: "500m"
    extraEnv:
      ALIYUN_SMS_ENABLED: "false"

  auth-service:
    enabled: true
    replicas: 2
    component: auth
    port: 8081
    serviceType: ClusterIP
    db:
      enabled: true
      host: "postgres-auth"
      port: 5432
      name: "auth_db"
    rabbitmq:
      enabled: false
    jvmOpts: "-Xms256m -Xmx512m -XX:+UseG1GC -XX:MaxGCPauseMillis=100"
    resources:
      requests:
        memory: "256Mi"
        cpu: "250m"
      limits:
        memory: "512Mi"
        cpu: "500m"
    extraEnv:
      ALIYUN_SMS_ENABLED: "false"

  user-service:
    enabled: true
    replicas: 2
    component: user
    port: 8082
    serviceType: ClusterIP
    db:
      enabled: true
      host: "postgres-user"
      port: 5432
      name: "user_db"
    rabbitmq:
      enabled: false
    jvmOpts: "-Xms256m -Xmx384m -XX:+UseG1GC -XX:MaxGCPauseMillis=100"
    resources:
      requests:
        memory: "256Mi"
        cpu: "250m"
      limits:
        memory: "512Mi"
        cpu: "500m"

  payment-service:
    enabled: true
    replicas: 2
    component: payment
    port: 8083
    serviceType: ClusterIP
    db:
      enabled: true
      host: "postgres-business"
      port: 5432
      name: "payment_db"
    rabbitmq:
      enabled: true
    jvmOpts: "-Xms256m -Xmx384m -XX:+UseG1GC -XX:MaxGCPauseMillis=100"
    resources:
      requests:
        memory: "256Mi"
        cpu: "250m"
      limits:
        memory: "512Mi"
        cpu: "500m"
    extraEnv:
      SPRING_MAIN_ALLOW_BEAN_DEFINITION_OVERRIDING: "true"

  order-service:
    enabled: true
    replicas: 2
    component: order
    port: 8084
    serviceType: ClusterIP
    db:
      enabled: true
      host: "postgres-business"
      port: 5432
      name: "order_db"
    rabbitmq:
      enabled: true
    jvmOpts: "-Xms256m -Xmx384m -XX:+UseG1GC -XX:MaxGCPauseMillis=100"
    resources:
      requests:
        memory: "256Mi"
        cpu: "250m"
      limits:
        memory: "512Mi"
        cpu: "500m"
    extraEnv:
      SPRING_MAIN_ALLOW_BEAN_DEFINITION_OVERRIDING: "true"

  cart-service:
    enabled: true
    replicas: 2
    component: cart
    port: 8085
    serviceType: ClusterIP
    db:
      enabled: true
      host: "postgres-business"
      port: 5432
      name: "cart_db"
    rabbitmq:
      enabled: true
    jvmOpts: "-Xms256m -Xmx384m -XX:+UseG1GC -XX:MaxGCPauseMillis=100"
    resources:
      requests:
        memory: "256Mi"
        cpu: "250m"
      limits:
        memory: "512Mi"
        cpu: "500m"

  logistics-service:
    enabled: true
    replicas: 2
    component: logistics
    port: 8086
    serviceType: ClusterIP
    db:
      enabled: true
      host: "postgres-business"
      port: 5432
      name: "logistics_db"
    rabbitmq:
      enabled: true
    jvmOpts: "-Xms256m -Xmx384m -XX:+UseG1GC -XX:MaxGCPauseMillis=100"
    resources:
      requests:
        memory: "256Mi"
        cpu: "250m"
      limits:
        memory: "512Mi"
        cpu: "500m"
```

### 5.3 Template Loop Structure

```yaml
# deployment.yaml
{{- range $name, $svc := .Values.javaServices }}
{{- if $svc.enabled }}
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ $name }}
  labels:
    app.kubernetes.io/name: {{ $name }}
    app.kubernetes.io/component: {{ $svc.component }}
spec:
  replicas: {{ $svc.replicas }}
  selector:
    matchLabels:
      app.kubernetes.io/name: {{ $name }}
  template:
    metadata:
      labels:
        app.kubernetes.io/name: {{ $name }}
        app.kubernetes.io/component: {{ $svc.component }}
    spec:
      serviceAccountName: {{ $name }}
      securityContext:
        runAsNonRoot: true
        runAsUser: 1001   # Matches Dockerfile appuser
        runAsGroup: 1001
        fsGroup: 1001
        seccompProfile:
          type: RuntimeDefault
      containers:
      - name: {{ $svc.component }}
        image: "{{ $.Values.global.imageRegistry }}/{{ $name }}:{{ $.Values.global.imageTag }}"
        imagePullPolicy: {{ $.Values.global.imagePullPolicy }}
        ports:
        - containerPort: {{ $svc.port }}
          name: http
        env:
        - name: JAVA_OPTS
          value: {{ $svc.jvmOpts | quote }}
        - name: SPRING_PROFILES_ACTIVE
          value: "docker"
        - name: SPRING_CLOUD_NACOS_CONFIG_IMPORT_CHECK_ENABLED
          value: "false"
        # Nacos
        - name: NACOS_SERVER
          value: "{{ $.Values.global.nacos.host }}:{{ $.Values.global.nacos.port }}"
        - name: NACOS_HOST
          value: {{ $.Values.global.nacos.host | quote }}
        # ... (all common env vars)
        {{- if $svc.db.enabled }}
        # DB vars
        - name: DB_HOST
          value: {{ $svc.db.host | quote }}
        - name: DB_PORT
          value: {{ $svc.db.port | quote }}
        - name: DB_NAME
          value: {{ $svc.db.name | quote }}
        {{- end }}
        {{- if $svc.rabbitmq.enabled }}
        # RabbitMQ vars
        {{- end }}
        {{- with $svc.extraEnv }}
        {{- toYaml . | nindent 8 }}
        {{- end }}
        securityContext:
          allowPrivilegeEscalation: false
          readOnlyRootFilesystem: true
          capabilities:
            drop:
            - ALL
        resources:
          {{- toYaml $svc.resources | nindent 10 }}
        livenessProbe:
          httpGet:
            path: {{ if eq $svc.component "gateway" }}/health{{ else }}/actuator/health{{ end }}
            port: http
          initialDelaySeconds: 60
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: {{ if eq $svc.component "gateway" }}/health{{ else }}/actuator/health{{ end }}
            port: http
          initialDelaySeconds: 10
          periodSeconds: 5
        # startupProbe MISSING in current K8s — add for Helm
        startupProbe:
          httpGet:
            path: {{ if eq $svc.component "gateway" }}/health{{ else }}/actuator/health{{ end }}
            port: http
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 12
{{- end }}
{{- end }}
```

---

## 6. Service Discovery DNS Names in K8s

| Target | DNS Name | Used By |
|--------|----------|---------|
| Node API | `api.agenthive.svc.cluster.local:3001` | Gateway route fallback |
| Landing | `landing.agenthive.svc.cluster.local:3000` | Ingress backend |
| Gateway | `gateway-service.agenthive.svc.cluster.local:8080` | Landing API_URL |
| Auth | `auth-service.agenthive.svc.cluster.local:8081` | Gateway lb://auth-service |
| User | `user-service.agenthive.svc.cluster.local:8082` | Gateway lb://user-service |
| Payment | `payment-service.agenthive.svc.cluster.local:8083` | Gateway lb://payment-service |
| Order | `order-service.agenthive.svc.cluster.local:8084` | Gateway lb://order-service, Payment internal |
| Cart | `cart-service.agenthive.svc.cluster.local:8085` | Gateway lb://cart-service |
| Logistics | `logistics-service.agenthive.svc.cluster.local:8086` | Gateway lb://logistics-service |
| Postgres (Node) | `postgres.agenthive.svc.cluster.local:5432` | API init container |
| Postgres Auth | `postgres-auth.agenthive.svc.cluster.local:5432` | Auth service |
| Postgres User | `postgres-user.agenthive.svc.cluster.local:5432` | User service |
| Postgres Business | `postgres-business.agenthive.svc.cluster.local:5432` | Payment/Order/Cart/Logistics |
| Redis | `redis.agenthive.svc.cluster.local:6379` | All services |
| Nacos | `nacos.agenthive.svc.cluster.local:8848` | All Java services |
| RabbitMQ | `rabbitmq.agenthive.svc.cluster.local:5672` | Payment/Order/Cart/Logistics |

> **Important**: Gateway `application-docker.yml` uses Spring Cloud Gateway `lb://` prefix for load-balanced service discovery via Nacos. The K8s Service names (`auth-service`, `user-service`, etc.) must match the `spring.application.name` values exactly.

---

## 7. Security Hardening for Java Services (K8s gaps)

Current `k8s/base/10-java-services.yaml` has **significant security gaps** compared to Node.js services:

| Security Control | Node.js (API/Landing) | Java Services (Current) | Java Services (Helm Target) |
|-----------------|----------------------|------------------------|----------------------------|
| `ServiceAccount` | ✅ Yes, per service | ❌ Missing | ✅ Yes, per service |
| `automountServiceAccountToken` | ✅ `false` | N/A | ✅ `false` |
| `runAsNonRoot` | ✅ Yes | ✅ Yes | ✅ Yes |
| `runAsUser` | ✅ `1000` | ✅ `1000` | ⚠️ Change to `1001` (matches Dockerfile) |
| `seccompProfile` | ✅ `RuntimeDefault` | ❌ Missing | ✅ `RuntimeDefault` |
| `readOnlyRootFilesystem` | ✅ `true` | ❌ Missing | ✅ `true` |
| `capabilities.drop` | ✅ `ALL` | ❌ Missing | ✅ `ALL` |
| `allowPrivilegeEscalation` | ✅ `false` | ❌ Missing | ✅ `false` |
| `startupProbe` | ✅ Yes | ❌ Missing | ✅ Yes |
| `PodDisruptionBudget` | ✅ Yes | ❌ Missing | ✅ Yes |
| `NetworkPolicy` | ✅ Yes | ❌ Missing | ✅ Yes |
| `HPA` | ✅ Yes | ❌ Missing | ✅ Optional |

> **Critical**: Dockerfile creates `appuser` with UID `1001`, but K8s manifests set `runAsUser: 1000`. This mismatch means the container runs as a non-existent user in the image. Helm must set `runAsUser: 1001` for Java services.

---

## 8. Resource Limits Comparison

| Service | Docker-Compose Limit | K8s Base Request | K8s Base Limit | **Gap** |
|---------|---------------------|------------------|----------------|---------|
| Gateway | 512M | 256Mi / 250m | 512Mi / 500m | ✅ Aligned |
| Auth | 768M | 256Mi / 250m | 512Mi / 500m | ⚠️ Docker gives 50% more memory |
| User | 512M | 256Mi / 250m | 512Mi / 500m | ✅ Aligned |
| Payment | 512M | 256Mi / 250m | 512Mi / 500m | ✅ Aligned |
| Order | 512M | 256Mi / 250m | 512Mi / 500m | ✅ Aligned |
| Cart | 512M | 256Mi / 250m | 512Mi / 500m | ✅ Aligned |
| Logistics | 512M | 256Mi / 250m | 512Mi / 500m | ✅ Aligned |

> **Recommendation**: Auth service docker-compose limit (768M) suggests higher memory needs. In Helm, consider making Auth limits configurable: default 512Mi but allow override to 768Mi or 1Gi in production.

---

## 9. Health Check Design

| Service | Liveness Path | Readiness Path | Startup Path (new) |
|---------|--------------|----------------|-------------------|
| Gateway | `/health` | `/health` | `/health` |
| All others | `/actuator/health` | `/actuator/health` | `/actuator/health` |

**Parameters**:
```yaml
livenessProbe:
  initialDelaySeconds: 60
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 3
readinessProbe:
  initialDelaySeconds: 10
  periodSeconds: 5
  timeoutSeconds: 3
  failureThreshold: 3
startupProbe:   # NEW — not in current K8s manifests
  initialDelaySeconds: 30
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 12   # 120s max startup for Java
```

> **Docker delta**: Docker uses `wget` every 20s with 5 retries and 60s start_period. K8s startupProbe with 30s initial + 12 failures × 10s = 150s provides equivalent coverage.

---

## 10. Template Design Notes for PLATFORM-006 Executor

1. **Shared `_helpers.tpl`**:
   - `java.name` — service name
   - `java.fullname` — release-name + service name
   - `java.labels` — standard labels
   - `java.selectorLabels` — selector labels
   - `java.serviceAccountName` — conditional SA

2. **Core templates**:
   - `deployment.yaml` — single file with `range` over `.Values.javaServices`
   - `service.yaml` — single file with `range` over services
   - `serviceaccount.yaml` — one SA per enabled service
   - `pdb.yaml` — one PDB per enabled service
   - `hpa.yaml` — optional, one per enabled service
   - `networkpolicy.yaml` — one per enabled service (or combined)

3. **Special-case handling in templates**:
   - Gateway: different health path (`/health` vs `/actuator/health`)
   - Gateway: `serviceType: LoadBalancer` vs `ClusterIP`
   - Gateway: no DB env vars
   - Services with RabbitMQ: conditional env block
   - Services with DB: conditional env block

4. **Volumes for Java services**:
   - All Java services need a `tmp` emptyDir because `readOnlyRootFilesystem: true` will be enabled
   - The layered JAR extracts to `/tmp` at runtime; mount `emptyDir` at `/tmp`

5. **ConfigMap/Secret design**:
   - Common Nacos/Redis/RabbitMQ credentials should live in shared ConfigMap/Secret
   - Per-service DB names can be hardcoded in `values.yaml` (not sensitive)
   - DB passwords from shared Secret

6. **Image reference pattern**:
   ```yaml
   image: "{{ $.Values.global.imageRegistry }}/{{ $name }}:{{ $.Values.global.imageTag }}"
   ```
   This matches docker-compose image names (`agenthive/gateway-service:latest`) and Kustomize registry (`registry.cn-hangzhou.aliyuncs.com/agenthive/gateway-service:v1.1.0`).

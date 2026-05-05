# AgentHive Helm Chart 修复方案

> **背景**：从 kustomize 迁移到 Helm Chart 后，prod 环境发生全量服务故障。
> **根因**：Chart 中镜像前缀、Secret 占位符、NetworkPolicy 标签匹配、RollingUpdate 策略均与实际环境不匹配。
> **目标**：修复 chart，使其能在当前单节点 8C ECS + 外部 PostgreSQL/Redis 环境中正确部署。

---

## 一、问题总览

| 序号 | 问题 | 影响 | 修复文件 |
|------|------|------|----------|
| 1 | **镜像前缀错误** | 新 Pod 拉取 `agenthive/xxx` 镜像失败，节点上实际只有 `crpi-89ktoa4wv8sjcdow.cn-beijing.personal.cr.aliyuncs.com/namespace-alpha/xxx` | `values.prod.yaml` |
| 2 | **Secret 硬编码 `REPLACE_ME`** | 每次 helm upgrade 都会把 Secret 重置为占位符，导致 DB/Redis 认证失败、JWT 校验失败 | `templates/secret.yaml`、`values.prod.yaml` |
| 3 | **NetworkPolicy 标签不匹配** | `java-service` 标签不存在，导致 `default-deny-all` 生效后所有 Pod 被网络隔离 | `templates/networkpolicy.yaml` |
| 4 | **RollingUpdate `maxUnavailable: 0`** | 单节点资源紧张时，新 Pod 无法调度，老 Pod 不能删除，更新死锁 | `values.yaml`、`values.prod.yaml`、`templates/nacos-deployment.yaml` |
| 5 | **HPA `minReplicas: 3` 过于激进** | 单节点 8C 无法承载 9 个 Java 服务 × 3 副本 = 27 个 Pod，CPU 直接占满 | `values.prod.yaml` |
| 6 | **缺少 `INTERNAL_API_TOKEN`** | `payment-service` 启动报错 `CreateContainerConfigError` | `templates/secret.yaml`、`values.prod.yaml` |
| 7 | **nacos 镜像仓库** | `nacos/nacos-server:v2.3.0` 从 docker.io 拉取被镜像代理 403 拒绝 | `values.prod.yaml` |

---

## 二、逐条修复方案

### 2.1 镜像前缀修复

**现状**：
- `values.yaml` 中 `api.image.repository: agenthive/api`
- `values.yaml` 中 `javaServices.defaults.image.repositoryPrefix: agenthive`
- `values.yaml` 中 `nacos.image.repository: nacos/nacos-server`

**修复**：在 `values.prod.yaml` 中覆盖 registry + repository：

```yaml
global:
  imageRegistry: "crpi-89ktoa4wv8sjcdow.cn-beijing.personal.cr.aliyuncs.com"

api:
  image:
    repository: "namespace-alpha/api"
    tag: "v1.1.0-g6d872b4"

landing:
  image:
    repository: "namespace-alpha/landing"
    tag: "v1.1.0-g6d872b4"

javaServices:
  defaults:
    image:
      repositoryPrefix: "namespace-alpha"   # 实际拼接后为 namespace-alpha/gateway-service
      tag: "v1.1.0-g6d872b4"

nacos:
  image:
    repository: "nacos/nacos-server"   # 注意：这个在私有仓库的路径是 crpi-.../nacos/nacos-server
    tag: "v2.3.0"
```

> **注意**：nacos 镜像在节点上的实际路径是 `crpi-89ktoa4wv8sjcdow.cn-beijing.personal.cr.aliyuncs.com/nacos/nacos-server:v2.3.0`，所以 `repository` 应设为 `nacos/nacos-server`，registry 由 `global.imageRegistry` 提供。

---

### 2.2 Secret 修复

**现状**：`templates/secret.yaml` 在 `secret.enabled: true` 时硬编码所有值为 `REPLACE_ME`。

**修复思路**：
- **Secret 不应由 Helm Chart 管理真实值**（否则每次 `helm upgrade` 都会覆盖为占位符）
- Chart 只负责声明 Secret 的 schema（key 列表），值由外部注入
- 提供两种模式：
  1. `secret.enabled: false` — 完全外部管理（推荐当前环境）
  2. `secret.externalSecret.enabled: true` — 用 ExternalSecret + KMS（未来）

**修改 `templates/secret.yaml`**：

```yaml
{{- if .Values.secret.enabled }}
{{- if .Values.secret.externalSecret.enabled }}
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: {{ .Values.secret.name }}
  namespace: {{ include "agenthive.namespace" . }}
  labels:
    app.kubernetes.io/name: agenthive
    app.kubernetes.io/component: secret-management
spec:
  refreshInterval: 1h
  secretStoreRef:
    kind: ClusterSecretStore
    name: {{ .Values.secret.externalSecret.secretStoreName | default "alicloud-kms" }}
  target:
    name: {{ .Values.secret.name }}
    creationPolicy: Owner
    deletionPolicy: Retain
    template:
      type: Opaque
      metadata:
        labels:
          app.kubernetes.io/name: agenthive
          app.kubernetes.io/component: secrets
  data:
    - secretKey: DB_USER
      remoteRef:
        key: "agenthive-{{ .Values.global.labels.environment }}-db-user"
    - secretKey: DB_PASSWORD
      remoteRef:
        key: "agenthive-{{ .Values.global.labels.environment }}-db-password"
    - secretKey: JWT_SECRET
      remoteRef:
        key: "agenthive-{{ .Values.global.labels.environment }}-jwt-secret"
    - secretKey: LLM_API_KEY
      remoteRef:
        key: "agenthive-{{ .Values.global.labels.environment }}-llm-api-key"
    - secretKey: REDIS_PASSWORD
      remoteRef:
        key: "agenthive-{{ .Values.global.labels.environment }}-redis-password"
    - secretKey: RABBITMQ_PASSWORD
      remoteRef:
        key: "agenthive-{{ .Values.global.labels.environment }}-rabbitmq-password"
    - secretKey: NACOS_PASSWORD
      remoteRef:
        key: "agenthive-{{ .Values.global.labels.environment }}-nacos-password"
    - secretKey: GRAFANA_ADMIN_PASSWORD
      remoteRef:
        key: "agenthive-{{ .Values.global.labels.environment }}-grafana-password"
    - secretKey: INTERNAL_API_TOKEN
      remoteRef:
        key: "agenthive-{{ .Values.global.labels.environment }}-internal-api-token"
    - secretKey: WITHDRAWAL_ENCRYPT_KEY
      remoteRef:
        key: "agenthive-{{ .Values.global.labels.environment }}-withdrawal-encrypt-key"
{{- else if .Values.secret.createEmpty }}
# 模式 B：创建空 Secret（key 存在，值由外部 patch/注入）
apiVersion: v1
kind: Secret
metadata:
  name: {{ .Values.secret.name }}
  namespace: {{ include "agenthive.namespace" . }}
  labels:
    app.kubernetes.io/name: agenthive
    app.kubernetes.io/component: secrets
type: Opaque
stringData:
  DB_USER: ""
  DB_PASSWORD: ""
  JWT_SECRET: ""
  LLM_API_KEY: ""
  REDIS_PASSWORD: ""
  RABBITMQ_PASSWORD: ""
  NACOS_PASSWORD: ""
  GRAFANA_ADMIN_PASSWORD: ""
  INTERNAL_API_TOKEN: ""
  WITHDRAWAL_ENCRYPT_KEY: ""
{{- end }}
{{- end }}
```

**修改 `values.prod.yaml`**：

```yaml
secret:
  enabled: false          # 生产环境不通过 Helm 管理 Secret，改为外部注入或 ArgoCD Vault Plugin
  createEmpty: false
```

> **使用建议**：
> 1. 首次部署前，手动创建 Secret：`bash scripts/setup-secrets.sh --from-env .env.prod`
> 2. 后续 Helm upgrade 时 `secret.enabled: false`，不会覆盖已有 Secret
> 3. 如果必须用 Helm 管理 Secret，使用 `createEmpty: true`，然后配合 `kubectl patch` 注入值

---

### 2.3 NetworkPolicy 标签匹配修复

**现状**：`templates/networkpolicy.yaml` 中大量策略使用 `app.kubernetes.io/component: java-service`，但实际 deployment 生成的标签是每个服务的 component 名（`gateway`、`auth`、`user`、`payment`、`order`、`cart`、`logistics`）。

**修复**：NetworkPolicy 应匹配实际存在的标签。由于 Java 服务没有统一标签，**最安全的方案是暂时禁用 NetworkPolicy**，或改为基于 `namespace` + `app.kubernetes.io/name` 前缀匹配。

**方案 A（推荐当前环境）：禁用 NetworkPolicy**

```yaml
# values.prod.yaml
networkPolicy:
  enabled: false
```

**方案 B（如需启用）：修正标签匹配**

将 `templates/networkpolicy.yaml` 中所有 `app.kubernetes.io/component: java-service` 替换为对各个服务名称的枚举，或使用 `matchExpressions` + `In` 操作符：

```yaml
# 例如 allow-nacos-ingress 修复后
- from:
    - podSelector:
        matchExpressions:
          - key: app.kubernetes.io/component
            operator: In
            values:
              - gateway
              - auth
              - user
              - payment
              - order
              - cart
              - logistics
```

> **建议**：如果未来要给所有 Java 服务统一标签，应修改 `templates/java-deployment.yaml`，在 `metadata.labels` 中额外添加：
> ```yaml
> app.kubernetes.io/component-group: java-service
> ```
> 然后 NetworkPolicy 统一匹配这个标签。

---

### 2.4 RollingUpdate 策略修复

**现状**：`values.yaml` 和 `values.prod.yaml` 中：

```yaml
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxSurge: 25%
    maxUnavailable: 0
```

`maxUnavailable: 0` 意味着更新时不允许任何 Pod 不可用。在单节点资源紧张时，新 Pod 无法调度，老 Pod 不能终止，更新死锁。

**修复**：改为允许至少 1 个 Pod 不可用：

```yaml
# values.yaml（基础默认值）
api:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 1

landing:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 1

javaServices:
  defaults:
    strategy:
      type: RollingUpdate
      rollingUpdate:
        maxSurge: 1
        maxUnavailable: 1
```

```yaml
# values.prod.yaml（覆盖）
api:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 1

landing:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 1

javaServices:
  defaults:
    strategy:
      type: RollingUpdate
      rollingUpdate:
        maxSurge: 1
        maxUnavailable: 1
```

**同时修改 `templates/nacos-deployment.yaml`**（当前硬编码）：

```yaml
# 修改前（硬编码）
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0

# 修改后（引用 values）
  strategy:
    {{- toYaml .Values.nacos.strategy | nindent 4 }}
```

并在 `values.yaml` 中新增：

```yaml
nacos:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 1
```

---

### 2.5 HPA 副本数修复（单节点环境）

**现状**：`values.prod.yaml` 中：
- 每个 Java 服务 `replicas: 3`，`hpa.minReplicas: 3`
- API `replicas: 3`，`hpa.minReplicas: 3`
- Landing `replicas: 3`，`hpa.minReplicas: 3`

单节点 8C 上，仅 Java 服务就需 `9 服务 × 3 副本 × 500m CPU = 13500m`（远超 8000m）。

**修复**：prod 环境当前是单节点，应降低副本数，或提供 `hpa.enabled` 开关：

```yaml
# values.prod.yaml
api:
  replicas: 1
  hpa:
    enabled: false          # 单节点关闭 HPA，避免 CPU 占满

landing:
  replicas: 1
  hpa:
    enabled: false

javaServices:
  defaults:
    replicas: 1
    hpa:
      enabled: false
  services:
    gateway:
      replicas: 1
      hpa:
        enabled: false
    auth:
      replicas: 1
      hpa:
        enabled: false
    # ... 其他服务同理
```

> **未来扩容**：当迁移到多节点集群时，再恢复 `replicas: 3` 和 `hpa.enabled: true`。

---

### 2.6 缺少 `INTERNAL_API_TOKEN` 修复

**现状**：`templates/secret.yaml` 中没有 `INTERNAL_API_TOKEN` 和 `WITHDRAWAL_ENCRYPT_KEY` 字段，但 `payment-service` 的 `application.yml` 中引用了 `${INTERNAL_API_TOKEN}`。

**修复**：已在 2.2 节的 Secret 修复中一并加入这两个 key。

如需在 `values.yaml` 中提供默认值（用于 dev 环境）：

```yaml
# values.yaml
secret:
  defaults:
    INTERNAL_API_TOKEN: "change-me-min-32-chars"
    WITHDRAWAL_ENCRYPT_KEY: "change-me-32-chars-encrypt"
```

---

## 三、修复后的 `values.prod.yaml` 完整示例

```yaml
# ============================================================================
# AgentHive Cloud — Production Values Override (Fixed)
# ============================================================================

global:
  imageRegistry: "crpi-89ktoa4wv8sjcdow.cn-beijing.personal.cr.aliyuncs.com"
  labels:
    environment: production

# ----------------------------------------------------------------------------
# Secret — 生产环境不由 Helm 管理，改为外部注入
# ----------------------------------------------------------------------------
secret:
  enabled: false

# ----------------------------------------------------------------------------
# NetworkPolicy — 当前单节点环境暂时禁用，后续修复标签后再启用
# ----------------------------------------------------------------------------
networkPolicy:
  enabled: false

# ----------------------------------------------------------------------------
# API Service — Production
# ----------------------------------------------------------------------------
api:
  replicas: 1
  image:
    repository: "namespace-alpha/api"
    tag: "v1.1.0-g6d872b4"
  resources:
    requests:
      memory: 512Mi
      cpu: 500m
    limits:
      memory: 1Gi
      cpu: 1000m
  pdb:
    enabled: false
  hpa:
    enabled: false
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 1

# ----------------------------------------------------------------------------
# Landing Service — Production
# ----------------------------------------------------------------------------
landing:
  replicas: 1
  image:
    repository: "namespace-alpha/landing"
    tag: "v1.1.0-g6d872b4"
  resources:
    requests:
      memory: 256Mi
      cpu: 200m
    limits:
      memory: 512Mi
      cpu: 500m
  pdb:
    enabled: false
  hpa:
    enabled: false
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 1

# ----------------------------------------------------------------------------
# Java Microservices — Production
# ----------------------------------------------------------------------------
javaServices:
  defaults:
    image:
      repositoryPrefix: "namespace-alpha"
      tag: "v1.1.0-g6d872b4"
    replicas: 1
    resources:
      requests:
        memory: 512Mi
        cpu: 500m
      limits:
        memory: 1Gi
        cpu: 1000m
    jvmOptions: "-XX:+UseG1GC -XX:MaxRAMPercentage=75.0 -XX:InitialRAMPercentage=50.0 -Djava.security.egd=file:/dev/./urandom"
    strategy:
      type: RollingUpdate
      rollingUpdate:
        maxSurge: 1
        maxUnavailable: 1
    hpa:
      enabled: false
    pdb:
      enabled: false

  services:
    gateway:
      envOverrides:
        REDIS_HOST: "172.24.146.165"
      replicas: 1
      hpa:
        enabled: false
      pdb:
        enabled: false

    auth:
      envOverrides:
        DB_HOST: "172.24.146.165"
        REDIS_HOST: "172.24.146.165"
      replicas: 1
      hpa:
        enabled: false
      pdb:
        enabled: false

    user:
      envOverrides:
        DB_HOST: "172.24.146.165"
        REDIS_HOST: "172.24.146.165"
      replicas: 1
      hpa:
        enabled: false
      pdb:
        enabled: false

    payment:
      envOverrides:
        DB_HOST: "172.24.146.165"
        REDIS_HOST: "172.24.146.165"
      replicas: 1
      hpa:
        enabled: false
      pdb:
        enabled: false

    order:
      envOverrides:
        DB_HOST: "172.24.146.165"
        REDIS_HOST: "172.24.146.165"
      replicas: 1
      hpa:
        enabled: false
      pdb:
        enabled: false

    cart:
      envOverrides:
        DB_HOST: "172.24.146.165"
        REDIS_HOST: "172.24.146.165"
      replicas: 1
      hpa:
        enabled: false
      pdb:
        enabled: false

    logistics:
      envOverrides:
        DB_HOST: "172.24.146.165"
        REDIS_HOST: "172.24.146.165"
      replicas: 1
      hpa:
        enabled: false
      pdb:
        enabled: false

# ----------------------------------------------------------------------------
# Ingress — Production
# ----------------------------------------------------------------------------
ingress:
  className: nginx
  tls:
    enabled: true
    secretName: agenthive-tls
    hosts:
      - api.agenthive.cloud
      - agenthive.cloud
      - www.agenthive.cloud
  hosts:
    - host: api.agenthive.cloud
      paths:
        - path: /
          pathType: Prefix
          service: gateway-service
          port: 8080
    - host: agenthive.cloud
      paths:
        - path: /api
          pathType: Prefix
          service: gateway-service
          port: 8080
        - path: /socket.io
          pathType: Prefix
          service: gateway-service
          port: 8080
        - path: /
          pathType: Prefix
          service: landing
          port: 3000
    - host: www.agenthive.cloud
      paths:
        - path: /
          pathType: Prefix
          service: landing
          port: 3000

# ----------------------------------------------------------------------------
# ConfigMap — Production
# ----------------------------------------------------------------------------
configmap:
  data:
    NODE_ENV: "production"
    DB_HOST: "172.24.146.165"
    DB_PORT: "5432"
    DB_NAME: "agenthive"
    DB_USER: "agenthive"
    REDIS_URL: "redis://:WEIya@135@172.24.146.165:6379"
    REDIS_HOST: "172.24.146.165"
    REDIS_PORT: "6379"
    API_URL: "https://api.agenthive.cloud"
    LOG_LEVEL: "warn"
    OTEL_TRACES_SAMPLER_ARG: "0.05"
    OTEL_LOG_LEVEL: "error"
    CORS_ORIGIN: "https://agenthive.cloud,https://www.agenthive.cloud"

# ----------------------------------------------------------------------------
# Nacos — Production
# ----------------------------------------------------------------------------
nacos:
  enabled: true
  replicas: 1
  image:
    registry: ""
    repository: "nacos/nacos-server"
    tag: "v2.3.0"
  resources:
    requests:
      memory: 1Gi
      cpu: 500m
    limits:
      memory: 2Gi
      cpu: 1000m
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 1
```

---

## 四、需要修改的模板文件清单

| 文件 | 修改内容 |
|------|----------|
| `templates/secret.yaml` | ① 去掉 `REPLACE_ME` 硬编码；② 增加 `INTERNAL_API_TOKEN`、`WITHDRAWAL_ENCRYPT_KEY`；③ 增加 `createEmpty` 模式 |
| `templates/networkpolicy.yaml` | ① 如保留，修正 `java-service` 标签匹配；② 建议当前阶段 `enabled: false` |
| `templates/nacos-deployment.yaml` | 硬编码 `maxUnavailable: 0` 改为引用 `Values.nacos.strategy` |
| `values.yaml` | ① `maxUnavailable` 改为 1；② nacos 增加 strategy 配置；③ secret 增加 `createEmpty` 选项 |
| `values.prod.yaml` | 全面覆盖：镜像、副本数、HPA、策略、Secret、NetworkPolicy |

---

## 五、ArgoCD Application 重新创建建议

当 chart 修复后，重新创建 ArgoCD Application 时建议：

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: agenthive-prod
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/your-org/agenthive-cloud.git
    targetRevision: develop          # 或 main
    path: chart/agenthive
    helm:
      valueFiles:
        - values.prod.yaml
      # 关键：不使用 Helm 的 --set 注入 Secret
  destination:
    server: https://kubernetes.default.svc
    namespace: agenthive
  syncPolicy:
    syncOptions:
      - CreateNamespace=true
      # 关键：不要自动 prune Secret，避免误删
      - PrunePropagationPolicy=foreground
    automated:
      prune: false                    # 关闭自动清理，避免误删手动创建的 Secret
      selfHeal: true
```

---

## 六、验证清单（部署前检查）

- [ ] `values.prod.yaml` 中 `secret.enabled: false`
- [ ] `values.prod.yaml` 中 `networkPolicy.enabled: false`
- [ ] `values.prod.yaml` 中所有 `replicas <= 1`（单节点环境）
- [ ] `values.prod.yaml` 中所有 `hpa.enabled: false`
- [ ] `values.prod.yaml` 中 `maxUnavailable: 1`
- [ ] 镜像路径可在节点上 `crictl images` 中找到
- [ ] Secret `app-secrets` 已手动创建且值正确
- [ ] ArgoCD Application 的 `automated.prune: false`

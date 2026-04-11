# AgentHive Cloud 生产级部署计划

> **版本**: v1.0  
> **制定日期**: 2026-04-06  
> **目标可用性**: 99.99% (52.56分钟/年停机时间)  
> **架构师**: DevOps Architect

---

## 执行摘要

本部署计划为 AgentHive Cloud 提供一套完整的云原生解决方案，支持：

| 能力 | 实现方式 |
|------|----------|
| **高可用** | 多可用区部署 + 自动故障转移 |
| **自动扩缩容** | KEDA + HPA 基于自定义指标 |
| **GitOps** | ArgoCD 声明式持续交付 |
| **MLOps** | 模型版本管理 + A/B 测试 |
| **SecDevOps** | DevSecOps 流水线 + 零信任网络 |
| **成本优化** | Spot 实例 + 资源右调 + 自动休眠 |

---

## 目录

1. [架构概览](#架构概览)
2. [基础设施层](#基础设施层)
3. [应用部署层](#应用部署层)
4. [数据层](#数据层)
5. [MLOps 平台](#mlops-平台)
6. [CI/CD 流水线](#cicd-流水线)
7. [可观测性](#可观测性)
8. [安全架构](#安全架构)
9. [成本优化](#成本优化)
10. [灾难恢复](#灾难恢复)
11. [实施路线图](#实施路线图)

---

## 架构概览

### 整体架构图

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                    边缘层 (Edge)                                     │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                         Cloudflare / AWS CloudFront                          │   │
│  │                     (DDoS防护 + CDN + WAF + 边缘缓存)                         │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                          │
                                          ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                  入口层 (Ingress)                                    │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                    Ingress-Nginx / AWS ALB (跨AZ)                            │   │
│  │              (SSL终止 + 路由分发 + 速率限制 + 灰度发布)                        │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                          │
        ┌─────────────────────────────────┼─────────────────────────────────┐
        │                                 │                                 │
        ▼                                 ▼                                 ▼
┌───────────────┐            ┌─────────────────────┐            ┌───────────────────┐
│   Web 层      │            │     API 层          │            │   Agent Runtime   │
│  (Landing)    │            │   (REST + WS)       │            │    (AI Agent)     │
├───────────────┤            ├─────────────────────┤            ├───────────────────┤
│  Nuxt 3 SSR   │            │  Express + TS       │            │  Node.js + WebSock│
│  Pod × 3      │            │  Pod × 5            │            │  Pod × 2-20       │
│  HPA enabled  │            │  HPA enabled        │            │  KEDA enabled     │
└───────────────┘            └──────────┬──────────┘            └─────────┬─────────┘
                                        │                                  │
                    ┌───────────────────┼───────────────────┐              │
                    │                   │                   │              │
                    ▼                   ▼                   ▼              ▼
            ┌──────────────┐    ┌──────────────┐    ┌──────────────┐ ┌──────────┐
            │  PostgreSQL  │    │    Redis     │    │    MinIO     │ │  LLM API │
            │  HA Cluster  │    │   Cluster    │    │  (对象存储)   │ │(外部服务)│
            │  3 replicas  │    │  3 replicas  │    │  4 replicas  │ │          │
            └──────────────┘    └──────────────┘    └──────────────┘ └──────────┘
```

### 技术选型矩阵

| 层级 | 组件 | 选型 | 理由 |
|------|------|------|------|
| **编排** | 容器编排 | Kubernetes (EKS/GKE) | 标准云原生，生态成熟 |
| **入口** | Ingress Controller | Ingress-Nginx | 功能丰富，与Cert-Manager集成好 |
| **网络** | Service Mesh | Istio (渐进采用) | mTLS，流量管理，可观测 |
| **GitOps** | 持续交付 | ArgoCD | 声明式，回滚能力强 |
| **监控** | 指标 | Prometheus + Grafana | 标准监控栈 |
| **日志** | 日志聚合 | Loki + Grafana | 轻量，与Grafana集成 |
| **追踪** | 分布式追踪 | Jaeger/Tempo | OpenTelemetry支持 |
| **证书** | TLS管理 | Cert-Manager | 自动证书颁发和续期 |
| **Secret** | 密钥管理 | External Secrets + Vault | 云KMS集成，轮换支持 |
| **成本** | 成本监控 | Kubecost / OpenCost | 命名空间级成本分摊 |

---

## 基础设施层

### 1. 集群配置

```yaml
# EKS 集群配置示例
cluster:
  name: agenthive-prod
  version: "1.29"
  region: ap-southeast-1
  
  vpc:
    cidr: "10.0.0.0/16"
    azs: ["ap-southeast-1a", "ap-southeast-1b", "ap-southeast-1c"]
    private_subnets: ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
    public_subnets: ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]
    
  node_groups:
    # 系统节点组 - 运行监控、Ingress等
    system:
      instance_types: ["t3.medium"]
      min_size: 2
      max_size: 4
      desired_size: 2
      taints:
        - key: "dedicated"
          value: "system"
          effect: "NoSchedule"
          
    # 应用节点组 - Spot实例降低成本
    app-spot:
      capacity_type: "SPOT"
      instance_types: ["t3.large", "t3a.large", "m6i.large"]
      min_size: 2
      max_size: 20
      desired_size: 3
      labels:
        workload-type: "app"
        cost-optimization: "spot"
        
    # Agent Runtime专用节点组 - 高内存需求
    agent-runtime:
      instance_types: ["r6i.xlarge", "r6g.xlarge"]
      min_size: 1
      max_size: 10
      desired_size: 2
      labels:
        workload-type: "agent-runtime"
      taints:
        - key: "dedicated"
          value: "agent-runtime"
          effect: "NoSchedule"
```

### 2. 网络策略

```yaml
# 零信任网络 - 默认拒绝所有流量
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: agenthive
spec:
  podSelector: {}
  policyTypes:
    - Ingress
    - Egress
---
# API服务只允许从Ingress进入
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: api-allow-ingress
  namespace: agenthive
spec:
  podSelector:
    matchLabels:
      app: api
  policyTypes:
    - Ingress
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              name: ingress-nginx
      ports:
        - protocol: TCP
          port: 3001
---
# Agent Runtime只允许访问必要的外部服务
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: agent-runtime-egress
  namespace: agenthive
spec:
  podSelector:
    matchLabels:
      app: agent-runtime
  policyTypes:
    - Egress
  egress:
    # 允许访问API服务
    - to:
        - podSelector:
            matchLabels:
              app: api
      ports:
        - protocol: TCP
          port: 3001
    # 允许访问PostgreSQL
    - to:
        - podSelector:
            matchLabels:
              app: postgres
      ports:
        - protocol: TCP
          port: 5432
    # 允许访问Redis
    - to:
        - podSelector:
            matchLabels:
              app: redis
      ports:
        - protocol: TCP
          port: 6379
    # 允许访问外部LLM API (限定IP范围)
    - to:
        - ipBlock:
            cidr: 0.0.0.0/0  # 实际应配置具体LLM服务商IP
      ports:
        - protocol: TCP
          port: 443
```

---

## 应用部署层

### 1. Landing (Nuxt 3 SSR)

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: landing
  namespace: agenthive
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 25%
      maxUnavailable: 0
  selector:
    matchLabels:
      app: landing
  template:
    metadata:
      labels:
        app: landing
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "3000"
        prometheus.io/path: "/metrics"
    spec:
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
            - weight: 100
              podAffinityTerm:
                labelSelector:
                  matchExpressions:
                    - key: app
                      operator: In
                      values:
                        - landing
                topologyKey: topology.kubernetes.io/zone
      containers:
        - name: landing
          image: agenthive/landing:${VERSION}
          ports:
            - containerPort: 3000
              name: http
          env:
            - name: NUXT_PUBLIC_API_BASE
              value: "https://api.agenthive.cloud"
            - name: NODE_ENV
              value: "production"
          resources:
            requests:
              memory: "256Mi"
              cpu: "250m"
            limits:
              memory: "512Mi"
              cpu: "1000m"
          livenessProbe:
            httpGet:
              path: /api/health
              port: 3000
            initialDelaySeconds: 10
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /api/ready
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 5
          securityContext:
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            runAsNonRoot: true
            runAsUser: 1000
            capabilities:
              drop:
                - ALL
          volumeMounts:
            - name: tmp
              mountPath: /tmp
      volumes:
        - name: tmp
          emptyDir: {}
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: landing-hpa
  namespace: agenthive
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: landing
  minReplicas: 3
  maxReplicas: 20
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
        - type: Percent
          value: 100
          periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Percent
          value: 10
          periodSeconds: 60
```

### 2. API 服务

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
  namespace: agenthive
spec:
  replicas: 5
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 50%
      maxUnavailable: 0
  selector:
    matchLabels:
      app: api
  template:
    metadata:
      labels:
        app: api
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "3001"
    spec:
      topologySpreadConstraints:
        - maxSkew: 1
          topologyKey: topology.kubernetes.io/zone
          whenUnsatisfiable: DoNotSchedule
          labelSelector:
            matchLabels:
              app: api
      containers:
        - name: api
          image: agenthive/api:${VERSION}
          ports:
            - containerPort: 3001
          env:
            - name: DB_HOST
              valueFrom:
                secretKeyRef:
                  name: db-credentials
                  key: host
            - name: DB_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: db-credentials
                  key: password
            - name: REDIS_URL
              valueFrom:
                secretKeyRef:
                  name: redis-credentials
                  key: url
            - name: JWT_SECRET
              valueFrom:
                secretKeyRef:
                  name: api-secrets
                  key: jwt-secret
          resources:
            requests:
              memory: "512Mi"
              cpu: "500m"
            limits:
              memory: "1Gi"
              cpu: "2000m"
          livenessProbe:
            httpGet:
              path: /health
              port: 3001
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /ready
              port: 3001
            initialDelaySeconds: 5
            periodSeconds: 5
```

### 3. Agent Runtime (KEDA 自动扩缩容)

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: agent-runtime
  namespace: agenthive
spec:
  replicas: 2
  selector:
    matchLabels:
      app: agent-runtime
  template:
    metadata:
      labels:
        app: agent-runtime
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "8080"
    spec:
      nodeSelector:
        workload-type: agent-runtime
      tolerations:
        - key: "dedicated"
          operator: "Equal"
          value: "agent-runtime"
          effect: "NoSchedule"
      containers:
        - name: agent-runtime
          image: agenthive/agent-runtime:${VERSION}
          ports:
            - containerPort: 8080
          env:
            - name: AGENT_ID
              valueFrom:
                fieldRef:
                  fieldPath: metadata.name
            - name: WORKSPACE_PATH
              value: "/workspace"
            - name: LLM_API_KEY
              valueFrom:
                secretKeyRef:
                  name: llm-credentials
                  key: api-key
          resources:
            requests:
              memory: "1Gi"
              cpu: "500m"
            limits:
              memory: "4Gi"
              cpu: "2000m"
          volumeMounts:
            - name: workspace
              mountPath: /workspace
          securityContext:
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: false  # Agent需要写workspace
            runAsNonRoot: true
            runAsUser: 1001
      volumes:
        - name: workspace
          emptyDir:
            sizeLimit: 10Gi
---
# KEDA 基于队列长度的自动扩缩容
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: agent-runtime-scaler
  namespace: agenthive
spec:
  scaleTargetRef:
    name: agent-runtime
  pollingInterval: 15
  cooldownPeriod: 300
  minReplicaCount: 2
  maxReplicaCount: 50
  advanced:
    restoreToOriginalReplicaCount: false
    horizontalPodAutoscalerConfig:
      behavior:
        scaleDown:
          stabilizationWindowSeconds: 600
          policies:
            - type: Percent
              value: 10
              periodSeconds: 60
  triggers:
    # 基于Redis队列长度扩容
    - type: redis
      metadata:
        address: redis:6379
        listName: agent-tasks
        listLength: "10"  # 每10个任务增加一个Pod
      authenticationRef:
        name: keda-redis-auth
    # 基于CPU使用率扩容
    - type: cpu
      metadata:
        type: Utilization
        value: "70"
```

---

## 数据层

### 1. PostgreSQL HA (使用 CloudNativePG)

```yaml
apiVersion: postgresql.cnpg.io/v1
kind: Cluster
metadata:
  name: agenthive-db
  namespace: agenthive
spec:
  instances: 3
  imageName: ghcr.io/cloudnative-pg/postgresql:16.2
  
  storage:
    size: 100Gi
    storageClass: gp3-encrypted
    
  resources:
    requests:
      memory: "2Gi"
      cpu: "1000m"
    limits:
      memory: "4Gi"
      cpu: "2000m"
      
  postgresql:
    parameters:
      max_connections: "200"
      shared_buffers: "512MB"
      effective_cache_size: "1536MB"
      maintenance_work_mem: "128MB"
      checkpoint_completion_target: "0.9"
      wal_buffers: "16MB"
      default_statistics_target: "100"
      random_page_cost: "1.1"
      effective_io_concurrency: "200"
      work_mem: "2621kB"
      min_wal_size: "1GB"
      max_wal_size: "4GB"
      
  backup:
    retentionPolicy: "30d"
    schedule:
      full: "0 2 * * *"  # 每天凌晨2点全量备份
      incremental: "0 */6 * * *"  # 每6小时增量备份
    barmanObjectStore:
      destinationPath: s3://agenthive-backups/postgres
      s3Credentials:
        accessKeyId:
          name: backup-credentials
          key: access-key-id
        secretAccessKey:
          name: backup-credentials
          key: secret-access-key
          
  monitoring:
    enabled: true
    customQueriesConfigMap:
      name: cnpg-custom-queries
      key: queries
```

### 2. Redis Cluster

```yaml
apiVersion: redis.redis.opstreelabs.in/v1beta1
kind: RedisCluster
metadata:
  name: agenthive-redis
  namespace: agenthive
spec:
  clusterSize: 3
  kubernetesConfig:
    image: redis:7-alpine
    resources:
      requests:
        cpu: 200m
        memory: 256Mi
      limits:
        cpu: 1000m
        memory: 1Gi
  redisExporter:
    enabled: true
    image: oliver006/redis_exporter:latest
  storage:
    volumeClaimTemplate:
      spec:
        accessModes: ["ReadWriteOnce"]
        resources:
          requests:
            storage: 10Gi
  redisConfig:
    additionalRedisConfig: |
      maxmemory 512mb
      maxmemory-policy allkeys-lru
      appendonly yes
      appendfsync everysec
```

### 3. MinIO 对象存储

```yaml
apiVersion: minio.min.io/v2
kind: Tenant
metadata:
  name: agenthive-storage
  namespace: agenthive
spec:
  pools:
    - servers: 4
      volumesPerServer: 4
      volumeClaimTemplate:
        metadata:
          name: data
        spec:
          storageClassName: gp3-encrypted
          accessModes:
            - ReadWriteOnce
          resources:
            requests:
              storage: 100Gi
      resources:
        requests:
          memory: 2Gi
          cpu: "1000m"
  credsSecret:
    name: minio-credentials
  mountPath: /export
  requestAutoCert: false
  certManager:
    generateCACertificate: true
```

---

## MLOps 平台

### 1. 模型版本管理 (MLflow)

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mlflow
  namespace: agenthive-mlops
spec:
  replicas: 2
  selector:
    matchLabels:
      app: mlflow
  template:
    metadata:
      labels:
        app: mlflow
    spec:
      containers:
        - name: mlflow
          image: mlflow/mlflow:latest
          command:
            - mlflow
            - server
            - --host=0.0.0.0
            - --port=5000
            - --backend-store-uri=postgresql://mlflow:${DB_PASSWORD}@postgres:5432/mlflow
            - --default-artifact-root=s3://agenthive-mlflow/artifacts
          ports:
            - containerPort: 5000
          resources:
            requests:
              memory: "1Gi"
              cpu: "500m"
            limits:
              memory: "2Gi"
              cpu: "1000m"
```

### 2. 模型推理服务 (KServe)

```yaml
apiVersion: serving.kserve.io/v1beta1
kind: InferenceService
metadata:
  name: agent-llm-predictor
  namespace: agenthive-mlops
  annotations:
    prometheus.io/scrape: "true"
spec:
  predictor:
    minReplicas: 1
    maxReplicas: 10
    containers:
      - name: predictor
        image: agenthive/llm-predictor:v1.0.0
        resources:
          requests:
            memory: "8Gi"
            cpu: "2000m"
            nvidia.com/gpu: "1"  # 如果使用GPU
          limits:
            memory: "16Gi"
            cpu: "4000m"
            nvidia.com/gpu: "1"
    # A/B 测试配置
    canaryTrafficPercent: 10  # 10%流量到新版本
```

### 3. LLM 调用追踪

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: agent-observability
  namespace: agenthive
data:
  otel-config.yaml: |
    receivers:
      otlp:
        protocols:
          grpc:
            endpoint: 0.0.0.0:4317
          http:
            endpoint: 0.0.0.0:4318
    
    processors:
      batch:
        timeout: 1s
        send_batch_size: 1024
      resource:
        attributes:
          - key: service.name
            value: agent-runtime
            action: upsert
    
    exporters:
      jaeger:
        endpoint: jaeger-collector:14250
        tls:
          insecure: true
      prometheus:
        endpoint: 0.0.0.0:8889
      
    service:
      pipelines:
        traces:
          receivers: [otlp]
          processors: [batch, resource]
          exporters: [jaeger]
        metrics:
          receivers: [otlp]
          processors: [batch]
          exporters: [prometheus]
```

---

## CI/CD 流水线

### 1. GitHub Actions 工作流

```yaml
# .github/workflows/deploy-pipeline.yml
name: Deploy Pipeline

on:
  push:
    branches: [main, develop]
    tags: ['v*']
  pull_request:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_PREFIX: agenthive

jobs:
  # 阶段1: 代码质量检查
  lint-and-test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        app: [landing, api, agent-runtime]
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          
      - name: Install dependencies
        run: |
          cd agenthive-cloud/apps/${{ matrix.app }}
          npm ci
          
      - name: Lint
        run: |
          cd agenthive-cloud/apps/${{ matrix.app }}
          npm run lint
          
      - name: Type Check
        run: |
          cd agenthive-cloud/apps/${{ matrix.app }}
          npm run type-check || npm run typecheck || true
          
      - name: Unit Tests
        run: |
          cd agenthive-cloud/apps/${{ matrix.app }}
          npm run test:unit || npm run test || true
          
      - name: Security Scan (Trivy)
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          scan-ref: 'agenthive-cloud/apps/${{ matrix.app }}'
          severity: 'CRITICAL,HIGH'

  # 阶段2: 构建镜像
  build:
    needs: lint-and-test
    runs-on: ubuntu-latest
    strategy:
      matrix:
        app: [landing, api, agent-runtime]
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
        
      - name: Login to Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
          
      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_PREFIX }}/${{ matrix.app }}
          tags: |
            type=ref,event=branch
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=sha,prefix={{branch}}-
            
      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: ./agenthive-cloud/apps/${{ matrix.app }}
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
          
      - name: Scan image
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: ${{ env.REGISTRY }}/${{ env.IMAGE_PREFIX }}/${{ matrix.app }}:${{ github.sha }}
          format: 'sarif'
          output: 'trivy-results.sarif'

  # 阶段3: 部署到开发环境
  deploy-dev:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/develop'
    environment: development
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup kubectl
        uses: azure/setup-kubectl@v3
        
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ap-southeast-1
          
      - name: Update kubeconfig
        run: aws eks update-kubeconfig --name agenthive-dev
        
      - name: Deploy with ArgoCD
        run: |
          argocd app sync agenthive-dev --prune

  # 阶段4: 部署到生产环境
  deploy-prod:
    needs: build
    runs-on: ubuntu-latest
    if: startsWith(github.ref, 'refs/tags/v')
    environment: production  # 需要人工审批
    steps:
      - uses: actions/checkout@v4
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ap-southeast-1
          
      - name: Update kubeconfig
        run: aws eks update-kubeconfig --name agenthive-prod
        
      - name: Deploy to Production
        run: |
          # 金丝雀发布
          kubectl set image deployment/landing landing=ghcr.io/agenthive/landing:${GITHUB_REF#refs/tags/} -n agenthive
          kubectl rollout status deployment/landing -n agenthive --timeout=5m
          
          # 自动回滚检查
          if [ $(kubectl get pods -n agenthive -l app=landing | grep -c Running) -lt 2 ]; then
            echo "Deployment failed, rolling back..."
            kubectl rollout undo deployment/landing -n agenthive
            exit 1
          fi
```

### 2. ArgoCD Application 配置

```yaml
# argocd/applications/agenthive-prod.yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: agenthive-prod
  namespace: argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io
  annotations:
    argocd.argoproj.io/sync-wave: "1"
spec:
  project: default
  source:
    repoURL: https://github.com/your-org/agenthive-cloud
    targetRevision: HEAD
    path: k8s/overlays/production
    helm:
      valueFiles:
        - values-production.yaml
  destination:
    server: https://kubernetes.default.svc
    namespace: agenthive
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
      allowEmpty: false
    syncOptions:
      - CreateNamespace=true
      - PrunePropagationPolicy=foreground
      - PruneLast=true
    retry:
      limit: 5
      backoff:
        duration: 5s
        factor: 2
        maxDuration: 3m
  ignoreDifferences:
    - group: apps
      kind: Deployment
      jsonPointers:
        - /spec/replicas
```

---

## 可观测性

### 1. Prometheus 监控规则

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: agenthive-alerts
  namespace: monitoring
spec:
  groups:
    # API 服务告警
    - name: api-alerts
      rules:
        - alert: APIHighErrorRate
          expr: |
            (
              sum(rate(http_requests_total{namespace="agenthive",job="api",status=~"5.."}[5m]))
              /
              sum(rate(http_requests_total{namespace="agenthive",job="api"}[5m]))
            ) > 0.01
          for: 5m
          labels:
            severity: critical
          annotations:
            summary: "API error rate is high"
            description: "Error rate is {{ $value | humanizePercentage }} for the last 5 minutes"
            
        - alert: APIHighLatency
          expr: |
            histogram_quantile(0.99, 
              sum(rate(http_request_duration_seconds_bucket{namespace="agenthive",job="api"}[5m])) by (le)
            ) > 1
          for: 5m
          labels:
            severity: warning
          annotations:
            summary: "API P99 latency is high"
            description: "P99 latency is {{ $value }}s for the last 5 minutes"
            
        - alert: APIPodCrashLooping
          expr: |
            rate(kube_pod_container_status_restarts_total{namespace="agenthive",pod=~"api-.*"}[15m]) > 0
          for: 5m
          labels:
            severity: critical
          annotations:
            summary: "API pod is crash looping"

    # Agent Runtime 告警
    - name: agent-runtime-alerts
      rules:
        - alert: AgentRuntimeHighQueueLength
          expr: |
            redis_key_size{key="agent-tasks"} > 100
          for: 5m
          labels:
            severity: warning
          annotations:
            summary: "Agent task queue is backing up"
            description: "Queue length is {{ $value }}"
            
        - alert: AgentRuntimeMemoryPressure
          expr: |
            container_memory_usage_bytes{namespace="agenthive",container="agent-runtime"}
            /
            container_spec_memory_limit_bytes{namespace="agenthive",container="agent-runtime"} > 0.9
          for: 5m
          labels:
            severity: warning
          annotations:
            summary: "Agent Runtime memory usage is high"
            
    # 数据库告警
    - name: database-alerts
      rules:
        - alert: PostgreSQLConnectionsNearLimit
          expr: |
            pg_stat_activity_count / pg_settings_max_connections > 0.8
          for: 5m
          labels:
            severity: warning
          annotations:
            summary: "PostgreSQL connections near limit"
            
        - alert: PostgreSQLReplicationLag
          expr: |
            pg_stat_replication_lag_seconds > 30
          for: 5m
          labels:
            severity: critical
          annotations:
            summary: "PostgreSQL replication lag is high"
```

### 2. Grafana Dashboard (JSON Model)

```json
{
  "dashboard": {
    "title": "AgentHive Cloud - Production Overview",
    "tags": ["agenthive", "production"],
    "timezone": "UTC",
    "panels": [
      {
        "title": "Service Health",
        "type": "stat",
        "targets": [
          {
            "expr": "up{namespace=\"agenthive\"}",
            "legendFormat": "{{job}}"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "thresholds": {
              "steps": [
                {"color": "red", "value": 0},
                {"color": "green", "value": 1}
              ]
            }
          }
        }
      },
      {
        "title": "API Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "sum(rate(http_requests_total{namespace=\"agenthive\",job=\"api\"}[5m])) by (status)",
            "legendFormat": "{{status}}"
          }
        ]
      },
      {
        "title": "API Latency (P99)",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket{job=\"api\"}[5m])) by (le))",
            "legendFormat": "P99"
          },
          {
            "expr": "histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{job=\"api\"}[5m])) by (le))",
            "legendFormat": "P95"
          }
        ]
      },
      {
        "title": "Agent Runtime - Active Tasks",
        "type": "gauge",
        "targets": [
          {
            "expr": "redis_key_size{key=\"agent-tasks\"}",
            "legendFormat": "Queue Length"
          }
        ]
      },
      {
        "title": "Pod Auto Scaling",
        "type": "graph",
        "targets": [
          {
            "expr": "kube_deployment_status_replicas{namespace=\"agenthive\",deployment=\"api\"}",
            "legendFormat": "API - Current"
          },
          {
            "expr": "kube_horizontalpodautoscaler_status_desired_replicas{namespace=\"agenthive\",horizontalpodautoscaler=\"api-hpa\"}",
            "legendFormat": "API - Desired"
          }
        ]
      },
      {
        "title": "Cost by Namespace",
        "type": "piechart",
        "targets": [
          {
            "expr": "sum(kube_pod_container_resource_requests{resource=\"cpu\"}) by (namespace) * 30 * 24 * 0.05",
            "legendFormat": "{{namespace}}"
          }
        ]
      }
    ]
  }
}
```

### 3. Loki 日志聚合

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: loki-config
  namespace: monitoring
data:
  loki.yaml: |
    auth_enabled: false
    
    server:
      http_listen_port: 3100
      
    common:
      path_prefix: /loki
      storage:
        filesystem:
          chunks_directory: /loki/chunks
          rules_directory: /loki/rules
      replication_factor: 1
      ring:
        instance_addr: 127.0.0.1
        kvstore:
          store: inmemory
          
    schema_config:
      configs:
        - from: 2020-10-24
          store: boltdb-shipper
          object_store: filesystem
          schema: v11
          index:
            prefix: index_
            period: 24h
            
    storage_config:
      boltdb_shipper:
        active_index_directory: /loki/boltdb-shipper-active
        cache_location: /loki/boltdb-shipper-cache
        cache_ttl: 24h
        shared_store: filesystem
      filesystem:
        directory: /loki/chunks
        
    limits_config:
      reject_old_samples: true
      reject_old_samples_max_age: 168h
      ingestion_rate_mb: 16
      ingestion_burst_size_mb: 32
      
    chunk_store_config:
      max_look_back_period: 0s
      
    table_manager:
      retention_deletes_enabled: true
      retention_period: 168h
```

---

## 安全架构

### 1. Pod 安全标准

```yaml
apiVersion: policy/v1beta1
kind: PodSecurityPolicy
metadata:
  name: agenthive-restricted
spec:
  privileged: false
  allowPrivilegeEscalation: false
  requiredDropCapabilities:
    - ALL
  volumes:
    - 'configMap'
    - 'emptyDir'
    - 'projected'
    - 'secret'
    - 'downwardAPI'
    - 'persistentVolumeClaim'
  runAsUser:
    rule: 'MustRunAsNonRoot'
  seLinux:
    rule: 'RunAsAny'
  fsGroup:
    rule: 'RunAsAny'
  readOnlyRootFilesystem: true
---
# 使用 OPA Gatekeeper 进行策略执行
apiVersion: constraints.gatekeeper.sh/v1beta1
kind: K8sRequiredLabels
metadata:
  name: require-cost-center-label
spec:
  match:
    kinds:
      - apiGroups: [""]
        kinds: ["Namespace"]
  parameters:
    labels:
      - key: cost-center
        allowedRegex: "^[a-z0-9-]+$"
      - key: environment
        allowedRegex: "^(production|staging|development)$"
```

### 2. Secret 管理 (External Secrets + Vault)

```yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: db-credentials
  namespace: agenthive
spec:
  refreshInterval: 1h
  secretStoreRef:
    kind: ClusterSecretStore
    name: vault-backend
  target:
    name: db-credentials
    creationPolicy: Owner
    template:
      type: Opaque
      data:
        host: "{{ .host }}"
        password: "{{ .password }}"
        username: "{{ .username }}"
  data:
    - secretKey: host
      remoteRef:
        key: database/production
        property: host
    - secretKey: password
      remoteRef:
        key: database/production
        property: password
    - secretKey: username
      remoteRef:
        key: database/production
        property: username
```

### 3. 网络策略 (零信任)

```yaml
# 只允许 API 服务访问数据库
apiVersion: cilium.io/v2
kind: CiliumNetworkPolicy
metadata:
  name: api-to-database
  namespace: agenthive
spec:
  endpointSelector:
    matchLabels:
      app: postgres
  ingress:
    - fromEndpoints:
        - matchLabels:
            app: api
      toPorts:
        - ports:
            - port: "5432"
              protocol: TCP
          rules:
            http:
              - method: "POST"
                path: "/query"
```

---

## 成本优化

### 1. Spot 实例中断处理

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: spot-handler
  namespace: kube-system
spec:
  replicas: 1
  selector:
    matchLabels:
      app: spot-handler
  template:
    metadata:
      labels:
        app: spot-handler
    spec:
      serviceAccountName: spot-handler
      containers:
        - name: handler
          image: public.ecr.aws/aws-ec2/aws-node-termination-handler:v1.20.0
          env:
            - name: NODE_NAME
              valueFrom:
                fieldRef:
                  fieldPath: spec.nodeName
            - name: POD_NAME
              valueFrom:
                fieldRef:
                  fieldPath: metadata.name
            - name: NAMESPACE
              valueFrom:
                fieldRef:
                  fieldPath: metadata.namespace
            - name: ENABLE_SPOT_INTERRUPTION_DRAINING
              value: "true"
            - name: ENABLE_SCHEDULED_EVENT_DRAINING
              value: "true"
            - name: GRACE_PERIOD
              value: "120"
```

### 2. 自动休眠 (开发环境)

```yaml
apiVersion: kubefledged.io/v1alpha2
kind: ImageCache
metadata:
  name: agenthive-images
  namespace: kube-fledged
spec:
  cacheSpec:
    - images:
        - ghcr.io/agenthive/landing:latest
        - ghcr.io/agenthive/api:latest
        - ghcr.io/agenthive/agent-runtime:latest
      nodeSelector:
        node-role.kubernetes.io/worker: "true"
---
# 使用 KEDA 基于 Cron 的扩缩容
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: dev-env-scheduler
  namespace: agenthive-dev
spec:
  scaleTargetRef:
    name: landing
  minReplicaCount: 0
  maxReplicaCount: 3
  triggers:
    # 工作时间自动启动
    - type: cron
      metadata:
        timezone: Asia/Shanghai
        start: 0 9 * * 1-5
        end: 0 18 * * 1-5
        desiredReplicas: "2"
```

### 3. 资源右调建议

```yaml
# Vertical Pod Autoscaler 配置
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: api-vpa
  namespace: agenthive
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api
  updatePolicy:
    updateMode: "Off"  # 先使用 Off 模式收集建议
  resourcePolicy:
    containerPolicies:
      - containerName: api
        minAllowed:
          memory: 256Mi
          cpu: 250m
        maxAllowed:
          memory: 2Gi
          cpu: 2000m
        controlledResources: ["cpu", "memory"]
```

---

## 灾难恢复

### 1. 备份策略

```yaml
apiVersion: velero.io/v1
kind: Schedule
metadata:
  name: agenthive-daily-backup
  namespace: velero
spec:
  schedule: "0 2 * * *"  # 每天凌晨2点
  template:
    includedNamespaces:
      - agenthive
    excludedResources:
      - pods
      - replicasets
      - events
    labelSelector:
      matchExpressions:
        - key: backup.velero.io/exclude
          operator: DoesNotExist
    storageLocation: aws-s3
    volumeSnapshotLocations:
      - aws-ebs
    ttl: 720h0m0s  # 保留30天
    
---
# 跨区域复制
apiVersion: objectbucket.io/v1alpha1
kind: ObjectBucketClaim
metadata:
  name: velero-backups
  namespace: velero
spec:
  generateBucketName: velero-backups
  storageClassName: s3-rgw
  additionalConfig:
    bucketPolicy: |
      {
        "Version": "2012-10-17",
        "Rules": [
          {
            "ID": "CrossRegionReplication",
            "Status": "Enabled",
            "Destination": {
              "Bucket": "arn:aws:s3:::velero-backups-dr"
            }
          }
        ]
      }
```

### 2. 故障转移流程

```yaml
# 使用 ExternalDNS 实现 DNS 故障转移
apiVersion: externaldns.k8s.io/v1alpha1
kind: DNSEndpoint
metadata:
  name: agenthive-failover
  namespace: agenthive
  annotations:
    external-dns.alpha.kubernetes.io/hostname: api.agenthive.cloud
spec:
  endpoints:
    - dnsName: api.agenthive.cloud
      recordType: A
      targets:
        - 1.2.3.4  # Primary region
      recordTTL: 60
      providerSpecific:
        - name: health-check
          value: "true"
        - name: failover
          value: "PRIMARY"
    - dnsName: api.agenthive.cloud
      recordType: A
      targets:
        - 5.6.7.8  # DR region
      recordTTL: 60
      providerSpecific:
        - name: health-check
          value: "true"
        - name: failover
          value: "SECONDARY"
```

---

## 实施路线图

### 阶段1: 基础架构 (Week 1-2)

- [ ] EKS/GKE 集群创建
- [ ] 网络配置 (VPC, Subnets, NAT)
- [ ] 基础监控 (Prometheus + Grafana)
- [ ] Ingress-Nginx + Cert-Manager

### 阶段2: 核心应用 (Week 3-4)

- [ ] PostgreSQL HA 部署
- [ ] Redis Cluster 部署
- [ ] Landing 应用部署
- [ ] API 服务部署

### 阶段3: AI能力 (Week 5-6)

- [ ] Agent Runtime 部署
- [ ] KEDA 配置
- [ ] LLM 网关配置
- [ ] MLOps 平台部署

### 阶段4: 生产就绪 (Week 7-8)

- [ ] CI/CD 流水线搭建
- [ ] ArgoCD 配置
- [ ] 安全加固
- [ ] 备份策略实施

### 阶段5: 优化 (Week 9-10)

- [ ] 成本监控
- [ ] 性能调优
- [ ] 混沌工程测试
- [ ] 文档完善

---

## 成本估算 (月度)

| 组件 | 配置 | 数量 | 单价/月 | 小计 |
|------|------|------|---------|------|
| **EKS Control Plane** | - | 1 | $73 | $73 |
| **System Nodes** | t3.medium | 2 | $30 | $60 |
| **App Nodes (Spot)** | t3.large | 3 | $25 | $75 |
| **Agent Nodes** | r6i.xlarge | 2 | $140 | $280 |
| **PostgreSQL** | db.r6g.large | 1 | $175 | $175 |
| **ElastiCache Redis** | cache.r6g.large | 1 | $105 | $105 |
| **ALB** | - | 2 | $22 | $44 |
| **S3 Storage** | 500GB | - | $12 | $12 |
| **CloudFront** | 1TB流量 | - | $85 | $85 |
| **预留实例折扣** | - | -30% | - | -$273 |
| **总计** | | | | **~$636/月** |

---

## 附录

### A. 工具清单

```bash
# 必需 CLI 工具
brew install kubectl helm argocd eksctl awscli

# 验证安装
kubectl version --client
helm version
argocd version --client
```

### B. 快速部署命令

```bash
# 1. 创建集群
eksctl create cluster -f eks-cluster-config.yaml

# 2. 安装基础组件
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo add jetstack https://charts.jetstack.io
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

# 3. 部署监控
helm install prometheus prometheus-community/kube-prometheus-stack -n monitoring --create-namespace

# 4. 部署应用
cd k8s/overlays/production
kustomize build . | kubectl apply -f -

# 5. 验证
kubectl get pods -n agenthive
kubectl get ingress -n agenthive
```

---

> **文档维护**: 本计划应每季度审查更新  
> **联系方式**: devops@agenthive.cloud

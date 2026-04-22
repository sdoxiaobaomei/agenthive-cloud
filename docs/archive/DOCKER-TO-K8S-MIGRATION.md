# Docker 转 Kubernetes 迁移方案

> **目标**: 将当前的 Docker Compose 部署迁移到 Kubernetes  
> **预计时间**: 2-3 天  
> **复杂度**: 中等

---

## 📋 迁移前检查清单

### 1. 当前架构盘点

```yaml
# docker-compose.full.yml 现状
服务列表:
  ✅ nginx:        反向代理 (Alpine)
  ✅ landing:      Nuxt 3 SSR (Node 20)
  ✅ api:          Express API (Node 20)
  ✅ postgres:     PostgreSQL 16
  ✅ redis:        Redis 7
  ❌ agent-runtime: 暂未部署

数据持久化:
  - postgres-data (Volume)
  - redis-data (Volume)
  
网络:
  - 本地端口映射: 80, 3000, 3001, 5432, 6379
  - 内部通信: Docker Network
```

### 2. 环境准备检查

```bash
# 本地开发环境
kubectl version --client    # 需要 v1.28+
helm version               # 需要 v3.12+
docker buildx version      # 需要支持多架构构建

# 镜像仓库访问
aws ecr get-login-password --region ap-southeast-1  # 或
aliyun cr GetAuthorizationToken                     # 或
docker login ghcr.io                                # GitHub Container Registry
```

---

## 🚀 迁移步骤

### Phase 1: 基础准备 (Day 1)

#### Step 1: 创建镜像仓库

```bash
# 选项 A: 阿里云 ACR (推荐，国内快)
aliyun cr CreateNamespace --NamespaceName agenthive
# 创建镜像仓库: landing, api, agent-runtime

# 选项 B: AWS ECR
aws ecr create-repository --repository-name agenthive/landing
aws ecr create-repository --repository-name agenthive/api

# 选项 C: GitHub Container Registry (免费，国外)
# 不需要预先创建，推送时自动创建
```

#### Step 2: 编写 Dockerfiles（生产优化版）

```dockerfile
# apps/landing/Dockerfile.prod
# ============================
FROM node:20-alpine AS builder

WORKDIR /app

# 安装 pnpm
RUN npm install -g pnpm

# 复制 workspace 配置
COPY pnpm-workspace.yaml package.json ./
COPY packages/types ./packages/types
COPY apps/landing ./apps/landing

# 安装依赖
RUN pnpm install --frozen-lockfile

# 构建
WORKDIR /app/apps/landing
RUN pnpm build

# 生产阶段
FROM nginx:alpine

# 复制构建产物
COPY --from=builder /app/apps/landing/.output/public /usr/share/nginx/html

# Nginx 配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
```

```dockerfile
# apps/api/Dockerfile.prod
# ========================
FROM node:20-alpine AS builder

WORKDIR /app

# 复制源码
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

# 生产阶段
FROM node:20-alpine

WORKDIR /app

# 安装运行时依赖
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# 复制构建产物
COPY --from=builder /app/dist ./dist

# 非 root 用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001
USER nodejs

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=3s \
  CMD node -e "require('http').get('http://localhost:3001/api/health', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"

CMD ["node", "dist/index.js"]
```

#### Step 3: 构建并推送镜像

```bash
#!/bin/bash
# scripts/build-and-push.sh

set -e

REGISTRY="registry.cn-hangzhou.aliyuncs.com/agenthive"
VERSION=${1:-latest}

echo "🚀 构建镜像..."

# 构建 Landing
docker build -t $REGISTRY/landing:$VERSION \
  -f apps/landing/Dockerfile.prod \
  --platform linux/amd64 \
  ./agenthive-cloud

# 构建 API
docker build -t $REGISTRY/api:$VERSION \
  -f apps/api/Dockerfile.prod \
  ./agenthive-cloud/apps/api

echo "📤 推送镜像..."
docker push $REGISTRY/landing:$VERSION
docker push $REGISTRY/api:$VERSION

echo "✅ 完成: $REGISTRY/landing:$VERSION, $REGISTRY/api:$VERSION"
```

---

### Phase 2: 编写 K8s Manifests (Day 1-2)

#### Step 4: 创建 Namespace 和基础配置

```yaml
# k8s/base/00-namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: agenthive
  labels:
    istio-injection: disabled  # 暂时禁用服务网格
```

```yaml
# k8s/base/01-secrets.yaml
apiVersion: v1
kind: Secret
metadata:
  name: app-secrets
  namespace: agenthive
type: Opaque
stringData:
  DB_PASSWORD: "ChangeMeToStrongPassword123!"
  JWT_SECRET: "your-jwt-secret-here"
  LLM_API_KEY: "sk-your-llm-api-key"
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: agenthive
data:
  NODE_ENV: "production"
  DB_HOST: "postgres"
  DB_PORT: "5432"
  DB_NAME: "agenthive"
  DB_USER: "agenthive"
  REDIS_URL: "redis://redis:6379"
  LLM_BASE_URL: "https://dashscope.aliyuncs.com/compatible-mode/v1"
  LLM_MODEL: "qwen-plus"
```

#### Step 5: 部署 PostgreSQL（StatefulSet）

```yaml
# k8s/base/02-postgres.yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-data
  namespace: agenthive
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: standard  # 根据云厂商调整
  resources:
    requests:
      storage: 10Gi
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
  namespace: agenthive
spec:
  serviceName: postgres
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
      - name: postgres
        image: postgres:16-alpine
        ports:
        - containerPort: 5432
        env:
        - name: POSTGRES_USER
          value: "agenthive"
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: DB_PASSWORD
        - name: POSTGRES_DB
          value: "agenthive"
        - name: PGDATA
          value: /var/lib/postgresql/data/pgdata
        volumeMounts:
        - name: data
          mountPath: /var/lib/postgresql/data
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          exec:
            command:
            - pg_isready
            - -U
            - agenthive
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          exec:
            command:
            - pg_isready
            - -U
            - agenthive
          initialDelaySeconds: 5
          periodSeconds: 5
      volumes:
      - name: data
        persistentVolumeClaim:
          claimName: postgres-data
---
apiVersion: v1
kind: Service
metadata:
  name: postgres
  namespace: agenthive
spec:
  selector:
    app: postgres
  ports:
  - port: 5432
    targetPort: 5432
```

#### Step 6: 部署 Redis

```yaml
# k8s/base/03-redis.yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: redis-data
  namespace: agenthive
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: standard
  resources:
    requests:
      storage: 5Gi
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis
  namespace: agenthive
spec:
  replicas: 1
  selector:
    matchLabels:
      app: redis
  template:
    metadata:
      labels:
        app: redis
    spec:
      containers:
      - name: redis
        image: redis:7-alpine
        command:
        - redis-server
        - --maxmemory
        - 256mb
        - --maxmemory-policy
        - allkeys-lru
        - --appendonly
        - "yes"
        ports:
        - containerPort: 6379
        volumeMounts:
        - name: data
          mountPath: /data
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "200m"
        livenessProbe:
          exec:
            command:
            - redis-cli
            - ping
          initialDelaySeconds: 10
          periodSeconds: 5
      volumes:
      - name: data
        persistentVolumeClaim:
          claimName: redis-data
---
apiVersion: v1
kind: Service
metadata:
  name: redis
  namespace: agenthive
spec:
  selector:
    app: redis
  ports:
  - port: 6379
    targetPort: 6379
```

#### Step 7: 部署 API

```yaml
# k8s/base/04-api.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
  namespace: agenthive
  labels:
    app: api
spec:
  replicas: 2  # 高可用
  selector:
    matchLabels:
      app: api
  template:
    metadata:
      labels:
        app: api
    spec:
      containers:
      - name: api
        image: registry.cn-hangzhou.aliyuncs.com/agenthive/api:latest
        imagePullPolicy: Always
        ports:
        - containerPort: 3001
          name: http
        env:
        - name: PORT
          value: "3001"
        - name: NODE_ENV
          valueFrom:
            configMapKeyRef:
              name: app-config
              key: NODE_ENV
        - name: DB_HOST
          valueFrom:
            configMapKeyRef:
              name: app-config
              key: DB_HOST
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: DB_PASSWORD
        - name: REDIS_URL
          valueFrom:
            configMapKeyRef:
              name: app-config
              key: REDIS_URL
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: JWT_SECRET
        - name: LLM_API_KEY
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: LLM_API_KEY
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3001
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/health
            port: 3001
          initialDelaySeconds: 5
          periodSeconds: 5
      initContainers:
      # 等待数据库就绪
      - name: wait-for-db
        image: busybox:1.36
        command: ['sh', '-c', 'until nc -z postgres 5432; do echo waiting for db; sleep 2; done;']
---
apiVersion: v1
kind: Service
metadata:
  name: api
  namespace: agenthive
spec:
  selector:
    app: api
  ports:
  - port: 3001
    targetPort: 3001
```

#### Step 8: 部署 Landing

```yaml
# k8s/base/05-landing.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: landing
  namespace: agenthive
  labels:
    app: landing
spec:
  replicas: 2
  selector:
    matchLabels:
      app: landing
  template:
    metadata:
      labels:
        app: landing
    spec:
      containers:
      - name: landing
        image: registry.cn-hangzhou.aliyuncs.com/agenthive/landing:latest
        imagePullPolicy: Always
        ports:
        - containerPort: 80
          name: http
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "200m"
---
apiVersion: v1
kind: Service
metadata:
  name: landing
  namespace: agenthive
spec:
  selector:
    app: landing
  ports:
  - port: 80
    targetPort: 80
```

#### Step 9: 配置 Ingress

```yaml
# k8s/base/09-ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: agenthive
  namespace: agenthive
  annotations:
    # 阿里云 ACK
    alb.ingress.kubernetes.io/scheme: internet-facing
    alb.ingress.kubernetes.io/listen-ports: '[{"HTTP": 80}, {"HTTPS": 443}]'
    
    # 或 Nginx Ingress
    nginx.ingress.kubernetes.io/rewrite-target: /
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
spec:
  ingressClassName: nginx  # 或 alb
  tls:
  - hosts:
    - agenthive.yourdomain.com
    secretName: agenthive-tls
  rules:
  - host: agenthive.yourdomain.com
    http:
      paths:
      - path: /api
        pathType: Prefix
        backend:
          service:
            name: api
            port:
              number: 3001
      - path: /
        pathType: Prefix
        backend:
          service:
            name: landing
            port:
              number: 80
```

---

### Phase 3: 部署和验证 (Day 2-3)

#### Step 10: 部署应用

```bash
#!/bin/bash
# scripts/deploy.sh

NAMESPACE="agenthive"

echo "🚀 部署 AgentHive 到 Kubernetes..."

# 1. 创建命名空间
kubectl apply -f k8s/base/00-namespace.yaml

# 2. 创建配置和密钥
echo "📦 创建 Secrets 和 ConfigMaps..."
kubectl apply -f k8s/base/01-secrets.yaml

# 3. 部署数据库
echo "🗄️  部署 PostgreSQL..."
kubectl apply -f k8s/base/02-postgres.yaml
kubectl wait --for=condition=ready pod -l app=postgres -n $NAMESPACE --timeout=120s

echo "📦 部署 Redis..."
kubectl apply -f k8s/base/03-redis.yaml
kubectl wait --for=condition=ready pod -l app=redis -n $NAMESPACE --timeout=60s

# 4. 部署应用
echo "🚀 部署 API..."
kubectl apply -f k8s/base/04-api.yaml
kubectl wait --for=condition=ready pod -l app=api -n $NAMESPACE --timeout=120s

echo "🎨 部署 Landing..."
kubectl apply -f k8s/base/05-landing.yaml
kubectl wait --for=condition=ready pod -l app=landing -n $NAMESPACE --timeout=120s

# 5. 部署 Ingress
echo "🌐 部署 Ingress..."
kubectl apply -f k8s/base/09-ingress.yaml

echo ""
echo "✅ 部署完成！"
echo ""
echo "检查状态:"
kubectl get pods -n $NAMESPACE
kubectl get svc -n $NAMESPACE
echo ""
echo "访问地址:"
echo "  Landing: http://agenthive.yourdomain.com"
echo "  API: http://agenthive.yourdomain.com/api"
```

#### Step 11: 验证部署

```bash
# 检查 Pod 状态
kubectl get pods -n agenthive

# 检查日志
kubectl logs -f deployment/api -n agenthive
kubectl logs -f deployment/landing -n agenthive

# 进入 Pod 调试
kubectl exec -it deployment/api -n agenthive -- sh

# 端口转发测试
kubectl port-forward svc/api 3001:3001 -n agenthive
curl http://localhost:3001/api/health
```

#### Step 12: 数据库迁移

```bash
# 从 Docker 导出数据
docker exec agenthive-db pg_dump -U agenthive agenthive > backup.sql

# 导入到 K8s
kubectl exec -i postgres-0 -n agenthive -- psql -U agenthive < backup.sql
```

---

## 📁 目录结构

```
agenthive-cloud/
├── apps/
│   ├── landing/
│   │   ├── Dockerfile          # 开发用
│   │   └── Dockerfile.prod     # 生产用 ⭐新增
│   ├── api/
│   │   ├── Dockerfile
│   │   └── Dockerfile.prod     # 生产用 ⭐新增
│   └── agent-runtime/
│       └── Dockerfile
├── k8s/                        # ⭐新增
│   ├── 00-namespace.yaml
│   ├── 01-secrets.yaml
│   ├── 02-postgres.yaml
│   ├── 03-redis.yaml
│   ├── 04-api.yaml
│   ├── 05-landing.yaml
│   ├── 06-ingress.yaml
│   └── kustomization.yaml      # 可选：Kustomize 配置
├── scripts/
│   ├── build-and-push.sh       # ⭐新增
│   └── deploy.sh               # ⭐新增
└── docs/
    └── DOCKER-TO-K8S-MIGRATION.md
```

---

## ⚠️ 常见问题和解决方案

### 1. ImagePullBackOff

```bash
# 检查镜像是否存在
docker pull your-registry/agenthive/api:latest

# 检查 Secret 是否创建
kubectl create secret docker-registry regcred \
  --docker-server=registry.cn-hangzhou.aliyuncs.com \
  --docker-username=your-username \
  --docker-password=your-password \
  -n agenthive

# 在 Deployment 中引用
imagePullSecrets:
- name: regcred
```

### 2. PVC 绑定失败

```bash
# 检查 StorageClass
kubectl get storageclass

# 如果没有默认 SC，手动指定
kubectl patch pvc postgres-data -p '{"spec":{"storageClassName":"alicloud-disk-ssd"}}'
```

### 3. Pod 无法调度

```bash
# 查看事件
kubectl describe pod <pod-name> -n agenthive

# 常见原因：
# - 资源不足：调整 requests/limits
# - 节点亲和性：添加 tolerations
# - 镜像拉取失败：检查网络和权限
```

### 4. 数据库连接失败

```bash
# 检查服务名是否正确
kubectl get svc -n agenthive

# 在 Pod 内测试连接
kubectl exec -it deployment/api -n agenthive -- nc -zv postgres 5432
```

---

## 🎯 迁移检查清单

### 部署前
- [ ] 镜像仓库已创建
- [ ] 生产 Dockerfile 已编写
- [ ] 镜像已构建并推送
- [ ] K8s 集群已准备（kubectl 可连接）
- [ ] 域名和 Ingress 控制器已配置
- [ ] Secrets（密码、密钥）已准备

### 部署中
- [ ] Namespace 创建成功
- [ ] PostgreSQL StatefulSet 运行正常
- [ ] Redis Deployment 运行正常
- [ ] API Deployment 运行正常
- [ ] Landing Deployment 运行正常
- [ ] Ingress 配置生效

### 部署后
- [ ] https://your-domain.com 可访问
- [ ] API 健康检查通过
- [ ] 数据库连接正常
- [ ] 日志收集配置完成（可选）
- [ ] 监控告警配置完成（可选）
- [ ] 数据备份策略已配置（可选）

---

## 💰 迁移后成本对比

| 项目 | Docker Compose (本地) | Kubernetes (云端) |
|------|----------------------|-------------------|
| **服务器** | 你的电脑（¥0） | EKS/ACK (~¥580/月） |
| **运维** | 你自己（时间成本） | 托管服务（省心） |
| **扩展性** | 手动扩容 | HPA 自动扩容 |
| **可用性** | 单机故障 | 多可用区高可用 |
| **适合** | 开发/演示 | 生产环境 |

**建议**: 
- 开发/演示：保持 Docker Compose
- 生产部署：使用 Kubernetes
- 面试展示：使用 **本地 K8s (Kind) + 云端域名穿透**（见 HYBRID-K8S-ARCHITECTURE.md）

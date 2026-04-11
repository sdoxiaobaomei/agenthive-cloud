# Kubernetes 部署指南

> **适用场景**: 生产环境部署  
> **预计时间**: 2-3 天  
> **复杂度**: 中等

---

## 前置条件

```bash
# 工具版本要求
kubectl version --client    # v1.28+
helm version               # v3.12+
docker buildx version      # 支持多架构构建

# 镜像仓库访问
aws ecr get-login-password --region ap-southeast-1
# 或
aliyun cr GetAuthorizationToken
```

---

## 镜像构建

### 生产 Dockerfile

```dockerfile
# apps/api/Dockerfile.prod
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force
COPY --from=builder /app/dist ./dist

RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
USER nodejs

EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=3s \
  CMD node -e "require('http').get('http://localhost:3001/api/health', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"

CMD ["node", "dist/index.js"]
```

### 构建脚本

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

echo "✅ 完成"
```

---

## K8s Manifests

### 1. Namespace 和基础配置

```yaml
# k8s/00-namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: agenthive
  labels:
    istio-injection: disabled

---
# k8s/01-secrets.yaml
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

### 2. PostgreSQL

```yaml
# k8s/02-postgres.yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-data
  namespace: agenthive
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: standard
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
            command: ["pg_isready", "-U", "agenthive"]
          initialDelaySeconds: 30
          periodSeconds: 10
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

### 3. Redis

```yaml
# k8s/03-redis.yaml
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

### 4. API Deployment

```yaml
# k8s/04-api.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
  namespace: agenthive
spec:
  replicas: 2
  selector:
    matchLabels:
      app: api
  template:
    metadata:
      labels:
        app: api
    spec:
      initContainers:
      - name: wait-for-db
        image: busybox:1.36
        command: ['sh', '-c', 'until nc -z postgres 5432; do echo waiting for db; sleep 2; done;']
      containers:
      - name: api
        image: registry.cn-hangzhou.aliyuncs.com/agenthive/api:latest
        imagePullPolicy: Always
        ports:
        - containerPort: 3001
        env:
        - name: PORT
          value: "3001"
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: DB_PASSWORD
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
        envFrom:
        - configMapRef:
            name: app-config
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

### 5. Landing Deployment

```yaml
# k8s/05-landing.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: landing
  namespace: agenthive
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

### 6. Ingress

```yaml
# k8s/06-ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: agenthive
  namespace: agenthive
  annotations:
    # 阿里云 ALB
    alb.ingress.kubernetes.io/scheme: internet-facing
    alb.ingress.kubernetes.io/listen-ports: '[{"HTTP": 80}, {"HTTPS": 443}]'
    
    # 或 Nginx Ingress
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
spec:
  ingressClassName: nginx
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

## 部署脚本

```bash
#!/bin/bash
# deploy.sh

set -e
NAMESPACE="agenthive"

echo "🚀 部署 AgentHive 到 Kubernetes..."

# 创建命名空间
kubectl apply -f k8s/00-namespace.yaml

# 创建配置和密钥
echo "📦 创建 Secrets 和 ConfigMaps..."
kubectl apply -f k8s/01-secrets.yaml

# 部署数据库
echo "🗄️  部署 PostgreSQL..."
kubectl apply -f k8s/02-postgres.yaml
kubectl wait --for=condition=ready pod -l app=postgres -n $NAMESPACE --timeout=120s

echo "📦 部署 Redis..."
kubectl apply -f k8s/03-redis.yaml
kubectl wait --for=condition=ready pod -l app=redis -n $NAMESPACE --timeout=60s

# 部署应用
echo "🚀 部署 API..."
kubectl apply -f k8s/04-api.yaml
kubectl wait --for=condition=ready pod -l app=api -n $NAMESPACE --timeout=120s

echo "🎨 部署 Landing..."
kubectl apply -f k8s/05-landing.yaml
kubectl wait --for=condition=ready pod -l app=landing -n $NAMESPACE --timeout=120s

# 部署 Ingress
echo "🌐 部署 Ingress..."
kubectl apply -f k8s/06-ingress.yaml

echo ""
echo "✅ 部署完成！"
kubectl get pods -n $NAMESPACE
kubectl get svc -n $NAMESPACE
```

---

## 数据迁移

```bash
# 从 Docker 导出
docker exec agenthive-db pg_dump -U agenthive agenthive > backup.sql

# 导入到 K8s
kubectl exec -i postgres-0 -n agenthive -- psql -U agenthive < backup.sql
```

---

## 故障排查

```bash
# 检查 Pod 状态
kubectl get pods -n agenthive

# 查看日志
kubectl logs -f deployment/api -n agenthive

# 进入 Pod 调试
kubectl exec -it deployment/api -n agenthive -- sh

# 端口转发测试
kubectl port-forward svc/api 3001:3001 -n agenthive
curl http://localhost:3001/api/health
```

### 常见问题

| 问题 | 解决方案 |
|------|----------|
| ImagePullBackOff | 检查镜像仓库认证 `kubectl create secret docker-registry` |
| PVC 绑定失败 | 检查 StorageClass `kubectl get storageclass` |
| Pod 无法调度 | 检查资源 `kubectl describe pod <pod-name>` |

---

*完整文档参见原始 RFC 和实现计划*

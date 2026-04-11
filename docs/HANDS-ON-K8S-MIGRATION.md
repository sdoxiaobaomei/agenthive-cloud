# 手把手教你从 Docker 迁移到 Kubernetes

> 从零开始，一步一步将 Docker 容器搬到 K8s

---

## 🎯 目标

将以下 Docker Compose 应用迁移到 Kubernetes：
- Landing (Nuxt 前端) → 端口 80
- API (Node.js 后端) → 端口 3001
- PostgreSQL → 端口 5432
- Redis → 端口 6379

---

## 📋 当前状态检查

### 步骤 1: 确认 K8s 集群就绪

```bash
# 检查集群状态
kubectl cluster-info

# 预期输出:
# Kubernetes control plane is running at https://kubernetes.docker.internal:6443
# CoreDNS is running at https://kubernetes.docker.internal:6443/api/v1/namespaces/kube-system/services/kube-dns:dns/proxy

# 检查节点
kubectl get nodes
# NAME             STATUS   ROLES           AGE   VERSION
# docker-desktop   Ready    control-plane   1d    v1.29.0

# 检查系统 Pod
kubectl get pods -n kube-system
```

### 步骤 2: 确认当前 Docker 应用运行正常

```bash
# 查看运行的容器
docker ps

# 预期看到:
# CONTAINER ID   IMAGE              PORTS
# abc123         agenthive/landing  0.0.0.0:80->80/tcp
# def456         agenthive/api      0.0.0.0:3001->3001/tcp
# ghj789         postgres:16        0.0.0.0:5432->5432/tcp
# klm012         redis:7            0.0.0.0:6379->6379/tcp

# 测试访问
curl http://localhost/api/health
curl http://localhost
```

---

## 🏗️ 迁移架构对比

### 迁移前 (Docker Compose)

```yaml
services:
  landing:
    image: agenthive/landing
    ports:
      - "80:80"
  api:
    image: agenthive/api
    ports:
      - "3001:3001"
    environment:
      DB_HOST: postgres
      REDIS_URL: redis://redis:6379
  postgres:
    image: postgres:16
    ports:
      - "5432:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data
  redis:
    image: redis:7
    ports:
      - "6379:6379"
```

### 迁移后 (Kubernetes)

```yaml
# 每个服务变成一组 K8s 资源

Landing:
  ├── Deployment (管理 Pod 副本)
  ├── Service (集群内访问)
  └── Ingress (外部访问)

API:
  ├── Deployment
  ├── Service
  └── ConfigMap/Secret (配置)

PostgreSQL:
  ├── StatefulSet (有状态应用)
  ├── Service
  └── PersistentVolumeClaim (存储)

Redis:
  ├── Deployment
  ├── Service
  └── PersistentVolumeClaim
```

---

## 📝 第一步：创建 Namespace

**概念**: Namespace 是 K8s 中的"虚拟集群"，用于隔离不同项目。

```bash
# 创建文件夹
mkdir -p k8s-tutorial
cd k8s-tutorial

# 创建 namespace.yaml
cat > 00-namespace.yaml << 'EOF'
apiVersion: v1
kind: Namespace
metadata:
  name: agenthive
  labels:
    app: agenthive
EOF

# 应用
kubectl apply -f 00-namespace.yaml

# 验证
kubectl get namespace agenthive
kubectl get ns  # 简写
```

**切换默认命名空间**（可选）：
```bash
# 后续命令可以省略 -n agenthive
kubectl config set-context --current --namespace=agenthive
```

---

## 📝 第二步：部署 PostgreSQL (StatefulSet)

**概念**: StatefulSet 用于有状态应用（数据库），保证：
- 稳定的网络标识（pod-name-0, pod-name-1）
- 稳定的存储（每个 Pod 有自己的 PVC）
- 有序的部署和扩缩容

### 2.1 创建 PVC（存储）

```bash
cat > 01-postgres-pvc.yaml << 'EOF'
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-data
  namespace: agenthive
spec:
  accessModes:
    - ReadWriteOnce  # 只能被一个节点挂载
  storageClassName: hostpath  # Docker Desktop 默认
  resources:
    requests:
      storage: 5Gi  # 请求 5GB 存储
EOF

kubectl apply -f 01-postgres-pvc.yaml
kubectl get pvc -n agenthive
```

### 2.2 创建 StatefulSet

```bash
cat > 02-postgres.yaml << 'EOF'
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
  namespace: agenthive
spec:
  serviceName: postgres  #  headless service 名称
  replicas: 1            # 只运行 1 个副本
  selector:
    matchLabels:
      app: postgres      # 选择带有这个标签的 Pod
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
          name: postgres
        env:
        - name: POSTGRES_USER
          value: "agenthive"
        - name: POSTGRES_PASSWORD
          value: "dev"        # 生产环境应该用 Secret
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
        # 健康检查
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
EOF

kubectl apply -f 02-postgres.yaml
```

### 2.3 创建 Service

```bash
cat > 03-postgres-service.yaml << 'EOF'
apiVersion: v1
kind: Service
metadata:
  name: postgres
  namespace: agenthive
spec:
  selector:
    app: postgres  # 选择标签为 app=postgres 的 Pod
  ports:
  - port: 5432          # Service 暴露的端口
    targetPort: 5432    # Pod 内的端口
  type: ClusterIP       # 只能在集群内部访问
  # type: NodePort      # 如果需要外部访问
EOF

kubectl apply -f 03-postgres-service.yaml
```

### 2.4 验证 PostgreSQL

```bash
# 查看 Pod 状态
kubectl get pods -n agenthive -w
# NAME         READY   STATUS    RESTARTS   AGE
# postgres-0   1/1     Running   0          1m

# 查看日志
kubectl logs postgres-0 -n agenthive

# 进入容器测试
kubectl exec -it postgres-0 -n agenthive -- psql -U agenthive -d agenthive

# 在 psql 中执行
\l                    # 列出数据库
\dt                   # 列出表
SELECT version();     # 查看版本
\q                    # 退出
```

---

## 📝 第三步：部署 Redis

### 3.1 创建 PVC

```bash
cat > 04-redis-pvc.yaml << 'EOF'
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: redis-data
  namespace: agenthive
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: hostpath
  resources:
    requests:
      storage: 2Gi
EOF

kubectl apply -f 04-redis-pvc.yaml
```

### 3.2 创建 Deployment

```bash
cat > 05-redis.yaml << 'EOF'
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
EOF

kubectl apply -f 05-redis.yaml
```

### 3.3 创建 Service

```bash
cat > 06-redis-service.yaml << 'EOF'
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
  type: ClusterIP
EOF

kubectl apply -f 06-redis-service.yaml

# 验证
kubectl get pods -n agenthive
kubectl get svc -n agenthive
```

---

## 📝 第四步：部署 API

### 4.1 准备镜像

**重要**: K8s 需要能够拉取镜像。有 3 种方式：

#### 方式 A：推送到镜像仓库（推荐生产）
```bash
# 推送到 Docker Hub
docker tag agenthive/api:latest yourname/agenthive-api:v1.0.0
docker push yourname/agenthive-api:v1.0.0

# YAML 中指定
# image: yourname/agenthive-api:v1.0.0
```

#### 方式 B：使用本地镜像（Docker Desktop）
```bash
# 确保镜像存在
docker images | grep agenthive/api

# YAML 中指定 imagePullPolicy: Never
# image: agenthive-api:latest
# imagePullPolicy: Never
```

#### 方式 C：Kind 加载镜像
```bash
kind load docker-image agenthive/api:latest --name agenthive
```

### 4.2 创建 ConfigMap（配置）

**概念**: ConfigMap 用于存储非敏感的配置数据。

```bash
cat > 07-api-configmap.yaml << 'EOF'
apiVersion: v1
kind: ConfigMap
metadata:
  name: api-config
  namespace: agenthive
data:
  NODE_ENV: "development"
  DB_HOST: "postgres"           # 使用 Service 名称
  DB_PORT: "5432"
  DB_NAME: "agenthive"
  DB_USER: "agenthive"
  REDIS_URL: "redis://redis:6379"  # 使用 Service 名称
  PORT: "3001"
EOF

kubectl apply -f 07-api-configmap.yaml
```

### 4.3 创建 Secret（敏感信息）

**概念**: Secret 用于存储密码、Token 等敏感信息，会 base64 编码存储。

```bash
cat > 08-api-secret.yaml << 'EOF'
apiVersion: v1
kind: Secret
metadata:
  name: api-secret
  namespace: agenthive
type: Opaque
stringData:
  DB_PASSWORD: "dev"
  JWT_SECRET: "dev-secret-key"
EOF

kubectl apply -f 08-api-secret.yaml

# 查看 Secret（值会被隐藏）
kubectl get secret api-secret -n agenthive -o yaml
```

### 4.4 创建 Deployment

```bash
cat > 09-api-deployment.yaml << 'EOF'
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
  namespace: agenthive
  labels:
    app: api
spec:
  replicas: 2  # 运行 2 个副本实现高可用
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
        # 根据你的情况修改镜像
        image: agenthive/api:latest
        imagePullPolicy: Never  # 使用本地镜像，不拉取
        ports:
        - containerPort: 3001
          name: http
        env:
        # 从 ConfigMap 读取
        - name: NODE_ENV
          valueFrom:
            configMapKeyRef:
              name: api-config
              key: NODE_ENV
        - name: DB_HOST
          valueFrom:
            configMapKeyRef:
              name: api-config
              key: DB_HOST
        # 从 Secret 读取
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: api-secret
              key: DB_PASSWORD
        - name: REDIS_URL
          valueFrom:
            configMapKeyRef:
              name: api-config
              key: REDIS_URL
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        # 健康检查
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
      # 初始化容器：等待数据库就绪
      initContainers:
      - name: wait-for-postgres
        image: busybox:1.36
        command: ['sh', '-c', 'until nc -z postgres 5432; do echo waiting for postgres; sleep 2; done;']
      - name: wait-for-redis
        image: busybox:1.36
        command: ['sh', '-c', 'until nc -z redis 6379; do echo waiting for redis; sleep 2; done;']
EOF

kubectl apply -f 09-api-deployment.yaml
```

### 4.5 创建 Service

```bash
cat > 10-api-service.yaml << 'EOF'
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
  type: ClusterIP  # 内部访问，通过 Ingress 暴露
EOF

kubectl apply -f 10-api-service.yaml
```

### 4.6 验证 API

```bash
# 查看 Pod
kubectl get pods -n agenthive
# NAME                   READY   STATUS    RESTARTS   AGE
# api-7d9f4b8c5-x2abc    1/1     Running   0          1m
# api-7d9f4b8c5-y3def    1/1     Running   0          1m

# 查看日志
kubectl logs deployment/api -n agenthive --tail=50

# 进入容器测试
kubectl exec -it deployment/api -n agenthive -- sh

# 在容器内测试连接
wget -qO- http://api:3001/api/health
# 或
nc -zv postgres 5432
nc -zv redis 6379
```

---

## 📝 第五步：部署 Landing

### 5.1 创建 Deployment

```bash
cat > 11-landing-deployment.yaml << 'EOF'
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
        image: agenthive/landing:latest
        imagePullPolicy: Never
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
        livenessProbe:
          httpGet:
            path: /
            port: 80
          initialDelaySeconds: 10
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /
            port: 80
          initialDelaySeconds: 5
          periodSeconds: 5
EOF

kubectl apply -f 11-landing-deployment.yaml
```

### 5.2 创建 Service

```bash
cat > 12-landing-service.yaml << 'EOF'
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
  type: ClusterIP
EOF

kubectl apply -f 12-landing-service.yaml
```

---

## 📝 第六步：配置 Ingress（外部访问）

**概念**: Ingress 是 K8s 的入口控制器，将外部 HTTP/HTTPS 路由到内部 Service。

### 6.1 安装 Ingress Controller

```bash
# Docker Desktop 自带 Nginx Ingress，检查是否已安装
kubectl get pods -n ingress-nginx

# 如果没有，安装它
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.2/deploy/static/provider/cloud/deploy.yaml

# 等待就绪
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=120s
```

### 6.2 创建 Ingress

```bash
cat > 13-ingress.yaml << 'EOF'
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: agenthive
  namespace: agenthive
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  ingressClassName: nginx
  rules:
  - http:
      paths:
      # API 路由
      - path: /api
        pathType: Prefix
        backend:
          service:
            name: api
            port:
              number: 3001
      # WebSocket 路由（如果有）
      - path: /socket.io
        pathType: Prefix
        backend:
          service:
            name: api
            port:
              number: 3001
      # 前端路由（默认）
      - path: /
        pathType: Prefix
        backend:
          service:
            name: landing
            port:
              number: 80
EOF

kubectl apply -f 13-ingress.yaml
```

### 6.3 或者使用 LoadBalancer（Docker Desktop 支持）

如果不想用 Ingress，可以直接暴露 Service：

```bash
cat > 14-landing-lb.yaml << 'EOF'
apiVersion: v1
kind: Service
metadata:
  name: landing-lb
  namespace: agenthive
spec:
  selector:
    app: landing
  ports:
  - port: 80
    targetPort: 80
  type: LoadBalancer  # Docker Desktop 会自动分配 localhost
EOF

kubectl apply -f 14-landing-lb.yaml

# 查看分配的 IP
kubectl get svc -n agenthive
# NAME         TYPE           CLUSTER-IP      EXTERNAL-IP   PORT(S)
# landing-lb   LoadBalancer   10.96.123.45    localhost     80:30080/TCP
```

---

## 🧪 第七步：验证完整部署

### 7.1 查看所有资源

```bash
# 查看所有资源
kubectl get all -n agenthive

# 预期输出:
# NAME                            READY   STATUS    RESTARTS   AGE
# pod/api-7d9f4b8c5-x2abc         1/1     Running   0          5m
# pod/api-7d9f4b8c5-y3def         1/1     Running   0          5m
# pod/landing-5c8d2a1b9-z4ghi     1/1     Running   0          5m
# pod/landing-5c8d2a1b9-w5jkl     1/1     Running   0          5m
# pod/postgres-0                  1/1     Running   0          10m
# pod/redis-6f9b5c4d8-m7nop       1/1     Running   0          8m
#
# NAME                 TYPE           CLUSTER-IP      EXTERNAL-IP   PORT(S)
# service/api          ClusterIP      10.96.1.2       <none>        3001/TCP
# service/landing      ClusterIP      10.96.2.3       <none>        80/TCP
# service/landing-lb   LoadBalancer   10.96.3.4       localhost     80:30080/TCP
# service/postgres     ClusterIP      10.96.4.5       <none>        5432/TCP
# service/redis        ClusterIP      10.96.5.6       <none>        6379/TCP
#
# NAME                       READY   UP-TO-DATE   AVAILABLE   AGE
# deployment.apps/api        2/2     2            2           5m
# deployment.apps/landing    2/2     2            2           5m
# deployment.apps/redis      1/1     1            1           8m
```

### 7.2 测试访问

```bash
# 测试 Landing
curl http://localhost
# 或浏览器访问 http://localhost

# 测试 API
curl http://localhost/api/health

# 端口转发测试（如果需要）
kubectl port-forward svc/api 3001:3001 -n agenthive
curl http://localhost:3001/api/health
```

### 7.3 查看事件（排查问题）

```bash
# 查看最近事件
kubectl get events -n agenthive --sort-by=.metadata.creationTimestamp | tail -20

# 查看 Pod 详情
kubectl describe pod <pod-name> -n agenthive

# 查看 Deployment 详情
kubectl describe deployment api -n agenthive
```

---

## 🎨 第八步：使用 Kustomize 组织配置

当配置文件变多时，使用 Kustomize 管理：

```bash
# 创建 kustomization.yaml
cat > kustomization.yaml << 'EOF'
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

namespace: agenthive

resources:
  - 00-namespace.yaml
  - 01-postgres-pvc.yaml
  - 02-postgres.yaml
  - 03-postgres-service.yaml
  - 04-redis-pvc.yaml
  - 05-redis.yaml
  - 06-redis-service.yaml
  - 07-api-configmap.yaml
  - 08-api-secret.yaml
  - 09-api-deployment.yaml
  - 10-api-service.yaml
  - 11-landing-deployment.yaml
  - 12-landing-service.yaml
  - 13-ingress.yaml
EOF

# 一键部署所有
kubectl apply -k .

# 一键删除所有
kubectl delete -k .
```

---

## 🔧 常用调试命令

```bash
# 查看 Pod 日志
kubectl logs <pod-name> -n agenthive
cubectl logs <pod-name> -n agenthive -f  # 实时
kubectl logs <pod-name> -n agenthive --tail=100  # 最后100行

# 查看之前的日志（Pod 重启后）
kubectl logs <pod-name> -n agenthive --previous

# 进入容器
kubectl exec -it <pod-name> -n agenthive -- sh
kubectl exec -it <pod-name> -n agenthive -- bash

# 复制文件
kubectl cp <pod-name>:/app/file.txt ./file.txt -n agenthive
kubectl cp ./file.txt <pod-name>:/app/file.txt -n agenthive

# 查看资源使用
kubectl top pods -n agenthive
kubectl top nodes

# 查看服务详情
kubectl get svc -n agenthive -o wide

# 查看 Endpoints
kubectl get endpoints -n agenthive
```

---

## 📊 和 Docker Compose 对比

| Docker Compose | Kubernetes | 说明 |
|---------------|------------|------|
| `services` | `Deployment/StatefulSet` | 应用定义 |
| `ports` | `Service` | 服务暴露 |
| `volumes` | `PVC` | 存储 |
| `environment` | `ConfigMap/Secret` | 配置 |
| `networks` | `Service DNS` | 服务发现 |
| `depends_on` | `initContainers` | 依赖等待 |
| `restart` | `restartPolicy` | 重启策略 |
| `healthcheck` | `liveness/readinessProbe` | 健康检查 |

---

## ✅ 迁移检查清单

- [x] Namespace 创建
- [x] PostgreSQL StatefulSet + PVC + Service
- [x] Redis Deployment + PVC + Service
- [x] API Deployment + ConfigMap + Secret + Service
- [x] Landing Deployment + Service
- [x] Ingress 或 LoadBalancer 配置
- [x] 所有 Pod Running
- [x] 服务可访问

---

## 🚀 下一步学习

1. **Helm 包管理**: 学习用 Helm Chart 管理应用
2. **HPA 自动扩缩容**: `kubectl autoscale deployment api --min=2 --max=10 --cpu-percent=80`
3. **监控**: 部署 Prometheus + Grafana
4. **CI/CD**: 配置 GitHub Actions 自动部署到 K8s

有问题随时问！

#!/bin/bash
# 简化版 K8s 部署脚本 - 快速体验用

set -e
NAMESPACE="agenthive"

echo "🚀 AgentHive 快速部署到 Kubernetes"
echo "====================================="
echo ""

# 检查 K8s 连接
echo "🔍 检查 Kubernetes 连接..."
if ! kubectl cluster-info &> /dev/null; then
    echo "❌ 无法连接到 Kubernetes"
    echo "请确保 Docker Desktop Kubernetes 已启用"
    exit 1
fi
echo "✅ Kubernetes 连接正常"
echo ""

# 检查镜像
echo "🔍 检查本地镜像..."
if ! docker images | grep -q "agenthive/api"; then
    echo "⚠️  未找到 agenthive/api 镜像"
    echo "请先构建镜像: ./scripts/build-local-k8s.sh"
    exit 1
fi

if ! docker images | grep -q "agenthive/landing"; then
    echo "⚠️  未找到 agenthive/landing 镜像"
    echo "请先构建镜像: ./scripts/build-local-k8s.sh"
    exit 1
fi

echo "✅ 镜像检查通过"
echo ""

# 清理旧部署（可选）
read -p "是否清理旧部署? (y/N): " clean
if [[ $clean == [yY] ]]; then
    echo "🧹 清理旧部署..."
    kubectl delete namespace $NAMESPACE --ignore-not-found=true
    sleep 5
fi

echo "📦 开始部署..."
echo ""

# 1. Namespace
echo "1/5 创建 Namespace..."
kubectl create namespace $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -

# 2. PostgreSQL
echo "2/5 部署 PostgreSQL..."
kubectl apply -f - <<'EOF'
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-data
  namespace: agenthive
spec:
  accessModes: [ReadWriteOnce]
  storageClassName: hostpath
  resources: {requests: {storage: 5Gi}}
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
  namespace: agenthive
spec:
  serviceName: postgres
  replicas: 1
  selector: {matchLabels: {app: postgres}}
  template:
    metadata: {labels: {app: postgres}}
    spec:
      containers:
      - name: postgres
        image: postgres:16-alpine
        ports: [{containerPort: 5432}]
        env:
        - {name: POSTGRES_USER, value: agenthive}
        - {name: POSTGRES_PASSWORD, value: dev}
        - {name: POSTGRES_DB, value: agenthive}
        volumeMounts: [{name: data, mountPath: /var/lib/postgresql/data}]
        resources: {requests: {memory: 256Mi, cpu: 250m}}
      volumes: [{name: data, persistentVolumeClaim: {claimName: postgres-data}}]
---
apiVersion: v1
kind: Service
metadata:
  name: postgres
  namespace: agenthive
spec:
  selector: {app: postgres}
  ports: [{port: 5432, targetPort: 5432}]
EOF

# 3. Redis
echo "3/5 部署 Redis..."
kubectl apply -f - <<'EOF'
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis
  namespace: agenthive
spec:
  replicas: 1
  selector: {matchLabels: {app: redis}}
  template:
    metadata: {labels: {app: redis}}
    spec:
      containers:
      - name: redis
        image: redis:7-alpine
        ports: [{containerPort: 6379}]
        resources: {requests: {memory: 128Mi, cpu: 100m}}
---
apiVersion: v1
kind: Service
metadata:
  name: redis
  namespace: agenthive
spec:
  selector: {app: redis}
  ports: [{port: 6379, targetPort: 6379}]
EOF

# 4. API
echo "4/5 部署 API..."
kubectl apply -f - <<'EOF'
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
  namespace: agenthive
spec:
  replicas: 2
  selector: {matchLabels: {app: api}}
  template:
    metadata: {labels: {app: api}}
    spec:
      containers:
      - name: api
        image: agenthive/api:latest
        imagePullPolicy: Never
        ports: [{containerPort: 3001}]
        env:
        - {name: DB_HOST, value: postgres}
        - {name: DB_PASSWORD, value: dev}
        - {name: REDIS_URL, value: "redis://redis:6379"}
        resources: {requests: {memory: 256Mi, cpu: 250m}}
      initContainers:
      - name: wait-for-db
        image: busybox:1.36
        command: ['sh', '-c', 'until nc -z postgres 5432; do sleep 2; done']
EOF

kubectl apply -f - <<'EOF'
apiVersion: v1
kind: Service
metadata:
  name: api
  namespace: agenthive
spec:
  selector: {app: api}
  ports: [{port: 3001, targetPort: 3001}]
EOF

# 5. Landing
echo "5/5 部署 Landing..."
kubectl apply -f - <<'EOF'
apiVersion: apps/v1
kind: Deployment
metadata:
  name: landing
  namespace: agenthive
spec:
  replicas: 2
  selector: {matchLabels: {app: landing}}
  template:
    metadata: {labels: {app: landing}}
    spec:
      containers:
      - name: landing
        image: agenthive/landing:latest
        imagePullPolicy: Never
        ports: [{containerPort: 80}]
        resources: {requests: {memory: 128Mi, cpu: 100m}}
---
apiVersion: v1
kind: Service
metadata:
  name: landing
  namespace: agenthive
spec:
  selector: {app: landing}
  ports: [{port: 80, targetPort: 80}]
  type: LoadBalancer
EOF

echo ""
echo "⏳ 等待服务就绪..."
echo ""

# 等待 Pod 就绪
kubectl wait --for=condition=ready pod -l app=postgres -n $NAMESPACE --timeout=120s 2>/dev/null || echo "⚠️ PostgreSQL 启动超时，继续等待..."
kubectl wait --for=condition=ready pod -l app=redis -n $NAMESPACE --timeout=60s 2>/dev/null || true
kubectl wait --for=condition=ready pod -l app=api -n $NAMESPACE --timeout=120s 2>/dev/null || echo "⚠️ API 启动超时，继续等待..."
kubectl wait --for=condition=ready pod -l app=landing -n $NAMESPACE --timeout=120s 2>/dev/null || echo "⚠️ Landing 启动超时，继续等待..."

echo ""
echo "📊 部署状态"
echo "==========="
kubectl get pods -n $NAMESPACE

echo ""
echo "🌐 服务状态"
echo "==========="
kubectl get svc -n $NAMESPACE

echo ""
echo "====================================="
echo "✅ 部署完成！"
echo "====================================="
echo ""
echo "访问地址:"
echo "  🌐 http://localhost"
echo ""
echo "验证命令:"
echo "  curl http://localhost/api/health"
echo ""
echo "查看日志:"
echo "  kubectl logs -f deployment/api -n agenthive"
echo ""
echo "清理部署:"
echo "  kubectl delete namespace agenthive"

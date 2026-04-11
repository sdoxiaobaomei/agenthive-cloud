#!/bin/bash
# AgentHive Kubernetes 部署脚本

set -e

NAMESPACE="${NAMESPACE:-agenthive}"
K8S_DIR="${K8S_DIR:-k8s}"

echo "🚀 AgentHive Kubernetes 部署"
echo "============================="
echo "Namespace: $NAMESPACE"
echo "K8s Dir: $K8S_DIR"
echo ""

# 检查 kubectl
if ! command -v kubectl &> /dev/null; then
    echo "❌ 错误: kubectl 未安装"
    exit 1
fi

# 检查集群连接
if ! kubectl cluster-info &> /dev/null; then
    echo "❌ 错误: 无法连接到 K8s 集群"
    echo "   请检查 kubeconfig 配置"
    exit 1
fi

echo "✅ 集群连接正常"
echo ""

# 切换到项目根目录
cd "$(dirname "$0")/.."

# 1. 创建命名空间
echo "📁 创建命名空间..."
kubectl apply -f "$K8S_DIR/00-namespace.yaml"
echo ""

# 2. 创建配置和密钥
echo "🔐 创建 ConfigMaps 和 Secrets..."
kubectl apply -f "$K8S_DIR/01-secrets.yaml"
echo ""

# 3. 部署数据库
echo "🗄️  部署 PostgreSQL..."
kubectl apply -f "$K8S_DIR/02-postgres.yaml"
echo "⏳ 等待 PostgreSQL 就绪..."
kubectl wait --for=condition=ready pod -l app=postgres -n "$NAMESPACE" --timeout=120s
echo "✅ PostgreSQL 就绪"
echo ""

echo "📦 部署 Redis..."
kubectl apply -f "$K8S_DIR/03-redis.yaml"
echo "⏳ 等待 Redis 就绪..."
kubectl wait --for=condition=ready pod -l app=redis -n "$NAMESPACE" --timeout=60s
echo "✅ Redis 就绪"
echo ""

# 4. 部署应用
echo "🚀 部署 API..."
kubectl apply -f "$K8S_DIR/04-api.yaml"
echo ""

echo "🎨 部署 Landing..."
kubectl apply -f "$K8S_DIR/05-landing.yaml"
echo ""

# 5. 等待应用就绪
echo "⏳ 等待应用就绪..."
kubectl wait --for=condition=ready pod -l app=api -n "$NAMESPACE" --timeout=120s
kubectl wait --for=condition=ready pod -l app=landing -n "$NAMESPACE" --timeout=120s
echo "✅ 应用就绪"
echo ""

# 6. 部署 Ingress
echo "🌐 部署 Ingress..."
kubectl apply -f "$K8S_DIR/06-ingress.yaml"
echo ""

# 显示状态
echo "📊 部署状态"
echo "==========="
kubectl get pods -n "$NAMESPACE" -o wide
echo ""
kubectl get svc -n "$NAMESPACE"
echo ""

# 获取访问地址
echo "🌐 访问信息"
echo "==========="

# 检查 Ingress
INGRESS_IP=$(kubectl get ingress -n "$NAMESPACE" -o jsonpath='{.items[0].status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "")
if [ -n "$INGRESS_IP" ]; then
    echo "  IP: $INGRESS_IP"
fi

INGRESS_HOST=$(kubectl get ingress -n "$NAMESPACE" -o jsonpath='{.items[0].spec.rules[0].host}' 2>/dev/null || echo "")
if [ -n "$INGRESS_HOST" ]; then
    echo "  Host: $INGRESS_HOST"
    echo "  Landing: http://$INGRESS_HOST"
    echo "  API:     http://$INGRESS_HOST/api"
else
    echo "  未配置 Ingress Host"
    echo "  使用端口转发测试:"
    echo "    kubectl port-forward svc/landing 8080:80 -n $NAMESPACE"
    echo "    kubectl port-forward svc/api 3001:3001 -n $NAMESPACE"
fi

echo ""
echo "✅ 部署完成！"
echo ""
echo "常用命令:"
echo "  查看日志:  kubectl logs -f deployment/api -n $NAMESPACE"
echo "  进入容器:  kubectl exec -it deployment/api -n $NAMESPACE -- sh"
echo "  重启部署:  kubectl rollout restart deployment/api -n $NAMESPACE"
echo "  回滚:      kubectl rollout undo deployment/api -n $NAMESPACE"

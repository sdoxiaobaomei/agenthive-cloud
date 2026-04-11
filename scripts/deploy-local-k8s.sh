#!/bin/bash
# Docker Desktop Kubernetes 本地部署脚本

set -e

NAMESPACE="agenthive"
K8S_DIR="k8s/local"

echo "🚀 AgentHive Docker Desktop K8s 部署"
echo "===================================="
echo ""

# 检查 kubectl
if ! command -v kubectl &> /dev/null; then
    echo "❌ 错误: kubectl 未安装"
    exit 1
fi

# 检查 Docker Desktop K8s
if ! kubectl cluster-info &> /dev/null; then
    echo "❌ 错误: 无法连接到 K8s 集群"
    echo "   请确保 Docker Desktop Kubernetes 已启用："
    echo "   Docker Desktop → Settings → Kubernetes → Enable Kubernetes ✅"
    exit 1
fi

echo "✅ 连接到 Docker Desktop Kubernetes"
kubectl version --short
kubectl cluster-info | head -2
echo ""

# 检查镜像
echo "🔍 检查本地镜像..."
if ! docker images | grep -q "agenthive/api"; then
    echo "⚠️  API 镜像不存在，开始构建..."
    ./scripts/build-local-k8s.sh
fi

if ! docker images | grep -q "agenthive/landing"; then
    echo "⚠️  Landing 镜像不存在，开始构建..."
    ./scripts/build-local-k8s.sh
fi

echo "✅ 镜像检查完成"
echo ""

# 切换到项目根目录
cd "$(dirname "$0")/.."
PROJECT_ROOT=$(pwd)

# 检查 K8s 配置目录
if [ ! -d "$K8S_DIR" ]; then
    echo "❌ 错误: K8s 配置目录不存在: $K8S_DIR"
    exit 1
fi

# 部署到 K8s
echo "📦 部署到 Kubernetes..."
echo "-----------------------"
echo ""

# 使用 kustomize 部署
echo "🚀 应用 Kustomize 配置..."
kubectl apply -k "$K8S_DIR"

echo ""
echo "⏳ 等待服务启动..."
echo "------------------"

# 等待数据库
kubectl wait --for=condition=ready pod -l app=postgres -n "$NAMESPACE" --timeout=120s 2>/dev/null || true

# 等待 Redis  
kubectl wait --for=condition=ready pod -l app=redis -n "$NAMESPACE" --timeout=60s 2>/dev/null || true

# 等待 API
kubectl wait --for=condition=ready pod -l app=api -n "$NAMESPACE" --timeout=120s 2>/dev/null || true

# 等待 Landing
kubectl wait --for=condition=ready pod -l app=landing -n "$NAMESPACE" --timeout=120s 2>/dev/null || true

echo ""
echo "📊 部署状态"
echo "==========="
kubectl get pods -n "$NAMESPACE" -o wide

echo ""
echo "🌐 服务状态"
echo "==========="
kubectl get svc -n "$NAMESPACE"

echo ""
echo "🎯 访问地址"
echo "==========="
echo "  Landing (主入口): http://localhost"
echo "  API 健康检查:     http://localhost/api/health"
echo "  API (直接访问):   http://localhost:3001"
echo ""
echo "  PostgreSQL:       localhost:30432 (用户: agenthive, 密码: dev)"
echo "  Redis:            localhost:30379"
echo ""

# 测试服务
echo "🧪 服务测试"
echo "==========="
sleep 2

echo "测试 API 健康检查..."
if curl -s http://localhost/api/health > /dev/null 2>&1; then
    echo "✅ API 正常"
else
    echo "⏳ API 启动中，稍后重试..."
fi

echo "测试 Landing..."
if curl -s -o /dev/null -w "%{http_code}" http://localhost | grep -q "200\|302"; then
    echo "✅ Landing 正常"
else
    echo "⏳ Landing 启动中，稍后重试..."
fi

echo ""
echo "✅ 部署完成！"
echo ""
echo "常用命令:"
echo "  查看 Pod:    kubectl get pods -n $NAMESPACE"
echo "  查看日志:    kubectl logs -f deployment/api -n $NAMESPACE"
echo "  重启 API:    kubectl rollout restart deployment/api -n $NAMESPACE"
echo "  进入容器:    kubectl exec -it deployment/api -n $NAMESPACE -- sh"
echo "  端口转发:    kubectl port-forward svc/api 3001:3001 -n $NAMESPACE"
echo ""
echo "清理部署:"
echo "  kubectl delete -k $K8S_DIR"

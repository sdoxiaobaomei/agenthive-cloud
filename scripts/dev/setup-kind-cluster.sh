#!/bin/bash
# Kind 集群创建脚本 - 用于本地 K8s 练习

set -e

CLUSTER_NAME="${CLUSTER_NAME:-agenthive}"
K8S_VERSION="${K8S_VERSION:-v1.28.0}"

echo "🚀 Kind 集群创建工具"
echo "===================="
echo "Cluster Name: $CLUSTER_NAME"
echo "K8s Version: $K8S_VERSION"
echo ""

# 检查 Kind 是否安装
if ! command -v kind &> /dev/null; then
    echo "❌ Kind 未安装，正在安装..."
    
    # 检测操作系统
    OS=$(uname -s)
    ARCH=$(uname -m)
    
    case $OS in
        Linux)
            if [ "$ARCH" = "x86_64" ]; then
                curl -Lo ./kind https://kind.sigs.k8s.io/dl/v0.20.0/kind-linux-amd64
            elif [ "$ARCH" = "aarch64" ]; then
                curl -Lo ./kind https://kind.sigs.k8s.io/dl/v0.20.0/kind-linux-arm64
            fi
            chmod +x ./kind
            sudo mv ./kind /usr/local/bin/kind
            ;;
        Darwin)
            if [ "$ARCH" = "x86_64" ]; then
                curl -Lo ./kind https://kind.sigs.k8s.io/dl/v0.20.0/kind-darwin-amd64
            elif [ "$ARCH" = "arm64" ]; then
                curl -Lo ./kind https://kind.sigs.k8s.io/dl/v0.20.0/kind-darwin-arm64
            fi
            chmod +x ./kind
            sudo mv ./kind /usr/local/bin/kind
            ;;
        MINGW*|CYGWIN*)
            # Windows - 使用 choco 或 scoop
            if command -v choco &> /dev/null; then
                choco install kind
            elif command -v scoop &> /dev/null; then
                scoop install kind
            else
                echo "请在 Windows 上手动安装 Kind:"
                echo "choco install kind"
                echo "或"
                echo "scoop install kind"
                exit 1
            fi
            ;;
    esac
    
    echo "✅ Kind 安装完成"
fi

# 检查 Docker
if ! docker info &> /dev/null; then
    echo "❌ Docker 未运行"
    exit 1
fi

echo "✅ 依赖检查通过"
echo ""

# 检查集群是否已存在
if kind get clusters | grep -q "^${CLUSTER_NAME}$"; then
    echo "⚠️  集群 '$CLUSTER_NAME' 已存在"
    read -p "是否删除并重新创建? (y/N): " confirm
    if [[ $confirm == [yY] ]]; then
        echo "🗑️  删除旧集群..."
        kind delete cluster --name "$CLUSTER_NAME"
    else
        echo "使用现有集群"
        kubectl config use-context "kind-${CLUSTER_NAME}"
        exit 0
    fi
fi

# 创建集群配置文件
echo "📝 创建集群配置..."
cat > /tmp/kind-cluster.yaml << EOF
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
name: ${CLUSTER_NAME}
nodes:
  - role: control-plane
    image: kindest/node:${K8S_VERSION}
    kubeadmConfigPatches:
      - |
        kind: InitConfiguration
        nodeRegistration:
          kubeletExtraArgs:
            node-labels: "ingress-ready=true"
    extraPortMappings:
      - containerPort: 80
        hostPort: 80
        protocol: TCP
      - containerPort: 443
        hostPort: 443
        protocol: TCP
      - containerPort: 30000
        hostPort: 30000
        protocol: TCP
      - containerPort: 30001
        hostPort: 30001
        protocol: TCP
  - role: worker
    image: kindest/node:${K8S_VERSION}
  - role: worker
    image: kindest/node:${K8S_VERSION}
EOF

# 创建集群
echo "🏗️  创建 Kind 集群 (约需 2-3 分钟)..."
kind create cluster --config /tmp/kind-cluster.yaml --wait 5m

# 设置 kubectl 上下文
kubectl config use-context "kind-${CLUSTER_NAME}"

echo ""
echo "✅ 集群创建成功!"
echo ""
echo "集群信息:"
kubectl cluster-info
echo ""
echo "节点列表:"
kubectl get nodes
echo ""

# 安装 Ingress Nginx
echo "🌐 安装 Nginx Ingress Controller..."
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml

echo "⏳ 等待 Ingress Controller 就绪..."
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=120s 2>/dev/null || echo "等待超时，请稍后手动检查"

echo ""
echo "✅ Ingress Controller 安装完成"

# 安装 Metrics Server（可选）
echo "📊 安装 Metrics Server..."
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
kubectl patch deployment metrics-server -n kube-system --type='json' -p='[{"op": "add", "path": "/spec/template/spec/containers/0/args/-", "value": "--kubelet-insecure-tls"}]'

echo ""
echo "====================================="
echo "🎉 Kind 集群 '$CLUSTER_NAME' 准备就绪!"
echo "====================================="
echo ""
echo "常用命令:"
echo "  kubectl get nodes              # 查看节点"
echo "  kubectl get pods -A            # 查看所有 Pod"
echo "  kubectl config use-context kind-${CLUSTER_NAME}  # 切换上下文"
echo "  kind delete cluster --name ${CLUSTER_NAME}       # 删除集群"
echo ""
echo "访问地址:"
echo "  http://localhost       → 集群 Ingress"
echo "  http://localhost:30000 → NodePort 服务"
echo "  http://localhost:30001 → NodePort 服务"
echo ""
echo "现在开始部署 AgentHive:"
echo "  ./scripts/deploy-local-k8s.sh"

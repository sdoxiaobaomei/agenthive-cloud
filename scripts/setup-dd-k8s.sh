#!/bin/bash
# Docker Desktop Kubernetes 设置检查脚本

echo "🔍 Docker Desktop Kubernetes 检查"
echo "==================================="
echo ""

# 检查操作系统
OS=$(uname -s)
echo "操作系统: $OS"

# 检查 Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker 未安装"
    case $OS in
        Linux)
            echo "安装命令: curl -fsSL https://get.docker.com | sh"
            ;;
        Darwin)
            echo "安装命令: brew install --cask docker"
            ;;
        MINGW*|CYGWIN*)
            echo "下载地址: https://www.docker.com/products/docker-desktop"
            echo "或: winget install Docker.DockerDesktop"
            ;;
    esac
    exit 1
fi

# 检查 Docker 运行状态
if ! docker info &> /dev/null; then
    echo "❌ Docker 未运行"
    echo "请启动 Docker Desktop"
    exit 1
fi

echo "✅ Docker 运行正常"
echo ""

# 检查 kubectl
if ! command -v kubectl &> /dev/null; then
    echo "⚠️  kubectl 未安装，建议安装:"
    case $OS in
        Linux)
            echo "  curl -LO https://dl.k8s/release/$(curl -L -s https://dl.k8s/release/stable.txt)/bin/linux/amd64/kubectl"
            ;;
        Darwin)
            echo "  brew install kubectl"
            ;;
        MINGW*|CYGWIN*)
            echo "  winget install Kubernetes.kubectl"
            ;;
    esac
else
    echo "✅ kubectl 已安装: $(kubectl version --client --short 2>/dev/null || kubectl version --client | head -1)"
fi
echo ""

# 检查 Kubernetes 是否启用
echo "🔍 检查 Kubernetes 状态..."
if kubectl cluster-info &> /dev/null; then
    echo "✅ Kubernetes 已启用并运行"
    echo ""
    echo "集群信息:"
    kubectl cluster-info | head -3
    echo ""
    echo "节点列表:"
    kubectl get nodes
    echo ""
    echo "系统 Pod:"
    kubectl get pods -n kube-system | head -6
else
    echo "❌ Kubernetes 未启用"
    echo ""
    echo "启用步骤:"
    echo "1. 打开 Docker Desktop"
    echo "2. 点击 Settings (齿轮图标)"
    echo "3. 选择 Kubernetes"
    echo "4. 勾选 'Enable Kubernetes'"
    echo "5. 点击 'Apply & Restart'"
    echo ""
    echo "等待 Kubernetes 启动完成 (约 2-5 分钟)"
    exit 1
fi

echo ""
echo "==================================="
echo "🎉 Docker Desktop K8s 准备就绪!"
echo "==================================="
echo ""
echo "常用命令:"
echo "  kubectl get nodes       # 查看节点"
echo "  kubectl get pods -A     # 查看所有 Pod"
echo "  kubectl get svc -A      # 查看所有服务"
echo ""
echo "安装图形界面工具:"
echo "  - k9s:   kubectl 的交互式终端 UI"
echo "  - Lens:  图形化管理界面"
echo ""
echo "现在开始部署 AgentHive:"
echo "  ./scripts/deploy-local-k8s.sh"

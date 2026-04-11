#!/bin/bash
# 清理本地 K8s 部署

set -e

NAMESPACE="agenthive"

echo "🧹 AgentHive 本地 K8s 清理"
echo "=========================="
echo ""

read -p "确定要删除所有资源吗？(y/N): " confirm
if [[ $confirm != [yY] ]]; then
    echo "已取消"
    exit 0
fi

echo ""
echo "🗑️  删除资源..."
kubectl delete -k k8s/local/ --ignore-not-found=true

echo ""
echo "🗑️  删除 PVC（数据卷）..."
kubectl delete pvc --all -n "$NAMESPACE" --ignore-not-found=true

echo ""
echo "🗑️  删除 Namespace..."
kubectl delete namespace "$NAMESPACE" --ignore-not-found=true

echo ""
echo "✅ 清理完成！"
echo ""

# 可选：清理镜像
read -p "是否删除本地镜像？(y/N): " clean_images
if [[ $clean_images == [yY] ]]; then
    echo "🗑️  删除镜像..."
    docker rmi agenthive/api:latest agenthive/landing:latest 2>/dev/null || true
    echo "✅ 镜像已删除"
fi

echo ""
echo "Docker Desktop 磁盘空间回收:"
echo "  Docker Desktop → Troubleshoot → Clean / Purge data"

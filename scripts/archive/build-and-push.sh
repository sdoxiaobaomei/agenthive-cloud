#!/bin/bash
# 构建并推送镜像到镜像仓库

set -e

# 配置
REGISTRY="${REGISTRY:-registry.cn-hangzhou.aliyuncs.com/agenthive}"
VERSION="${1:-latest}"
PLATFORM="${PLATFORM:-linux/amd64}"

echo "🚀 AgentHive 镜像构建工具"
echo "========================"
echo "Registry: $REGISTRY"
echo "Version: $VERSION"
echo "Platform: $PLATFORM"
echo ""

# 检查登录状态
if ! docker info | grep -q "Username"; then
    echo "⚠️  请先登录镜像仓库:"
    echo "   docker login $REGISTRY"
    exit 1
fi

# 切换到项目根目录
cd "$(dirname "$0")/.."

echo "📦 构建 Landing 镜像..."
docker build \
    -t "$REGISTRY/landing:$VERSION" \
    -f apps/landing/Dockerfile.prod \
    --platform "$PLATFORM" \
    ./apps

echo ""
echo "📦 构建 API 镜像..."
docker build \
    -t "$REGISTRY/api:$VERSION" \
    -f apps/api/Dockerfile \
    --platform "$PLATFORM" \
    ./apps/api

echo ""
echo "📤 推送镜像..."
docker push "$REGISTRY/landing:$VERSION"
docker push "$REGISTRY/api:$VERSION"

echo ""
echo "✅ 构建完成！"
echo ""
echo "镜像地址:"
echo "  Landing: $REGISTRY/landing:$VERSION"
echo "  API:     $REGISTRY/api:$VERSION"
echo ""
echo "使用方式:"
echo "  更新 k8s/base/04-api.yaml 和 k8s/base/05-landing.yaml 中的 image 字段"
echo "  然后运行: ./scripts/deploy.sh"

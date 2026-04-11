#!/bin/bash
# CI 构建脚本 - 正确处理 workspace 依赖
# 使用方式: ./scripts/build-api-ci.sh [tag]

set -e

TAG="${1:-latest}"
REGISTRY="${REGISTRY:-agenthive}"
IMAGE_NAME="${REGISTRY}/api:${TAG}"

echo "🚀 CI 构建 API 镜像"
echo "===================="
echo "镜像: $IMAGE_NAME"
echo ""

# 进入项目根目录
cd "$(dirname "$0")/.."

# 检查必要的文件
if [ ! -f "pnpm-workspace.yaml" ]; then
    echo "❌ 错误: 请在项目根目录运行此脚本"
    exit 1
fi

if [ ! -f "apps/api/package.json" ]; then
    echo "❌ 错误: 找不到 apps/api/package.json"
    exit 1
fi

if [ ! -f "apps/agent-runtime/package.json" ]; then
    echo "❌ 错误: 找不到 apps/agent-runtime/package.json"
    echo "agent-runtime 是 API 的依赖，请确保它存在"
    exit 1
fi

# 确保 lockfile 是最新的
echo "📦 检查依赖..."
if [ ! -f "pnpm-lock.yaml" ]; then
    echo "⚠️  警告: 未找到 pnpm-lock.yaml，建议运行 pnpm install 生成"
fi

# 构建镜像
echo "🔨 构建 Docker 镜像..."
docker build \
    -t "$IMAGE_NAME" \
    -f apps/api/Dockerfile.ci \
    .

# 验证构建结果
echo ""
echo "✅ 构建成功!"
echo ""
docker images "$IMAGE_NAME" --format "table {{.Repository}}:{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"

echo ""
echo "运行测试:"
echo "  docker run -p 3001:3001 --rm $IMAGE_NAME"
echo ""
echo "推送镜像:"
echo "  docker push $IMAGE_NAME"

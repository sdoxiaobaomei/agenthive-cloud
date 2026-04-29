#!/bin/bash
# API 最小化构建脚本 - 只复制必要文件
# 使用方式: ./scripts/build-api-minimal.sh [tag]

set -e

TAG="${1:-latest}"
IMAGE_NAME="agenthive/api:${TAG}"

echo "🚀 最小化构建 API 镜像"
echo "======================"
echo "镜像: $IMAGE_NAME"
echo ""

# 进入项目根目录
cd "$(dirname "$0")/.."

# 检查必要文件是否存在
echo "🔍 检查必要文件..."

required_files=(
    "package.json"
    "pnpm-workspace.yaml"
    "packages/types/package.json"
    "apps/agent-runtime/package.json"
    "apps/api/package.json"
    "apps/api/src"
)

for file in "${required_files[@]}"; do
    if [ ! -e "$file" ]; then
        echo "❌ 错误: 找不到 $file"
        exit 1
    fi
done

echo "✅ 所有必要文件存在"
echo ""

# 构建镜像
echo "🔨 构建 Docker 镜像..."
docker build \
    -t "$IMAGE_NAME" \
    -f apps/api/Dockerfile.minimal \
    .

echo ""
echo "✅ 构建成功!"
echo ""
docker images "$IMAGE_NAME" --format "table {{.Repository}}:{{.Tag}}\t{{.Size}}"
echo ""
echo "运行测试:"
echo "  docker run -p 3001:3001 --rm $IMAGE_NAME"

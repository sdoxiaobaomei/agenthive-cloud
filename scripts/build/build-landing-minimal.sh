#!/bin/bash
# Landing 最小化构建脚本
# 使用方式: ./scripts/build-landing-minimal.sh [tag]

set -e

TAG="${1:-latest}"
IMAGE_NAME="agenthive/landing:${TAG}"

echo "🚀 最小化构建 Landing 镜像"
echo "========================="
echo "镜像: $IMAGE_NAME"
echo ""

cd "$(dirname "$0")/.."

echo "🔨 构建 Docker 镜像..."
docker build \
    -t "$IMAGE_NAME" \
    -f apps/landing/Dockerfile.minimal \
    .

echo ""
echo "✅ 构建成功!"
docker images "$IMAGE_NAME" --format "table {{.Repository}}:{{.Tag}}\t{{.Size}}"

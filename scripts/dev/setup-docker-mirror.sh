#!/bin/bash
# 配置阿里云 Docker 镜像加速器
set -e

MIRROR_URL="https://crpi-89ktoa4wv8sjcdow.mirror.aliyuncs.com"
CONFIG_FILE="/etc/docker/daemon.json"

mkdir -p /etc/docker
cat > "$CONFIG_FILE" << EOF
{
  "registry-mirrors": ["$MIRROR_URL"]
}
EOF

systemctl daemon-reload
systemctl restart docker

echo "Docker 镜像加速器配置完成"
docker info 2>/dev/null | grep -A3 "Registry Mirrors" || true

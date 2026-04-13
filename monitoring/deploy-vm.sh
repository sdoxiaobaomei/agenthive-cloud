#!/bin/bash
# AgentHive 监控系统 - VM 部署脚本
# 用法: ./deploy-vm.sh [版本号]
#
# 环境变量覆盖（可选）:
#   REGISTRY=your-registry.cn   NAMESPACE=your-namespace   ./deploy-vm.sh v1.0.0

set -e

# 配置（可通过环境变量覆盖）
REGISTRY=${REGISTRY:-registry.cn-hangzhou.aliyuncs.com}
NAMESPACE=${NAMESPACE:-agenthive}
VERSION=${1:-latest}
NETWORK_NAME=${NETWORK_NAME:-monitoring}

echo "=============================================="
echo "AgentHive 监控系统部署"
echo "版本: $VERSION"
echo "仓库: $REGISTRY/$NAMESPACE"
echo "网络: $NETWORK_NAME"
echo "=============================================="

# 检查 Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker 未安装，请先安装 Docker"
    exit 1
fi

# 登录镜像仓库（可选）
read -p "是否需要登录镜像仓库? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    read -p "请输入用户名: " USERNAME
    read -s -p "请输入密码: " PASSWORD
    echo
    echo "docker login --username=$USERNAME $REGISTRY"
    echo "$PASSWORD" | docker login --username=$USERNAME --password-stdin $REGISTRY
fi

# ============================================
# 服务配置区
# 新增 exporter 只需在这里添加一个元素
# ============================================
declare -a SERVICES=(
  # 格式: "服务名|镜像名|端口|额外docker参数"
  "prometheus|prometheus|9090|"
  "grafana|grafana|3000|"
  "node-exporter|node-exporter|9100|--pid host -v /proc:/host/proc:ro -v /sys:/host/sys:ro -v /:/rootfs:ro"
  # 示例：如需扩展 redis-exporter，取消下行注释并修改 target
  # "redis-exporter|redis-exporter|9121|-e REDIS_ADDR=redis://redis:6379"
)

# 健康检查端口映射（服务名 -> 本地检查端口）
declare -A HEALTH_PORTS=(
  [prometheus]=9090
  [grafana]=3000
  [node-exporter]=9100
)

# 健康检查路径映射（服务名 -> 检查路径）
declare -A HEALTH_PATHS=(
  [prometheus]="/-/healthy"
  [grafana]="/api/health"
  [node-exporter]="/"
)

# ============================================
# 拉取镜像
# ============================================
echo ""
echo "=== 拉取镜像 ==="
for svc_def in "${SERVICES[@]}"; do
    IFS='|' read -r svc_name image_name port extra <<< "$svc_def"
    echo "  → $image_name:$VERSION"
    docker pull $REGISTRY/$NAMESPACE/$image_name:$VERSION
done

# ============================================
# 停止旧容器
# ============================================
echo ""
echo "=== 停止旧容器 ==="
for svc_def in "${SERVICES[@]}"; do
    IFS='|' read -r svc_name image_name port extra <<< "$svc_def"
    docker stop agenthive-$svc_name 2>/dev/null || true
    docker rm agenthive-$svc_name 2>/dev/null || true
done

# ============================================
# 创建数据目录
# ============================================
echo ""
echo "=== 创建数据目录 ==="
mkdir -p /opt/agenthive-monitoring/data/prometheus
mkdir -p /opt/agenthive-monitoring/data/grafana

# ============================================
# 创建 Docker 自定义网络
# ============================================
echo ""
echo "=== 创建 Docker 网络 ==="
docker network create $NETWORK_NAME 2>/dev/null || echo "网络 $NETWORK_NAME 已存在"

# ============================================
# 启动容器
# ============================================
for svc_def in "${SERVICES[@]}"; do
    IFS='|' read -r svc_name image_name port extra <<< "$svc_def"
    echo ""
    echo "=== 启动 $svc_name ==="

    # 服务特定挂载/环境变量
    local_volumes=""
    local_env=""
    if [ "$svc_name" = "prometheus" ]; then
        local_volumes="-v /opt/agenthive-monitoring/data/prometheus:/prometheus"
    elif [ "$svc_name" = "grafana" ]; then
        read -p "请输入 Grafana 管理员密码 (默认: admin123): " GRAFANA_PASS
        GRAFANA_PASS=${GRAFANA_PASS:-admin123}
        local_volumes="-v /opt/agenthive-monitoring/data/grafana:/var/lib/grafana"
        local_env="-e GF_SECURITY_ADMIN_USER=admin -e GF_SECURITY_ADMIN_PASSWORD=$GRAFANA_PASS"
    fi

    # 构建 docker run 命令（注意：空格分隔的 extra 参数需要 eval 或数组展开）
    # 这里用 bash 数组方式安全处理
    read -ra EXTRA_ARGS <<< "$extra"

    docker run -d \
      --name agenthive-$svc_name \
      --restart always \
      --network $NETWORK_NAME \
      -p $port:$port \
      $local_volumes \
      $local_env \
      "${EXTRA_ARGS[@]}" \
      $REGISTRY/$NAMESPACE/$image_name:$VERSION
done

# ============================================
# 等待服务启动
# ============================================
echo ""
echo "=== 等待服务启动 ==="
sleep 5

# ============================================
# 检查状态
# ============================================
echo ""
echo "=== 容器状态 ==="
docker ps --filter "name=agenthive-" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# ============================================
# 健康检查
# ============================================
echo ""
echo "=== 健康检查 ==="
for svc_def in "${SERVICES[@]}"; do
    IFS='|' read -r svc_name image_name port extra <<< "$svc_def"
    check_port="${HEALTH_PORTS[$svc_name]}"
    check_path="${HEALTH_PATHS[$svc_name]}"
    echo -n "$svc_name: "
    curl -s -o /dev/null -w "%{http_code}" "http://localhost:$check_port$check_path" || echo "未就绪"
done

# ============================================
# 部署完成信息
# ============================================
IP=$(hostname -I | awk '{print $1}')

echo ""
echo "=============================================="
echo "🎉 部署完成！"
echo "=============================================="
echo "访问地址:"
echo "  Grafana:      http://$IP:3000"
if [ -n "${GRAFANA_PASS:-}" ]; then
    echo "                管理员密码: $GRAFANA_PASS"
fi
echo "  Prometheus:   http://$IP:9090"
echo "=============================================="
echo "常用命令:"
echo "  查看日志:     docker logs -f agenthive-prometheus"
echo "  停止服务:     docker stop \$(docker ps -q --filter name=agenthive-)"
echo "  重启服务:     docker restart agenthive-prometheus"
echo "=============================================="

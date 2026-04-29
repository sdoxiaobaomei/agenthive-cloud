#!/bin/bash
# =============================================================================
# Docker 磁盘监控与告警脚本 (TICKET-P0-NEW-001)
# =============================================================================
# 用途：监控 Docker 数据目录磁盘使用率，超阈值时告警并自动清理
# 部署方式：
#   - K8s: CronJob 每 5 分钟执行（或 DaemonSet 常驻监控）
#   - Docker Compose: 宿主机 cron 定时任务（crontab -e）
#     */5 * * * * /path/to/scripts/disk-monitor.sh
# =============================================================================

set -euo pipefail

# 配置项（可通过环境变量覆盖）
DOCKER_DATA_DIR="${DOCKER_DATA_DIR:-/var/lib/docker}"
WARN_THRESHOLD="${DISK_WARN_THRESHOLD:-80}"
CRIT_THRESHOLD="${DISK_CRIT_THRESHOLD:-90}"
WEBHOOK_URL="${DISK_WEBHOOK_URL:-}"
HOSTNAME="${HOSTNAME:-$(hostname)}"

# 获取磁盘使用率（%）
get_usage() {
    df -h "$DOCKER_DATA_DIR" | awk 'NR==2 {print $5}' | tr -d '%'
}

# 发送告警（支持钉钉 webhook）
send_alert() {
    local level="$1"
    local message="$2"
    local timestamp
    timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    echo "[$timestamp] [$level] $message"

    if [ -n "$WEBHOOK_URL" ]; then
        curl -s -X POST "$WEBHOOK_URL" \
            -H "Content-Type: application/json" \
            -d "{\"msgtype\":\"text\",\"text\":{\"content\":\"[AgentHive Disk Monitor] [$level] $message\"}}" \
            >/dev/null 2>&1 || true
    fi
}

# 自动清理 Docker 资源
auto_cleanup() {
    echo "执行自动清理..."

    # 清理已停止容器
    docker container prune -f >/dev/null 2>&1 || true

    # 清理未使用镜像
    docker image prune -af >/dev/null 2>&1 || true

    # 清理未使用卷（谨慎：确保没有重要数据）
    # docker volume prune -f >/dev/null 2>&1 || true

    # 清理构建缓存
    docker builder prune -f >/dev/null 2>&1 || true

    echo "自动清理完成"
}

# 主逻辑
main() {
    local usage
    usage=$(get_usage)

    if [ "$usage" -ge "$CRIT_THRESHOLD" ]; then
        send_alert "CRITICAL" "服务器 $HOSTNAME Docker 数据目录磁盘使用率 ${usage}%（超过 ${CRIT_THRESHOLD}%），即将执行自动清理！"
        auto_cleanup

        # 清理后再次检查
        sleep 2
        usage=$(get_usage)
        if [ "$usage" -ge "$CRIT_THRESHOLD" ]; then
            send_alert "CRITICAL" "清理后磁盘使用率仍 ${usage}%，请立即人工介入！"
            exit 2
        else
            send_alert "INFO" "清理后磁盘使用率降至 ${usage}%"
        fi

    elif [ "$usage" -ge "$WARN_THRESHOLD" ]; then
        send_alert "WARNING" "服务器 $HOSTNAME Docker 数据目录磁盘使用率 ${usage}%（超过 ${WARN_THRESHOLD}%），请关注。"
        exit 1
    else
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] [INFO] 磁盘使用率 ${usage}%，正常。"
    fi
}

main "$@"

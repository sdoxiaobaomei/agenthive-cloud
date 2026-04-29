#!/bin/bash
# =============================================================================
# PostgreSQL 单库恢复脚本 (TICKET-P0-005)
# =============================================================================
# 用途：从备份文件恢复指定数据库到指定时间点
# 用法：
#   ./restore-postgres.sh <dbname> <backup_date> [target_host] [target_port]
# 示例：
#   ./restore-postgres.sh agenthive 20260427_020000 localhost 5432
# =============================================================================

set -euo pipefail

DB_NAME="${1:-}"
BACKUP_DATE="${2:-}"
TARGET_HOST="${3:-localhost}"
TARGET_PORT="${4:-5432}"

# 配置（通过环境变量覆盖）
BACKUP_DIR="${BACKUP_DIR:-/var/backups/postgres}"
ENCRYPTION_KEY="${BACKUP_ENCRYPTION_KEY:-}"
DB_USER="${DB_USER:-agenthive}"
DB_PASSWORD="${DB_PASSWORD:-dev}"

MINIO_ENDPOINT="${MINIO_ENDPOINT:-}"
MINIO_BUCKET="${MINIO_BUCKET:-agenthive-backups}"
MINIO_ACCESS_KEY="${MINIO_ACCESS_KEY:-}"
MINIO_SECRET_KEY="${MINIO_SECRET_KEY:-}"

if [ -z "$DB_NAME" ] || [ -z "$BACKUP_DATE" ]; then
    echo "用法: $0 <dbname> <backup_date> [target_host] [target_port]"
    echo "  backup_date 格式: YYYYMMDD_HHMMSS（如 20260427_020000）"
    exit 1
fi

echo "恢复数据库: $DB_NAME"
echo "备份日期: $BACKUP_DATE"
echo "目标: $TARGET_HOST:$TARGET_PORT"

# 构建备份文件名
local_enc="$BACKUP_DIR/${DB_NAME}_${BACKUP_DATE}.sql.gz.enc"
local_gz="$BACKUP_DIR/${DB_NAME}_${BACKUP_DATE}.sql.gz"

# 如果本地不存在，尝试从 MinIO 下载
if [ ! -f "$local_enc" ] && [ ! -f "$local_gz" ]; then
    echo "本地备份不存在，尝试从 MinIO 下载..."
    if [ -z "$MINIO_ENDPOINT" ] || [ -z "$MINIO_ACCESS_KEY" ]; then
        echo "ERROR: MinIO 未配置，无法下载备份"
        exit 1
    fi

    if command -v mc >/dev/null 2>&1; then
        mc alias set local "$MINIO_ENDPOINT" "$MINIO_ACCESS_KEY" "$MINIO_SECRET_KEY" >/dev/null 2>&1 || true
        mc cp "local/$MINIO_BUCKET/postgres/$DB_NAME/${DB_NAME}_${BACKUP_DATE}.sql.gz.enc" "$BACKUP_DIR/" >/dev/null 2>&1 || \
        mc cp "local/$MINIO_BUCKET/postgres/$DB_NAME/${DB_NAME}_${BACKUP_DATE}.sql.gz" "$BACKUP_DIR/" >/dev/null 2>&1 || true
    elif command -v aws >/dev/null 2>&1; then
        AWS_ACCESS_KEY_ID="$MINIO_ACCESS_KEY" \
        AWS_SECRET_ACCESS_KEY="$MINIO_SECRET_KEY" \
        aws --endpoint-url "$MINIO_ENDPOINT" s3 cp "s3://$MINIO_BUCKET/postgres/$DB_NAME/${DB_NAME}_${BACKUP_DATE}.sql.gz.enc" "$BACKUP_DIR/" >/dev/null 2>&1 || \
        aws --endpoint-url "$MINIO_ENDPOINT" s3 cp "s3://$MINIO_BUCKET/postgres/$DB_NAME/${DB_NAME}_${BACKUP_DATE}.sql.gz" "$BACKUP_DIR/" >/dev/null 2>&1 || true
    fi
fi

# 确定备份文件路径
if [ -f "$local_enc" ]; then
    backup_file="$local_enc"
elif [ -f "$local_gz" ]; then
    backup_file="$local_gz"
else
    echo "ERROR: 找不到备份文件: $local_enc 或 $local_gz"
    exit 1
fi

echo "使用备份文件: $backup_file"

# 解密（如果需要）
restore_input="$backup_file"
if [[ "$backup_file" == *.enc ]]; then
    if [ -z "$ENCRYPTION_KEY" ] || [ "$ENCRYPTION_KEY" == "none" ]; then
        echo "ERROR: 备份已加密，但 BACKUP_ENCRYPTION_KEY 未设置"
        exit 1
    fi
    restore_input="/tmp/${DB_NAME}_${BACKUP_DATE}.sql.gz"
    openssl enc -aes-256-cbc -d -salt \
        -in "$backup_file" -out "$restore_input" \
        -pass pass:"$ENCRYPTION_KEY"
    echo "解密完成"
fi

# 确认恢复（生产环境谨慎操作）
echo ""
echo "⚠️  警告：这将覆盖目标数据库 $DB_NAME@$TARGET_HOST:$TARGET_PORT"
read -p "确认恢复? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "已取消"
    rm -f "$restore_input"
    exit 0
fi

# 创建目标数据库（如果不存在）
PGPASSWORD="$DB_PASSWORD" psql \
    -h "$TARGET_HOST" -p "$TARGET_PORT" -U "$DB_USER" postgres \
    -c "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1 || \
PGPASSWORD="$DB_PASSWORD" psql \
    -h "$TARGET_HOST" -p "$TARGET_PORT" -U "$DB_USER" postgres \
    -c "CREATE DATABASE $DB_NAME;"

# 恢复数据
gunzip -c "$restore_input" | PGPASSWORD="$DB_PASSWORD" psql \
    -h "$TARGET_HOST" -p "$TARGET_PORT" -U "$DB_USER" "$DB_NAME"

# 清理临时文件
rm -f "$restore_input"

echo "✅ 数据库 $DB_NAME 恢复完成"

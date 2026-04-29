#!/bin/bash
# =============================================================================
# PostgreSQL 自动备份脚本 (TICKET-P0-005)
# =============================================================================
# 用途：对所有 PostgreSQL 数据库执行逻辑备份、压缩、加密并上传 MinIO
# 执行方式：
#   - Docker: 宿主机 crontab 每日 02:00 执行
#     0 2 * * * /path/to/scripts/backup-postgres.sh >> /var/log/pg-backup.log 2>&1
#   - K8s: CronJob 调用此脚本（需挂载备份密钥 Secret）
# =============================================================================

set -euo pipefail

# 配置（通过环境变量覆盖）
BACKUP_DIR="${BACKUP_DIR:-/var/backups/postgres}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"
ENCRYPTION_KEY="${BACKUP_ENCRYPTION_KEY:-}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# MinIO / S3 配置
MINIO_ENDPOINT="${MINIO_ENDPOINT:-http://localhost:9000}"
MINIO_BUCKET="${MINIO_BUCKET:-agenthive-backups}"
MINIO_ACCESS_KEY="${MINIO_ACCESS_KEY:-}"
MINIO_SECRET_KEY="${MINIO_SECRET_KEY:-}"

# 数据库列表（Docker Compose 环境）
# 格式："host:port:user:password:dbname"
DB_LIST="${BACKUP_DB_LIST:-
localhost:5432:agenthive:${DB_PASSWORD:-dev}:agenthive
localhost:5433:agenthive:${DB_PASSWORD:-dev}:auth_db
localhost:5433:agenthive:${DB_PASSWORD:-dev}:user_db
localhost:5433:agenthive:${DB_PASSWORD:-dev}:payment_db
localhost:5433:agenthive:${DB_PASSWORD:-dev}:order_db
localhost:5433:agenthive:${DB_PASSWORD:-dev}:cart_db
localhost:5433:agenthive:${DB_PASSWORD:-dev}:logistics_db
}"

# 创建备份目录
mkdir -p "$BACKUP_DIR"

echo "[$(date)] PostgreSQL 备份开始..."

# 检查加密密钥
if [ -z "$ENCRYPTION_KEY" ]; then
    echo "ERROR: BACKUP_ENCRYPTION_KEY 未设置，备份将不加密！"
    echo "如需不加密备份，请显式设置 BACKUP_ENCRYPTION_KEY=none"
    exit 1
fi

# 遍历数据库列表
IFS=$'\n'
for db_entry in $DB_LIST; do
    # 跳过空行
    [ -z "$db_entry" ] && continue

    IFS=':' read -r host port user password dbname <<< "$db_entry"

    echo "备份数据库: $dbname@$host:$port"

    backup_file="$BACKUP_DIR/${dbname}_${TIMESTAMP}.sql"
    gzip_file="${backup_file}.gz"
    enc_file="${gzip_file}.enc"

    # 1. pg_dump
    PGPASSWORD="$password" pg_dump \
        -h "$host" -p "$port" -U "$user" \
        --no-owner --no-privileges \
        "$dbname" > "$backup_file"

    # 2. gzip 压缩
    gzip -f "$backup_file"

    # 3. AES-256 加密（如果密钥不为 none）
    if [ "$ENCRYPTION_KEY" != "none" ]; then
        openssl enc -aes-256-cbc -salt \
            -in "$gzip_file" -out "$enc_file" \
            -pass pass:"$ENCRYPTION_KEY"
        rm -f "$gzip_file"
        upload_file="$enc_file"
    else
        upload_file="$gzip_file"
    fi

    echo "  本地备份: $upload_file"

    # 4. 上传 MinIO（如果配置了）
    if [ -n "$MINIO_ACCESS_KEY" ] && [ -n "$MINIO_SECRET_KEY" ]; then
        if command -v mc >/dev/null 2>&1; then
            # 使用 MinIO Client
            mc alias set local "$MINIO_ENDPOINT" "$MINIO_ACCESS_KEY" "$MINIO_SECRET_KEY" >/dev/null 2>&1 || true
            mc cp "$upload_file" "local/$MINIO_BUCKET/postgres/$dbname/" >/dev/null 2>&1
            echo "  已上传至 MinIO: $MINIO_BUCKET/postgres/$dbname/"
        elif command -v aws >/dev/null 2>&1; then
            # 使用 AWS CLI（兼容 S3）
            AWS_ACCESS_KEY_ID="$MINIO_ACCESS_KEY" \
            AWS_SECRET_ACCESS_KEY="$MINIO_SECRET_KEY" \
            aws --endpoint-url "$MINIO_ENDPOINT" s3 cp "$upload_file" "s3://$MINIO_BUCKET/postgres/$dbname/" >/dev/null 2>&1
            echo "  已上传至 S3/MinIO: $MINIO_BUCKET/postgres/$dbname/"
        else
            echo "  WARN: 未安装 mc 或 aws CLI，跳过上传"
        fi
    fi
done

# 5. 清理旧备份（本地）
echo "清理 $RETENTION_DAYS 天前的本地备份..."
find "$BACKUP_DIR" -name "*.sql.gz.enc" -mtime +$RETENTION_DAYS -delete
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +$RETENTION_DAYS -delete

# 6. 清理 MinIO 旧备份（如果配置了 mc）
if command -v mc >/dev/null 2>&1 && [ -n "$MINIO_ACCESS_KEY" ]; then
    echo "清理 MinIO 旧备份..."
    mc alias set local "$MINIO_ENDPOINT" "$MINIO_ACCESS_KEY" "$MINIO_SECRET_KEY" >/dev/null 2>&1 || true
    for db_entry in $DB_LIST; do
        [ -z "$db_entry" ] && continue
        IFS=':' read -r _ _ _ _ dbname <<< "$db_entry"
        # MinIO 没有按日期删除的内置命令，需要列出后删除
        mc rm --recursive --force --older-than "${RETENTION_DAYS}d" "local/$MINIO_BUCKET/postgres/$dbname/" >/dev/null 2>&1 || true
    done
fi

echo "[$(date)] PostgreSQL 备份完成。"

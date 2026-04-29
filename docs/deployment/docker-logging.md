# Docker 日志轮转与磁盘监控

> **关联 Ticket**: TICKET-P0-NEW-001  
> **目标**: 防止 Docker 容器日志占满磁盘导致服务崩溃

---

## 配置概览

所有 Docker Compose 环境中的服务已统一配置 `json-file` 日志驱动，限制单容器日志大小：

```yaml
logging:
  driver: "json-file"
  options:
    max-size: "100m"
    max-file: "5"
    compress: "true"
```

### 空间占用估算

| 环境 | 服务数 | 单容器上限 | 理论总计 |
|------|--------|-----------|---------|
| **Production** | 17 | 500M | ~8.5G |
| **Development** | 19 | 500M | ~9.5G |
| **Demo** | 14 | 500M | ~7.0G |

> 实际占用通常远低于理论值（日志压缩率约 70%，且并非所有服务都会写满）。

---

## 快速验证

```bash
# 查看某个容器的日志文件大小
ls -lh /var/lib/docker/containers/<container-id>/*-json.log

# 查看所有容器日志总大小
docker system df -v | grep -A100 "CONTAINER ID"

# 实时查看日志（带轮转后仍然有效）
docker logs -f agenthive-api-prod
```

---

## 磁盘监控脚本

### 部署方式

```bash
# 1. 赋予执行权限
chmod +x scripts/disk-monitor.sh

# 2. 配置环境变量（可选）
export DISK_WARN_THRESHOLD=80
export DISK_CRIT_THRESHOLD=90
export DISK_WEBHOOK_URL="https://oapi.dingtalk.com/robot/send?access_token=xxx"

# 3. 手动测试
./scripts/disk-monitor.sh

# 4. 添加到 crontab（每 5 分钟执行）
crontab -e
# 添加：
*/5 * * * * cd /path/to/agenthive-cloud && ./scripts/disk-monitor.sh >> /var/log/disk-monitor.log 2>&1
```

### 告警阈值

| 级别 | 阈值 | 行为 |
|------|------|------|
| **WARNING** | 使用率 ≥ 80% | 发送钉钉/企业微信告警 |
| **CRITICAL** | 使用率 ≥ 90% | 告警 + 自动清理已停止容器和未使用镜像 |

### 自动清理内容

- `docker container prune -f` — 已停止容器
- `docker image prune -af` — 未使用镜像
- `docker builder prune -f` — 构建缓存

> ⚠️ 不会自动清理 `docker volume`，避免误删持久化数据。

---

## 故障排查

| 现象 | 原因 | 解决 |
|------|------|------|
| 日志文件仍超过 100M | 配置未生效（旧容器） | 重启容器使 logging 配置生效：`docker compose restart` |
| 磁盘监控脚本无 webhook 通知 | `DISK_WEBHOOK_URL` 未设置 | 配置环境变量或检查 webhook URL 有效性 |
| 清理后磁盘仍满 | 持久化卷（volume）占用大 | 手动检查 `docker volume ls` 和 `du -sh /var/lib/docker/volumes/*` |

---

## 回滚

如需移除日志限制（仅限应急调试）：

```bash
# 临时移除单个服务的日志限制
docker run --log-driver json-file --log-opt max-size=10g ...

# 或修改 docker-compose.yml 注释掉 logging 块后重启
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d
```

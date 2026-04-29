# Watchtower 自动镜像更新

> **关联 Ticket**: TICKET-P0-NEW-002  
> **目标**: CI/CD 推送新镜像后，自动检测并安全重启业务容器  

---

## 架构概览

```
┌─────────────┐     ┌─────────────┐     ┌─────────────────┐
│   CI/CD     │────▶│  Image      │────▶│  Watchtower     │
│  (GitHub    │     │  Registry   │     │  (自动检测更新)  │
│   Actions)  │     │  (ACR)      │     └────────┬────────┘
└─────────────┘     └─────────────┘              │
                                                  ▼
                                         ┌─────────────────┐
                                         │  Business Pods  │
                                         │  api/landing/   │
                                         │  java-*         │
                                         └─────────────────┘
```

---

## 配置说明

### Watchtower 服务配置

```yaml
watchtower:
  image: containrrr/watchtower:latest
  container_name: agenthive-watchtower
  volumes:
    - /var/run/docker.sock:/var/run/docker.sock
  environment:
    - WATCHTOWER_POLL_INTERVAL=300      # 每 5 分钟检测一次
    - WATCHTOWER_LABEL_ENABLE=true       # 仅监控带 label 的容器
    - WATCHTOWER_CLEANUP=true            # 更新后删除旧镜像
    - WATCHTOWER_INCLUDE_STOPPED=true    # 包含已停止容器
    - WATCHTOWER_REVIVE_STOPPED=true     # 检测到更新后启动已停止容器
    - WATCHTOWER_NOTIFICATIONS=webhook   # Webhook 通知
    - WATCHTOWER_NOTIFICATION_WEBHOOK_URL=${WATCHTOWER_WEBHOOK_URL}
  command: --label-enable
  restart: unless-stopped
```

### 受监控的业务服务

以下服务已添加 `com.centurylinklabs.watchtower.enable=true` label，允许自动更新：

| 服务 | 说明 |
|------|------|
| `api` | Node.js API 服务 |
| `landing` | Nuxt 3 前端服务 |
| `java-gateway` | Java Gateway 微服务 |
| `java-auth` | Java 认证服务 |
| `java-user` | Java 用户服务 |
| `java-payment` | Java 支付服务 |
| `java-order` | Java 订单服务 |
| `java-cart` | Java 购物车服务 |
| `java-logistics` | Java 物流服务 |

### 不受监控的基础设施服务

以下服务**未添加 label**，Watchtower 不会自动更新，避免数据中断：

- `nginx`（统一入口，手动控制）
- `nacos`（配置中心）
- `rabbitmq`（消息队列）
- `prometheus`, `grafana`, `tempo`, `loki`, `otel-collector`（监控栈）

---

## 快速开始

### 1. 配置 Webhook（可选）

```bash
# .env.prod
WATCHTOWER_WEBHOOK_URL=https://oapi.dingtalk.com/robot/send?access_token=xxx
```

### 2. 启动 Watchtower

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d watchtower
```

### 3. 验证监控列表

```bash
# 查看 Watchtower 识别的监控目标
docker logs -f agenthive-watchtower

# 预期输出：
# Found 9 containers to watch
# Starting Watchtower and scheduling first run: 2026-04-27 02:00:00 +0000 UTC
```

---

## 测试自动更新

```bash
# 1. 手动构建并推送一个测试镜像
docker build -t crpi-xxx.cn-beijing.personal.cr.aliyuncs.com/namespace-alpha/api:test-watchtower ./apps/api
docker push crpi-xxx.cn-beijing.personal.cr.aliyuncs.com/namespace-alpha/api:test-watchtower

# 2. 修改 docker-compose.prod.yml 中 api 服务的镜像 tag 为 test-watchtower
# 3. 重新部署 api
docker compose -f docker-compose.prod.yml up -d api

# 4. 在另一终端观察 Watchtower 日志
docker logs -f agenthive-watchtower

# 5. 预期行为（5 分钟内）：
# - Watchtower 检测到 registry 有新镜像
# - 拉取新镜像
# - 停止旧 api 容器
# - 启动新 api 容器（等待 healthcheck 通过）
# - 发送 webhook 通知
```

---

## 手动触发更新

```bash
# 立即执行一次检测（不等待轮询间隔）
docker exec agenthive-watchtower /watchtower --run-once
```

---

## 故障排查

| 现象 | 原因 | 解决 |
|------|------|------|
| Watchtower 未更新任何容器 | 容器未添加 label | 确认 `labels: - "com.centurylinklabs.watchtower.enable=true"` |
| 更新后服务不可用 | 新镜像 healthcheck 失败 | 检查镜像质量，Watchtower 会自动回滚到上一版本 |
| 未收到 webhook 通知 | `WATCHTOWER_WEBHOOK_URL` 未配置或无效 | 检查环境变量和 webhook URL |
| 镜像拉取失败 | 镜像仓库认证过期 | 执行 `docker login` 重新认证 |

---

## 回滚

如需停止自动更新：

```bash
# 停止并删除 Watchtower
docker compose -f docker-compose.prod.yml stop watchtower
docker compose -f docker-compose.prod.yml rm watchtower

# 如需恢复手动更新模式，重新启动 Watchtower 即可
docker compose -f docker-compose.prod.yml up -d watchtower
```

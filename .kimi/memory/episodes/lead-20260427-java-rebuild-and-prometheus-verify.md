# Episode: Java 全服务镜像重建 + Prometheus 端到端验证

**Date**: 2026-04-27
**Trigger**: User asked to "continue task" — unblock P0-A and 2.2.2
**Scope**: Rebuild all 7 Java Docker images, verify actuator + micrometer + prometheus, fix monitoring stack

## What Happened

### Phase 1: Diagnostic (解除 Maven 阻塞)
1. **Maven 环境确认**: `C:\tools\apache-maven-3.9.15\bin\mvn.cmd -v` 验证通过 (Apache Maven 3.9.15 + Java 21)。之前 episode 误判为"Maven 缺失"，实际是 PowerShell 不能直接调用无 `.cmd` 后缀的 `mvn`。

2. **重新诊断 actuator 问题**:
   - order-service (8084) 和 user-service (8082) 的 `actuator/health` 返回 **500**（不是 404）
   - 日志显示 `NoResourceFoundException: No static resource actuator/health` — 说明 actuator 端点根本不存在
   - 旧镜像的 `GlobalResponseAdvice` 把 actuator 404 包装成了 HTTP 200 + 500 JSON，导致 **Docker healthcheck 被欺骗**（wget exit code 0）
   - 这是一个严重问题：统一响应包装机制导致 healthcheck 完全失效

### Phase 2: 编译与重建 (Maven → Docker Build)
3. **Maven 全量编译**: `mvn clean package -DskipTests` 成功，生成 7 个服务的最新 jar（包含 actuator + micrometer-registry-prometheus）

4. **分批次 Docker rebuild**:
   - **Batch 1**: user-service, order-service — 最紧急（缺少 actuator 依赖）
   - **Batch 2**: gateway-service, cart-service, logistics-service — 旧镜像，GlobalResponseAdvice 未修复
   - **Batch 3**: auth-service, payment-service — 2 小时前 rebuild，但缺少 micrometer-registry-prometheus jar

5. **Redis 密码传递修复**:
   - 发现 `docker compose` 未加载 `.env.dev`，导致 `REDIS_PASSWORD` 为空
   - 所有 Java 服务 `SPRING_DATA_REDIS_PASSWORD=${REDIS_PASSWORD}` → 空值 → Redis AUTH 失败 → actuator/health DOWN
   - **Fix**: 所有 `docker compose` 命令追加 `--env-file .env.dev`

### Phase 3: 验证
6. **Actuator 验证** (全部 7/7 UP):
   | 服务 | Health | Prometheus | 备注 |
   |------|--------|------------|------|
   | gateway | UP | OK | Discovery Client UNKNOWN (expected, gateway disables discovery) |
   | auth | UP | OK | — |
   | user | UP | OK | — |
   | payment | UP | OK | — |
   | order | UP | OK | — |
   | cart | UP | OK | — |
   | logistics | UP | OK | — |

7. **Monitoring Stack 启动与修复**:
   - Grafana Dockerfile COPY 路径错误 (`grafana/provisioning/...` 应为 `provisioning/...`，因为 build context 已是 `./grafana`)
   - `agenthive-dev` 网络 external 名称不匹配：`agenthive-cloud_agenthive-dev` vs `agenthive-dev`
   - **Fix**: 指定外部网络名 `name: agenthive-cloud_agenthive-dev`
   - Prometheus targets: **7/7 java-* jobs UP**

8. **Git Commit**: `e7bc81a` — 92 files changed, 4803 insertions, 269 deletions

## Key Decisions

- **PowerShell `mvn` 调用陷阱**: Windows 下 `where mvn` 能找到目录，但 PowerShell 执行 `mvn` 失败（无 `.cmd` 后缀）。必须使用 `mvn.cmd` 或完整路径。已记录为教训。
- **Docker healthcheck 被 GlobalResponseAdvice 欺骗**: 当 actuator 404 被包装成 HTTP 200 + JSON 500 时，wget 返回 exit code 0，Docker 标记 healthy。这在旧镜像上造成了严重的健康检查盲区。修复后的 GlobalResponseAdvice 添加了 `path.startsWith("/actuator")` early return。
- **分批次 rebuild 策略**: 优先 rebuild 完全缺失 actuator 的服务 (user/order)，然后 rebuild 有 actuator 但缺 micrometer 的服务，最后 rebuild 部分更新的服务 (auth/payment)。避免一次性重建全部 7 个服务的资源争抢。

## Metrics

| Metric | Before | After |
|--------|--------|-------|
| Java services actuator UP | 3/7 (gateway, cart, logistics 有 actuator 但缺 prometheus) | **7/7** |
| Prometheus scrape targets up | 0/7 (prometheus.yml 注释了 targets) | **7/7** |
| Docker images rebuilt | 0 | **7** |
| Maven build time | — | ~2 min (9 modules) |
| Monitoring stack | Not running | **Running** (Prometheus + Grafana + Tempo + Loki + OTel) |
| Git working tree uncommitted | 32 files | **0** |

## Follow-up

- [ ] Grafana dashboard JSON 验证 (`system-monitor.json` 内容正确性)
- [ ] 0.3.4 任务崩溃隔离混沌测试 (`kill -9` 消费者)
- [ ] 0.4.1 移除 Java 配置中所有默认密码/Secret fallback
- [ ] Phase 1 启动决策：code-service 存储后端 (MinIO)、LLM Gateway 方案
- [ ] 考虑在 `docker-compose.dev.yml` 顶部添加 `env_file: .env.dev` 声明，避免每次手动 `--env-file`

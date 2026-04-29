# Reflection: TICKET-PLAT-OTEL-001

## 任务概述
设计并实现 OpenTelemetry 统一可观测性体系，实现 dev/prod 环境一致性。

## 架构决策

### 1. OTel Java Agent 零侵入方案
- **决策**: 所有 7 个 Java 微服务通过 Dockerfile `ADD` 下载 OTel Java Agent v2.6.0，ENTRYPOINT 硬编码 `-javaagent` 路径。
- **理由**: 满足 "no code changes" 约束；agent 在镜像构建阶段固定版本，运行时通过 env var 控制开关。
- **权衡**: `ADD` 下载依赖外部网络，air-gapped 环境需替换为本地 COPY。后续应考虑 checksum 验证。

### 2. Dev 后端选择: Tempo + Jaeger 双输出
- **决策**: Collector traces pipeline 同时导出到 Tempo (长期存储) 和 Jaeger all-in-one (即时 UI)。
- **理由**: 团队已有 Grafana+Tempo 配置，但 Jaeger UI 在 trace 探索和依赖分析上更直观。双输出无额外成本。

### 3. Log 关联: MDC + Spring Boot Relaxed Binding
- **决策**: 利用 `LOGGING_PATTERN_CONSOLE` env var 注入 `%X{trace_id}` 到 Java stdout，无需修改 logback.xml。
- **关键发现**: Spring Boot 3 的 relaxed binding 确实支持 `LOGGING_PATTERN_CONSOLE` → `logging.pattern.console`。OTel Java Agent 默认向 MDC 写入 `trace_id` 和 `span_id`。

### 4. Node API 激活
- **决策**: 直接移除 `OTEL_SDK_DISABLED: "true"`，添加 `OTEL_EXPORTER_OTLP_ENDPOINT`。
- **理由**: `apps/api/src/telemetry.ts` 和 `apps/api/src/utils/logger.ts` 已经完整实现了 SDK 初始化和 trace_id 注入，只需在 docker-compose 中启用。

## 踩坑记录

### 坑 1: Tempo S3 配置引用不存在的 MinIO
- **现象**: `monitoring/tempo/tempo.yml` 配置了 `backend: s3` + `endpoint: minio:9000`，但 docker-compose.dev.yml 没有 MinIO 服务。
- **修复**: 改为 `backend: local`，使用本地文件系统存储。dev 环境无需 S3 的持久化和高可用。

### 坑 2: docker-compose.prod.yml watchtower 缩进错误
- **现象**: `watchtower` 服务被放在了 `networks:` 下面，导致 `docker compose config` 报错 `networks.watchtower additional properties ... not allowed`。
- **修复**: 将 watchtower 移动到 `services:` 末尾、`networks:` 之前。

### 坑 3: docker-compose.prod.yml 跨 profile depends_on
- **现象**: `nginx` (无 profile) depends on `java-gateway` (profile: java)，在某些 Docker Compose 版本下验证失败。
- **评估**: 这是 pre-existing 设计问题，不在本 ticket 范围内修复，避免引入部署行为变更。

## 安全与合规检查

| 检查项 | 状态 | 说明 |
|--------|------|------|
| 镜像非 root | ✅ | Java: appuser (1001), Node: appuser/nodejs (1001) |
| 无明文 Secret | ✅ | OTLP endpoint 为内部地址，非敏感 |
| HTTPS 强制 | N/A | nginx.conf 已配置 TLS 1.2/1.3，未变更 |
| readOnlyRootFilesystem | N/A | Docker Compose 阶段，K8s manifest 未改动 |

## 回滚策略
1. **docker-compose**: 移除 Jaeger 服务、恢复 `OTEL_SDK_DISABLED: "true"`、删除 OTEL env vars。
2. **Dockerfiles**: 移除 `ADD` agent 和 ENTRYPOINT 的 `-javaagent`。
3. **Nginx**: 移除 `traceparent/tracestate` 的 `proxy_set_header`。
4. **Monitoring**: 恢复 tempo.yml S3 配置（如需）。

所有变更独立且可逐条 revert，预计 5 分钟内完成回滚。

## 后续优化建议
1. **Checksum 验证**: Java Agent Dockerfile 中增加 SHA256 校验，提升供应链安全。
2. **Frontend 插桩**: Nuxt 3 可接入 `@opentelemetry/auto-instrumentations-web` 实现浏览器端 trace 起点。
3. **Collector Tail Sampling**: 当前 dev 环境采样率 100%，生产应配置基于延迟/错误的 tail sampling。
4. **统一 Dashboard**: 在 Grafana 中新增一个 OTel Overview dashboard，聚合 traces/metrics/logs 三联查。

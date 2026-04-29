# AgentHive Cloud — Lessons Learned Archive

> 归档的技术细节。本文件不自动加载，只有明确搜索时才读取。
> 最新跨角色洞察见 `lessons-learned.md`。

---

## Encoding / File Handling（归档详细技术条目）

原始条目已归档至此。核心规则保留在主文件：
- `Set-Content -NoNewline` DESTROYS YAML files
- `StrReplaceFile` on UTF-8 BOM files causes mojibake
- Git `core.autocrlf=true` on Windows issues

详细技术解释和修复命令见本文件历史版本（git: 2026-04-27 之前的 lessons-learned.md）。

---

## DevOps / Container（归档详细技术条目）

### Nacos JVM 调优
- `JVM_XMN=512m` 与 `JVM_XMX=512m` 冲突 → 老年代几乎为 0
- `remote.executor.times.of.processors=16` × Docker Desktop 32 vCPU = 512 线程
- `docker-startup.sh` 中 `JAVA_OPT_EXT` 放在 `-jar` 之后，JVM 忽略
- **解决方案**: 使用 `JAVA_TOOL_OPTIONS` 注入参数

### Java 容器内存
- Java 21 + Spring Boot 3 非堆内存 ~80-120MB
- 容器限制必须高于 `-Xmx`

### Redis
- Redisson 空密码时仍发送 AUTH 命令
- `docker-compose.dev.yml` 不会自动加载 `.env.dev`
- 必须使用 `--env-file .env.dev` 或 `env_file: .env.dev`

---

## Observability（归档详细技术条目）

- 7 Java 服务仅 3 个有 actuator，0 个有 micrometer-registry-prometheus
- Prometheus 和 Java 服务必须共享 Docker 网络
- `external: true` 网络名称遵循 `<project_dir>_<network_name>`

---

## Java / Spring Boot（归档详细技术条目）

### Docker Image
- `pom.xml` 修改后必须重建镜像（`docker compose build`）
- Maven 路径: `C:\tools\apache-maven-3.9.15\bin\mvn.cmd`
- PowerShell 不能直接调用 `mvn`，需 `.cmd` 后缀

### GlobalResponseAdvice
- ResponseBodyAdvice 包装 actuator 404 → Docker healthcheck 被欺骗
- 修复: `path.startsWith("/actuator")` early return

### SecurityConfig
- `requestMatchers("/actuator/health").permitAll()` 不足
- 需 `requestMatchers("/actuator/**").permitAll()`

### Gateway Actuator
- `/actuator/gateway/routes` 需显式启用
- `management.endpoint.gateway.enabled: true`
- `gateway` in `web.exposure.include`

---

## Node.js / API（归档详细技术条目）

### express-rate-limit v7
- ESM-compatible，无内置 ioredis store
- 自定义 Store: `incr` + `pexpire` pipeline
- Mount after `authMiddleware` for per-user rate limiting

---

## CI / Build（归档）

- `packages/ui` missing `@element-plus/icons-vue`
- `landing` GSAP type conflict
- `agent-runtime` type errors bypassed with `|| true`

---

## Security（归档详细条目）

- 8 P0 security baseline items identified
- See `docs/architecture/00-architecture-review.md` for details

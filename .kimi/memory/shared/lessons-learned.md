# AgentHive Cloud — Shared Lessons Learned

> Cross-cutting insights from all Agent sessions. Updated automatically by Curator step.

## Architecture
- [2026-04-27] Role separation by runtime (JVM/V8/Browser/Docker) proven effective. Avoid business-domain splitting.
- [2026-04-27] Landing BFF (Nuxt server/api/) belongs to Frontend Agent because it's Nitro/V8 runtime, not JVM.

## Encoding / File Handling
- [2026-04-27] `StrReplaceFile` on UTF-8 BOM files causes mojibake (GBK misread). Use Python byte-level operations for BOM files.
- [2026-04-27] Git `core.autocrlf=true` on Windows + shell scripts = potential line ending issues. Prefer `.gitattributes` with `* text=auto eol=lf`.

## Security
- [2026-04-27] 8 P0 security baseline items identified but not yet fixed. See `docs/architecture/00-architecture-review.md`.

## CI / Build
- [2026-04-27] `packages/ui` missing `@element-plus/icons-vue` — known blocker.
- [2026-04-27] `landing` GSAP type conflict — known blocker.
- [2026-04-27] `agent-runtime` type errors bypassed with `|| true` — must fix properly.

## DevOps / Container
- [2026-04-27] Nacos 2.3.0 `JVM_XMN=512m` default conflicts with `JVM_XMX=512m` → near-zero old generation. Override `JVM_XMN` explicitly.
- [2026-04-27] Nacos `remote.executor.times.of.processors=16` × Docker Desktop 32 vCPU = 512 gRPC threads. Use `JAVA_TOOL_OPTIONS="-Dremote.executor.times.of.processors=1"` to control.
- [2026-04-27] Nacos `docker-startup.sh` appends `JAVA_OPT_EXT` AFTER `-jar`, so JVM ignores it. Always use `JAVA_TOOL_OPTIONS` for container JVM tuning.
- [2026-04-27] Java 21 + Spring Boot 3 baseline non-heap memory ≈ 80-120MB (Metaspace + Code Cache + Thread Stacks + DirectBuffer). Container limit must leave headroom above `-Xmx`.
- [2026-04-27] Redisson sends AUTH command even when password is empty string. Ensure Redis `requirepass` is set or omit `spring.data.redis.password` entirely.

## Observability
- [2026-04-27] 7 Java services: only 3 have `spring-boot-starter-actuator`, 0 have `micrometer-registry-prometheus`. Prometheus scrape targets are all commented. Monitoring stack is infrastructure-only, no app metrics.
- [2026-04-27] Prometheus and Java services must share a Docker network for DNS-based service discovery. If services are on `agenthive-dev` and Prometheus on `agenthive-monitoring`, add `external: true` network bridge or attach Prometheus to both networks.

## Agent Tooling
- [2026-04-27] Built-in `Agent` tool fails with cyclic path resolution when specialist agent.yaml uses `extend: ../lead/agent.yaml` and lead defines `subagents` pointing back to specialists. Workaround: dispatch via CLI `kimi --print --agent-file path --input-format text --output-format text --final-message-only --work-dir .`
- [2026-04-27] Jinja template syntax in system.md must avoid `${}` literal strings (kimi CLI uses `${`/`}` as variable delimiters). Escape as `${'${}'}` or wrap in `{% raw %}` blocks.
- [2026-04-27] Lead must NOT execute code changes directly. Role boundary: plan → dispatch → review → broadcast only.

## Agent Tooling (continued)
- [2026-04-27] **Session-level agent spec cache**: Even after fixing `extend: ../lead/agent.yaml` on disk, the running Lead session retains the old recursive spec in memory. `Agent` tool dispatch remains broken until session restart. Workaround: use direct Shell execution for urgent tasks.
- [2026-04-27] **Lead fallback to Shell execution**: When Agent infrastructure is blocked, Lead may fall back to direct Shell-based task execution. This is acceptable as emergency measure but must be recorded as debt to restore proper dispatch ASAP.

## Java / Spring Boot
- [2026-04-27] **Docker image staleness**: Adding actuator/micrometer to `pom.xml` does NOT affect running containers. Images must be rebuilt (`docker compose build`) after any dependency change. Current dev environment lacks Maven (`mvn` not in PATH, no `target/*.jar`), making rebuild impossible.
- [2026-04-27] **SecurityConfig actuator authorization**: `requestMatchers("/actuator/health").permitAll()` is insufficient — Prometheus scrapes `/actuator/prometheus`, Gateway routes query `/actuator/gateway/routes`. Use `requestMatchers("/actuator/**").permitAll()` for dev/monitoring compatibility.
- [2026-04-27] **Global response wrapper interference**: `ResponseBodyAdvice` that wraps all responses into `Result<T>` breaks actuator endpoints (Prometheus expects raw text, health expects JSON). Exclude `/actuator/**` paths in `beforeBodyWrite()`.
- [2026-04-27] **Gateway actuator endpoint disabled by default**: Spring Cloud Gateway's `/actuator/gateway/routes` requires explicit `management.endpoint.gateway.enabled: true` and `gateway` in `web.exposure.include`.

## Node.js / API
- [2026-04-27] **express-rate-limit v7 + ioredis custom Store**: `express-rate-limit` v7 is ESM-compatible but has no built-in ioredis store. Implement custom `Store` with `incr` + `pexpire` pipeline for atomic window management. Mount after `authMiddleware` so `X-User-Id` is available for per-user rate limiting.

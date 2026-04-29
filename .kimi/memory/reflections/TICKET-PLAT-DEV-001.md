# Reflection: TICKET-PLAT-DEV-001

## 根因复盘

Docker Dev 环境出现 Nacos 认证失败，导致所有 Java 微服务无法注册到 Nacos，Gateway 路由返回 500。

根因有两个：
1. **凭据不一致**：Nacos 容器配置的 `NACOS_AUTH_IDENTITY_KEY=agenthive`, `NACOS_AUTH_IDENTITY_VALUE=agenthive-secret-2024`，但所有 Java 服务通过 `SPRING_CLOUD_NACOS_DISCOVERY_USERNAME/PASSWORD` 连接时使用的是 `nacos/nacos`。
2. **服务发现被禁用**：`application-docker.yml` 中 `spring.cloud.nacos.discovery.enabled=false`，即使凭据正确，服务也不会注册。

## 修复措施

- docker-compose.dev.yml 中 7 个 Java 服务的 Nacos 凭据统一改为 `agenthive` / `agenthive-secret-2024`
- 新增 `NACOS_USERNAME` / `NACOS_PASSWORD` 环境变量，与 bootstrap.yml 对齐
- 所有 application-docker.yml 中显式启用 `discovery.enabled=true` 和 `config.enabled=true`

## 验证

`docker compose -f docker-compose.dev.yml config` 验证通过。

## 预防措施

1. 修改 Nacos 服务端认证配置时，强制同步检查所有客户端凭据
2. 禁止在 dev 环境禁用服务发现（discovery.enabled 必须为 true）
3. 将 `docker compose config` 加入 CI 流程，作为 PR 合并前的语法检查步骤

## 回滚策略

git revert 本次 commit，可立即恢复 `nacos/nacos` 凭据和 `discovery=false` 状态。

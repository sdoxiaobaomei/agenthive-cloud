# Reflection: PLAT-DEV-001 + PLAT-DEV-002 + PLAT-DEV-003

## 执行概述
2026-04-28 并行执行 3 个 P0 Dev 环境修复 Ticket。实际修改量小于预期，因为部分问题已在前期迭代中被修复，但仍发现了 2 个隐蔽但致命的配置漂移。

## 关键发现

### 1. Nacos 连接问题（PLAT-DEV-001）
- **预期问题**：凭据不一致 nacos/nacos vs agenthive/agenthive-secret-2024
- **实际情况**：docker-compose.dev.yml 中凭据已通过 ${NACOS_PASSWORD} 统一，.env.dev 值正确
- **意外发现**：cart-service 和 logistics-service 的 bootstrap.yml 使用了 **${NACOS_HOST}:${NACOS_PORT}**，而其他 5 个服务和 docker-compose 均使用 **${NACOS_SERVER}**。这会导致这两个服务回退到 localhost:8848，完全无法连接 Nacos。这是一个隐蔽但 100% 阻断性的 bug。
- **修复**：统一为 ${NACOS_SERVER:localhost:8848}，补充 spring.application.name

### 2. Gateway 路由未启用服务发现（PLAT-DEV-001）
- Gateway 的 application-docker.yml 中所有下游路由使用硬编码 `http://service:port`，而非 `lb://service`
- 这意味着即使所有服务都注册到 Nacos，Gateway 也不会通过服务发现进行负载均衡和故障转移
- **修复**：6 个 Java 微服务路由改为 `lb://`，Node API 保持 `http://`（未注册 Nacos）

### 3. 用户表冲突（PLAT-DEV-002）
- init-schemas.sql 和 init.sql 均使用 sys_user
- 但 schema.sql 使用 t_auth_user（字段名、类型、约束均不同）
- **根因**：表结构变更后未同步更新所有 SQL 文件
- **修复**：schema.sql 对齐为 sys_user/sys_role/sys_user_role

### 4. JWT Secret 已统一（PLAT-DEV-003）
- .env.dev 已定义 JWT_SECRET，Node API 和 Java Gateway 均使用 ${JWT_SECRET}
- scripts/setup-dev-env.sh 已存在且功能完整，自动生成 256-bit base64 secret
- 仅需验证，无需修改

## 安全基线检查
- 未新增任何硬编码 Secret ✓
- 所有密码均通过环境变量注入 ✓
- docker-compose config 验证通过，无 "variable is not set" 警告 ✓

## 踩坑记录（Skill 候选）
1. **bootstrap.yml 环境变量命名漂移**：同一项目中 7 个微服务，2 个使用不同变量名连接同一中间件，Dev 环境表现正常（可能因为有 fallback 到 localhost 的假象），但在容器网络中直接失败。
2. **多源 SQL Schema 冲突**：一个微服务内部存在 schema.sql、init.sql、init-schemas.sql 三个文件定义同一表，变更时极易遗漏。
3. **Gateway 路由 hardcode**：Spring Cloud Gateway 配了 Nacos discovery 但路由写死 IP/域名，导致服务发现形同虚设。

## 改进建议
- 建立 bootstrap.yml / application-docker.yml 模板化机制，所有 Java 服务共享同一份基础配置
- CI 中增加 SQL Schema 一致性检查（diff src/main/resources/db/*.sql）
- CI 中增加 docker-compose config 校验，确保无未定义变量

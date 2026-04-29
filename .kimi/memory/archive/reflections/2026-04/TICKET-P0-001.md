# Reflection: TICKET-P0-001 Java 默认密码 Fallback 彻底清理

## 问题
apps/java 多个服务的 application*.yml 中存在敏感配置 fallback 默认值：
- `${DB_USER:agenthive}` — 数据库默认用户名
- `${RABBITMQ_USER:guest}` — RabbitMQ 默认账号
- `username: postgres` / `username: agenthive` / `password:` (空) — local 配置硬编码

## 方案
1. **YAML 清理**：将所有敏感 fallback 改为纯环境变量引用（`${DB_USER}` / `${RABBITMQ_USER}`）。
2. **启动校验增强**：在 JwtConfig / InternalApiConfig / WithdrawalAccountEncryptor 的 `@PostConstruct` 中添加明确的 `${...}` 占位符检测，确保环境变量缺失时给出清晰错误信息而非模糊的 "length too short"。

## 关键发现
- Spring Boot 的 `@Value("${jwt.secret}")` 在环境变量缺失时，会将字符串 `${JWT_SECRET}` 原样注入，导致 `isBlank()` 无法捕获。
- 现有代码已通过长度/弱密码校验间接阻止了未解析占位符的启动（`${JWT_SECRET}` 长度13<32，且包含 "secret" 关键字），但增强后 DX 更好。
- 本地配置文件（application-local.yml）往往是最容易被忽略的安全死角，需要特别关注。

## 代码规范
- 新增单元测试覆盖占位符检测逻辑（JwtConfigTest, InternalApiConfigTest, WithdrawalAccountEncryptorTest）。

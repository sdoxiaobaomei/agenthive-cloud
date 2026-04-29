# Root Cause Analysis — 数据库无表 & JWT Secret 长度问题

**Date:** 2026-04-29  
**Analyst:** Lead (Architecture)  
**Status:** Root causes identified, systemic solutions proposed

---

## 问题 1：数据库无表（反复出现）

### 症状
- 7 个 Java 服务各自有独立的 PostgreSQL 数据库
- 服务启动或请求时报错：`FATAL: database "xxx_db" does not exist` 或 `ERROR: relation "t_xxx" does not exist`
- 手动执行 `schema.sql` 后问题解决，但重启/重建环境后问题复现

### 根因分析

#### 根因 1-A：PostgreSQL init 脚本的"一次性"陷阱

```
docker-compose.dev.yml:
  postgres:
    volumes:
      - postgres_data:/var/lib/postgresql/data          ← 命名卷，数据持久化
      - ./apps/java/scripts/init-multiple-dbs.sh:/docker-entrypoint-initdb.d/...
      - ./apps/java/scripts/init-schemas.sql:/docker-entrypoint-initdb.d/...
```

**PostgreSQL 官方行为：** `/docker-entrypoint-initdb.d/` 中的脚本**仅在数据目录为空时执行一次**。

```
执行条件: $PGDATA 目录为空（即容器首次启动）
执行顺序: 按文件名字母顺序
执行后:   数据目录不再为空，后续容器重启/重建时脚本被跳过
```

**陷阱链条：**
1. 首次启动 postgres → `init-multiple-dbs.sh` 创建 7 个数据库 → `99-schemas.sql` 创建所有表 ✅
2. 开发过程中修改了 `99-schemas.sql`（增加新表、修改字段）
3. `docker compose down && docker compose up -d` → postgres 数据目录（命名卷）不为空
4. `99-schemas.sql` **被跳过**，新 schema 不会执行 ❌
5. 服务启动 → 表不存在 → ERROR

#### 根因 1-B：Spring Boot 未配置 schema.sql 自动执行

| 问题 | 现状 | 要求 |
|------|------|------|
| schema.sql 位置 | `src/main/resources/db/schema.sql` | 默认从 classpath root 查找 |
| `spring.sql.init.mode` | 未配置 | PostgreSQL 需要显式设置为 `always` |
| `spring.sql.init.schema-locations` | 未配置 | 需要指向 `classpath:db/schema.sql` |
| Flyway / Liquibase | **不存在** | 行业标准的迁移方案 |

**结果：** Java 服务启动时**完全不尝试**自动创建数据库表。

#### 根因 1-C：schema 分散在 7 个服务中，缺乏统一管理

```
apps/java/auth-service/src/main/resources/db/schema.sql
apps/java/user-service/src/main/resources/db/schema.sql
apps/java/payment-service/src/main/resources/db/schema.sql
apps/java/order-service/src/main/resources/db/schema.sql
apps/java/cart-service/src/main/resources/db/schema.sql
apps/java/logistics-service/src/main/resources/db/schema.sql
```

- 每个服务维护独立的 schema
- `init-schemas.sql` 是手动聚合的副本，容易与源文件不同步
- 没有版本控制（无法追踪 schema 变更历史）
- 没有回滚能力

### 系统性解决方案（按优先级排序）

#### 方案 A：引入 Flyway 迁移（推荐 ✅）

**原理：** Flyway 在应用启动时自动检测并执行数据库迁移脚本，支持版本控制、幂等执行、回滚。

**实施步骤：**
1. 在 `apps/java/pom.xml` 添加 Flyway 依赖
2. 每个服务的 `src/main/resources/db/migration/` 目录按 `V1__init.sql`, `V2__add_index.sql` 命名
3. `application-docker.yml` 配置 Flyway 启用
4. 删除 `init-schemas.sql`（Flyway 取代其职责）
5. CI/CD 中增加 Flyway validate 步骤

**收益：**
- 迁移脚本版本化，可审计
- 幂等执行，重复启动安全
- 支持团队协同（多开发者不会冲突）
- 支持多环境（dev/staging/prod）使用同一套脚本

#### 方案 B：Spring Boot `sql.init` 自动执行（快速修复，但不推荐长期用）

**在 `application-docker.yml` 中添加：**
```yaml
spring:
  sql:
    init:
      mode: always
      schema-locations: classpath:db/schema.sql
```

**限制：**
- 每次应用启动都执行（即使表已存在，靠 `CREATE TABLE IF NOT EXISTS` 幂等）
- 不支持 schema 变更（ALTER TABLE）
- 不支持回滚
- 不适合生产环境

#### 方案 C：改进 PostgreSQL init 机制（治标不治本）

**在 `docker-compose.dev.yml` 中添加一个一次性初始化容器：**
```yaml
  db-init:
    image: postgres:16-alpine
    depends_on:
      postgres:
        condition: service_healthy
    volumes:
      - ./apps/java/scripts/init-schemas.sql:/init.sql:ro
    entrypoint: ["sh", "-c", "sleep 5 && psql -h postgres -U agenthive -f /init.sql"]
    restart: "no"
```

**问题：** 每次 `docker compose up` 都会尝试执行，需要额外处理幂等性。

---

## 问题 2：JWT Secret 长度不足（反复出现）

### 症状
- gateway-service 日志反复出现 WARN：`JWT validation failed: key size 344 bits < 384 bits required for HS384`
- 不同环境配置的 JWT_SECRET 长度不一致
- 42 字节 → 64 字节的手动修复，但没有防止问题再次发生的机制

### 根因分析

#### 根因 2-A：jjwt `Keys.hmacShaKeyFor()` 的自动推断行为

**jjwt 0.12.5 源码逻辑：**
```java
// Keys.hmacShaKeyFor(byte[] keyBytes)
// 根据 key 长度自动选择 HMAC 算法：
//  key.length >= 64 bytes  → HS512
//  key.length >= 48 bytes  → HS384
//  key.length >= 32 bytes  → HS256
//  key.length <  32 bytes  → 抛异常
```

**当前代码：**
```java
// JwtUtils.java:20
this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));

// JwtUtils.java:40
.signWith(key);   // ← 没有显式指定算法！依赖自动推断
```

**当 secret = "AgentHive2024!Dev#Secure%Change&It*In+Prod"（42 字节）：**
- jjwt 推断算法：42 字节 = 336 bits
- 336 bits 介于 256 和 384 之间
- **jjwt 0.12.x 的 bug/设计选择：** 对于非标准长度（32/48/64），它会选择最近的更高算法
- 336 bits → 推断为 **HS384**
- 但 HS384 要求 key ≥ 384 bits
- **验证时报 WARN：** key size 344 bits < 384 bits

#### 根因 2-B：环境变量无长度校验，配置即运行时炸弹

```
.env.dev.example:
  JWT_SECRET=<GENERATE>   ← 只有占位符，没有生成长度要求

.env.dev:
  JWT_SECRET=AgentHive2024!Dev#Secure%Change&It*In+Prod  ← 42 字节，人工配置

代码:
  启动时直接读取环境变量，没有任何校验
  运行时 jjwt 才发现长度不足
```

**问题：** 配置错误在**运行时**才暴露，而非**启动时**失败。

#### 根因 2-C：生成端和验证端使用不同算法推断逻辑

- **生成端（auth-service）**：`JwtUtils.signWith(key)` → jjwt 选择 HS384
- **验证端（gateway-service）**：`JwtValidationFilter.verifyWith(key)` → jjwt 也选择 HS384，但校验 key 长度时 WARN

两边的 key 相同，算法推断结果也相同，所以验证**实际上是通过的**（只是 jjwt 在 WARN）。但如果未来某一方代码升级了 jjwt 版本，算法推断逻辑可能改变，导致 token 不兼容。

### 系统性解决方案

#### 方案 A：代码中显式指定算法（推荐 ✅）

**修改 `JwtUtils.java`：**
```java
import io.jsonwebtoken.Jwts;

// 显式使用 HS256，要求最低 32 字节
private static final SignatureAlgorithm ALGORITHM = Jwts.SIG.HS256;

public JwtUtils(String secret, ...) {
    byte[] keyBytes = secret.getBytes(StandardCharsets.UTF_8);
    // 启动时校验长度
    if (keyBytes.length < 32) {
        throw new IllegalArgumentException(
            "JWT_SECRET must be at least 32 bytes (256 bits) for HS256, " +
            "got " + keyBytes.length + " bytes. " +
            "Generate with: openssl rand -base64 32"
        );
    }
    this.key = Keys.hmacShaKeyFor(keyBytes);
}

private String generateToken(...) {
    return Jwts.builder()
        .subject(subject)
        .issuedAt(now)
        .expiration(expiry)
        .signWith(key, ALGORITHM)   // ← 显式指定！
        .compact();
}

public Claims parseToken(String token) {
    return Jwts.parser()
        .verifyWith(key)
        .build()
        .parseSignedClaims(token)
        .getPayload();
}
```

**修改 `JwtValidationFilter.java`：**
```java
// 同样校验 key 长度
@PostConstruct
public void validateKey() {
    byte[] keyBytes = jwtSecret.getBytes(StandardCharsets.UTF_8);
    if (keyBytes.length < 32) {
        throw new IllegalStateException("JWT_SECRET too short: " + keyBytes.length + " bytes, minimum 32");
    }
}
```

**收益：**
- 算法固定，不再依赖 jjwt 的推断逻辑
- 启动时即失败（fail-fast），而非运行时才 WARN
- 错误信息清晰，告诉开发者如何修复
- 兼容未来 jjwt 版本升级

#### 方案 B：环境变量模板中强制执行长度

**修改 `.env.dev.example`：**
```bash
# JWT Secret — MUST be at least 32 bytes (256 bits) for HS256
# Generate: openssl rand -base64 32
# Current: 64 bytes (512 bits) → HS512
JWT_SECRET=dxvmC6J4yjw7o0MxVhrEVQMNHfbWEf3J53YBAC7sRMNp7haLQE5WhYcWxScPXobD
```

**添加 `scripts/validate-env.sh`：**
```bash
#!/bin/bash
JWT_SECRET="${JWT_SECRET:-}"
JWT_LEN=${#JWT_SECRET}
if [ "$JWT_LEN" -lt 32 ]; then
    echo "ERROR: JWT_SECRET must be at least 32 bytes, got $JWT_LEN bytes"
    exit 1
fi
echo "OK: JWT_SECRET length = $JWT_LEN bytes"
```

**在 `docker-compose.dev.yml` 的 healthcheck 或 entrypoint 中调用。**

#### 方案 C：升级 jjwt 并适配新 API（中长期）

jjwt 0.12.x 的 API 相比 0.11.x 有较大变化。如果未来升级到 0.13.x，可能需要进一步适配。显式指定算法（方案 A）可以减少升级风险。

---

## 决策矩阵

| 问题 | 推荐方案 | 工作量 | 风险 | 长期价值 |
|------|---------|--------|------|---------|
| 数据库无表 | **Flyway 迁移** | 2-3 天 | 低 | ⭐⭐⭐⭐⭐ |
| JWT 长度 | **显式算法 + 启动校验** | 2-4 小时 | 极低 | ⭐⭐⭐⭐⭐ |

---

## 下一步行动

1. **短期（本周）**：
   - [ ] 实施 JWT 方案 A（显式 HS256 + 启动校验）
   - [ ] 更新 `.env.dev.example` 注释，说明最小长度要求
   - [ ] 添加 `scripts/validate-env.sh` 到 CI 流程

2. **中期（下周）**：
   - [ ] 引入 Flyway 依赖到 parent POM
   - [ ] 将 6 个服务的 `db/schema.sql` 迁移为 `db/migration/V1__init.sql`
   - [ ] 配置 `application-docker.yml` Flyway 启用
   - [ ] 删除 `init-schemas.sql`（由 Flyway 取代）
   - [ ] 保留 `init-multiple-dbs.sh`（仍负责创建空数据库）

3. **长期**：
   - [ ] 所有 schema 变更通过 Flyway migration 管理
   - [ ] CI 中增加 `flyway validate` + `flyway info` 检查
   - [ ] 生产环境使用 Flyway 的 `baseline` 功能平滑迁移

# AgentHive Cloud — Java Microservices Specification (Refactoring Blueprint)

> **Document**: `specs/agenthive/004-java-services.md`
> **Status**: Code Blueprint — implementation-ready specification
> **Target**: Consolidate 6 Java microservices into 3 (Gateway, Auth, Economy)
> **Lines of code analyzed**: ~14,000 lines across 6 services + 8 common modules
> **Tests analyzed**: 21 test files

---

## 1. Service Topology After Refactoring

### 1.1 Before (Current State)

```
Nginx → Gateway (8080)
           ├── lb://auth-service (8081)        — Auth, SMS, Users
           ├── lb://payment-service (8083)     — Payments, Credits, Marketplace, Hosted Website, Withdrawals
           ├── lb://order-service (8084)       — Orders (电商), Creator Products
           ├── lb://cart-service (8085)        — Shopping Cart (电商)
           ├── lb://logistics-service (8086)   — Logistics Tracking (电商)
           └── API_SERVICE_URL (Node.js:3001)  — Agents, Tasks, Code, Projects, Chat
```

### 1.2 After (Target State)

```
Nginx → Gateway (8080)
           ├── lb://auth-service (8081)        — Auth, SMS, Users
           ├── lb://economy-service (8083)     — Payments, Credits, Marketplace, Hosted Website,
           │                                      Withdrawals, Creator Products
           └── API_SERVICE_URL (Node.js:3001)  — Agents, Tasks, Code, Projects, Chat, Preview
```

**Key change**: payment-service renamed to economy-service. CreatorProduct/CreatorEarning merged from order-service into economy-service. Cart, Logistics, and Order (电商部分) deleted entirely.

---

## 2. Gateway Service — Keep & Enhance

**Service**: `apps/java/gateway-service/`
**Port**: 8080
**Lines**: ~1,207
**Tests**: 6

### 2.1 Filter Chain (Ordered Execution)

| Order | Filter | File | Purpose |
|-------|--------|------|---------|
| HIGHEST_PRECEDENCE | `AbsoluteUriFilter` | `filter/AbsoluteUriFilter.java` (config/) | Fixes Spring 6.1.x CORS relative-URI bug |
| -200 | `TraceIdFilter` | `filter/TraceIdFilter.java` | Generate/forward `X-Trace-Id` for distributed tracing |
| -100 | `JwtValidationFilter` | `filter/JwtValidationFilter.java` | JWT HS256 validation, header injection |
| -50 | `RateLimitFilter` | `filter/RateLimitFilter.java` | Redis Lua sliding window rate limiter |
| (Spring) | `CorsWebFilter` | `config/CorsConfig.java` | K8s ConfigMap-driven CORS, `@ConditionalOnProperty` |

### 2.2 JwtValidationFilter — Actual Code Flow

**File**: `apps/java/gateway-service/src/main/java/com/agenthive/gateway/filter/JwtValidationFilter.java`

```java
@Component
public class JwtValidationFilter implements GlobalFilter, Ordered {

    @Value("${jwt.secret}")
    private String jwtSecret;

    private static final List<String> WHITE_LIST = List.of(
            "/api/auth/register",
            "/api/auth/login",
            "/api/auth/login/sms",
            "/api/auth/sms/send",
            "/api/auth/refresh",
            "/api/demo/**",
            "/api/health",
            "/actuator/**"
    );

    @PostConstruct
    public void validateKeyLength() {
        byte[] keyBytes = jwtSecret.getBytes(StandardCharsets.UTF_8);
        if (keyBytes.length < 32) {
            throw new IllegalStateException(
                "JWT_SECRET too short: " + keyBytes.length + " bytes, minimum 32 for HS256"
            );
        }
    }
    // ...
}
```

**Flow**:
1. On every request, check if path matches 8-item whitelist (`AntPathMatcher`). If yes, pass through.
2. Extract `Bearer <token>` from `Authorization` header.
3. Parse with JJWT 0.12+ `Jwts.parser().verifyWith(key).build().parseSignedClaims(token)`.
4. On success, mutate request to inject three downstream headers:
   - `X-User-Id` ← `claims.getSubject()` (userId as string)
   - `X-User-Name` ← `claims.get("username")`
   - `X-User-Role` ← `claims.get("roles")` (comma-separated)
5. On failure (any exception), return 401 with empty body via `response.setComplete()`.
6. Filter order: `-100` (runs after TraceIdFilter, before RateLimitFilter).

**Post-refactoring whitelist expansion** — add `/api/preview/**` (for hosted website iframe previews that don't carry auth):

```java
private static final List<String> WHITE_LIST = List.of(
        "/api/auth/register",
        "/api/auth/login",
        "/api/auth/login/sms",
        "/api/auth/sms/send",
        "/api/auth/refresh",
        "/api/demo/**",
        "/api/preview/**",      // NEW: hosted website iframe previews
        "/api/health",
        "/actuator/**"
);
```

### 2.3 RateLimitFilter — Redis Lua Sliding Window

**File**: `apps/java/gateway-service/src/main/java/com/agenthive/gateway/filter/RateLimitFilter.java`

```java
@Component
@RequiredArgsConstructor
public class RateLimitFilter implements GlobalFilter, Ordered {

    private final ReactiveStringRedisTemplate reactiveStringRedisTemplate;

    private static final String RATE_LIMIT_SCRIPT =
            "local key = KEYS[1];" +
            "local limit = tonumber(ARGV[1]);" +
            "local window = tonumber(ARGV[2]);" +
            "local current = redis.call('GET', key);" +
            "if current == false then" +
            "  redis.call('SET', key, 1, 'EX', window);" +
            "  return 1;" +
            "end;" +
            "local count = tonumber(current);" +
            "if count >= limit then" +
            "  return 0;" +
            "else" +
            "  redis.call('INCR', key);" +
            "  redis.call('EXPIRE', key, window);" +
            "  return 1;" +
            "end";
    // ...
}
```

**Parameters**:
- Per-IP (`gateway:rate:<ip>`), 200 requests per 60-second sliding window
- IP resolution: `X-Forwarded-For` → `Proxy-Client-IP` → `RemoteAddress` (first comma-separated entry extracted)
- Returns 429 on limit exceeded with `log.warn`
- Uses reactive Redis (`ReactiveStringRedisTemplate`) — non-blocking on the WebFlux event loop

**Post-refactoring**: Add per-project preview rate limiting for hosted websites:

```java
// Additional key for preview endpoints: gateway:rate:preview:<projectId>
// Limit: 1000 req/60s per project (higher than generic IP limit for iframe views)
```

### 2.4 TraceIdFilter

**File**: `apps/java/gateway-service/src/main/java/com/agenthive/gateway/filter/TraceIdFilter.java`

Generates `X-Trace-Id` header with UUID sans dashes (e.g., `a1b2c3d4e5f6...`). If incoming request already carries the header, it is forwarded as-is. Injected into both request mutation and response header (via `then(Mono.fromRunnable(...))`). Order: `-200` (first in chain).

### 2.5 JwtConfig — Secret Validation

**File**: `apps/java/gateway-service/src/main/java/com/agenthive/gateway/config/JwtConfig.java`

```java
@Configuration
public class JwtConfig {
    @Value("${jwt.secret}")
    private String secret;

    @PostConstruct
    public void validateSecret() {
        // 1. Detect unresolved placeholders (e.g., "${JWT_SECRET}")
        if (secret != null && secret.startsWith("${") && secret.endsWith("}")) { throw ... }
        // 2. Detect null/blank
        if (secret == null || secret.isBlank()) { throw ... }
        // 3. Minimum 32 chars for HS256
        if (secret.length() < 32) { throw ... }
        // 4. Detect weak/default values
        if (secret.toLowerCase().contains("default") ||
            secret.toLowerCase().contains("secret") ||
            secret.toLowerCase().contains("password") ||
            secret.toLowerCase().contains("123")) { throw ... }
    }
}
```

### 2.6 CORS Config for Preview Iframe

**File**: `apps/java/gateway-service/src/main/java/com/agenthive/gateway/config/CorsConfig.java`

```java
@Configuration
public class CorsConfig {
    @Bean
    @ConditionalOnProperty(prefix = "spring.cloud.gateway.globalcors", name = "cors-configurations")
    public CorsWebFilter corsWebFilter(GlobalCorsProperties globalCorsProperties) {
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        globalCorsProperties.getCorsConfigurations()
                .forEach(source::registerCorsConfiguration);
        return new CorsWebFilter(source);
    }
}
```

CORS is externalized to a K8s ConfigMap (mounted at `/app/config/`). Production ConfigMap must include `https://*.agenthive.app` for hosted-website iframe embedding:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: gateway-cors-config
data:
  application-gateway.yml: |
    spring:
      cloud:
        gateway:
          globalcors:
            cors-configurations:
              '[/**]':
                allowedOrigins:
                  - "https://app.agenthive.cloud"
                  - "https://*.agenthive.app"   # NEW: hosted website domains
                allowedMethods:
                  - GET
                  - POST
                  - PUT
                  - PATCH
                  - DELETE
                  - OPTIONS
                allowedHeaders: "*"
                allowCredentials: true
```

### 2.7 Updated Route Table (application.yml)

**File**: `apps/java/gateway-service/src/main/resources/application.yml` — updated:

```yaml
spring:
  cloud:
    gateway:
      routes:
        # --- RENAMED from payment-service --->
        - id: economy-service
          uri: lb://economy-service
          predicates:
            - Path=/api/payments/**,/api/wallets/**,/api/credits/**,/api/marketplace/**,/api/hosted-websites/**,/api/withdrawals/**,/api/creator/**
          filters:
            - StripPrefix=1

        # --- Auth Service (unchanged) --->
        - id: auth-service
          uri: lb://auth-service
          predicates:
            - Path=/api/auth/**
          filters:
            - StripPrefix=1

        - id: auth-service-users
          uri: lb://auth-service
          predicates:
            - Path=/api/users/**
          filters:
            - StripPrefix=1

        # --- Node API Service (add preview) --->
        - id: api-service
          uri: ${API_SERVICE_URL:http://localhost:3001}
          predicates:
            - Path=/api/agents/**,/api/tasks/**,/api/code/**,/api/projects/**,/api/chat/**,/api/demo/**,/api/preview/**,/api/health
          filters:
            - StripPrefix=0
```

**Removed routes**: order-service (`/api/orders/**`), cart-service (`/api/carts/**`), logistics-service (`/api/logistics/**`).

**Changed**: payment-service path group expanded to include `/api/creator/**` (merged from order-service), service name changed to `lb://economy-service`.

### 2.8 Swagger Doc URLs — Updated

```yaml
springdoc:
  swagger-ui:
    urls:
      - name: auth-service
        url: /auth/v3/api-docs
      - name: economy-service
        url: /economy/v3/api-docs
```

---

## 3. Auth Service — Keep & Enhance

**Service**: `apps/java/auth-service/`
**Port**: 8081
**Lines**: ~2,587
**Tests**: 7
**Database**: `auth_db` (PostgreSQL, via `postgres-auth` service)

### 3.1 Complete REST API Reference

All endpoints return `com.agenthive.common.core.result.Result<T>` wrapper.

#### AuthController (`/auth`)

**File**: `apps/java/auth-service/src/main/java/com/agenthive/auth/controller/AuthController.java`

| Method | Path | Request Body | Response | Notes |
|--------|------|-------------|----------|-------|
| POST | `/auth/register` | `RegisterRequest` (username, password, email) | `Result<TokenResponse>` | Validates password regex (uppercase+lowercase+digit+special, min 8). Assigns default USER role (roleId=2). bcrypt hash. |
| POST | `/auth/login` | `LoginRequest` (username, password) | `Result<TokenResponse>` | IP rate limited: 5 attempts/min (`login:rate:<ip>` Redis key). Account status check (status=1). |
| POST | `/auth/login/sms` | `SmsLoginRequest` (phone, code) | `Result<TokenResponse>` | SMS code verification + auto-register. `isNewUser=true` in response on first login. |
| POST | `/auth/refresh` | `RefreshTokenRequest` (refreshToken) | `Result<TokenResponse>` | Validates JWT, checks user exists and active, issues new tokens. |
| POST | `/auth/logout` | None (Bearer token in header) | `Result<Void>` | Blacklists token in Redis with TTL = remaining validity: `blacklist:<token>` → `1`. |
| GET | `/auth/me` | None (Bearer token in header) | `Result<UserVO>` | Extracts userId from JWT subject, returns user with roles list. |
| PATCH | `/auth/profile` | `UpdateProfileRequest` (username?, password?, avatar?) + Bearer | `Result<UserVO>` | Ownership check: only self. Username uniqueness across other users. Password validation same as register. |
| GET | `/auth/users/{id}/roles` | None | `Result<List<String>>` | Returns role codes (e.g., `["USER"]`, `["ADMIN"]`). |

#### SmsController (`/auth/sms`)

| Method | Path | Request Body | Response | Notes |
|--------|------|-------------|----------|-------|
| POST | `/auth/sms/send` | `SendSmsVerifyCodeRequest` (phone, templateType, signName?) | `Result<Void>` | Rate limited: 60s interval, max 10/day. 5 template types. |
| POST | `/auth/sms/verify` | `VerifySmsCodeRequest` (phone, code, templateType) | `Result<Void>` | Validates against Redis-stored code, deletes on success. |

#### UserController — standard CRUD for user profile management (kept unchanged).

### 3.2 AuthServiceImpl Design Patterns

**File**: `apps/java/auth-service/src/main/java/com/agenthive/auth/service/impl/AuthServiceImpl.java` (273 lines)

**Key patterns**:

1. **Password validation regex**:
   ```java
   private static final Pattern PASSWORD_PATTERN = Pattern.compile(
       "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}$");
   ```

2. **Login IP rate limiting** (incremental counter with 1-min TTL, max 5):
   ```java
   String rateKey = "login:rate:" + clientIp;
   int attempts = /* parse Redis value */;
   if (attempts >= 5) { throw RATE_LIMIT_EXCEEDED; }
   // ... on failure:
   stringRedisTemplate.opsForValue().increment(rateKey);
   stringRedisTemplate.expire(rateKey, 1, TimeUnit.MINUTES);
   // ... on success:
   stringRedisTemplate.delete(rateKey);
   ```

3. **SMS auto-registration** (`smsLogin`): If phone not found, calls `autoRegisterByPhone()` — generates username `phone_XXXX` (last 4 digits), collision-avoidance with suffix, random UUID password, then calls `generateTokens(user, isNewUser=true)`.

4. **Token blacklist on logout**: `blacklist:<token>` → `"1"` with TTL = `expiration - now`. Gateway's `JwtValidationFilter` must be updated to check blacklist (add Redis check before parsing).

5. **`generateTokens()`**: Queries roles from `roleMapper.selectRolesByUserId()`, joins as `String.join(",", roles)`, passes to `jwtUtils.generateAccessToken(subject, Map.of("username", ..., "roles", ...))`.

### 3.3 SmsServiceImpl — Alibaba Cloud Integration

**File**: `apps/java/auth-service/src/main/java/com/agenthive/auth/service/impl/SmsServiceImpl.java` (209 lines)

**Dependency**: `com.aliyun:dypnsapi20170525` (Alibaba Cloud Phone Number Verification SDK), injected via `@Autowired(required = false)`.

**Rate limiting** (Redis):
- Interval: `sms:interval:<phone>` → 60s between sends (configurable via `aliyun.sms.interval-seconds`)
- Daily cap: `sms:daily:<phone>` → max 10/day (configurable via `aliyun.sms.daily-limit`), TTL auto-expires at midnight

**Template types** (`SmsTemplateType` enum, 5 values):
1. `LOGIN_REGISTER` — `templateCodeLoginRegister`
2. `MODIFY_PHONE` — `templateCodeModifyPhone`
3. `RESET_PASSWORD` — `templateCodeResetPassword`
4. `BIND_PHONE` — `templateCodeBindPhone`
5. `VERIFY_PHONE` — `templateCodeVerifyPhone`

**Dev mode bypass**:
```java
if (!smsProperties.isEnabled()) {
    log.warn("[LOCAL DEV] 阿里云 SMS 已禁用，跳过真实发送。验证码 {} 已存入 Redis（phone={}，template={}）",
            code, phone, templateCode);
} else {
    // Real Alibaba Cloud API call via dypnsClient
}
```
Controlled by `ALIYUN_SMS_ENABLED=false` environment variable.

**Code storage**: `sms:code:<phone>:<TEMPLATE_TYPE>` → 6-digit numeric code, TTL = template's `defaultExpireMinutes` (typically 5 min).

### 3.4 JWT Token Structure

**File**: `apps/java/common/common-security/src/main/java/com/agenthive/common/security/util/JwtUtils.java`

```java
public class JwtUtils {
    private static final SecureDigestAlgorithm<SecretKey, SecretKey> SIGNATURE_ALGORITHM = Jwts.SIG.HS256;

    private final SecretKey key;
    private final long accessTokenExpiration;   // default: 86400000 ms = 24h
    private final long refreshTokenExpiration;  // default: 604800000 ms = 7d

    public JwtUtils(String secret, long accessTokenExpiration, long refreshTokenExpiration) {
        byte[] keyBytes = secret.getBytes(StandardCharsets.UTF_8);
        if (keyBytes.length < 32) { throw IllegalArgumentException; }
        this.key = Keys.hmacShaKeyFor(keyBytes);
        // ...
    }
}
```

**Token payload**:
- `sub` (subject): userId as string (e.g., `"1"` or `"42"`)
- `iat` (issued at): current timestamp
- `exp` (expiration): issuedAt + accessTokenExpiration (24h) / refreshTokenExpiration (7d)
- Custom claims: `username` (String), `roles` (String, comma-separated, e.g., `"ADMIN,USER"`)

**Key constraint**: HS256 requires minimum 32-byte key. Constructor validates `keyBytes.length < 32` and throws `IllegalArgumentException`. Gateway's `JwtConfig` provides a second layer of human-readable validation.

### 3.5 Database: auth_db

**File**: `apps/java/auth-service/src/main/resources/db/migration/V1__init.sql`

```sql
CREATE TABLE IF NOT EXISTS sys_user (
  id BIGSERIAL PRIMARY KEY,
  username VARCHAR(64) UNIQUE NOT NULL,
  password VARCHAR(128) NOT NULL,       -- bcrypt hash
  email VARCHAR(128),
  phone VARCHAR(20),
  avatar VARCHAR(500),
  status INT DEFAULT 1,                  -- 1=active, 0=disabled
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted INT DEFAULT 0,                 -- logical delete
  version BIGINT DEFAULT 0               -- optimistic locking
);

CREATE TABLE IF NOT EXISTS sys_role (
  id BIGSERIAL PRIMARY KEY,
  role_code VARCHAR(64) UNIQUE NOT NULL,
  role_name VARCHAR(64) NOT NULL
);

CREATE TABLE IF NOT EXISTS sys_user_role (
  user_id BIGINT NOT NULL,
  role_id BIGINT NOT NULL,
  PRIMARY KEY (user_id, role_id)
);

-- Seeds:
-- roleId=1: ADMIN, roleId=2: USER
-- userId=1: admin/***, userId=2: phone user 18829355062
```

**Entities**: `SysUser extends BaseEntity` (from `common-mybatis`):
```java
// BaseEntity provides:
@TableId(type = IdType.ASSIGN_ID)   // SnowflakeIdGenerator
private Long id;
@TableLogic                        // MyBatis-Plus logical delete
private Integer deleted;
@Version                           // MyBatis-Plus optimistic lock
private Long version;
private LocalDateTime createdAt;
private LocalDateTime updatedAt;
```

### 3.6 Post-Refactoring: Gateway JWT Filter Enhancement

The current `JwtValidationFilter` does **not** check the Redis token blacklist. After refactoring, add a blacklist check:

```java
// In JwtValidationFilter.filter(), after resolving token, before parsing:
Boolean isBlacklisted = reactiveStringRedisTemplate
    .opsForValue().get("blacklist:" + token)
    .map(v -> true)
    .defaultIfEmpty(false)
    .block();  // or use flatMap for fully reactive
if (Boolean.TRUE.equals(isBlacklisted)) {
    return unauthorized(exchange.getResponse());
}
```

---

## 4. Economy Service — NEW (Payment Service Refactored)

**Original**: `apps/java/payment-service/` (port 8083, 5,855 lines, 8 tests)
**Target**: `apps/java/economy-service/` (port 8083, ~7,000+ lines after Creator merge, 8+ tests)
**Database**: `economy_db` (formerly `payment_db`, on `postgres-business`)

### 4.1 Service Rename Checklist

| Item | Before | After |
|------|--------|-------|
| Directory | `apps/java/payment-service/` | `apps/java/economy-service/` |
| Base package | `com.agenthive.payment` | `com.agenthive.economy` |
| ArtifactId | `payment-service` | `economy-service` |
| K8s Deployment name | `payment-service` | `economy-service` |
| K8s Service name | `payment-service` | `economy-service` |
| K8s label component | `payment` | `economy` |
| Docker image | `agenthive/payment-service:latest` | `agenthive/economy-service:latest` |
| Nacos service name | `payment-service` | `economy-service` |
| Database name | `payment_db` | `economy_db` |
| Spring app name | `payment-service` | `economy-service` |

### 4.2 Module Structure

```
apps/java/economy-service/
├── pom.xml
├── src/main/java/com/agenthive/economy/
│   ├── EconomyServiceApplication.java
│   ├── config/
│   │   ├── RabbitConfig.java              # economy.exchange (NEW name)
│   │   ├── WithdrawalConfig.java
│   │   └── WithdrawalAccountEncryptor.java
│   ├── controller/
│   │   ├── PaymentController.java         # POST /payments/, POST /payments/callback
│   │   ├── WalletController.java          # GET/POST /wallets/
│   │   ├── CreditsController.java         # GET /credits/, GET /credits/transactions
│   │   ├── CreditsAgentController.java    # POST /credits/agent/deduct
│   │   ├── MarketplaceProductController.java
│   │   ├── MarketplaceOrderController.java
│   │   ├── HostedWebsiteController.java
│   │   ├── WithdrawalController.java      # POST /withdrawals/, GET /withdrawals/
│   │   ├── CreatorController.java         # MERGED from order-service
│   │   └── AdminWithdrawalController.java
│   ├── service/
│   │   ├── PaymentService.java
│   │   ├── WalletService.java
│   │   ├── CreditsAccountService.java
│   │   ├── CreditsAgentService.java
│   │   ├── MarketplaceOrderService.java
│   │   ├── HostedWebsiteService.java
│   │   ├── TrafficSettlementService.java
│   │   ├── WithdrawalService.java
│   │   ├── CreatorService.java            # MERGED from order-service
│   │   └── impl/
│   │       ├── PaymentServiceImpl.java
│   │       ├── WalletServiceImpl.java
│   │       ├── CreditsAccountServiceImpl.java
│   │       ├── CreditsAgentServiceImpl.java
│   │       ├── MarketplaceOrderServiceImpl.java
│   │       ├── HostedWebsiteServiceImpl.java
│   │       ├── TrafficSettlementServiceImpl.java
│   │       ├── WithdrawalServiceImpl.java
│   │       └── CreatorServiceImpl.java    # MERGED from order-service
│   ├── domain/
│   │   ├── entity/
│   │   │   ├── Payment.java
│   │   │   ├── UserWallet.java
│   │   │   ├── Refund.java
│   │   │   ├── CreditsAccount.java
│   │   │   ├── CreditsTransaction.java
│   │   │   ├── AgentQuotaConfig.java
│   │   │   ├── MarketplaceProduct.java
│   │   │   ├── MarketplaceOrder.java
│   │   │   ├── MarketplacePurchase.java
│   │   │   ├── HostedWebsite.java
│   │   │   ├── TrafficRecord.java
│   │   │   ├── TrafficConversionConfig.java
│   │   │   ├── WithdrawalRecord.java
│   │   │   ├── CreatorProduct.java        # MERGED from order-service
│   │   │   └── CreatorEarning.java        # MERGED from order-service
│   │   ├── enums/
│   │   │   ├── PaymentChannel.java
│   │   │   ├── PaymentStatus.java
│   │   │   ├── RefundStatus.java
│   │   │   ├── CreditsTransactionType.java
│   │   │   ├── MarketplaceOrderStatus.java
│   │   │   ├── MarketplaceProductStatus.java
│   │   │   ├── PayChannel.java
│   │   │   ├── HostedWebsiteStatus.java
│   │   │   ├── WithdrawalStatus.java
│   │   │   └── ProductStatus.java         # MERGED from order-service
│   │   └── vo/
│   │       ├── PaymentVO.java, WalletVO.java, RefundVO.java
│   │       ├── MarketplaceOrderVO.java
│   │       ├── HostedWebsiteVO.java, TrafficStatsVO.java
│   │       ├── WithdrawalVO.java
│   │       ├── CreatorProductVO.java      # MERGED
│   │       ├── CreatorDashboardVO.java    # MERGED
│   │       └── CreatorEarningVO.java      # MERGED
│   ├── mapper/
│   │   ├── PaymentMapper.java
│   │   ├── UserWalletMapper.java
│   │   ├── RefundMapper.java
│   │   ├── CreditsAccountMapper.java      # 5 atomic SQL operations
│   │   ├── CreditsTransactionMapper.java
│   │   ├── AgentQuotaConfigMapper.java
│   │   ├── MarketplaceProductMapper.java
│   │   ├── MarketplaceOrderMapper.java
│   │   ├── MarketplacePurchaseMapper.java
│   │   ├── HostedWebsiteMapper.java
│   │   ├── TrafficRecordMapper.java
│   │   ├── TrafficConversionConfigMapper.java
│   │   ├── WithdrawalRecordMapper.java
│   │   ├── CreatorProductMapper.java      # MERGED
│   │   └── CreatorEarningMapper.java      # MERGED
│   └── internal/common/
│       ├── BusinessException.java
│       ├── GlobalExceptionHandler.java
│       ├── Result.java
│       └── PageResult.java
└── src/main/resources/
    ├── application.yml
    └── db/migration/
        ├── V1__init.sql                   # 13 tables (unchanged from payment_db)
        └── V2__refactor.sql               # NEW: add t_creator_product, t_creator_earning
```

### 4.3 CreditsAccountService — Double-Entry Design

**File**: `apps/java/payment-service/src/main/java/com/agenthive/payment/service/impl/CreditsAccountServiceImpl.java` (203 lines)

**Core pattern**: All balance mutations use atomic `@Update` SQL with `WHERE version = #{version}` for optimistic locking. On zero rows affected, throws `BusinessException("入账失败，请重试")`.

**Five operations**:

| Method | SQL check | What changes | Use case |
|--------|-----------|-------------|----------|
| `addBalance()` | `WHERE user_id = ? AND version = ?` | `balance += amount, total_earned += amount, version += 1` | Traffic rewards, sale earnings, refunds |
| `deductBalance()` | `WHERE user_id = ? AND version = ? AND balance >= ?` | `balance -= amount, total_spent += amount, version += 1` | Agent usage, marketplace purchases |
| `freezeBalance()` | `WHERE user_id = ? AND version = ? AND balance >= ?` | `balance -= amount, frozen_balance += amount, version += 1` | Withdrawal application |
| `unfreezeBalance()` | `WHERE user_id = ? AND version = ? AND frozen_balance >= ?` | `balance += amount, frozen_balance -= amount, version += 1` | Withdrawal rejection |
| `deductFrozenBalance()` | `WHERE user_id = ? AND version = ? AND frozen_balance >= ?` | `frozen_balance -= amount, total_withdrawn += amount, version += 1` | Withdrawal approval |

**Idempotency**: `credit()` checks `creditsTransactionMapper.countBySource(userId, sourceType, sourceId)` before inserting. If count > 0, skips (returns silently). Used by traffic settlement (`TRAFFIC_RECORD`, recordId), marketplace orders (`MARKETPLACE_ORDER`, orderNo), and refunds (`MARKETPLACE_REFUND`, orderNo).

**Seven transaction types** (`CreditsTransactionType`):

```java
public enum CreditsTransactionType {
    EARN_TRAFFIC("流量收益"),     // Traffic rewards
    EARN_SALE("售卖收益"),         // Marketplace sales
    RECHARGE("充值"),              // Wallet recharge
    SPEND_AGENT("Agent 消耗"),     // Agent usage deduction
    WITHDRAW("提现"),              // Withdrawal
    FEE("手续费"),                 // Platform fee / withdrawal fee
    REFUND("退款");                // Order refund
}
```

### 4.4 CreditsMapper — 5 Atomic SQL Operations

**File**: `apps/java/payment-service/src/main/java/com/agenthive/payment/mapper/CreditsAccountMapper.java`

```java
@Mapper
public interface CreditsAccountMapper extends BaseMapper<CreditsAccount> {

    @Update("UPDATE t_credits_account SET balance = balance + #{amount}, " +
            "total_earned = total_earned + #{amount}, version = version + 1, updated_at = NOW() " +
            "WHERE user_id = #{userId} AND version = #{version}")
    int addBalance(@Param("userId") Long userId, @Param("amount") BigDecimal amount,
                   @Param("version") Long version);

    @Update("UPDATE t_credits_account SET balance = balance - #{amount}, " +
            "total_spent = total_spent + #{amount}, version = version + 1, updated_at = NOW() " +
            "WHERE user_id = #{userId} AND version = #{version} AND balance >= #{amount}")
    int deductBalance(@Param("userId") Long userId, @Param("amount") BigDecimal amount,
                      @Param("version") Long version);

    @Update("UPDATE t_credits_account SET balance = balance - #{amount}, " +
            "frozen_balance = frozen_balance + #{amount}, version = version + 1, updated_at = NOW() " +
            "WHERE user_id = #{userId} AND version = #{version} AND balance >= #{amount}")
    int freezeBalance(@Param("userId") Long userId, @Param("amount") BigDecimal amount,
                      @Param("version") Long version);

    @Update("UPDATE t_credits_account SET balance = balance + #{amount}, " +
            "frozen_balance = frozen_balance - #{amount}, version = version + 1, updated_at = NOW() " +
            "WHERE user_id = #{userId} AND version = #{version} AND frozen_balance >= #{amount}")
    int unfreezeBalance(@Param("userId") Long userId, @Param("amount") BigDecimal amount,
                        @Param("version") Long version);

    @Update("UPDATE t_credits_account SET frozen_balance = frozen_balance - #{amount}, " +
            "total_withdrawn = total_withdrawn + #{amount}, version = version + 1, updated_at = NOW() " +
            "WHERE user_id = #{userId} AND version = #{version} AND frozen_balance >= #{amount}")
    int deductFrozenBalance(@Param("userId") Long userId, @Param("amount") BigDecimal amount,
                            @Param("version") Long version);
}
```

All five are plain MyBatis `@Update` — no XML mapper needed. Each uses `version` for optimistic concurrency and an additional `AND balance >= #{amount}` or `AND frozen_balance >= #{amount}` guard to prevent negative values at the database level.

### 4.5 Marketplace

**Files**:
- `MarketplaceOrderServiceImpl.java` (232 lines)
- `MarketplaceProductMapper.java`, `MarketplaceOrderMapper.java`, `MarketplacePurchaseMapper.java`

**Order lifecycle**:
```
PENDING → COMPLETED (on successful payment)
PENDING → REFUNDED  (via refundOrder())
```

**Pricing model**:
- Dual-channel: `PayChannel.CREDITS` (credits_price) or `PayChannel.FIAT` (fiat price)
- Platform fee: 20% (`platform.fee.rate=0.20` in `application.yml`)
- Seller earns: `price - platformFee`
- `PLATFORM_USER_ID = 0L` (platform collects fees into this account)

**Credits payment flow** (`payOrder()`):
```java
// 1. Deduct buyer credits
creditsAccountService.debit(buyerId, price, SPEND_AGENT, "MARKETPLACE", orderNo, desc);
// 2. Credit seller earnings
creditsAccountService.credit(sellerId, sellerEarn, EARN_SALE, "MARKETPLACE_ORDER", orderNo, desc);
// 3. Credit platform fee
creditsAccountService.credit(0L, platformFee, FEE, "MARKETPLACE_ORDER", orderNo, desc);
// 4. Record purchase (unique: buyerId + productId)
// 5. Increment product sales_count
// 6. Set order status = COMPLETED
```

**Fiat payment flow**: Creates a payment via `PaymentService.createPayment()` (synchronous mock), then credits seller + platform in credits.

**Refund**: Checks idempotency via `MARKETPLACE_REFUND` source check. Credits back buyer. Status → `REFUNDED`.

**Purchase dedup**: `UNIQUE (buyer_id, product_id)` on `t_marketplace_purchase` prevents duplicate purchases.

### 4.6 Hosted Website

**File**: `HostedWebsiteServiceImpl.java` (240 lines)

**Subdomain generation with collision retry**:
```java
private String generateUniqueSubdomain(String slug) {
    for (int attempt = 0; attempt < 10; attempt++) {
        String random = randomAlphanum(4);  // a-z0-9, 4 chars
        String subdomain = slug + "-" + random + DOMAIN_SUFFIX;  // e.g., "my-site-a3f9.agenthive.app"
        if (hostedWebsiteMapper.countBySubdomain(subdomain) == 0) {
            return subdomain;
        }
    }
    // Fallback with timestamp
    return slug + "-" + System.currentTimeMillis() + DOMAIN_SUFFIX;
}
```

**UV/PV anti-abuse via Redis**:
```java
// PV: Same session 10 minutes → count once
String pvKey = "traffic:pv:" + websiteId + ":" + sessionId;
Boolean pvNew = redisTemplate.opsForValue().setIfAbsent(pvKey, "1", 10, TimeUnit.MINUTES);

// UV: Same IP + date 1 hour → count once
String uvKey = "traffic:uv:" + websiteId + ":" + dateStr + ":" + ip;
Boolean uvNew = redisTemplate.opsForValue().setIfAbsent(uvKey, "1", 1, TimeUnit.HOURS);
```

**Traffic record upsert**: Query-then-insert with retry-on-insert-conflict pattern (concurrency-safe).

**Statuses**: `ACTIVE` → `DEPLOYING` → `DELETED` (logical).

**Settlement**: `TrafficSettlementServiceImpl` — scheduled job that converts PV/UV to credits based on `t_traffic_conversion_config` thresholds.

### 4.7 Withdrawal — Full Lifecycle

**File**: `WithdrawalServiceImpl.java` (293 lines)

**Status state machine**:
```
PENDING ──approve──> APPROVED ──complete──> COMPLETED
PENDING ──reject───> REJECTED  (unfreezes balance)
APPROVED ──fail─────> FAILED
APPROVED ──process──> PROCESSING ──complete──> COMPLETED
```

**Security features**:
- `account_info_encrypted`: AES-256-GCM via `WithdrawalAccountEncryptor` (bean using `WITHDRAWAL_ENCRYPT_KEY` env var)
- Encrypted at `applyWithdrawal()`, never returned in API responses (field omitted from `WithdrawalVO`)
- Only decrypted server-side for disbursement

**Daily risk controls** (`checkDailyLimits()`):
```java
int todayCount = withdrawalRecordMapper.countTodayByUserId(userId, startOfDay, startOfNextDay);
if (todayCount >= maxDailyCount) throw BusinessException("今日提现次数已达上限");

BigDecimal todayAmount = withdrawalRecordMapper.sumTodayAmountByUserId(userId, startOfDay, startOfNextDay);
if (todayAmount.add(amount).compareTo(maxDailyAmount) > 0) throw BusinessException("今日提现金额已达上限");
```

**Auto-approve**: Amount ≤ `autoApproveThreshold` → auto-calls `approveWithdrawal(recordId, adminId=0L)`.

**Fee calculation**:
```java
BigDecimal feeRate = withdrawalConfig.getFeeRate();  // configurable
BigDecimal feeAmount = amount.multiply(feeRate).setScale(4, RoundingMode.HALF_UP);
BigDecimal netAmount = amount.subtract(feeAmount);
```

**Flow on approval**: `deductFrozen(userId, amount)` → insert `WITHDRAW` transaction (negative amount) → insert `FEE` transaction → mark `APPROVED`.

**Flow on rejection**: `unfreeze(userId, amount)` → mark `REJECTED`.

### 4.8 Creator Products — Merged from Order Service

**Original**: `apps/java/order-service/src/main/java/com/agenthive/order/service/impl/CreatorServiceImpl.java` (264 lines)
**Original Controller**: `apps/java/order-service/src/main/java/com/agenthive/order/controller/CreatorController.java`

**API migrated as-is** to economy-service under `/creator/` prefix:

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | `/creator/products` | `X-User-Id` header | Publish new product |
| PUT | `/creator/products/{productId}` | `X-User-Id` (ownership check) | Update product |
| PUT | `/creator/products/{productId}/status` | `X-User-Id` | Toggle ACTIVE/INACTIVE |
| DELETE | `/creator/products/{productId}` | `X-User-Id` | Logical delete |
| GET | `/creator/products/{productId}` | Public | View product |
| GET | `/creator/products` | `X-User-Id` | List my products (filter by status) |
| GET | `/creator/dashboard` | `X-User-Id` | Dashboard (active count, total sales, revenue, monthly earnings) |
| GET | `/creator/earnings` | `X-User-Id` | Paginated earnings history with date range |

**CreatorProduct fields**:
```java
private Long creatorId;          // X-User-Id from header
private String name;
private String description;
private String type;             // Agent template type
private String techStackTags;    // comma-separated
private int creditsPrice;        // Credits price (integer)
private BigDecimal fiatPrice;    // Optional fiat price
private String previewImages;    // comma-separated URLs
private String demoUrl;          // Demo page URL
private Long sourceProjectId;    // Source project in Node API
private ProductStatus status;    // ACTIVE / INACTIVE
private int salesCount;          // Incremented on Marketplace purchase
private BigDecimal totalRevenue; // Aggregated from earnings
```

**Dashboard computation** (in-memory aggregation):
```java
// totalProducts: COUNT WHERE creator_id = ? AND deleted = 0
// activeProducts: COUNT WHERE creator_id = ? AND status = 'ACTIVE' AND deleted = 0
// totalSales: SUM(sales_count) across all creator products
// totalRevenue: SUM(total_revenue) across all creator products (BigDecimal add)
// monthlyEarning: SUM(net_earning) FROM t_creator_earning WHERE creator_id = ?
//                  AND created_at BETWEEN monthStart AND monthEnd
```

**PublishProductRequest**:
```java
@Data
public class PublishProductRequest {
    @NotBlank private String name;
    @NotBlank private String description;
    @NotBlank private String type;
    private List<String> techStackTags;
    @NotNull @Min(1) private Integer creditsPrice;
    @DecimalMin("0.01") private BigDecimal fiatPrice;
    private List<String> previewImages;
    private String demoUrl;
    private Long sourceProjectId;
}
```

### 4.9 RabbitMQ Configuration

**File**: `apps/java/payment-service/src/main/java/com/agenthive/payment/config/RabbitConfig.java` — renamed to use `economy.exchange`:

```java
@Configuration
public class RabbitConfig {

    public static final String EXCHANGE_ECONOMY = "economy.exchange";  // RENAMED

    // 6 queues:
    public static final String QUEUE_PAYMENT_CREATED = "payment.created.queue";
    public static final String QUEUE_PAYMENT_SUCCESS = "payment.success.queue";
    public static final String QUEUE_PAYMENT_REFUNDED = "payment.refunded.queue";
    public static final String QUEUE_ORDER_CREATED = "order.created.queue";  // kept for marketplace
    public static final String QUEUE_TRAFFIC_SETTLEMENT = "economy.traffic.settlement.queue";  // NEW
    public static final String QUEUE_CREATOR_EARNING = "economy.creator.earning.queue";  // NEW

    // Routing keys:
    public static final String ROUTING_PAYMENT_CREATED = "payment.created";
    public static final String ROUTING_PAYMENT_SUCCESS = "payment.success";
    public static final String ROUTING_PAYMENT_REFUNDED = "payment.refunded";
    public static final String ROUTING_ORDER_CREATED = "order.created";
    public static final String ROUTING_TRAFFIC_SETTLEMENT = "traffic.settlement";   // NEW
    public static final String ROUTING_CREATOR_EARNING = "creator.earning";         // NEW

    @Bean
    public DirectExchange economyExchange() {
        return new DirectExchange(EXCHANGE_ECONOMY);
    }
    // ... 6 queue beans + 6 binding beans
}
```

**Exchange topology after refactoring**:
```
economy.exchange (DirectExchange)
├── payment.created.queue     ← routing: payment.created
├── payment.success.queue     ← routing: payment.success
├── payment.refunded.queue    ← routing: payment.refunded
├── order.created.queue       ← routing: order.created       (marketplace orders)
├── economy.traffic.settlement.queue ← routing: traffic.settlement  (NEW: scheduled)
└── economy.creator.earning.queue    ← routing: creator.earning     (NEW: post-purchase)
```

### 4.10 Redisson Distributed Lock Key Conventions

Used in `PaymentServiceImpl` for payment creation and `HostedWebsiteServiceImpl` for traffic settlement:

```
lock:payment:{orderNo}           — Payment creation (BALANCE channel)
lock:wallet:{userId}              — Wallet recharge
lock:withdrawal:{userId}          — Withdrawal application
lock:traffic:settlement:{date}    — Daily traffic settlement job
lock:marketplace:order:{orderNo}  — Marketplace order payment
```

### 4.11 GlobalExceptionHandler with Extended ResultCode

**File** (existing): `apps/java/payment-service/src/main/java/com/agenthive/payment/internal/common/GlobalExceptionHandler.java`

After refactoring, must be updated to use common `ResultCode` from `common-core` (not the local `Result`) and extended with economy-specific codes:

```java
// In common-core ResultCode.java — add economy codes (7000-7499):
PURCHASE_LIMIT_REACHED(7106, "Purchase limit reached"),
WITHDRAWAL_DAILY_LIMIT(7107, "Daily withdrawal limit reached"),
WITHDRAWAL_AMOUNT_TOO_LOW(7108, "Withdrawal amount below minimum"),
WEBSITE_NOT_FOUND(7109, "Hosted website not found"),
PRODUCT_NOT_ACTIVE(7110, "Product is not active"),
ALREADY_PURCHASED(7111, "Already purchased this product"),
DUPLICATE_SETTLEMENT(7112, "Settlement already processed");
```

The economy-service's `GlobalExceptionHandler` should catch `BusinessException` (local) and map to `Result.error(code, message)`, plus handle `BindException` for validation errors.

### 4.12 Application.yml for Economy Service

```yaml
server:
  port: 8083

spring:
  application:
    name: economy-service
  datasource:
    url: jdbc:postgresql://${DB_HOST:localhost}:${DB_PORT:5432}/${DB_NAME:economy_db}
    username: ${DB_USER}
    password: ${DB_PASSWORD}
  redis:
    host: ${SPRING_DATA_REDIS_HOST:localhost}
    port: ${SPRING_DATA_REDIS_PORT:6379}
    password: ${SPRING_DATA_REDIS_PASSWORD:}
  rabbitmq:
    host: ${RABBITMQ_HOST:localhost}
    port: ${RABBITMQ_PORT:5672}
    username: ${RABBITMQ_USER:agenthive}
    password: ${RABBITMQ_PASSWORD:}
  flyway:
    enabled: true
    locations: classpath:db/migration

platform:
  fee:
    rate: 0.20

withdrawal:
  min-amount: 10.00
  max-daily-count: 3
  max-daily-amount: 1000.00
  fee-rate: 0.01
  auto-approve-threshold: 100.00

logging:
  level:
    com.agenthive.economy: DEBUG
```

---

## 5. Deletion Strategy

### 5.1 What Gets Deleted (Entire Services)

| Service | Directory | Lines | Reason |
|---------|-----------|-------|--------|
| **cart-service** | `apps/java/cart-service/` | 773 | Shopping cart is e-commerce specific, not needed |
| **logistics-service** | `apps/java/logistics-service/` | 878 | Logistics tracking is e-commerce specific, not needed |

### 5.2 What Gets Partially Deleted (Order Service)

**Keep** (merged into economy-service):
- `CreatorProduct.java` (entity)
- `CreatorEarning.java` (entity)
- `CreatorProductMapper.java`
- `CreatorEarningMapper.java`
- `CreatorProductVO.java`, `CreatorDashboardVO.java`, `CreatorEarningVO.java` (VOs)
- `CreatorServiceImpl.java`
- `CreatorController.java`
- `PublishProductRequest.java`, `UpdateProductRequest.java`
- `ProductStatus.java` (enum)
- DDL for `t_creator_product` and `t_creator_earning`

**Delete** (e-commerce code):
- `Order.java`, `OrderItem.java`, `OrderVO.java`, `OrderItemVO.java`
- `OrderStatus.java`
- `OrderMapper.java`, `OrderItemMapper.java`
- `OrderServiceImpl.java` (~170 lines)
- `OrderController.java`
- DDL for `t_order`, `t_order_item`
- `PaymentSuccessListener.java`
- `LogisticsListener.java`
- `RabbitConfig.java` (order-service specific, queues for order created/paid/shipped)
- `order_db` database (entire)

**The entire `apps/java/order-service/` directory is deleted** after Creator code is migrated.

### 5.3 Files to Update

| File | Change |
|------|--------|
| `apps/java/pom.xml` (parent) | Remove `<module>cart-service</module>`, `<module>logistics-service</module>`, `<module>order-service</module>`; rename `<module>payment-service</module>` to `<module>economy-service</module>` |
| `apps/java/economy-service/pom.xml` | Change artifactId from `payment-service` to `economy-service` |
| Each service's `Dockerfile` | Update `COPY` target JAR name |
| `k8s/base/10-java-services.yaml` | Remove Cart/Logistics/Order Deployments+Services; rename Payment→Economy (change all labels, names, DB_NAME to `economy_db`); remove `wait-for-rabbitmq` init container from economy-service if not needed |
| `apps/java/gateway-service/src/main/resources/application.yml` | Update route table (Section 2.7) |
| `.github/workflows/` CI files | Remove cart/logistics/order build steps; rename payment→economy |
| `docker-compose.yml` (if present) | Remove cart/logistics/order containers |

---

## 6. Database

### 6.1 economy_db — 14 Tables

After refactoring, `economy_db` (formerly `payment_db`) contains the following tables:

**Existing 13 tables** (from `V1__init.sql` in payment-service):
1. `t_payment` — Payment records (PAY-nnn)
2. `t_user_wallet` — User wallets with optimistic locking
3. `t_refund` — Refund records (RFD-nnn)
4. `t_credits_account` — Credits balances (double-entry source of truth)
5. `t_credits_transaction` — Transaction journal (immutable)
6. `t_agent_quota_config` — Agent pricing configuration
7. `t_marketplace_product` — Marketplace products
8. `t_marketplace_order` — Marketplace orders (MK-nnn)
9. `t_marketplace_purchase` — Purchase records (buyer-product dedup)
10. `t_hosted_website` — Hosted website registrations
11. `t_traffic_record` — Daily PV/UV traffic records
12. `t_traffic_conversion_config` — PV/UV-to-credits conversion rules
13. `t_withdrawal_record` — Withdrawal lifecycle records

**NEW ADDITION** via Flyway V2 migration — 1 table (`t_creator_product` = 14th table, `t_creator_earning` = 15th table):

### 6.2 Flyway V2__refactor.sql

**File**: `apps/java/economy-service/src/main/resources/db/migration/V2__refactor.sql`

```sql
-- Flyway migration: V2__refactor.sql
-- Service: economy-service
-- Description: Add creator tables (merged from order-service)

CREATE TABLE IF NOT EXISTS t_creator_product (
    id BIGSERIAL PRIMARY KEY,
    creator_id BIGINT NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    type VARCHAR(20) NOT NULL,
    tech_stack_tags VARCHAR(500),
    credits_price INT NOT NULL,
    fiat_price DECIMAL(18,2),
    preview_images TEXT,
    demo_url VARCHAR(500),
    source_project_id BIGINT,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    sales_count INT DEFAULT 0,
    total_revenue DECIMAL(18,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted INT DEFAULT 0,
    version BIGINT DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_creator_product_creator_id ON t_creator_product(creator_id);
CREATE INDEX IF NOT EXISTS idx_creator_product_status ON t_creator_product(status);
CREATE INDEX IF NOT EXISTS idx_creator_product_type ON t_creator_product(type);

CREATE TABLE IF NOT EXISTS t_creator_earning (
    id BIGSERIAL PRIMARY KEY,
    creator_id BIGINT NOT NULL,
    product_id BIGINT NOT NULL,
    product_name VARCHAR(200),
    buyer_id BIGINT NOT NULL,
    credits_amount INT,
    fiat_amount DECIMAL(18,2),
    platform_fee DECIMAL(18,2) DEFAULT 0.00,
    net_earning DECIMAL(18,2) DEFAULT 0.00,
    settled_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted INT DEFAULT 0,
    version BIGINT DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_creator_earning_creator_id ON t_creator_earning(creator_id);
CREATE INDEX IF NOT EXISTS idx_creator_earning_product_id ON t_creator_earning(product_id);
CREATE INDEX IF NOT EXISTS idx_creator_earning_created_at ON t_creator_earning(created_at);
```

### 6.3 Drop Order DB Tables

Manual SQL for DBA execution (not Flyway — these were in a separate `order_db` database):
```sql
-- Run against postgres-business, on the now-dropped order_db
DROP TABLE IF EXISTS t_order_item CASCADE;
DROP TABLE IF EXISTS t_order CASCADE;
DROP DATABASE IF EXISTS order_db;  -- Or drop via K8s/k3d
```

### 6.4 Database Server Assignment

| Database | PostgreSQL Server | Service |
|----------|------------------|---------|
| `auth_db` | `postgres-auth` | auth-service (8081) |
| `economy_db` | `postgres-business` | economy-service (8083) |

`auth_db` remains on its own server for security isolation (user credentials). `economy_db` merges what was previously `payment_db` + `order_db` creator tables into a single `postgres-business` database.

---

## Appendix A: Test Status

| Service | Tests | Files |
|---------|-------|-------|
| Gateway | 6 | JwtValidationFilterTest (9.3KB), RateLimitFilterTest (4.3KB), TraceIdFilterTest (4.0KB), CorsConfigDevTest (4.9KB), CorsConfigProdTest (5.0KB), JwtConfigTest (3.4KB) |
| Auth | 7 | (existing auth service tests) |
| Economy (was Payment) | 8 | CreditsAccountServiceImplTest (11.5KB), CreditsAgentServiceImplTest (9.2KB), HostedWebsiteServiceImplTest (7.9KB), MarketplaceOrderServiceImplTest (8.8KB), TrafficSettlementServiceImplTest (12.2KB), WithdrawalServiceImplTest (13.9KB), PaymentServiceImplTest, WalletServiceImplTest |
| Order (Creator only) | 0 | Tests must be written after Creator migration to economy-service |

---

## Appendix B: K8s Manifest Changes (Summary)

In `k8s/base/10-java-services.yaml`:

1. **Remove**: Cart Service Deployment+Service (lines 733-933), Logistics Service Deployment+Service (lines 934-1135), Order Service Deployment+Service (lines 535-731)
2. **Rename**: Payment Service Deployment+Service (lines 330-533):
   - `name: payment-service` → `name: economy-service`
   - `app.kubernetes.io/name: payment-service` → `app.kubernetes.io/name: economy-service`
   - `app.kubernetes.io/component: payment` → `app.kubernetes.io/component: economy`
   - `image: agenthive/payment-service:latest` → `image: agenthive/economy-service:latest`
   - `DB_NAME: payment_db` → `DB_NAME: economy_db`
   - Container port remains 8083
   - Service port remains 8083

---

## Appendix C: Key File Paths Reference

| Component | Absolute Path |
|-----------|---------------|
| Gateway JwtValidationFilter | `e:\Git\agenthive-cloud\apps\java\gateway-service\src\main\java\com\agenthive\gateway\filter\JwtValidationFilter.java` |
| Gateway RateLimitFilter | `e:\Git\agenthive-cloud\apps\java\gateway-service\src\main\java\com\agenthive\gateway\filter\RateLimitFilter.java` |
| Gateway TraceIdFilter | `e:\Git\agenthive-cloud\apps\java\gateway-service\src\main\java\com\agenthive\gateway\filter\TraceIdFilter.java` |
| Gateway JwtConfig | `e:\Git\agenthive-cloud\apps\java\gateway-service\src\main\java\com\agenthive\gateway\config\JwtConfig.java` |
| Gateway CorsConfig | `e:\Git\agenthive-cloud\apps\java\gateway-service\src\main\java\com\agenthive\gateway\config\CorsConfig.java` |
| Gateway AbsoluteUriFilter | `e:\Git\agenthive-cloud\apps\java\gateway-service\src\main\java\com\agenthive\gateway\config\AbsoluteUriFilter.java` |
| Gateway application.yml | `e:\Git\agenthive-cloud\apps\java\gateway-service\src\main\resources\application.yml` |
| Auth AuthController | `e:\Git\agenthive-cloud\apps\java\auth-service\src\main\java\com\agenthive\auth\controller\AuthController.java` |
| Auth AuthServiceImpl | `e:\Git\agenthive-cloud\apps\java\auth-service\src\main\java\com\agenthive\auth\service\impl\AuthServiceImpl.java` |
| Auth SmsServiceImpl | `e:\Git\agenthive-cloud\apps\java\auth-service\src\main\java\com\agenthive\auth\service\impl\SmsServiceImpl.java` |
| Auth V1__init.sql | `e:\Git\agenthive-cloud\apps\java\auth-service\src\main\resources\db\migration\V1__init.sql` |
| Common JwtUtils | `e:\Git\agenthive-cloud\apps\java\common\common-security\src\main\java\com\agenthive\common\security\util\JwtUtils.java` |
| Common ResultCode | `e:\Git\agenthive-cloud\apps\java\common\common-core\src\main\java\com\agenthive\common\core\result\ResultCode.java` |
| Economy (Payment) CreditsAccountServiceImpl | `e:\Git\agenthive-cloud\apps\java\payment-service\src\main\java\com\agenthive\payment\service\impl\CreditsAccountServiceImpl.java` |
| Economy (Payment) CreditsAccountMapper | `e:\Git\agenthive-cloud\apps\java\payment-service\src\main\java\com\agenthive\payment\mapper\CreditsAccountMapper.java` |
| Economy (Payment) CreditsTransactionType | `e:\Git\agenthive-cloud\apps\java\payment-service\src\main\java\com\agenthive\payment\domain\enums\CreditsTransactionType.java` |
| Economy (Payment) MarketplaceOrderServiceImpl | `e:\Git\agenthive-cloud\apps\java\payment-service\src\main\java\com\agenthive\payment\service\impl\MarketplaceOrderServiceImpl.java` |
| Economy (Payment) HostedWebsiteServiceImpl | `e:\Git\agenthive-cloud\apps\java\payment-service\src\main\java\com\agenthive\payment\service\impl\HostedWebsiteServiceImpl.java` |
| Economy (Payment) WithdrawalServiceImpl | `e:\Git\agenthive-cloud\apps\java\payment-service\src\main\java\com\agenthive\payment\service\impl\WithdrawalServiceImpl.java` |
| Economy (Payment) GlobalExceptionHandler | `e:\Git\agenthive-cloud\apps\java\payment-service\src\main\java\com\agenthive\payment\internal\common\GlobalExceptionHandler.java` |
| Economy (Payment) V1__init.sql | `e:\Git\agenthive-cloud\apps\java\payment-service\src\main\resources\db\migration\V1__init.sql` |
| Economy (Payment) RabbitConfig | `e:\Git\agenthive-cloud\apps\java\payment-service\src\main\java\com\agenthive\payment\config\RabbitConfig.java` |
| Order CreatorController | `e:\Git\agenthive-cloud\apps\java\order-service\src\main\java\com\agenthive\order\controller\CreatorController.java` |
| Order CreatorServiceImpl | `e:\Git\agenthive-cloud\apps\java\order-service\src\main\java\com\agenthive\order\service\impl\CreatorServiceImpl.java` |
| Order V1__init.sql | `e:\Git\agenthive-cloud\apps\java\order-service\src\main\resources\db\migration\V1__init.sql` |
| K8s Java Services Manifest | `e:\Git\agenthive-cloud\k8s\base\10-java-services.yaml` |

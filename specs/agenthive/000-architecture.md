# AgentHive Cloud Architecture Specification

**Document ID**: SPEC-000
**Version**: 1.0.0
**Status**: Final
**Last Updated**: 2026-05-09
**Source of Truth**: Code as of commit `2c0de00` on `develop` branch

---

## 1. System Architecture Diagram

```
                                    INTERNET
                                       |
                                  [Cloudflare / LB]
                                       |
                              +--------+--------+
                              |      NGINX      |
                              |  (TLS 1.2/1.3)  |
                              |  Port 80/443    |
                              +--------+--------+
                                       |
                    +------------------+------------------+
                    |                  |                  |
                   /             /api | socket.io       /socket.io
                  /                   |                  /
                 v                    v                 v
           [Landing:80]     +-------------------+  (bypass to Gateway)
          (Nuxt 3 SSR)      |  GATEWAY-SERVICE  |
                            |  (SCG + WebFlux)  |
                            |  Port 8080        |
                            +-------------------+
                            |  Filter Chain      |
                            |  order=-150..0    |
                            |  +----------------+|
                            |  | TraceIdFilter  ||  X-Trace-Id
                            |  | RateLimitFilter||  Redis Lua
                            |  | JwtValidation  ||  HS256 verify
                            |  | Filter         ||  + inject headers
                            |  +----------------+|
                            |  Route Predicates  |
                            +--------+----------+
                                     |
              +----------------------+-----------------------+
              |                      |                       |
     [lb://auth-service]    [lb://payment-service]   [Node.js API]
     [lb://order-service]   [lb://cart-service]      ${API_SERVICE_URL}
     [lb://logistics-service]                        (default :3001)
              |                      |                       |
     +--------+--------+    +-------+--------+    +---------+---------+
     | AUTH-SERVICE     |    | BUSINESS        |    | NODE.JS API      |
     | (Spring Boot 3)  |    | SERVICES (x4)   |    | (Express + TS)   |
     | Port: dynamic    |    | (Spring Boot 3) |    | Port 3001        |
     | DB: auth_db      |    | Each: own DB    |    | DB: agenthive    |
     +------------------+    +------------------+    +------------------+
              |                      |                       |
     +--------+--------+    +-------+--------+    +---------+---------+
     | NACOS            |    | RABBITMQ        |    | REDIS STREAMS    |
     | Service Discovery|    | Async Events    |    | Task Queue       |
     +------------------+    +------------------+    +------------------+
              |                      |                       |
     +--------+--------+    +-------+--------+    +---------+---------+
     | POSTGRESQL       |    | POSTGRESQL      |    | POSTGRESQL       |
     | auth_db (Java)   |    | payment_db etc  |    | agenthive (Node) |
     +------------------+    +------------------+    +------------------+
              |                      |                       |
              +----------------------+-----------------------+
                                     |
                        +------------+------------+
                        | MONITORING STACK         |
                        | Prometheus + Tempo       |
                        | Loki + Grafana + Beyla   |
                        | MinIO (S3 backend)       |
                        +--------------------------+
```

---

## 2. Component Contract Interfaces

| Service | Port | Technology | DB | Responsibilities |
|---------|------|-----------|-----|-----------------|
| **Nginx** | 80/443 | nginx (reverse proxy) | -- | TLS termination (1.2/1.3), HSTS, security headers, W3C trace-context propagation, routes `/` -> Landing, `/api` -> Gateway, `/socket.io` -> Gateway |
| **Gateway Service** | 8080 | Spring Cloud Gateway + WebFlux + Java 21 | -- | JWT validation (HS256), IP-based rate limiting (Redis Lua, 200/60s), X-User-Id/X-User-Name/X-User-Role header injection, route predicates to lb:// services and Node API, Swagger UI aggregation |
| **Auth Service** | dynamic | Spring Boot 3.2.12 + MyBatis-Plus 3.5.9 | `auth_db` | User registration (password regex: A-Z+a-z+0-9+special, 8+), login (bcrypt, IP rate 5/min), SMS login (Alibaba Dypnsapi + auto-register), JWT generation (access 24h, refresh 7d), token refresh, logout (Redis blacklist), profile update |
| **Payment Service** | dynamic | Spring Boot 3.2.12 | `payment_db` | Payment processing (own database per microservice pattern) |
| **Order Service** | dynamic | Spring Boot 3.2.12 | `order_db` | Order lifecycle management |
| **Cart Service** | dynamic | Spring Boot 3.2.12 | `cart_db` | Shopping cart CRUD |
| **Logistics Service** | dynamic | Spring Boot 3.2.12 | `logistics_db` | Logistics/shipping tracking |
| **Node.js API** | 3001 | Express + TypeScript (ESM) | `agenthive` (PostgreSQL) | AI control plane: chat sessions, projects, agents, tasks, code files, WebSocket hub (Socket.IO), LLM integration, workspace management, agent task execution (Redis Streams), billing retry |
| **Agent Runtime** | dynamic | Node.js | -- | Agent execution sandbox, LLM tool calling, WebSocket communication with API |
| **Nacos** | 8848 | Spring Cloud Alibaba | -- | Service discovery + config management for all Java services |
| **Redis** | 6379 | Redisson 3.27.0 / Node ioredis | -- | Rate limiting (Gateway Lua scripts), login rate limiting (Auth Service), JWT blacklist, task queues (Node Redis Streams), session caching, distributed locks |
| **RabbitMQ** | 5672 | Spring AMQP | -- | Async event bus between Java microservices (order events, payment events, etc.) |
| **Monitoring** | various | Grafana LGTM + Beyla | S3 (MinIO) | Prometheus (metrics, :9090), Tempo (traces, :3200), Loki (logs, :3100), Grafana (dashboards, :3003), Beyla eBPF (auto-instrumentation), OTel Collector (:4317 gRPC, :4318 HTTP) |

---

## 3. Technology Stack Versions

### Java Ecosystem
| Component | Version | Notes |
|-----------|---------|-------|
| Java | 21 | LTS |
| Spring Boot | 3.2.12 | |
| Spring Cloud | 2023.0.5 | |
| Spring Cloud Alibaba | 2023.0.1.0 | Nacos integration |
| MyBatis-Plus | 3.5.9 | BaseEntity with ASSIGN_ID, @TableLogic, @Version |
| Redisson | 3.27.0 | Reactive Redis for Gateway |
| Flyway | 10.15.2 | Database migration |
| JJWT | 0.12.5 | JWT signing/verification |
| MapStruct | 1.5.5.Final | Object mapping |
| Lombok | 1.18.30 | Boilerplate reduction |
| Springdoc | 2.6.0 | OpenAPI 3 / Swagger |

### Node.js Ecosystem
| Component | Details |
|-----------|---------|
| Runtime | Node.js (ESM, TypeScript) |
| Framework | Express 4.x |
| Migration | node-pg-migrate |
| Async Queue | Redis Streams |
| WebSocket | Socket.IO |
| Monorepo | pnpm workspace (`apps/*`, `packages/*`) |
| Packages | `@agenthive/observability`, `@agenthive/agent-runtime`, `@agenthive/ui`, `@agenthive/types`, `@agenthive/workflow-engine` |

---

## 4. Gateway JWT Authentication Flow

### 4.1 Filter Chain Order

```
TraceIdFilter       (order = -150)   -> Generates X-Trace-Id if missing
RateLimitFilter      (order = -50)    -> Redis Lua sliding window, 200 req/60s per IP
JwtValidationFilter  (order = -100)   -> JWT verify + header injection
Route Predicates                      -> Path-based routing to downstream
```

*Note on ordering: JwtValidationFilter runs BEFORE RateLimitFilter because SCG filter ordering: higher priority (more negative) runs first. `-100` < `-50`, so JWT check runs first, then rate limit.*

### 4.2 JWT Validation Step-by-Step

**Source**: `apps/java/gateway-service/src/main/java/com/agenthive/gateway/filter/JwtValidationFilter.java:56-91`

1. **Extract path** from `request.getURI().getPath()`
2. **Whitelist check** (lines 61-63): If path matches any of:
   - `/api/auth/register`
   - `/api/auth/login`
   - `/api/auth/login/sms`
   - `/api/auth/sms/send`
   - `/api/auth/refresh`
   - `/api/demo/**`
   - `/api/health`
   - `/actuator/**`

   then skip JWT validation entirely (pass through to downstream).
3. **Resolve token** (lines 65-68): Extract `Bearer <token>` from `Authorization` header using `resolveToken()`. If missing -> return 401.
4. **Verify JWT** (lines 70-76): Using HS256 (`HmacSHA256`) with the configured secret key. Parse claims: subject (userId), username, roles.
5. **Inject downstream headers** (lines 81-85):
   ```java
   ServerHttpRequest mutatedRequest = exchange.getRequest().mutate()
       .header("X-User-Id", claims.getSubject())          // Java BIGINT user ID as string
       .header("X-User-Name", username != null ? username : "")
       .header("X-User-Role", roles != null ? roles : "")
       .build();
   ```
6. **On failure** (lines 87-90): Log warning, return HTTP 401 with empty body.

### 4.3 JWT Config Validation at Startup

**Source**: `apps/java/gateway-service/src/main/java/com/agenthive/gateway/config/JwtConfig.java:14-42`

On `@PostConstruct`, the Gateway validates the JWT secret:
- Must not be an unresolved placeholder (`${...}`)
- Must not be null or blank
- Must be >= 32 characters (256 bits for HS256)
- Must NOT contain weak words: "default", "secret", "password", "123"

Identical validation exists in `common-security`'s `JwtUtils` constructor (`apps/java/common/common-security/src/main/java/com/agenthive/common/security/util/JwtUtils.java:24-30`).

---

## 5. X-User-Id Header Injection and User ID Mapping

### 5.1 Three Headers Injected by Gateway

| Header | Source | Example |
|--------|--------|---------|
| `X-User-Id` | JWT subject claim (Java BIGINT) | `"1"` or `"42"` |
| `X-User-Name` | JWT `username` claim | `"admin"` |
| `X-User-Role` | JWT `roles` claim (comma-separated) | `"ADMIN,USER"` |

The JWT is generated by Auth Service with these claims (`apps/java/auth-service/src/main/java/com/agenthive/auth/service/impl/AuthServiceImpl.java:226-231`):
```java
String accessToken = jwtUtils.generateAccessToken(String.valueOf(user.getId()),
    Map.of("username", user.getUsername(), "roles", String.join(",", roles)));
```

### 5.2 JWT Token Parameters

**Source**: `apps/java/common/common-security/src/main/java/com/agenthive/common/security/util/JwtUtils.java:18-20`

| Parameter | Value |
|-----------|-------|
| Algorithm | HS256 (HMAC-SHA256) |
| Access Token TTL | 24 hours (default `3600000` ms overridden to 24h) |
| Refresh Token TTL | 7 days |

### 5.3 Node.js API: How Headers Are Consumed

**Source**: `apps/api/src/middleware/auth.ts:70-124`

The Node.js API NEVER re-validates the JWT. It trusts the Gateway as the single authentication boundary:

```typescript
// Production: extract from Gateway headers
async function resolveGatewayUser(req: Request): Promise<boolean> {
  const externalId = req.headers['x-user-id'] as string | undefined
  if (!externalId) return false
  // ... maps to local user via userMapping service
}
```

Auth modes by environment:
| Environment | Behavior |
|-------------|----------|
| `production` | Requires `X-User-Id` from Gateway; returns 401 if missing |
| `development` | Injects mock user from `DEV_USER_ID` env var (auto-creates in DB) |
| `test` | Auto-passes with `test-user-id` |

### 5.4 User ID Mapping: Java BIGINT -> Node UUID

**Source**: `apps/api/src/services/userMapping.ts:1-64`

The `resolveLocalUser()` function bridges Java's BIGINT user IDs with Node.js' UUID primary keys:

1. **Lookup by `external_user_id`**: Searches `users.external_user_id` column for the Java user ID string.
2. **Migration compatibility**: If not found by external ID, searches by `username` to link pre-existing local users.
3. **Auto-create**: If still not found, creates a new local user with `external_user_id` set and default role.

**Migration**: `apps/api/src/db/migrations/20260503180000_add-external-user-id.sql`
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS external_user_id VARCHAR(255) UNIQUE;
CREATE INDEX IF NOT EXISTS idx_users_external_user_id ON users(external_user_id);
```

---

## 6. Complete Route Table

**Source**: `apps/java/gateway-service/src/main/resources/application.yml:10-55`

```yaml
spring:
  cloud:
    gateway:
      routes:
        - id: auth-service
          uri: lb://auth-service        # Nacos load-balanced
          predicates:
            - Path=/api/auth/**
          filters:
            - StripPrefix=1             # /api/auth/login -> /auth/login

        - id: auth-service-users
          uri: lb://auth-service
          predicates:
            - Path=/api/users/**
          filters:
            - StripPrefix=1

        - id: payment-service
          uri: lb://payment-service
          predicates:
            - Path=/api/payments/**
          filters:
            - StripPrefix=1

        - id: order-service
          uri: lb://order-service
          predicates:
            - Path=/api/orders/**
          filters:
            - StripPrefix=1

        - id: cart-service
          uri: lb://cart-service
          predicates:
            - Path=/api/carts/**
          filters:
            - StripPrefix=1

        - id: logistics-service
          uri: lb://logistics-service
          predicates:
            - Path=/api/logistics/**
          filters:
            - StripPrefix=1

        - id: api-service
          uri: ${API_SERVICE_URL:http://localhost:3001}  # Env-configurable Node API
          predicates:
            - Path=/api/agents/**,/api/tasks/**,/api/code/**,
                   /api/projects/**,/api/chat/**,/api/demo/**,/api/health
          filters:
            - StripPrefix=0             # No prefix stripping for Node API
```

**Route Resolution Order** (first match wins):
1. `/api/auth/**` and `/api/users/**` -> `lb://auth-service` (StripPrefix=1)
2. `/api/payments/**` -> `lb://payment-service`
3. `/api/orders/**` -> `lb://order-service`
4. `/api/carts/**` -> `lb://cart-service`
5. `/api/logistics/**` -> `lb://logistics-service`
6. `/api/agents/**`, `/api/tasks/**`, `/api/code/**`, `/api/projects/**`, `/api/chat/**`, `/api/demo/**`, `/api/health` -> Node.js API (StripPrefix=0, path preserved as-is)

**Key**: All Java services use `lb://` (Nacos service discovery). Node API uses a direct URL configured via `API_SERVICE_URL` environment variable.

---

## 7. Request Lifecycle (End-to-End Trace)

### 7.1 Authenticated API Request (e.g., `GET /api/chat/sessions`)

```
Step 1: NGINX (nginx/nginx.conf:135-148)
  - Receives HTTPS request on :443
  - Adds security headers (HSTS, X-Frame-Options, etc.)
  - Propagates W3C trace context: proxy_set_header traceparent $http_traceparent
  - Sets X-Forwarded-For, X-Real-IP
  - Proxy pass to http://gateway (gateway-service:8080)

Step 2: Gateway - TraceIdFilter (order=-150)
  - Generates X-Trace-Id header if not present (UUID)
  - Stored in SLF4J MDC for log correlation

Step 3: Gateway - JwtValidationFilter (order=-100)
  - Path /api/chat/sessions is NOT in whitelist
  - Extracts Bearer token from Authorization header
  - Verifies HS256 JWT signature using configured secret
  - Extracts claims: subject="1", username="admin", roles="ADMIN"
  - Mutates request to add headers:
    X-User-Id: "1"
    X-User-Name: "admin"
    X-User-Role: "ADMIN"

Step 4: Gateway - RateLimitFilter (order=-50)
  - Key: gateway:rate:<client_ip>
  - Redis Lua script: sliding window, 200 requests per 60 seconds
  - If exceeded -> HTTP 429

Step 5: Gateway - Route Matching
  - Path /api/chat/sessions matches predicate Path=/api/chat/**
  - Route to ${API_SERVICE_URL} (default http://localhost:3001)
  - StripPrefix=0: full path forwarded as /api/chat/sessions

Step 6: Node.js API - authMiddleware (apps/api/src/middleware/auth.ts)
  - Checks public paths: /api/chat/sessions not in whitelist
  - Checks NODE_ENV: "production"
  - Calls resolveGatewayUser():
    - Reads X-User-Id header -> "1"
    - Calls resolveLocalUser({externalId: "1", username: "admin", role: "ADMIN"})
    - Finds local user by external_user_id, returns UUID user record
    - Sets req.userId, req.externalUserId, req.user
  - Calls next()

Step 7: Node.js API - Route Handler
  - Business logic executes with authenticated req.user
  - Queries chat_sessions WHERE user_id = req.userId (UUID)

Step 8: Response flows back
  - Node API -> Gateway -> Nginx -> Client
  - Gateway propagates response headers (CORS, etc.)
```

### 7.2 Unauthenticated Request (e.g., `POST /api/auth/login`)

```
Step 1-2: Same (Nginx -> Gateway)
Step 3: JwtValidationFilter
  - Path /api/auth/login IS in whitelist -> skip JWT check
Step 4: RateLimitFilter
  - Rate limit still applies (200 req/60s per IP)
Step 5: Route to lb://auth-service (/api/auth/login -> /auth/login after StripPrefix=1)
Step 6: Auth Service processes login
  - Validates credentials against auth_db.sys_user (bcrypt)
  - IP-based login rate limit: 5 attempts/minute (Redis)
  - Returns JWT access + refresh tokens
```

### 7.3 Nginx -> Gateway WebSocket (Socket.IO)

```
Nginx location /socket.io (nginx/nginx.conf:151-163)
  - proxy_http_version 1.1
  - Upgrade + Connection headers for WebSocket upgrade
  - proxy_read_timeout 86400 (24 hours for long-lived connections)
  - Also propagates traceparent/tracestate for OTel
```

---

## 8. Data Ownership Matrix

### 8.1 Per-Service Databases

| Database | Owner Service | Key Tables | ID Strategy |
|----------|--------------|------------|-------------|
| `auth_db` | Auth Service (Java) | `sys_user`, `sys_role`, `sys_user_role` | BIGSERIAL (Long) |
| `payment_db` | Payment Service (Java) | Payment tables | ASSIGN_ID (Long, Snowflake) |
| `order_db` | Order Service (Java) | Order tables | ASSIGN_ID (Long, Snowflake) |
| `cart_db` | Cart Service (Java) | Cart tables | ASSIGN_ID (Long, Snowflake) |
| `logistics_db` | Logistics Service (Java) | Logistics tables | ASSIGN_ID (Long, Snowflake) |
| `agenthive` | Node.js API | `users`, `projects`, `chat_sessions`, `chat_messages`, `agents`, `tasks`, `agent_tasks`, `code_files`, `workspaces`, `chat_versions`, `project_deployments`, `project_members`, `agent_logs` | UUID (gen_random_uuid()) |

### 8.2 Cross-Database Relationships

| Relationship | Mechanism | Implementation |
|-------------|-----------|---------------|
| Java User -> Node User | External ID mapping | `users.external_user_id` column stores Java BIGINT as string |
| Java Service -> Java Service | Feign + RabbitMQ | Synchronous via Feign with header propagation; Async via RabbitMQ events |
| Gateway -> All Services | JWT claims | User identity flows via `X-User-Id`, `X-User-Name`, `X-User-Role` headers |
| Node API -> Auth Service | Reverse lookup | Node.js can call Auth Service to validate or look up user details (via `javaUserService`) |

### 8.3 Base Entity Patterns

**Java (MyBatis-Plus)** - Source: `apps/java/common/common-mybatis/src/main/java/com/agenthive/common/mybatis/entity/BaseEntity.java`:
```java
@TableId(type = IdType.ASSIGN_ID)  // Long, Snowflake
private Long id;
@TableField(fill = FieldFill.INSERT) private LocalDateTime createdAt;
@TableField(fill = FieldFill.INSERT_UPDATE) private LocalDateTime updatedAt;
@TableLogic @TableField(fill = FieldFill.INSERT) private Integer deleted;
@Version private Long version;  // Optimistic locking
```

**Node.js (PostgreSQL)** - UUID primary keys with `gen_random_uuid()`, timestamps with timezone, and auto-update triggers.

---

## 9. Error Handling Strategy

### 9.1 Result Code Ranges

**Source**: `apps/java/common/common-core/src/main/java/com/agenthive/common/core/result/ResultCode.java`

| Code | Meaning | Layer |
|------|---------|-------|
| 200 | Success | All layers |
| 400 | Bad Request (validation) | Controller validation |
| 401 | Unauthorized (missing/invalid JWT) | Gateway, Common-Web |
| 403 | Forbidden (account disabled) | Auth Service |
| 404 | Not Found | Route handlers |
| 405 | Method Not Allowed | Framework |
| 409 | Conflict | Business logic |
| 429 | Too Many Requests | Gateway RateLimitFilter, Auth Service login rate |
| 500 | Internal Server Error | Uncaught exceptions |
| 503 | Service Unavailable | Downstream failures |
| **7000-7999** | **Business Logic Errors** | Service layer |
| 7000 | User already exists | Auth registration |
| 7001 | User not found | Auth lookup |
| 7002 | Invalid username or password | Auth login |
| 7003 | Invalid or expired token | Auth token refresh |
| 7004 | Password does not meet strength requirements | Auth password validation |
| 7005 | Rate limit exceeded | Auth login rate limiting |

### 9.2 Uniform Response Envelope (Java)

All Java responses are normalized by `GlobalResponseAdvice` (`apps/java/common/common-web/src/main/java/com/agenthive/common/web/advice/GlobalResponseAdvice.java`) to:
```json
{
  "code": 200,
  "message": "Success",
  "data": { ... }
}
```

Exception handling is centralized in `GlobalExceptionHandler` (`apps/java/common/common-web/src/main/java/com/agenthive/common/web/advice/GlobalExceptionHandler.java`):
- `AgentHiveException` -> custom code/message
- `MethodArgumentNotValidException` -> 400 with field-level error messages
- `BindException` -> 400
- `Exception` (catch-all) -> 500

### 9.3 Node.js API Error Format

Node.js API mirrors the same envelope:
```json
{
  "code": 401,
  "message": "Missing gateway authentication header (X-User-Id)",
  "data": null
}
```

---

## 10. Inter-Service Communication

### 10.1 Synchronous (Feign)

**Source**: `apps/java/common/common-feign/src/main/java/com/agenthive/common/feign/config/FeignConfig.java`

Feign clients automatically propagate:
- `x-trace-id` from SLF4J MDC context
- `Authorization` header from incoming request (JWT passthrough)

This enables trace continuity across synchronous call chains.

### 10.2 Asynchronous (RabbitMQ)

**Source**: `apps/java/common/common-rabbitmq/`
- `RabbitSender`: Sends typed events to RabbitMQ exchanges
- `RabbitListenerBase`: Base class for consuming events
- Used for: order status changes, payment confirmations, logistics updates, etc.

### 10.3 Async Task Processing (Node.js)

**Source**: `apps/api/src/services/taskQueue.ts`
- Redis Streams for agent task queuing
- `TaskConsumer` processes tasks asynchronously
- `TaskExecutionService` manages concurrent execution (max 3 tasks, 10-min timeout, 50 iterations max)

---

## 11. Observability Architecture

### 11.1 Signal Pipeline

```
[App Code] --OTLP--> [OTel Collector :4317/:4318]
                         |
            +------------+------------+
            |            |            |
        [Tempo]      [Loki]     [Prometheus]
        :3200        :3100       :9090
            |            |            |
            +------------+------------+
                         |
                    [Grafana :3003]
                         |
                    [Beyla eBPF]  (auto-instrumentation, no code changes)
```

### 11.2 Key AI Business Spans

| Span Name | Attributes |
|-----------|-----------|
| `agenthive.llm.completion` | `llm.provider`, `llm.model`, `llm.tokens.*`, `llm.cost_usd` |
| `agenthive.runtime.task` | `agent.id`, `task.id`, `task.type` |
| `agenthive.query_loop.execute` | `query_loop.iteration`, `llm.tokens.total` |
| `agenthive.tool.execute` | `tool.name`, `tool.duration_ms` |
| `agenthive.websocket.*` | `websocket.event_type`, `websocket.connection_id` |

### 11.3 W3C Trace Context Propagation

- **Nginx**: `proxy_set_header traceparent $http_traceparent;` (`nginx/nginx.conf:65`)
- **Gateway**: `TraceIdFilter` generates `X-Trace-Id` header if missing
- **Feign**: Propagates `x-trace-id` across Java service calls
- **Node.js**: `@agenthive/observability` package handles OTel SDK integration

---

## 12. Nacos Service Discovery

**Source**: `apps/java/gateway-service/src/main/resources/bootstrap.yml`

All Java services register with Nacos for discovery:
```yaml
spring:
  cloud:
    nacos:
      discovery:
        server-addr: ${NACOS_SERVER:localhost:8848}
        ephemeral: false          # Persistent instance
        heart-beat-interval: 5000  # 5-second heartbeat
```

Gateway routes use `lb://service-name` syntax to resolve via Nacos load balancing.

---

## 13. ADR Appendix: Key Architectural Decisions

### ADR-001: Single Gateway Authentication Boundary
**Decision**: JWT validation occurs ONLY at Gateway. Downstream services trust `X-User-Id` header without re-validation.
**Rationale**: Avoids credential propagation. Reduces auth logic duplication. Centralizes security policy.
**Trade-off**: Gateway becomes critical path; must ensure header-only mode cannot be bypassed (network policy).
**Files**: `JwtValidationFilter.java`, `auth.ts` middleware.

### ADR-002: Dual-ID System (Java BIGINT + Node UUID)
**Decision**: Java services use MyBatis-Plus `ASSIGN_ID` (Snowflake Long); Node.js uses PostgreSQL `UUID` (UUIDv4 via `gen_random_uuid()`).
**Rationale**: Historical divergence. Java services were built first with standard MyBatis-Plus patterns. Node.js API was added later with PostgreSQL-idiomatic UUIDs.
**Bridge**: `users.external_user_id` VARCHAR column stores Java BIGINT as string. `userMapping.ts` resolves on every request.
**Migration**: `20260503180000_add-external-user-id.sql`.

### ADR-003: True Microservice Database-Per-Service
**Decision**: Each Java service owns its own PostgreSQL database. No shared tables between services.
**Rationale**: Enforces bounded contexts. Prevents coupling through the database layer. Enables independent scaling and schema evolution.
**Trade-off**: Cross-service joins impossible. Requires eventual consistency via events.

### ADR-004: Node.js API as AI Control Plane (Not Business Logic)
**Decision**: Node.js handles AI orchestration (chat, agents, tasks, LLM). Java handles transactional business (auth, payments, orders).
**Rationale**: Node.js excels at async I/O, WebSocket, and streaming (LLM responses). Java excels at transactional consistency and type-safe business logic.
**Enforcement**: Gateway routes `/api/agents/**`, `/api/tasks/**`, `/api/chat/**` to Node. Routes `/api/payments/**`, `/api/orders/**` to Java.

### ADR-005: StripPrefix=1 for Java, StripPrefix=0 for Node
**Decision**: Java services receive paths without `/api` prefix (e.g., `/auth/login`). Node API receives full path (e.g., `/api/agents/list`).
**Rationale**: Java services use Spring MVC with standard `@RequestMapping` patterns that don't expect `/api`. Node.js routes are defined with `/api` prefix.
**Files**: `application.yml:13,53` (Gateway route config).

### ADR-006: Redis Lua for Gateway Rate Limiting
**Decision**: Use Redis Lua scripts (atomic) for sliding-window rate limiting at Gateway level.
**Rationale**: Atomicity prevents race conditions. O(1) complexity. No additional infrastructure.
**Parameters**: 200 requests per 60 seconds per IP. Configurable via `RateLimitFilter.java` constants.
**Files**: `RateLimitFilter.java:27-43` (Lua script), `RateLimitFilter.java:52-53` (limit/window constants).

### ADR-007: Migration-Only Database Strategy (Node.js)
**Decision**: Node.js API uses `node-pg-migrate` as sole schema authority. `schema.sql` is a read-only snapshot.
**Rationale**: Migration files are the source of truth. `schema.sql` is regenerated via `pg_dump --schema-only` for documentation only.
**Production**: Migrations run in CI/CD via Helm hooks. Dev mode auto-runs on startup.
**Files**: `apps/api/src/db/migrations/`, `apps/api/src/index.ts:34-51`.

### ADR-008: Feign + RabbitMQ Dual Communication
**Decision**: Java services use Feign for synchronous calls (request-response) and RabbitMQ for asynchronous events.
**Rationale**: Feign provides type-safe inter-service HTTP calls with header propagation. RabbitMQ decouples services for eventual consistency. Each mechanism serves a different communication pattern.
**Files**: `FeignConfig.java` (header propagation), `RabbitSender.java` / `RabbitListenerBase.java`.

---

## 14. File Reference Index

| File | Lines | Purpose |
|------|-------|---------|
| `apps/java/gateway-service/src/main/java/com/agenthive/gateway/filter/JwtValidationFilter.java` | 114 | JWT validation + header injection |
| `apps/java/gateway-service/src/main/java/com/agenthive/gateway/filter/RateLimitFilter.java` | 88 | Redis Lua sliding window rate limiter |
| `apps/java/gateway-service/src/main/java/com/agenthive/gateway/config/JwtConfig.java` | 43 | JWT secret startup validation |
| `apps/java/gateway-service/src/main/java/com/agenthive/gateway/filter/TraceIdFilter.java` | ~40 | Trace ID generation/propagation |
| `apps/java/gateway-service/src/main/resources/application.yml` | 83 | Route table, Redis config, Swagger aggregation |
| `apps/java/gateway-service/src/main/resources/bootstrap.yml` | 23 | Nacos discovery + config |
| `apps/java/auth-service/src/main/java/com/agenthive/auth/service/impl/AuthServiceImpl.java` | 273 | Registration, login, SMS login, token refresh, logout |
| `apps/java/auth-service/src/main/java/com/agenthive/auth/service/impl/SmsServiceImpl.java` | 209 | Alibaba Cloud SMS with rate limiting |
| `apps/java/auth-service/src/main/resources/db/migration/V1__init.sql` | 49 | auth_db schema initialization |
| `apps/java/common/common-core/src/main/java/com/agenthive/common/core/result/ResultCode.java` | 35 | Result code enum (200, 400, 7000-7005) |
| `apps/java/common/common-security/src/main/java/com/agenthive/common/security/util/JwtUtils.java` | 88 | JWT generation/validation (HS256, 24h/7d) |
| `apps/java/common/common-mybatis/src/main/java/com/agenthive/common/mybatis/entity/BaseEntity.java` | 31 | Base entity (ASSIGN_ID, @TableLogic, @Version) |
| `apps/java/common/common-feign/src/main/java/com/agenthive/common/feign/config/FeignConfig.java` | 41 | Feign header propagation (trace-id, JWT) |
| `apps/java/common/common-web/src/main/java/com/agenthive/common/web/advice/GlobalExceptionHandler.java` | 46 | Unified exception handling |
| `apps/api/src/middleware/auth.ts` | 161 | Node.js auth middleware (Gateway header consumption) |
| `apps/api/src/services/userMapping.ts` | 64 | Java BIGINT <-> Node UUID bridge |
| `apps/api/src/index.ts` | 157 | API server bootstrap (DB, Redis, LLM, WS, Task Queue) |
| `apps/api/src/db/schema.sql` | 288 | Node.js database schema snapshot |
| `apps/api/src/db/migrations/20260503180000_add-external-user-id.sql` | 14 | external_user_id column migration |
| `nginx/nginx.conf` | 173 | Nginx reverse proxy (TLS, HSTS, W3C trace context) |
| `monitoring/docker-compose.yml` | 256 | Grafana LGTM + Beyla observability stack |
| `pnpm-workspace.yaml` | 3 | pnpm monorepo package declaration |

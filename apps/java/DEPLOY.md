# Java 微服务部署指南 (DEPLOY)

> **目标读者**：DevOps 工程师  
> **适用范围**：`apps/java` - AgentHive Java 微服务集群  
> **部署方式**：Docker Compose

---

## 目录

- [Docker Compose 启动顺序](#docker-compose-启动顺序)
- [Healthcheck 建议](#healthcheck-建议)
- [Nacos 配置说明](#nacos-配置说明)
- [网关负载均衡说明](#网关负载均衡说明)
- [JWT Secret 配置要求](#jwt-secret-配置要求)

---

## Docker Compose 启动顺序

### 基础设施层（先启动）

```bash
docker compose -f docker-compose.dev.yml --env-file .env.dev --profile java up -d nacos rabbitmq
```

| 服务 | 端口 | 说明 | 健康检查 |
|------|------|------|----------|
| `nacos` | 8848 / 9848 | 服务注册与配置中心 | HTTP 200 on `/nacos` |
| `postgres-auth` | 5432 | 认证服务数据库 | TCP 5432 |
| `postgres-user` | 5433 | 用户服务数据库 | TCP 5432 |
| `postgres-business` | 5434 | 业务数据库（订单/支付/购物车/物流） | TCP 5432 |
| `redis` | 6379 | 缓存 / 限流 / 会话 | TCP 6379 |
| `rabbitmq` | 5672 / 15672 | 消息队列 | HTTP 200 on `/api/overview` |

### 等待基础设施就绪

```bash
# 检查 Nacos 是否就绪
curl -f http://localhost:8848/nacos || echo "Nacos not ready"

# 检查 PostgreSQL 是否就绪（示例：auth 库）
pg_isready -h localhost -p 5432 -U agenthive

# 检查 Redis 是否就绪
redis-cli -h localhost -p 6379 ping
```

### 应用服务层（后启动）

```bash
# 建议按依赖顺序分批启动

# 第一批：网关 + 认证服务（核心依赖）
docker compose -f docker-compose.dev.yml --env-file .env.dev --profile java up -d gateway-service auth-service

# 第二批：用户服务
docker compose -f docker-compose.dev.yml --env-file .env.dev --profile java up -d user-service

# 第三批：业务服务（彼此通过 MQ 解耦，可并行启动）
docker compose -f docker-compose.dev.yml --env-file .env.dev --profile java up -d payment-service order-service cart-service logistics-service
```

### 完整一键启动（开发环境）

```bash
docker compose -f docker-compose.dev.yml --env-file .env.dev --profile java up -d
```

> **注意**：首次启动需等待数据库初始化完成（自动执行 `init.sql` / `init-business.sql`）。

---

## Healthcheck 建议

### 为 Docker Compose 增加健康检查

`docker-compose.dev.yml` 已为各服务添加 `healthcheck`：

```yaml
services:
  gateway-service:
    build: ./gateway-service
    ports:
      - "8080:8080"
    environment:
      - NACOS_SERVER=nacos:8848
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - JWT_SECRET=${JWT_SECRET}
    depends_on:
      nacos:
        condition: service_started
      redis:
        condition: service_started
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/actuator/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s

  auth-service:
    build: ./auth-service
    ports:
      - "8081:8081"
    environment:
      - NACOS_SERVER=nacos:8848
      - DB_HOST=postgres-auth
      - DB_PORT=5432
      - DB_NAME=auth_db
      - DB_USER=agenthive
      - DB_PASSWORD=${DB_PASSWORD}
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - JWT_SECRET=${JWT_SECRET}
    depends_on:
      nacos:
        condition: service_started
      postgres-auth:
        condition: service_started
      redis:
        condition: service_started
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8081/actuator/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s
```

### 健康检查端点

| 服务 | 健康检查 URL | 预期响应 |
|------|-------------|----------|
| Gateway | `http://localhost:8080/actuator/health` | `{"status":"UP"}` |
| Auth | `http://localhost:8081/actuator/health` | `{"status":"UP"}` |
| User | `http://localhost:8082/actuator/health` | `{"status":"UP"}` |
| Payment | `http://localhost:8083/actuator/health` | `{"status":"UP"}` |
| Order | `http://localhost:8084/actuator/health` | `{"status":"UP"}` |
| Cart | `http://localhost:8085/actuator/health` | `{"status":"UP"}` |
| Logistics | `http://localhost:8086/actuator/health` | `{"status":"UP"}` |

> **注意**：确保各服务 `pom.xml` 中已引入 `spring-boot-starter-actuator` 依赖。

---

## Nacos 配置说明

### Nacos 运行模式

当前使用 **standalone（单机）模式**，适用于开发和测试环境：

```yaml
services:
  nacos:
    image: nacos/nacos-server:v2.3.0
    ports:
      - "8848:8848"
      - "9848:9848"
    environment:
      - MODE=standalone
      - SPRING_DATASOURCE_PLATFORM=postgresql
      - NACOS_AUTH_ENABLE=false  # 开发环境关闭认证
```

### 生产环境建议

- **集群模式**：生产环境应部署 Nacos 集群（至少 3 节点）
- **认证开启**：设置 `NACOS_AUTH_ENABLE=true` 并配置用户名密码
- **持久化**：使用外置 MySQL/PostgreSQL 存储配置数据
- **端口说明**：
  - `8848`：HTTP 控制台和 OpenAPI
  - `9848`：gRPC 客户端通信端口（Nacos 2.x 必需）

### 服务注册验证

启动后，访问 Nacos 控制台确认各服务已注册：

```
http://localhost:8848/nacos
```

进入 **服务管理 → 服务列表**，应看到：

- `gateway-service`
- `auth-service`
- `user-service`
- `payment-service`
- `order-service`
- `cart-service`
- `logistics-service`

---

## 网关负载均衡说明

### 负载均衡策略

网关使用 **Spring Cloud LoadBalancer**（替代已停更的 Netflix Ribbon）：

- **默认策略**：轮询（Round Robin）
- **服务发现**：基于 Nacos 实时服务列表
- **协议格式**：`lb://{service-name}`

### 自定义负载均衡（可选）

如需调整策略，在 `gateway-service` 中配置：

```java
@Bean
public ReactorLoadBalancer<ServiceInstance> randomLoadBalancer(
        Environment environment,
        LoadBalancerClientFactory loadBalancerClientFactory) {
    String name = environment.getProperty(LoadBalancerClientFactory.PROPERTY_NAME);
    return new RandomLoadBalancer(
        loadBalancerClientFactory.getLazyProvider(name, ServiceInstanceListSupplier.class),
        name
    );
}
```

### 网关过滤器执行顺序

| 顺序 | 过滤器 | 功能 | 优先级 |
|------|--------|------|--------|
| 1 | `TraceIdFilter` | 生成/透传 Trace ID | `Ordered.HIGHEST_PRECEDENCE` |
| 2 | `RateLimitFilter` | 限流（Redis Lua） | `-50` |
| 3 | `JwtValidationFilter` | JWT 校验 | `0` |
| 4 | `RequestLoggingFilter` | 请求日志 | `LOWEST_PRECEDENCE - 1` |

---

## JWT Secret 配置要求

### 密钥长度要求

- **最小长度**：≥ 256 位（32 字节）
- **推荐长度**：≥ 512 位（64 字节）
- **字符集**：大小写字母 + 数字 + 特殊符号
- **生成示例**：
  ```bash
  openssl rand -base64 48
  # 输出示例：xT9mK2pL5vQ8nR4wE7jB3hF6cA1yU0iO9lP4kG7dS2fV5bN8mQ1rT6uW3eX0z
  ```

### 环境变量配置

```bash
# .env 文件
JWT_SECRET=xT9mK2pL5vQ8nR4wE7jB3hF6cA1yU0iO9lP4kG7dS2fV5bN8mQ1rT6uW3eX0z
```

### 多服务共享密钥

**所有 Java 服务必须使用相同的 `JWT_SECRET`**：

| 服务 | 用途 |
|------|------|
| `gateway-service` | 校验请求中的 JWT Token |
| `auth-service` | 签发 JWT Token |
| 其他业务服务 | 解析 Token 获取用户信息（如有直接校验需求） |

### 密钥轮换策略（建议）

1. **新旧密钥并行**：在新密钥生效前，保留旧密钥的校验能力
2. **渐进式切换**：先更新 `auth-service`（签发端），再更新网关（校验端）
3. **Token 有效期**：建议设置较短有效期（如 2 小时），配合 Refresh Token 机制

---

## 快速验证脚本

```bash
#!/bin/bash
# verify-deployment.sh

echo "=== AgentHive Java 部署验证 ==="

# 1. 检查核心服务健康
echo "[1/4] 检查服务健康..."
curl -sf http://localhost:8080/actuator/health > /dev/null && echo "✅ Gateway" || echo "❌ Gateway"
curl -sf http://localhost:8081/actuator/health > /dev/null && echo "✅ Auth" || echo "❌ Auth"
curl -sf http://localhost:8082/actuator/health > /dev/null && echo "✅ User" || echo "❌ User"

# 2. 检查 Nacos 注册
echo "[2/4] 检查 Nacos 服务注册..."
curl -s http://localhost:8848/nacos/v1/ns/service/list?pageNo=1&pageSize=10 | grep -q "auth-service" && echo "✅ Auth registered" || echo "❌ Auth not registered"

# 3. 检查网关路由
echo "[3/4] 检查网关路由..."
curl -sf http://localhost:8080/actuator/gateway/routes > /dev/null && echo "✅ Routes loaded" || echo "❌ Routes failed"

# 4. 测试认证链路
echo "[4/4] 测试认证链路..."
LOGIN_RES=$(curl -s -X POST http://localhost:8080/api/auth/login -H "Content-Type: application/json" -d '{"username":"admin","password":"admin"}')
echo $LOGIN_RES | grep -q "token" && echo "✅ Login works" || echo "❌ Login failed"

echo "=== 验证完成 ==="
```

---

> 生产环境部署请联系 SRE 团队，获取 Kubernetes Helm Charts 和详细运维手册。

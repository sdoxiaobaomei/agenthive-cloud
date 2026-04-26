# AgentHive Cloud - Java Microservices

## 服务清单

| 服务 | 端口 | 说明 |
|------|------|------|
| gateway-service | 8080 | Spring Cloud Gateway，统一入口 |
| auth-service | 8081 | 认证中心，JWT + OAuth2 |
| user-service | 8082 | 用户管理 |
| payment-service | 8083 | 支付、钱包、对账 |
| order-service | 8084 | 订单、状态机 |
| cart-service | 8085 | 购物车 |
| logistics-service | 8086 | 物流追踪 |

## 快速开始

### 1. 启动基础设施

```bash
docker compose -f docker-compose.dev.yml --env-file .env.dev --profile java up -d
```

这会启动：
- Nacos (8848) - 注册中心 + 配置中心
- RabbitMQ (5672, 15672) - 消息队列
- PostgreSQL (5433) - 多数据库
- Redis (6380) - 缓存

### 2. 构建所有服务

```bash
cd apps/java
mvn clean install -DskipTests
```

### 3. 启动服务

按顺序启动：
```bash
# 1. 网关
cd gateway-service && mvn spring-boot:run

# 2. 认证
cd auth-service && mvn spring-boot:run

# 3. 其他服务...
```

或使用 Docker Compose：
```bash
docker compose -f docker-compose.dev.yml --env-file .env.dev --profile java up -d gateway-service auth-service user-service
```

## 技术栈

- Spring Boot 3.2
- Spring Cloud 2023.0
- Spring Cloud Alibaba 2023.0.0.0-RC1
- MyBatis Plus 3.5.5
- PostgreSQL 16
- Redis 7
- RabbitMQ 3.13
- Nacos 2.3

## API 文档

所有服务通过 Gateway 暴露：
- Gateway: http://localhost:8080
- Auth API: http://localhost:8080/api/auth/**
- User API: http://localhost:8080/api/users/**
- Payment API: http://localhost:8080/api/payments/**
- Order API: http://localhost:8080/api/orders/**
- Cart API: http://localhost:8080/api/carts/**
- Logistics API: http://localhost:8080/api/logistics/**

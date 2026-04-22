# Java Spring Cloud 微服务设计文档

## 1. 服务矩阵

| 服务 | 端口 | 职责 | 数据库 | 依赖 |
|------|------|------|--------|------|
| gateway-service | 8080 | 网关、路由、鉴权、限流 | - | nacos |
| auth-service | 8081 | 注册、登录、Token、OAuth2 | auth_db | nacos, redis |
| user-service | 8082 | 用户信息、Profile、权限 | user_db | nacos, auth-service |
| payment-service | 8083 | 支付、钱包、对账、退款 | payment_db | nacos, rabbitmq |
| order-service | 8084 | 订单、订单项、状态机 | order_db | nacos, rabbitmq, redis |
| cart-service | 8085 | 购物车、加购、结算 | cart_db | nacos, redis |
| logistics-service | 8086 | 物流追踪、配送、仓储 | logistics_db | nacos, rabbitmq |

## 2. 公共依赖 (apps/java/common/)

```
common/
├── common-core/          # 工具类、常量、异常基类
├── common-web/           # Web 封装 (统一响应、全局异常、拦截器)
├── common-mybatis/       # MyBatis Plus 配置、分页
├── common-redis/         # Redis 封装、分布式锁、缓存注解
├── common-rabbitmq/      # RabbitMQ 封装、可靠投递
├── common-security/      # JWT 工具、Security 配置
├── common-otel/          # OpenTelemetry 自动配置
└── common-feign/         # Feign 拦截器（透传 Token、TraceId）
```

## 3. 每个服务的标准目录结构

```
service-name/
├── src/main/java/com/agenthive/
│   ├── ServiceNameApplication.java
│   ├── config/           # 配置类
│   ├── controller/       # REST API
│   ├── service/          # 业务逻辑
│   │   ├── impl/
│   │   └── dto/          # 内部 DTO
│   ├── domain/           # 领域模型
│   │   ├── entity/       # MyBatis Entity
│   │   ├── vo/           # 返回 VO
│   │   └── enums/        # 枚举
│   ├── mapper/           # MyBatis Mapper
│   ├── repository/       # 仓储（复杂查询）
│   ├── feign/            # Feign Client
│   ├── mq/               # 消息生产/消费
│   ├── listener/         # 事件监听
│   └── utils/            # 工具类
├── src/main/resources/
│   ├── application.yml
│   ├── application-dev.yml
│   ├── application-prod.yml
│   ├── bootstrap.yml     # Nacos 配置
│   └── mapper/           # XML 映射文件
├── Dockerfile
├── pom.xml
└── README.md
```

## 4. 数据库设计（分库）

### auth_db
```sql
CREATE TABLE sys_user (
  id BIGSERIAL PRIMARY KEY,
  username VARCHAR(64) UNIQUE NOT NULL,
  password VARCHAR(128) NOT NULL,
  email VARCHAR(128),
  phone VARCHAR(20),
  avatar VARCHAR(500),
  status TINYINT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sys_role (
  id BIGSERIAL PRIMARY KEY,
  role_code VARCHAR(64) UNIQUE NOT NULL,
  role_name VARCHAR(64) NOT NULL
);

CREATE TABLE sys_user_role (
  user_id BIGINT,
  role_id BIGINT,
  PRIMARY KEY (user_id, role_id)
);
```

### order_db
```sql
CREATE TABLE t_order (
  id BIGSERIAL PRIMARY KEY,
  order_no VARCHAR(32) UNIQUE NOT NULL,
  user_id BIGINT NOT NULL,
  total_amount DECIMAL(18,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'CREATED',
  pay_status VARCHAR(20) DEFAULT 'UNPAID',
  logistics_status VARCHAR(20) DEFAULT 'PENDING',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  paid_at TIMESTAMP,
  delivered_at TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE TABLE t_order_item (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL,
  product_id BIGINT NOT NULL,
  product_name VARCHAR(200),
  sku_id BIGINT,
  quantity INT NOT NULL,
  unit_price DECIMAL(18,2) NOT NULL,
  total_price DECIMAL(18,2) NOT NULL
);
```

### payment_db
```sql
CREATE TABLE t_payment (
  id BIGSERIAL PRIMARY KEY,
  payment_no VARCHAR(32) UNIQUE NOT NULL,
  order_no VARCHAR(32) NOT NULL,
  user_id BIGINT NOT NULL,
  amount DECIMAL(18,2) NOT NULL,
  channel VARCHAR(20) NOT NULL, -- ALIPAY, WECHAT, BALANCE
  status VARCHAR(20) DEFAULT 'PENDING',
  third_party_no VARCHAR(64),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE TABLE t_user_wallet (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT UNIQUE NOT NULL,
  balance DECIMAL(18,2) DEFAULT 0.00,
  frozen_balance DECIMAL(18,2) DEFAULT 0.00,
  version BIGINT DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### cart_db
```sql
CREATE TABLE t_cart_item (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  product_id BIGINT NOT NULL,
  sku_id BIGINT,
  quantity INT NOT NULL DEFAULT 1,
  selected BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, product_id, sku_id)
);
```

### logistics_db
```sql
CREATE TABLE t_logistics (
  id BIGSERIAL PRIMARY KEY,
  order_no VARCHAR(32) NOT NULL,
  tracking_no VARCHAR(64),
  carrier VARCHAR(32), -- SF, YTO, ZTO
  status VARCHAR(20) DEFAULT 'PENDING',
  sender_info JSONB,
  receiver_info JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  shipped_at TIMESTAMP,
  delivered_at TIMESTAMP
);

CREATE TABLE t_logistics_track (
  id BIGSERIAL PRIMARY KEY,
  tracking_no VARCHAR(64) NOT NULL,
  event_time TIMESTAMP,
  event_desc VARCHAR(500),
  location VARCHAR(200)
);
```

## 5. API 规范

### Auth Service
```
POST /auth/register        → RegisterRequest → TokenResponse
POST /auth/login           → LoginRequest → TokenResponse
POST /auth/refresh         → RefreshToken → TokenResponse
POST /auth/logout          → 无 → Void
GET  /auth/me              → 无 → UserVO
```

### User Service
```
GET    /users/{id}         → UserVO
PUT    /users/{id}         → UpdateUserRequest → UserVO
GET    /users/{id}/roles   → List<RoleVO>
```

### Payment Service
```
POST /payments/create      → CreatePaymentRequest → PaymentVO
POST /payments/callback    → CallbackDTO → Void (幂等)
POST /payments/refund      → RefundRequest → RefundVO
GET  /payments/{orderNo}   → PaymentVO
GET  /wallets/{userId}     → WalletVO
POST /wallets/recharge     → RechargeRequest → WalletVO
```

### Order Service
```
POST /orders               → CreateOrderRequest → OrderVO
GET  /orders/{orderNo}     → OrderVO
GET  /orders/user/{userId} → Page<OrderVO>
PUT  /orders/{orderNo}/cancel → Void
PUT  /orders/{orderNo}/confirm → Void
```

### Cart Service
```
GET    /carts/{userId}           → CartVO
POST   /carts/items              → AddCartItemRequest → CartItemVO
PUT    /carts/items/{id}         → UpdateCartItemRequest → CartItemVO
DELETE /carts/items/{id}         → Void
POST   /carts/clear              → Void
POST   /carts/checkout           → CheckoutRequest → OrderPreviewVO
```

### Logistics Service
```
POST /logistics/create     → CreateLogisticsRequest → LogisticsVO
GET  /logistics/{orderNo}  → LogisticsVO
GET  /logistics/{trackingNo}/tracks → List<TrackVO>
PUT  /logistics/{trackingNo}/ship  → Void
PUT  /logistics/{trackingNo}/deliver → Void
```

## 6. 消息队列设计

| 事件 | 生产者 | 消费者 | 用途 |
|------|--------|--------|------|
| order.created | order-service | payment-service | 创建支付单 |
| payment.success | payment-service | order-service | 更新订单为已支付 |
| payment.success | payment-service | logistics-service | 创建物流单 |
| order.paid | order-service | logistics-service | 发货通知 |
| logistics.shipped | logistics-service | order-service | 更新订单为已发货 |
| logistics.delivered | logistics-service | order-service | 更新订单为已送达 |

## 7. 高并发要点

1. **库存扣减**：Redis Lua 脚本原子扣减，异步同步到 DB
2. **订单号生成**：雪花算法（Snowflake），避免单点
3. **支付幂等**：Token 机制 + 数据库唯一索引 (payment_no)
4. **分布式锁**：Redisson，用于钱包扣减、库存扣减
5. **限流**：Gateway 层 Sentinel 限流 + 服务层注解限流
6. **缓存**：Caffeine L1 + Redis L2，Cache-Aside 模式

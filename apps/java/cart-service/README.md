# Cart Service

购物车服务，端口 8085。

## 技术栈

- Spring Boot 3.2.x
- Spring Cloud Alibaba Nacos
- MyBatis Plus
- PostgreSQL + Redis (Cache-Aside)
- RabbitMQ

## 核心功能

- 购物车商品增删改查
- Redis 缓存加速读取（TTL 1小时）
- 结算预览（校验库存、计算总价）

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | /carts/{userId} | 查询购物车 |
| POST | /carts/items | 添加商品 |
| PUT | /carts/items/{id} | 更新商品数量/选中状态 |
| DELETE | /carts/items/{id} | 删除商品 |
| POST | /carts/clear | 清空购物车 |
| POST | /carts/checkout | 结算预览 |

## 环境变量

```
DB_HOST, DB_PORT, DB_USER, DB_PASSWORD
REDIS_HOST, REDIS_PORT, REDIS_PASSWORD
RABBITMQ_HOST, RABBITMQ_PORT, RABBITMQ_USER, RABBITMQ_PASS
NACOS_HOST, NACOS_PORT
```

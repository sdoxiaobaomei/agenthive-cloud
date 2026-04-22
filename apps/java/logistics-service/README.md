# Logistics Service

物流服务，端口 8086。

## 技术栈

- Spring Boot 3.2.x
- Spring Cloud Alibaba Nacos
- MyBatis Plus
- PostgreSQL + Redis
- RabbitMQ

## 核心功能

- 物流单创建、查询
- 物流轨迹追踪
- 发货、签收状态流转
- MQ 消费 `order.paid` 自动创建物流
- 定时任务模拟物流轨迹（演示用）

## API

| Method | Path | Description |
|--------|------|-------------|
| POST | /logistics/create | 创建物流单 |
| GET | /logistics/{orderNo} | 根据订单号查询物流 |
| GET | /logistics/{trackingNo}/tracks | 查询物流轨迹 |
| PUT | /logistics/{trackingNo}/ship | 发货 |
| PUT | /logistics/{trackingNo}/deliver | 签收 |

## MQ

- Consume: `order.paid` → 自动创建物流
- Publish: `logistics.created`, `logistics.shipped`, `logistics.delivered`

## 环境变量

```
DB_HOST, DB_PORT, DB_USER, DB_PASSWORD
REDIS_HOST, REDIS_PORT, REDIS_PASSWORD
RABBITMQ_HOST, RABBITMQ_PORT, RABBITMQ_USER, RABBITMQ_PASS
NACOS_HOST, NACOS_PORT
```

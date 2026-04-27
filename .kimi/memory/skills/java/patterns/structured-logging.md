# Pattern: 结构化 JSON 日志

```java
// 正确 — 结构化
log.info("Order created",
    kv("orderId", order.getId()),
    kv("userId", order.getUserId()),
    kv("amount", order.getAmount()));

// 错误 — 禁止
System.out.println("Order created: " + order.getId());
```

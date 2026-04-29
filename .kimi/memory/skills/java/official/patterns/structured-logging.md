> ⚠️ **v0.9 批量模板** — 此 skill 为初始化时批量生成，非实战沉淀。内容可能不完整或存在编码损坏。执行相关 Ticket 后应逐步替换为实战验证版本。

# Pattern: 缁撴瀯鍖?JSON 鏃ュ織

```java
// 姝ｇ‘ 鈥?缁撴瀯鍖?
log.info("Order created",
    kv("orderId", order.getId()),
    kv("userId", order.getUserId()),
    kv("amount", order.getAmount()));

// 閿欒 鈥?绂佹
System.out.println("Order created: " + order.getId());
```

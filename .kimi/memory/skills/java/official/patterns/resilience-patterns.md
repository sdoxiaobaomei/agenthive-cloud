> ⚠️ **v0.9 批量模板** — 此 skill 为初始化时批量生成，非实战沉淀。内容可能不完整或存在编码损坏。执行相关 Ticket 后应逐步替换为实战验证版本。

# Pattern: Resilience4j 鐔旀柇闄愭祦

```java
@CircuitBreaker(name = "orderService", fallbackMethod = "fallback")
@RateLimiter(name = "orderApi")
@Retry(name = "orderService")
public OrderDTO getOrder(Long id) { ... }

// 铏氭嫙绾跨▼锛圝ava 21锛?
ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor();
```

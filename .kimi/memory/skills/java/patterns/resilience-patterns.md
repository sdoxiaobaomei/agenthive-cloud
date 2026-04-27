# Pattern: Resilience4j 熔断限流

```java
@CircuitBreaker(name = "orderService", fallbackMethod = "fallback")
@RateLimiter(name = "orderApi")
@Retry(name = "orderService")
public OrderDTO getOrder(Long id) { ... }

// 虚拟线程（Java 21）
ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor();
```

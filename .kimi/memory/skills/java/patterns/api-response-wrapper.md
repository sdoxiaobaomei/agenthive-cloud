# Pattern: API 响应包装

统一使用 Result<T>:
```java
@RestController
public class OrderController {
    @GetMapping("/api/v1/orders/{id}")
    public Result<OrderVO> getOrder(@PathVariable Long id) {
        return Result.ok(orderService.getOrder(id));
    }
}
```

Result 结构:
```json
{ "code": 200, "message": "success", "data": { ... } }
```

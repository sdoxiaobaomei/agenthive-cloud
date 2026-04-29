> ⚠️ **v0.9 批量模板** — 此 skill 为初始化时批量生成，非实战沉淀。内容可能不完整或存在编码损坏。执行相关 Ticket 后应逐步替换为实战验证版本。

# Pattern: API 鍝嶅簲鍖呰

缁熶竴浣跨敤 Result<T>:
```java
@RestController
public class OrderController {
    @GetMapping("/api/v1/orders/{id}")
    public Result<OrderVO> getOrder(@PathVariable Long id) {
        return Result.ok(orderService.getOrder(id));
    }
}
```

Result 缁撴瀯:
```json
{ "code": 200, "message": "success", "data": { ... } }
```

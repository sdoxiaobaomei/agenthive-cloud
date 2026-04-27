# Pattern: Redis Stream 消费者

```typescript
const stream = redisClient.xreadgroup(
  'GROUP', 'workers', 'worker-1',
  'BLOCK', 5000,
  'COUNT', 10,  // 背压控制：每次最多10条
  'STREAMS', 'agenthive:agent:task:queue', '>'
);
```

规则:
- 必须显式 ACK（xack），否则消息会堆积
- COUNT 限制防止内存溢出
- 消费者必须是幂等的

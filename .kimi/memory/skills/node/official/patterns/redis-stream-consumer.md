> ⚠️ **v0.9 批量模板** — 此 skill 为初始化时批量生成，非实战沉淀。内容可能不完整或存在编码损坏。执行相关 Ticket 后应逐步替换为实战验证版本。

# Pattern: Redis Stream 娑堣垂鑰?

```typescript
const stream = redisClient.xreadgroup(
  'GROUP', 'workers', 'worker-1',
  'BLOCK', 5000,
  'COUNT', 10,  // 鑳屽帇鎺у埗锛氭瘡娆℃渶澶?0鏉?
  'STREAMS', 'agenthive:agent:task:queue', '>'
);
```

瑙勫垯:
- 蹇呴』鏄惧紡 ACK锛坸ack锛夛紝鍚﹀垯娑堟伅浼氬爢绉?
- COUNT 闄愬埗闃叉鍐呭瓨婧㈠嚭
- 娑堣垂鑰呭繀椤绘槸骞傜瓑鐨?

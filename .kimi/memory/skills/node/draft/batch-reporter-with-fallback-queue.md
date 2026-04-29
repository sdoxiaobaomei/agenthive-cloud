# Pattern: Batch Reporter with Fallback Queue

## Context

周期性向上游服务上报聚合数据（如流量统计、日志、指标）。上游服务可能出现短暂不可用，需要本地缓冲和自动重试。

## Solution

```typescript
const pendingReports: Array<{ projectId: string; pvCount: number; uvCount: number; timestamp: string }> = []

async function runBatchReport(): Promise<void> {
  // 1. 先 flush 之前失败的数据
  while (pendingReports.length > 0) {
    const report = pendingReports.shift()!
    const ok = await notifyUpstream(report)
    if (!ok) {
      pendingReports.push(report) // re-queue
      break // stop flushing to avoid infinite loop
    }
  }

  // 2. 聚合当前周期数据
  const aggregated = await aggregateData()
  const timestamp = new Date().toISOString()

  for (const [projectId, data] of aggregated) {
    const ok = await notifyUpstream(projectId, data, timestamp)
    if (!ok) {
      pendingReports.push({ projectId, ...data, timestamp })
    }
  }
}

// 启动定时器
setInterval(() => {
  runBatchReport().catch((err) => logger.error('Batch reporter error', err))
}, 5 * 60 * 1000)
```

## Trade-offs

- **Pros**: 实现简单；失败数据不丢失（进程存活期间）；自动重试。
- **Cons**: 内存队列在进程重启时丢失；无限重试可能堆积大量旧数据。

## Improvements

1. **持久化队列**：用 Redis Stream / BullMQ 替换内存数组。
2. **背压控制**：限制队列最大长度，超过时丢弃最旧数据或采样。
3. **指数退避**：重试间隔从 5min → 10min → 20min 递增，避免雪崩。
4. **批量压缩**：上报时将多条记录合并为一个请求体，减少 HTTP 开销。

## When to Use

对上报实时性要求不高（分钟级），且上游服务通常可用的场景。

## When NOT to Use

金融交易、实时告警等零容忍丢失场景，应使用持久化消息队列（RabbitMQ / Kafka）。

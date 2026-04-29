# [Draft] Traffic Settlement Scheduler

> 来源: TICKET-JAVA-006 | 创建: 2026-04-27 | 考察期: 2026-05-27

## 场景

定时任务将业务统计（PV/UV）转换为平台代币，批量入账。

## 代码

```java
@Component
public class TrafficSettlementJob {
    @Scheduled(cron = "0 0 2 * * ?")
    public void settleDailyTraffic() {
        settleTrafficForDate(LocalDate.now().minusDays(1));
    }
    
    public void settleTrafficForDate(LocalDate date) {
        List<TrafficRecord> records = trafficRecordMapper.findByDate(date);
        for (TrafficRecord record : records) {
            try {
                transactionTemplate.execute(status -> {
                    // 幂等性检查
                    if (creditsTransactionMapper.countBySource(
                            record.getWebsiteId(), "EARN_TRAFFIC", 
                            record.getWebsiteId() + ":" + date) > 0) {
                        return null;
                    }
                    BigDecimal credits = calculateCredits(record);
                    creditsAccountService.credit(
                        record.getUserId(), credits,
                        CreditsTransactionType.EARN_TRAFFIC,
                        record.getWebsiteId() + ":" + date,
                        "Traffic settlement for " + date
                    );
                    record.setCreditsEarned(credits);
                    trafficRecordMapper.updateById(record);
                    return null;
                });
            } catch (Exception e) {
                log.error("Settlement failed for website {}: {}", 
                    record.getWebsiteId(), e.getMessage());
            }
        }
    }
}
```

## 关键设计

1. **事务粒度**: 方法级不加 `@Transactional`，每个网站独立 `TransactionTemplate` — 避免大事务，单个失败不影响其他
2. **幂等性**: 利用数据库唯一约束 `(userId, sourceType, sourceId)`，`sourceId = websiteId:date`
3. **异常隔离**: `try-catch` 包裹每个网站的结算，失败记录日志不中断批量

## 测试技巧

- **注入 TransactionTemplate 而非 PlatformTransactionManager** — mock `execute()` 直接执行 callback
- **Mockito strictness**: 通用 stub 可能未在某些路径使用，用 `@MockitoSettings(strictness = Strictness.LENIENT)`
- **BigDecimal**: 用 `compareTo` 而非 `equals` 比较

## 注意

- 多实例部署需考虑分布式锁
- 数据量大时分页查询，避免一次性加载

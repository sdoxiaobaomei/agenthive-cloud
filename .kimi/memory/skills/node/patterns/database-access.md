# Pattern: PostgreSQL 参数化查询

```typescript
// 正确 — 参数化
const result = await pgPool.query(
  'SELECT * FROM users WHERE id = $1 AND status = $2',
  [userId, 'active']
);

// 错误 — SQL 注入风险
const result = await pgPool.query(`SELECT * FROM users WHERE id = ${userId}`);

// 连接池配置
const pgPool = new Pool({
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

> ⚠️ **v0.9 批量模板** — 此 skill 为初始化时批量生成，非实战沉淀。内容可能不完整或存在编码损坏。执行相关 Ticket 后应逐步替换为实战验证版本。

# Pattern: PostgreSQL 鍙傛暟鍖栨煡璇?

```typescript
// 姝ｇ‘ 鈥?鍙傛暟鍖?
const result = await pgPool.query(
  'SELECT * FROM users WHERE id = $1 AND status = $2',
  [userId, 'active']
);

// 閿欒 鈥?SQL 娉ㄥ叆椋庨櫓
const result = await pgPool.query(`SELECT * FROM users WHERE id = ${userId}`);

// 杩炴帴姹犻厤缃?
const pgPool = new Pool({
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

> ⚠️ **v0.9 批量模板** — 此 skill 为初始化时批量生成，非实战沉淀。内容可能不完整或存在编码损坏。执行相关 Ticket 后应逐步替换为实战验证版本。

# Pattern: Pino 缁撴瀯鍖栨棩蹇?

```typescript
import { logger } from '../config/logger.js';

logger.info({ userId, orderId }, 'Order created');
logger.warn({ attempt: 3 }, 'Retrying payment');
logger.error({ err, taskId }, 'Task failed');
```

绂佹鐢熶骇璺緞浣跨敤 console.log

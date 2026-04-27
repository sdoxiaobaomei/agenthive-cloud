# Pattern: Pino 结构化日志

```typescript
import { logger } from '../config/logger.js';

logger.info({ userId, orderId }, 'Order created');
logger.warn({ attempt: 3 }, 'Retrying payment');
logger.error({ err, taskId }, 'Task failed');
```

禁止生产路径使用 console.log

> ⚠️ **v0.9 批量模板** — 此 skill 为初始化时批量生成，非实战沉淀。内容可能不完整或存在编码损坏。执行相关 Ticket 后应逐步替换为实战验证版本。

# Pattern: Zod Schema 杩愯鏃舵牎楠?

```typescript
import { z } from 'zod';

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1).max(100),
  role: z.enum(['admin', 'user', 'guest']),
});

export type User = z.infer<typeof UserSchema>;

// Controller 涓娇鐢?
const body = UserSchema.parse(req.body);  // 鑷姩鎶?400
```

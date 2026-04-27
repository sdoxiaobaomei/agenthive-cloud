# Pattern: Zod Schema 运行时校验

```typescript
import { z } from 'zod';

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1).max(100),
  role: z.enum(['admin', 'user', 'guest']),
});

export type User = z.infer<typeof UserSchema>;

// Controller 中使用
const body = UserSchema.parse(req.body);  // 自动抛 400
```

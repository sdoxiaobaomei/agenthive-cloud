> ⚠️ **v0.9 批量模板** — 此 skill 为初始化时批量生成，非实战沉淀。内容可能不完整或存在编码损坏。执行相关 Ticket 后应逐步替换为实战验证版本。

# Pattern: AppError 缁熶竴閿欒澶勭悊

```typescript
// errors/AppError.ts
export class AppError extends Error {
  constructor(
    public code: string,
    public statusCode: number,
    public message: string
  ) { super(message); }
}

// 鍏ㄥ眬涓棿浠?
app.use((err, req, res, next) => {
  if (err instanceof AppError) {
    logger.warn({ errCode: err.code, path: req.path }, err.message);
    return res.status(err.statusCode).json({
      success: false, code: err.code, message: err.message
    });
  }
  logger.error({ stack: err.stack }, 'Unexpected error');
  res.status(500).json({ success: false, code: 'INTERNAL_ERROR' });
});
```

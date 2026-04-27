# Pattern: AppError 统一错误处理

```typescript
// errors/AppError.ts
export class AppError extends Error {
  constructor(
    public code: string,
    public statusCode: number,
    public message: string
  ) { super(message); }
}

// 全局中间件
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

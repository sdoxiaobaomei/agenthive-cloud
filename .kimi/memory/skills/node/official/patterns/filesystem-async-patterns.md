# [Draft] Filesystem Async Patterns

> 来源: TICKET-FEAT-002a | 创建: 2026-04-27 | 考察期: 2026-05-27

## 场景

Node.js 后端操作文件系统，避免 callback/async 陷阱。

## 正确做法

```typescript
import { promises as fs } from 'fs';

async function safeReadFile(path: string): Promise<string | null> {
  try {
    await fs.access(path);
    return await fs.readFile(path, 'utf-8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}
```

## Multer 错误处理

```typescript
const upload = multer({ dest: 'uploads/' });

app.post('/upload', upload.single('file'), (req, res, next) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({ url: `/uploads/${req.file.filename}` });
});

app.use((err: any, req: any, res: any, next: any) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: err.code, message: err.message });
  }
  next(err);
});
```

## 关键模式

1. **用 `fs.promises.*`** — 原生 Promise，避免 callback 地狱
2. **`fs.access` 替代 `fs.exists`** — `exists` 已废弃且是同步 API
3. **区分 ENOENT 和其他错误** — 文件不存在是正常分支，权限错误才是异常
4. **multer 错误必须单独捕获** — Express 默认不处理 LIMIT_FILE_SIZE 等错误

## 踩坑

TICKET-FEAT-002a: 误用 `fs.exists` 的 async/await 封装导致"文件不存在"误判为"权限错误"。`fs.exists` 的 callback 签名 `(err, exists)` 与 Promise 封装不兼容。

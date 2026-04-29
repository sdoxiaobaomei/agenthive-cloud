# Reflection: TICKET-FEAT-002a — Workspace 目录操作与文件上传下载 API

## 执行摘要
补全 Workspace 文件系统 API 的 5 个核心缺口：mkdir、rename、move、upload、download，全部基于现有 `isPathSafe` + `getUserWorkspace` 基础设施构建。

## 关键决策

### 决策 1：multer memoryStorage 而非 diskStorage
- **memoryStorage**：文件保存在内存 buffer 中，Controller 直接 `writeFile(dest, file.buffer)`
- **优点**：无临时文件清理负担；代码更简洁
- **风险**：大文件会占用内存；当前单文件 10MB 限制可接受
- **未来**：如需要支持 GB 级上传，应切换为 diskStorage + 流式处理

### 决策 2：rename/move 使用 fs.rename 原生递归支持
- Node.js `fs.rename` 在跨目录时支持移动整个目录树（包括子目录和文件）
- 无需手动递归遍历，代码简洁且原子性更好
- 目标存在时返回 409 Conflict，避免意外覆盖

### 决策 3：下载使用 createReadStream 而非 readFile
- **stream 方式**：`createReadStream(path).pipe(res)`
- **优点**：不占用大量内存；Express 自动处理 backpressure
- **对比**：`readFile` 会把整个文件加载到内存，对于大文件或高并发场景风险高

## 文件变更统计
| 文件 | 变更类型 |
|------|----------|
| `apps/api/src/controllers/code.ts` | 编辑：新增 5 个端点 + multer 配置导出 |
| `apps/api/src/routes/code.ts` | 编辑：新增 5 条路由（含 multer 中间件） |
| `apps/api/package.json` | 编辑：新增 multer + @types/multer 依赖 |

## API 端点清单
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/code/workspace/files/mkdir | 创建目录（支持多级） |
| POST | /api/code/workspace/files/rename | 重命名 |
| POST | /api/code/workspace/files/move | 移动（支持递归子树） |
| POST | /api/code/workspace/files/upload | 上传（最多 5 文件，单文件 10MB） |
| GET | /api/code/workspace/files/download | 下载（stream 传输） |

## 验证结果
- `npm run typecheck`：✅ 通过
- `npm test`（project.service）：✅ 12/12 通过
- `npm test`（redis-cache）：✅ 21/21 通过
- `npm test`（userMapping.service）：✅ 6/6 通过
- `npm test`（全量）：56 通过 / 10 失败（全部 pre-existing）

## 学到的模式

### Pattern: 文件上传的安全三层防御
```
Layer 1: multer fileFilter — 扩展名白名单拦截（.exe/.bat/...）
Layer 2: multer limits.fileSize — 单文件大小限制（10MB）
Layer 3: isPathSafe — 路径安全检查，禁止跳出 workspace
```
这种分层防御在文件上传场景中可复用。

### Pattern: 目标存在的前置检查
```typescript
try {
  await stat(newFullPath)
  return res.status(409).json({ message: '目标路径已存在' })
} catch (e: any) {
  if (e.code !== 'ENOENT') throw e
}
// 继续执行 rename/move
```
比 `fs.exists` 更符合 async/await 风格，且能区分"不存在"和"权限错误"。

## 后续建议
1. **FEAT-002b 就绪**：002a 完成后，002b（批量操作与内容搜索）的依赖已满足，可立即执行。
2. **multer 错误处理**：当前 multer 的错误（如文件过大）由 Express 默认错误中间件捕获，
   建议后续统一为自定义错误处理，返回中文错误提示。
3. **下载目录打包**：当前 download 端点禁止下载目录，后续可考虑支持目录打包下载（tar/zip）。

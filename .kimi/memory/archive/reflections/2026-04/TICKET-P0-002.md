# Reflection: TICKET-P0-002 — Node API 结构化日志与敏感信息脱敏

## 执行摘要
将 `apps/api` 中全部 `console.*` 替换为结构化日志，并建立敏感信息脱敏规则。因 pino 未实际安装，选择增强现有自研 logger 而非引入新依赖。

## 关键决策

### 决策 1：不引入 pino，增强现有 logger
- **原因**：约束明确"不引入新的运行时依赖（pino 已可用）"，但 `node_modules` 中不存在 pino。
- **结果**：在现有 `utils/logger.ts` 上增加脱敏层 + 切换底层输出为 `process.stdout/stderr.write`，零依赖增加。

### 决策 2：双层脱敏架构
- **字符串层**：7 组正则覆盖 pg/redis 连接串、Bearer Token、API Key（sk-/pk-）、密码字段。
- **对象层**：键名白名单（password/secret/token/api_key/jwt/auth/credential）直接替换值为 `***`。
- **理由**：仅靠正则无法覆盖嵌套对象中的敏感字段（如 `context: { dbConfig: { password: 'xxx' } }`）。

### 决策 3：启动 banner 的取舍
- **原状**：`index.ts` 中 `server.listen` 回调打印 80+ 行多行 banner，纯文本非 JSON。
- **改造**：收束为单条结构化日志 `{ port, database, redis, websocket, healthEndpoint }`。
- **代价**：开发环境启动时失去视觉 banner；收益：生产环境日志系统（Loki/ELK）可统一解析。

## 文件变更统计
| 文件 | 变更类型 |
|------|----------|
| `apps/api/src/utils/logger.ts` | 重写：新增脱敏 + 切换 stdout/stderr |
| `apps/api/src/index.ts` | 编辑：替换 18 处 console.* |
| `apps/api/src/telemetry.ts` | 编辑：替换 4 处 console.* |
| `apps/api/src/bin/task-consumer.ts` | 编辑：替换 4 处 console.* |
| `apps/api/src/websocket/hub.ts` | 编辑：替换 9 处 console.* |
| `apps/api/src/config/redis.ts` | 编辑：替换 6 处 console.* |
| `apps/api/src/config/database.ts` | 编辑：替换 2 处 console.* |
| `apps/api/src/services/llm.ts` | 编辑：替换 6 处 console.* |
| `apps/api/src/services/taskExecution.ts` | 编辑：替换 5 处 console.* |
| `apps/api/src/services/llm-mock.ts` | 编辑：替换 1 处 console.* |

## 验证结果
- `npm run typecheck`：✅ 通过
- `npm run lint`：✅ 通过（未配置 linter）
- `npm test`：✅ 39 通过 / 10 失败（全部 pre-existing，与 logger 无关）
- `grep console.* apps/api/src`：✅ 零命中

## 学到的模式

### Pattern: 双层日志脱敏
```
输入日志 → sanitizeString(正则) → sanitizeValue(对象键名) → JSON.stringify → stdout/stderr
```
适用于任何需要输出用户/系统数据到日志的场景，可作为 Node.js 服务的默认日志中间件模式。

### Pattern: 约束驱动架构决策
当 Ticket 假设（pino 已可用）与实际环境不符时，不应盲目遵守字面要求引入依赖，而应回归约束本质（"不引入新依赖"），在现有基础设施上满足功能目标。

## 后续建议
1. **测试债务**：`taskExecution.service.test.ts` 的 `result.result.success` 断言与实现不符（返回结构为 `{ code, message, data }` 而非 `{ success, error }`），建议单独 Ticket 修复。
2. **auth.middleware.test.ts** 的 dev mode 注入导致 8 个测试失败，建议在测试 setup 中强制设置 `NODE_ENV=test` 并隔离 dev 注入逻辑。
3. **logger.ts 性能**：`sanitizeValue` 对每个日志的 context 做深度遍历，高频场景下可能产生 GC 压力。如需优化，可引入简单的缓存（LRU）或仅在 error 级别启用完整脱敏。

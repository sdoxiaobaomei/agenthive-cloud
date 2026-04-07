# AgentHive Cloud API - TODO 清单

> 本文档记录 API 待实现、待修复的功能  
> 最后更新: 2026-04-07

---

## 🔴 高优先级 (阻塞性功能)

### 1. 短信验证码服务 `[已完成]`

**状态**: ✅ 已实现 (Mock 版本)  
**位置**: `src/services/sms.ts`

**实现功能**:
- ✅ 生成6位随机验证码
- ✅ 存储到 PostgreSQL (5分钟过期)
- ✅ 频率限制 (1分钟内不能重复发送)
- ✅ 最多3次验证尝试
- ✅ 开发环境返回验证码 (devCode)

**使用方式**:
```typescript
import { smsService } from './services/sms.js'

// 发送验证码
await smsService.sendCode('13800138000')

// 验证验证码
await smsService.verifyCode('13800138000', '123456')
```

**生产环境建议**:
- 接入阿里云短信服务
- 或腾讯云短信服务

---

### 2. PostgreSQL 数据库初始化 `[已完成]`

**状态**: ✅ 已实现  
**错误**: `relation "users" does not exist` (已修复)

**实现文件**:
- `src/db/schema.sql` - 表结构定义
- `scripts/init-db.ts` - 初始化脚本
- `package.json` - 已配置 `db:init` 命令

**已创建的表**:
- ✅ users (用户表)
- ✅ agents (Agent表)
- ✅ tasks (任务表)
- ✅ code_files (代码文件表)
- ✅ sms_codes (验证码临时表)
- ✅ agent_logs (Agent日志表)

**使用方式**:
```bash
npm run db:init  # 执行数据库初始化
```

**初始化内容包括**:
- 创建所有表结构
- 创建索引
- 创建更新时间触发器
- 插入默认测试数据 (agents, tasks, code_files, agent_logs)

---

## 🟡 中优先级 (功能完善)

### 3. 用户注册接口 `[TODO]`

**状态**: ⚠️ 有接口但未完整实现  
**位置**: `POST /api/auth/register`

```typescript
// TODO: 完善注册逻辑
// 当前: 直接插入数据库，无验证
// 需要:
// 1. 检查手机号是否已存在
// 2. 密码强度验证
// 3. 发送欢迎短信
// 4. 创建默认项目
```

---

### 4. Agent 运行时集成 `[TODO]`

**状态**: ⚠️ Mock 数据  
**位置**: `src/controllers/agents.ts`

```typescript
// TODO: 连接真实的 Agent Runtime
// 当前: 返回静态 mock 数据
// 需要:
// 1. WebSocket 连接到 agent-runtime
// 2. 转发启动/停止/暂停命令
// 3. 实时接收 Agent 日志
// 4. 状态同步
```

---

### 5. 任务执行引擎 `[TODO]`

**状态**: ⚠️ 未实现  
**位置**: `POST /api/tasks/:id/execute`

```typescript
// TODO: 实现任务执行
// 当前: 仅更新数据库状态
// 需要:
// 1. 任务队列 (Bull/Agenda)
// 2. 调用 Agent Runtime 执行
// 3. 进度实时推送 (WebSocket/SSE)
// 4. 结果存储
```

---

## 🟢 低优先级 (优化增强)

### 6. 文件存储服务 `[TODO]`

**状态**: ⚠️ 本地存储  
**位置**: `src/controllers/code.ts`

```typescript
// TODO: 支持多种存储后端
// 当前: 直接操作本地文件系统
// 可选增强:
// 1. MinIO/S3 对象存储
// 2. Git 集成 (版本控制)
// 3. 文件同步到 workspace
```

---

### 7. 速率限制 `[TODO]`

**状态**: ❌ 未实现  
**影响**: 容易被暴力破解/刷接口

```typescript
// TODO: 添加限流保护
// 1. 短信发送: 每手机号每天5条
// 2. 登录尝试: 每IP每小时10次
// 3. API 通用: 每用户每分钟100次
```

---

### 8. 日志和监控 `[TODO]`

**状态**: ❌ 基础 console.log

```typescript
// TODO: 专业日志系统
// 1. Winston/Pino 结构化日志
// 2. 错误上报 (Sentry)
// 3. API 访问日志
// 4. 性能监控
```

---

### 9. 单元测试 `[TODO]`

**状态**: ❌ 测试文件为空  
**位置**: `tests/unit/`

```typescript
// TODO: 补充测试
// 1. 认证流程测试
// 2. Agent CRUD 测试
// 3. 任务执行测试
// 4. 文件操作测试
```

---

## ✅ 已完成

| 功能 | 状态 | 备注 |
|------|------|------|
| 基础 Express 框架 | ✅ | TypeScript + 中间件 |
| 路由结构 | ✅ | auth, agents, tasks, code |
| JWT 认证中间件 | ✅ | 令牌生成和验证 |
| 数据库连接 | ✅ | PostgreSQL + Redis |
| API 文档 | ✅ | 本文档 |
| 健康检查 | ✅ | GET /api/health |
| **短信验证码服务** | ✅ | `src/services/sms.ts` (Mock) |
| **数据库初始化** | ✅ | `npm run db:init` |

---

## 📝 快速修复指南

### 开发环境快速绕过 (临时方案)

如果需要立即测试登录功能，可以修改 `src/services/sms.ts`:

```typescript
// 开发环境: 验证码固定为 123456
export async function sendSmsCode(phone: string) {
  const code = '123456'; // 开发环境固定
  await redis.setex(`sms:${phone}`, 300, code);
  console.log(`[DEV] 验证码 for ${phone}: ${code}`);
  return { success: true };
}
```

---

## 🔗 相关文档

- [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) - 完整 API 文档
- [DATABASE.md](./DATABASE.md) - 数据库设计
- [STARTUP_GUIDE.md](./STARTUP_GUIDE.md) - 启动指南

---

## 👨‍💻 负责人

| 模块 | 负责人 | 进度 |
|------|--------|------|
| 认证服务 | 待定 | 0% |
| Agent 运行时 | 待定 | 0% |
| 任务系统 | 待定 | 0% |
| 文件存储 | 待定 | 0% |

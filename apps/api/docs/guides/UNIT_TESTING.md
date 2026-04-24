# API 单元测试指南

> **目标**: 参照 Java 单元测试质量标准，为 Node API 核心模块建立完整、可维护的单元测试体系。

---

## 测试总数

| 层级 | 测试文件数 | 测试用例数 | 状态 |
|------|-----------|-----------|------|
| Node API | 15 | **169** | ✅ 全部通过 |
| Java | 9+ | **75** | ✅ 全部通过 |

---

## Node API 测试覆盖

### Controller 层（HTTP 路由测试）

| 模块 | 文件 | 测试数 | 覆盖场景 |
|------|------|--------|----------|
| Agents | `agents.controller.test.ts` | 18 | CRUD、命令下发、参数校验、404 处理 |
| Tasks | `tasks.controller.test.ts` | 20 | CRUD、取消、子任务、参数校验 |
| Code | `code.controller.test.ts` | 18 | 文件读写、搜索、验证错误 |

**测试风格**: 使用 `supertest` + 真实 Express app，测试真实 HTTP 请求/响应。

### Service 层（业务逻辑测试）

| 模块 | 文件 | 测试数 | 覆盖场景 |
|------|------|--------|----------|
| Redis Cache | `redis-cache.test.ts` | 21 | get/set、过期、删除、Pipeline、计数器、会话管理 |
| Project | `project.service.test.ts` | 12 | CRUD、软删除、COALESCE 部分更新、null 字段处理 |
| UserMapping | `userMapping.service.test.ts` | 6 | 外部用户映射、字段同步、迁移兼容、默认用户名生成 |
| TaskExecution | `taskExecution.service.test.ts` | 19 | 并发限制、重复执行防护、LLM 成功/失败、取消、进度广播、提示词构建 |

**测试风格**: Mock 数据库层 (`pool.query`) 和外部依赖 (`fs/promises`, `broadcast`, `getLLMService`)，专注业务逻辑验证。

### Middleware 层（中间件测试）

| 模块 | 文件 | 测试数 | 覆盖场景 |
|------|------|--------|----------|
| Auth | `auth.middleware.test.ts` | 14 | 白名单、测试环境自动认证、Gateway 透传、JWT 验证、Cookie、optionalAuth |
| Visitor | `visitor.middleware.test.ts` | 5 | 访客 ID 分配、已认证跳过、计数递增、过期清理 |
| Request Logger | `request-logger.middleware.test.ts` | 6 | 结构化日志、状态码、duration、user-agent |

**测试风格**: 使用 `supertest` 驱动中间件，验证请求放行/拦截行为和副作用（mock logger）。

### 工具层（纯函数测试）

| 模块 | 文件 | 测试数 | 覆盖场景 |
|------|------|--------|----------|
| JWT | `jwt.test.ts` | 9 | 签名、验证、解码、过期、时钟容差、generateToken |
| Code DB | `code.db.test.ts` | 5 | 文件 CRUD、目录列表、搜索 |
| Redis Config | `redis.config.test.ts` | 6 | 连接配置、重连、健康检查、环境变量解析 |
| WebSocket Hub | `websocket.hub.test.ts` | 3 | 连接管理、消息广播 |

### 集成测试

| 模块 | 文件 | 测试数 | 覆盖场景 |
|------|------|--------|----------|
| API Workflow | `api.workflow.test.ts` | 7 | 端到端请求流、错误处理、404、验证错误 |

---

## 测试质量规范

### 命名规范

```typescript
// 使用中文描述，明确测试意图
it('应通过 externalId 找到已有用户并返回', async () => { ... })
it('超过并发限制时应抛出错误', async () => { ... })
it('无效 token 应返回 401', async () => { ... })
```

### 一测一事

每个 `it()` 只验证一个行为或一个断言组：
```typescript
it('应更新项目并返回更新后的数据', async () => {
  const result = await projectService.update('proj-1', { name: 'Updated' })
  expect(result?.name).toBe('Updated')
  expect(mockQuery).toHaveBeenCalledWith(
    expect.stringContaining('UPDATE projects'),
    ['Updated', undefined, undefined, undefined, 'proj-1']
  )
})
```

### Mock 策略

**必须在 import 之前声明 `vi.mock`**:
```typescript
vi.mock('../../src/utils/database.js', () => ({
  userDb: {
    findByExternalId: vi.fn(),
    findByUsername: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  },
}))

// 然后 import
import { userDb } from '../../src/utils/database.js'
```

### 环境隔离

```typescript
describe('Auth Middleware', () => {
  const originalEnv = process.env.NODE_ENV

  beforeEach(() => { vi.clearAllMocks(); process.env.NODE_ENV = 'development' })
  afterEach(() => { process.env.NODE_ENV = originalEnv })
})
```

---

## 运行测试

```bash
cd apps/api

# 全部测试
npx vitest run

# 指定文件
npx vitest run tests/unit/auth.middleware.test.ts

# 监视模式
npx vitest

# UI 模式
npx vitest --ui
```

---

## Java 测试对应关系

| Java 模块 | 测试文件 | 测试数 | 测试重点 |
|-----------|---------|--------|----------|
| common-core | `ResultTest.java` | 7 | 成功/失败响应构建、链式操作 |
| common-core | `AgentHiveExceptionTest.java` | 5 | 异常码、消息、链式构造 |
| common-security | `JwtUtilsTest.java` | 10 | 令牌生成、验证、过期、刷新、 claims 提取 |
| gateway-service | `JwtValidationFilterTest.java` | 7 | 令牌验证、白名单、过期处理、异常响应 |
| gateway-service | `TraceIdFilterTest.java` | 3 | TraceId 生成/传递 |
| auth-service | `SmsControllerTest.java` | 5 | 发送/验证短信、参数校验、限流 |
| auth-service | `AuthControllerTest.java` | 5 | 注册、登录、JWT 颁发、刷新令牌 |
| user-service | `UserServiceImplTest.java` | 7 | 用户 CRUD、Feign 调用、分页查询 |
| user-service | `AuthFeignClientFallbackTest.java` | 2 | 熔断降级、降级响应 |

**Java 测试关键技术**: 使用独立 `TestMvcConfig` 避免加载完整 Spring 上下文，通过 `@Import` 仅注入被测 Controller 和必要组件，解决级联依赖缺失问题。

---

## 持续改进清单

- [ ] `services/llm.ts` - LLM Provider 抽象层测试
- [ ] `services/redis-cache.ts` - Pub/Sub 场景补充
- [ ] `middleware/rate-limit.ts` - 限流中间件（如存在）
- [ ] E2E 测试覆盖 - 登录/注册/短信验证完整链路

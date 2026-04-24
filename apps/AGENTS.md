# AgentHive Cloud Apps 开发规范

> 适用于 `apps/` 目录下所有项目的开发者和 AI Agent。
> 本规范与根目录 `AGENTS.md` 互补，**apps 子目录的规范以此为准**。

---

## 核心理念

**后端定契约（API-First），前端做 BFF（Backend for Frontend）驱动体验。**

后端对领域负责（数据对不对），BFF 对页面负责（数据好不好用），前端对体验负责（界面好不好看）。

---

## 1. 架构分层与职责

```
┌────────────────────────────────────────────────────────────┐
│  Layer 1: 前端（Landing / Web）                             │
│  → 只管 UI/UX：组件、交互、动画、状态管理                     │
│  → 不直接调后端，只调 BFF（server/api）                      │
│  → 技术栈：Vue 3 / Nuxt 3 / Pinia / Tailwind                 │
├────────────────────────────────────────────────────────────┤
│  Layer 2: BFF（Landing server/api/*）                       │
│  → 前端团队维护，按页面需求聚合/裁剪/转换数据                  │
│  → Java Long ID → 前端 UUID                                 │
│  → snake_case → camelCase                                   │
│  → 多微服务接口聚合为单页面接口                                │
│  → 技术栈：Nitro (Nuxt Server) / TypeScript                 │
├────────────────────────────────────────────────────────────┤
│  Layer 3: 后端（Java / Node API）                            │
│  → 定义领域模型和标准 REST API                               │
│  → 保证接口稳定、幂等、安全、可复用                            │
│  → 所有接口必须生成 Swagger/OpenAPI 文档                      │
│  → Java: Spring Boot / Spring Cloud / MyBatis-Plus          │
│  → Node: Express / TypeScript / Vitest                      │
└────────────────────────────────────────────────────────────┘
```

**铁律：前端需求变了，先在 BFF 层解决；BFF 解决不了，再提后端接口变更需求。**

---

## 2. API 契约规范

### 2.1 谁定契约

**后端定义接口契约，前端遵守。**

- Java 端：使用 SpringDoc OpenAPI 自动生成 Swagger UI
- Node 端：使用 JSDoc + swagger-jsdoc 或维护 `docs/API_REFERENCE.md`
- 契约一旦发布，非破坏性变更（additive only）

### 2.2 接口设计原则

```
后端接口设计 checklist：
□ URL 用资源名词复数，不用动词
  ✅ GET /api/auth/users/{id}
  ❌ GET /api/auth/getUserById

□ HTTP 方法语义正确
  GET → 查询 | POST → 创建 | PUT → 全量更新 | PATCH → 部分更新 | DELETE → 删除

□ 响应包装统一
  {
    "code": 200,
    "message": "success",
    "data": { ... }
  }

□ 错误码全局唯一，不重复定义
  → Java 端使用 ResultCode 枚举
  → Node 端使用统一错误中间件

□ 分页参数统一
  { "page": 1, "pageSize": 10 }
  返回: { "list": [], "total": 100, "page": 1, "pageSize": 10 }
```

### 2.3 数据模型规范

| 层级 | 命名风格 | 示例 |
|------|---------|------|
| 后端领域模型 | PascalCase + 业务语义 | `SysUser`, `SysRole`, `AgentTask` |
| 后端 DTO | PascalCase + Request/Response 后缀 | `LoginRequest`, `TokenResponse` |
| BFF 页面模型 | PascalCase + 页面语义 | `LoginResult`, `UserProfile` |
| 前端 Store | camelCase + use 前缀 | `useAuthStore`, `useTaskStore` |
| 前端组件 | PascalCase | `AgentCard.vue`, `TaskList.vue` |

---

## 3. 数据流向规则

### 3.1 后端 → BFF → 前端 转换清单

```typescript
// landing/server/api/auth/me.get.ts
// ✅ 正确：BFF 层做字段映射和补全
export default defineEventHandler(async (event) => {
  const result = await proxyToApi(event, '/api/auth/me')
  
  if (result.success && result.data) {
    const user = result.data
    return {
      success: true,
      data: {
        id: user.id,
        name: user.name || user.username || '',        // 字段兜底
        phone: user.phone,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        createdAt: user.createdAt || user.created_at,   // 命名转换
        updatedAt: user.updatedAt || user.updated_at,
      }
    }
  }
  
  return result
})
```

### 3.2 BFF 层禁止做的事

```
❌ 在 BFF 层写业务逻辑（如密码校验、权限判断）
❌ 在 BFF 层直接操作数据库
❌ 在 BFF 层缓存敏感数据（如 Token、密码）
❌ 在 BFF 层暴露后端内部字段（如 deleted、version、internalRemark）
```

### 3.3 BFF 层必须做的事

```
✅ 字段映射（snake_case ↔ camelCase）
✅ 字段补全（给前端提供默认值）
✅ 错误格式统一（后端不同服务的错误格式可能不同）
✅ 接口聚合（一个页面调多个后端接口，BFF 聚合为一次请求）
✅ 敏感字段脱敏
```

---

## 4. 开发流程

### 4.1 新增功能的标准流程

```
阶段 1：需求对齐（15 分钟）
├── 后端提供 Swagger/OpenAPI 草案
├── 前端确认 BFF 聚合策略
└── 双方确认数据模型和错误码

阶段 2：并行开发（独立进行）
├── 后端：按契约实现接口，更新 Swagger
├── 前端：对着 Swagger 用 Mock 数据开发 UI
├── BFF：写代理和转换层（可用后端 Mock 接口测试）

阶段 3：联调（半天）
├── 后端确认接口符合契约
├── BFF 对接真实接口
└── 前端对接 BFF（字段已转好，直接可用）

阶段 4：验收
├── 接口测试通过（Swagger Try-it-out）
├── 前端 E2E 通过（Playwright）
└── 代码审查通过
```

### 4.2 接口变更流程

```
后端接口变更必须走评审：

1. 破坏性变更（改 URL、删字段、改类型）
   → 发 RFC 文档，通知所有前端和 BFF 维护者
   → 版本号升级（v1 → v2）
   → 保留旧接口至少 2 个版本周期

2. 非破坏性变更（新增字段、新增可选参数）
   → 更新 Swagger 即可
   → BFF 层按需消费新字段

3. 前端需求驱动的新接口
   → 前端写接口需求文档（含请求/响应示例）
   → 后端评审技术可行性
   → 后端实现并生成 Swagger
   → 禁止前端直接要求后端按 UI 临时改字段
```

---

## 5. 命名与代码规范

### 5.1 文件目录规范

```
apps/
├── landing/                          # 前端 Landing
│   ├── components/                   # Vue 组件
│   │   ├── atoms/                    # 原子组件
│   │   ├── molecules/                # 分子组件
│   │   └── organisms/                # 有机体组件
│   ├── composables/                  # 组合式函数
│   │   └── useApi.ts                 # API 调用封装
│   ├── pages/                        # 页面路由
│   ├── stores/                       # Pinia Store
│   └── server/                       # BFF 层（Nitro）
│       └── api/                      # API 路由
│           └── auth/
│               ├── login.post.ts     # 登录
│               ├── login/
│               │   └── sms.post.ts   # 短信登录
│               └── me.get.ts         # 获取当前用户
│
├── api/                              # Node API 服务
│   ├── src/
│   │   ├── middleware/               # Express 中间件
│   │   ├── routes/                   # 路由定义
│   │   ├── services/                 # 业务逻辑
│   │   └── utils/                    # 工具函数
│   └── tests/                        # 单元测试
│       ├── unit/                     # 单元测试
│       └── integration/              # 集成测试
│
├── java/                             # Java 微服务
│   ├── auth-service/                 # 认证服务
│   │   ├── src/main/java/.../controller/   # Controller
│   │   ├── src/main/java/.../service/      # Service
│   │   ├── src/main/java/.../mapper/       # Mapper
│   │   └── src/test/java/.../              # 单元测试
│   ├── user-service/                 # 用户服务
│   └── gateway-service/              # 网关服务
```

### 5.2 接口路由规范

| 服务 | 基础路径 | 示例 |
|------|---------|------|
| Gateway | `/api/**` | `/api/auth/login`, `/api/users/1` |
| Java auth-service | `/auth/**` | `/auth/login`, `/auth/sms/send` |
| Java user-service | `/users/**` | `/users/1`, `/users/1/roles` |
| Node API | `/api/agents/**`, `/api/tasks/**` | `/api/agents`, `/api/tasks/123` |
| Landing BFF | `/api/**` (代理层) | 同 Gateway，Landing server/api 映射 |

**注意：前端（浏览器）永远只访问 Gateway（8080）或 Landing（3000），不直接访问后端服务端口。**

---

## 6. 测试规范

### 6.1 后端测试

```java
// Java：Controller 层用 MockMvc，Service 层用 Mockito
@SpringBootTest(classes = TestMvcConfig.class)
@AutoConfigureMockMvc
class AuthControllerTest {
    // 一测一事，使用 @Nested 分组
    // 不用假数据，用 ArgumentCaptor 精确验证参数
    // 真实 JWT 令牌（不 mock 库内部）
}
```

```typescript
// Node：使用 Vitest + Supertest
// Mock 必须在 import 之前声明 vi.mock()
// 一测一事，用 describe 分组
// 环境变量在 beforeEach/afterEach 中隔离
```

### 6.2 前端测试

```typescript
// Vitest + Vue Test Utils
// Store 测试：mock API 层，测状态流转
// 组件测试：测 props/事件/渲染，不测业务逻辑
```

### 6.3 BFF 层测试

```typescript
// 用 $fetch 或真实 HTTP 调 BFF 端点
// Mock 后端服务（用 MSW 或 Nitro 的 mock 能力）
// 验证字段转换是否正确
```

---

## 7. 代码审查 Checklist

### PR 提交前自测

```
□ 新增/修改的接口已更新 Swagger/OpenAPI 文档
□ 新增/修改的 BFF 路由已做字段映射和错误处理
□ 单元测试覆盖核心路径（ happy path + 至少 1 个异常路径）
□ 没有 console.log / System.out.println 残留（除框架本身的日志）
□ 环境变量使用正确，不硬编码敏感信息
□ 响应格式符合统一包装规范
```

### Reviewer 检查项

```
□ 接口设计是否符合 REST 规范
□ 数据模型是否复用了已有 DTO/VO，没有重复定义
□ BFF 层是否做了必要的字段转换和脱敏
□ 错误码是否使用了全局定义，没有魔数
□ 测试是否独立、可重复，没有外部依赖泄漏
```

---

## 8. 环境变量与配置

### 8.1 配置优先级

```
生产环境变量 (.env) > 开发环境变量 (.env.development) > 本地覆盖 (.env.local) > 代码默认值
```

### 8.2 敏感信息处理

```
❌ 禁止把密码/密钥/Token 提交到 Git
✅ 使用 .env.local（已加入 .gitignore）
✅ 示例配置放在 .env.example
```

### 8.3 服务端口

| 服务 | 开发端口 | 说明 |
|------|---------|------|
| Landing | 3000 | Nuxt dev server |
| Gateway | 8080 | 所有前端请求的统一入口 |
| auth-service | 8081 | Java 认证服务 |
| user-service | 8082 | Java 用户服务 |
| Node API | 3001 | Express 服务 |

---

## 9. 常用命令速查

```bash
# Java
mvn -f java/pom.xml test                    # 运行全部测试
mvn -f java/pom.xml test -pl auth-service   # 只测 auth-service

# Node API
cd apps/api && npx vitest run               # 运行全部测试
npx vitest run tests/unit/xxx.test.ts       # 运行指定测试

# Landing
cd apps/landing && npm run dev              # 开发服务器
cd apps/landing && npm run test             # Vitest 单元测试
cd apps/landing && npm run test:e2e         # Playwright E2E
```

---

## 10. 快速决策树

```
"这个字段该放哪里？"
├── 业务核心字段（id, status, created_at）
│   └── → 后端领域模型
├── 页面展示字段（displayName, formattedDate）
│   └── → BFF 层计算
├── 纯 UI 状态（isOpen, activeTab）
│   └── → 前端 Store
└── 临时计算字段（searchHighlight）
    └── → 前端组件内部

"这个接口该谁实现？"
├── 跨页面复用的核心业务（用户认证、权限校验）
│   └── → Java 后端
├── Agent/Task/文件操作
│   └── → Node API
├── 页面专属的数据聚合/转换
│   └── → Landing BFF (server/api)
└── 纯前端状态（表单校验、路由守卫）
    └── → 前端

"文档该写在哪里？"
├── 接口契约（请求/响应/错误码）
│   └── → Swagger/OpenAPI 自动生成
├── 产品级 API 使用说明
│   └── → api/docs/API_REFERENCE.md
├── 开发规范和流程
│   └── → apps/AGENTS.md（本文件）
└── 架构设计和决策记录
    └── → docs/architecture/
```

---

> **最后提醒**：如果你在 `apps/` 下开发时遇到规范未覆盖的场景，**优先保持和现有代码风格一致**，然后在本文件补充规范。

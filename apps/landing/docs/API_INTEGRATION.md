# Landing 前端 API 集成文档

> **最后更新**: 2026-04-24
> **目标**: 明确前端每个接口调用的后端服务（Java / Node），以及适配状态。

---

## 响应格式说明

前端 `useApi.ts` 已兼容两种后端响应格式：

### Node.js 旧格式
```json
{
  "success": true,
  "data": { ... },
  "message": "..."
}
```

### Java 新格式 (Spring Boot)
```json
{
  "code": 200,
  "message": "success",
  "data": { ... },
  "timestamp": 1713945600000
}
```

> `useApi.ts` 内部通过 `result.code !== undefined && result.success === undefined` 自动识别 Java 格式，并统一转换为前端标准响应 `{ success, data, error, message }`。

---

## 1. 认证模块 (auth)

| # | 前端方法 | HTTP | 前端路径 | 参数 | 响应 data | Java 后端 | 状态 |
|---|---------|------|---------|------|-----------|-----------|------|
| 1 | `auth.sendSms` | POST | `/api/auth/sms/send` | `{ phone, type }` | `Void` | `SmsController.sendVerifyCode()` | ✅ 已适配 |
| 2 | `auth.loginBySms` | POST | `/api/auth/login/sms` | `{ phone, code }` | `TokenResponse` | `AuthController.smsLogin()` | ✅ 已适配 |
| 3 | `auth.login` | POST | `/api/auth/login` | `{ username, password }` | `TokenResponse` | `AuthController.login()` | ✅ 已适配 |
| 4 | `auth.register` | POST | `/api/auth/register` | `{ name, phone, code, password }` | `TokenResponse` | `AuthController.register()` | ⚠️ 参数不匹配 |
| 5 | `auth.logout` | POST | `/api/auth/logout` | — | `Void` | `AuthController.logout()` | ✅ 已适配 |
| 6 | `auth.refresh` | POST | `/api/auth/refresh` | — | `{ token }` | `AuthController.refresh()` | ⚠️ 字段待确认 |
| 7 | `auth.me` | GET | `/api/auth/me` | — | `UserVO` | `AuthController.me()` | ✅ 已适配 |

### 关键差异

**短信发送 (sendSms)**
- 前端发送 `{ phone, type: 'login'|'register'|'reset' }`
- Java `SendSmsVerifyCodeRequest` 接收 `{ phone, type, templateType, signName }`
- Java 内部自动映射：`type=login|register` → `templateType=LOGIN_REGISTER`
- Java 返回 `Result<Void>`，**不再返回 devCode**

**登录响应 (login/loginBySms)**
- Java `TokenResponse` 字段：`accessToken`, `refreshToken`, `expiresIn`, `tokenType`
- 前端已适配：从 `data.accessToken` 读取 token，然后额外调用 `auth.me()` 获取用户信息
- Node.js 旧格式返回 `{ token, user }`，已废弃

**注册 (register)**
- 前端参数：`{ name, phone, code, password }`
- Java `RegisterRequest`：`{ username, password, email }`
- ⚠️ **不匹配**：前端用手机号+验证码注册，Java 用用户名+密码+邮箱注册
- **建议**：注册页需改为用户名密码注册，或 Java 后端增加手机号验证码注册接口

**用户信息 (me)**
- Java `UserVO`：`{ id: Long, username, email, phone, avatar, status, createdAt, roles: string[] }`
- 前端 `User`：`{ id: string, username, name, email?, phone?, role, avatar?, createdAt, updatedAt }`
- `mapUserVO()` 自动映射：`roles[0]` → `role`，`username` → `name`（兜底）

---

## 2. Agent 模块 (agents)

| # | 前端方法 | HTTP | 前端路径 | 参数 | Java 后端 | 状态 |
|---|---------|------|---------|------|-----------|------|
| 1 | `agents.list` | GET | `/api/agents` | `PaginationParams + { status?, type? }` | Node.js API | 🟡 Node 专用 |
| 2 | `agents.getAll` | GET | `/api/agents/all` | `{ status?, type? }` | Node.js API | 🟡 Node 专用 |
| 3 | `agents.create` | POST | `/api/agents` | `CreateAgentParams` | Node.js API | 🟡 Node 专用 |
| 4 | `agents.get` | GET | `/api/agents/:id` | `id` | Node.js API | 🟡 Node 专用 |
| 5 | `agents.update` | PATCH | `/api/agents/:id` | `UpdateAgentParams` | Node.js API | 🟡 Node 专用 |
| 6 | `agents.delete` | DELETE | `/api/agents/:id` | `id` | Node.js API | 🟡 Node 专用 |
| 7 | `agents.start` | POST | `/api/agents/:id/start` | `id` | Node.js API | 🟡 Node 专用 |
| 8 | `agents.stop` | POST | `/api/agents/:id/stop` | `id` | Node.js API | 🟡 Node 专用 |
| 9 | `agents.pause` | POST | `/api/agents/:id/pause` | `id` | Node.js API | 🟡 Node 专用 |
| 10 | `agents.resume` | POST | `/api/agents/:id/resume` | `id` | Node.js API | 🟡 Node 专用 |
| 11 | `agents.getLogs` | GET | `/api/agents/:id/logs` | `PaginationParams + { level?, startTime?, endTime? }` | Node.js API | 🟡 Node 专用 |

> Java Gateway 中 `/api/agents/**` 路由到 Node.js API (`API_SERVICE_URL`)。
> 这些接口目前仍由 Node.js 提供服务，无需修改。

---

## 3. 任务模块 (tasks)

| # | 前端方法 | HTTP | 前端路径 | 参数 | Java 后端 | 状态 |
|---|---------|------|---------|------|-----------|------|
| 1 | `tasks.list` | GET | `/api/tasks` | `PaginationParams + { status?, agentId?, priority? }` | Node.js API | 🟡 Node 专用 |
| 2 | `tasks.getAll` | GET | `/api/tasks/all` | `{ status?, agentId? }` | Node.js API | 🟡 Node 专用 |
| 3 | `tasks.create` | POST | `/api/tasks` | `CreateTaskParams` | Node.js API | 🟡 Node 专用 |
| 4 | `tasks.get` | GET | `/api/tasks/:id` | `id` | Node.js API | 🟡 Node 专用 |
| 5 | `tasks.update` | PATCH | `/api/tasks/:id` | `UpdateTaskParams` | Node.js API | 🟡 Node 专用 |
| 6 | `tasks.delete` | DELETE | `/api/tasks/:id` | `id` | Node.js API | 🟡 Node 专用 |

> Java Gateway 中 `/api/tasks/**` 路由到 Node.js API。

---

## 4. 聊天模块 (chat)

| # | 前端方法 | HTTP | 前端路径 | 参数 | Java 后端 | 状态 |
|---|---------|------|---------|------|-----------|------|
| 1 | `chat.createSession` | POST | `/api/chat/sessions` | `{ projectId?, title? }` | Node.js API | 🟡 Node 专用 |
| 2 | `chat.listSessions` | GET | `/api/chat/sessions` | — | Node.js API | 🟡 Node 专用 |
| 3 | `chat.getSession` | GET | `/api/chat/sessions/:id` | `id` | Node.js API | 🟡 Node 专用 |
| 4 | `chat.sendMessage` | POST | `/api/chat/sessions/:id/messages` | `{ content }` | Node.js API | 🟡 Node 专用 |
| 5 | `chat.getMessages` | GET | `/api/chat/sessions/:id/messages` | `page?, pageSize?` | Node.js API | 🟡 Node 专用 |
| 6 | `chat.executeTask` | POST | `/api/chat/sessions/:id/execute` | `{ content }` | Node.js API | 🟡 Node 专用 |
| 7 | `chat.getTasks` | GET | `/api/chat/sessions/:id/tasks` | — | Node.js API | 🟡 Node 专用 |
| 8 | `chat.getProgress` | GET | `/api/chat/sessions/:id/progress` | — | Node.js API | 🟡 Node 专用 |

> Java Gateway 中 `/api/chat/**` 路由到 Node.js API。

---

## 5. 代码模块 (code)

| # | 前端方法 | HTTP | 前端路径 | 参数 | Java 后端 | 状态 |
|---|---------|------|---------|------|-----------|------|
| 1 | `code.getFiles` | GET | `/api/code/files` | `path?` | Node.js API | 🟡 Node 专用 |
| 2 | `code.getFile` | GET | `/api/code/files/:path` | `path` | Node.js API | 🟡 Node 专用 |
| 3 | `code.updateFile` | PUT | `/api/code/files/:path` | `{ content }` | Node.js API | 🟡 Node 专用 |
| 4 | `code.create` | POST | `/api/code/files/:path` | `{ isDirectory }` | Node.js API | 🟡 Node 专用 |
| 5 | `code.delete` | DELETE | `/api/code/files/:path` | `path` | Node.js API | 🟡 Node 专用 |
| 6 | `code.move` | PATCH | `/api/code/files/:path/move` | `{ toPath }` | Node.js API | 🟡 Node 专用 |

> Java Gateway 中 `/api/code/**` 路由到 Node.js API。

---

## Java Gateway 路由总览

```yaml
# application-docker.yml
/api/auth/**     → auth-service (Java)      StripPrefix=1
/api/users/**    → user-service (Java)      StripPrefix=1
/api/payments/** → payment-service (Java)   StripPrefix=1
/api/orders/**   → order-service (Java)     StripPrefix=1
/api/carts/**    → cart-service (Java)      StripPrefix=1
/api/logistics/**→ logistics-service (Java) StripPrefix=1
/api/agents/**   → api-service (Node.js)    StripPrefix=0
/api/tasks/**    → api-service (Node.js)    StripPrefix=0
/api/code/**     → api-service (Node.js)    StripPrefix=0
/api/chat/**     → api-service (Node.js)    StripPrefix=0
/api/demo/**     → api-service (Node.js)    StripPrefix=0
/api/health      → api-service (Node.js)    StripPrefix=0
```

---

## 本地测试建议

1. **启动 Java 认证服务**
   ```bash
   cd apps/java/auth-service
   ./mvnw spring-boot:run -Dspring-boot.run.profiles=docker
   # 或启动 Gateway
   cd apps/java/gateway-service
   ./mvnw spring-boot:run -Dspring-boot.run.profiles=docker
   ```

2. **启动 Landing 开发服务器**
   ```bash
   cd apps/landing
   npm run dev
   ```

3. **修改本地 API Base**（如需直接调 Java）
   `apps/landing/.env.local`:
   ```
   NUXT_PUBLIC_API_BASE=http://localhost:8080/api
   ```
   注意：Gateway 在 8080，路径已带 `/api` 前缀。

---

## 待办事项

- [ ] 注册接口：前端 `name/phone/code/password` ↔ Java `username/password/email` 不匹配
- [ ] 刷新 Token：`auth.refresh()` 返回结构需确认 Java `TokenResponse` 是否含新 token
- [ ] 其他 Java 服务（user/payment/order/cart/logistics）尚未对接前端页面

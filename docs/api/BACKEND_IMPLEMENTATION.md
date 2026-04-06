# 后端实现文档

## 概述

AgentHive Cloud 后端 API 已根据 API 文档完整实现，包含阿里云短信登录 mock。

## 项目结构

```
apps/api/src/
├── index.ts                 # 服务器入口
├── app.ts                   # Express 应用配置
├── types/
│   └── index.ts             # TypeScript 类型定义
├── utils/
│   ├── database.ts          # 内存数据库（mock）
│   └── jwt.ts               # JWT 工具函数
├── services/
│   └── sms.ts               # 阿里云短信服务 mock
├── controllers/
│   ├── auth.ts              # 认证控制器
│   ├── agents.ts            # Agent 控制器
│   ├── tasks.ts             # Task 控制器
│   └── code.ts              # Code 控制器
├── routes/
│   ├── index.ts             # 路由聚合
│   ├── auth.ts              # 认证路由
│   ├── agents.ts            # Agent 路由
│   ├── tasks.ts             # Task 路由
│   ├── code.ts              # Code 路由
│   └── demo.ts              # Demo 路由
└── middleware/
    ├── auth.ts              # 认证中间件
    ├── cors.ts              # CORS 配置
    └── visitor.ts           # 访客中间件
```

## 功能实现

### 1. 认证 API

| 接口 | 方法 | 状态 | 说明 |
|------|------|------|------|
| `/api/auth/sms/send` | POST | ✅ | 发送短信验证码（阿里云 mock） |
| `/api/auth/login/sms` | POST | ✅ | 短信验证码登录 |
| `/api/auth/login` | POST | ✅ | 用户名密码登录 |
| `/api/auth/register` | POST | ✅ | 用户注册 |
| `/api/auth/logout` | POST | ✅ | 用户登出 |
| `/api/auth/refresh` | POST | ✅ | 刷新 Token |
| `/api/auth/me` | GET | ✅ | 获取当前用户 |

**阿里云短信 Mock 特性:**
- 验证码 6 位数字
- 有效期 5 分钟
- 同一手机号 1 分钟限制
- 最多尝试 3 次
- 开发环境返回验证码（方便测试）

### 2. Agent API

| 接口 | 方法 | 状态 |
|------|------|------|
| `/api/agents` | GET/POST | ✅ |
| `/api/agents/:id` | GET/PATCH/DELETE | ✅ |
| `/api/agents/:id/start` | POST | ✅ |
| `/api/agents/:id/stop` | POST | ✅ |
| `/api/agents/:id/pause` | POST | ✅ |
| `/api/agents/:id/resume` | POST | ✅ |
| `/api/agents/:id/command` | POST | ✅ |
| `/api/agents/:id/logs` | GET | ✅ |

### 3. Task API

| 接口 | 方法 | 状态 |
|------|------|------|
| `/api/tasks` | GET/POST | ✅ |
| `/api/tasks/:id` | GET/PATCH/DELETE | ✅ |
| `/api/tasks/:id/cancel` | POST | ✅ |
| `/api/tasks/:id/subtasks` | GET | ✅ |

### 4. Code API

| 接口 | 方法 | 状态 |
|------|------|------|
| `/api/code/files` | GET | ✅ |
| `/api/code/files/*` | GET/PUT/DELETE | ✅ |
| `/api/code/search` | GET | ✅ |
| `/api/code/recent` | GET | ✅ |

### 5. Demo API

| 接口 | 方法 | 状态 |
|------|------|------|
| `/api/demo/plan` | GET | ✅ |
| `/api/demo/agents` | GET | ✅ |
| `/api/demo/tasks` | GET | ✅ |
| `/api/demo/visitor-status` | GET | ✅ |

## 运行方式

### 开发模式（热重载）

```bash
cd agenthive-cloud/apps/api
npm run dev
```

### 生产模式

```bash
cd agenthive-cloud/apps/api
npm run build
npm start
```

## 测试 API

```bash
cd agenthive-cloud/apps/api
./test-api.ps1
```

## 示例请求

### 发送短信验证码

```bash
curl -X POST http://localhost:3001/api/auth/sms/send \
  -H "Content-Type: application/json" \
  -d '{"phone":"13800138000"}'
```

**响应:**
```json
{
  "success": true,
  "message": "验证码发送成功",
  "requestId": "sms-abc123",
  "devCode": "123456"
}
```

### 短信验证码登录

```bash
curl -X POST http://localhost:3001/api/auth/login/sms \
  -H "Content-Type: application/json" \
  -d '{"phone":"13800138000","code":"123456"}'
```

**响应:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "user-1",
      "username": "user_8000",
      "phone": "13800138000",
      "role": "user"
    }
  }
}
```

### 获取 Agent 列表

```bash
curl http://localhost:3001/api/agents
```

**响应:**
```json
{
  "success": true,
  "data": {
    "agents": [...],
    "total": 3
  }
}
```

## 技术栈

- **框架**: Express.js
- **语言**: TypeScript
- **认证**: JWT
- **数据存储**: 内存数据库（mock）
- **短信服务**: 阿里云 SMS Mock

## 注意事项

1. **数据持久化**: 当前使用内存数据库，重启后数据丢失。生产环境应替换为真实数据库。
2. **短信服务**: 当前为 mock 实现，生产环境需要接入真实的阿里云 SMS SDK。
3. **JWT 密钥**: 使用环境变量 `JWT_SECRET`，生产环境应设置强密钥。
4. **CORS**: 已配置允许跨域，生产环境应限制特定域名。

## 后续优化建议

1. 接入 PostgreSQL / MongoDB 等真实数据库
2. 接入真实的阿里云短信服务
3. 添加请求限流（Rate Limiting）
4. 添加 API 文档生成（Swagger/OpenAPI）
5. 添加单元测试和集成测试
6. 添加 Docker 支持

## 单元测试

已添加完整的单元测试覆盖：

```bash
# 运行测试
npm test

# 覆盖率报告
npm run test:coverage

# 监视模式
npm run test:watch
```

**测试结果:**
```
✅ 测试文件: 7 passed
✅ 测试用例: 97 passed
⏱️  执行时间: ~13s
```

**测试覆盖范围:**
- JWT 工具（Token 生成/验证）
- SMS 服务（发送/验证/频率限制）
- 认证控制器（7 个接口）
- Agent 控制器（11 个接口）
- Task 控制器（7 个接口）
- Code 控制器（5 个接口）
- API 集成流程测试

**测试文件结构:**
```
tests/
├── unit/
│   ├── jwt.test.ts
│   ├── sms.test.ts
│   ├── auth.controller.test.ts
│   ├── agents.controller.test.ts
│   ├── tasks.controller.test.ts
│   └── code.controller.test.ts
├── integration/
│   └── api.workflow.test.ts
└── utils/
    └── test-db.ts
```

## 后续优化建议（更新）

1. ✅ ~~添加单元测试和集成测试~~ (已完成 - 97 个测试)
2. 接入 PostgreSQL / MongoDB 等真实数据库
3. 接入真实的阿里云短信服务
4. 添加请求限流（Rate Limiting）
5. 添加 API 文档生成（Swagger/OpenAPI）
6. 添加 Docker 支持

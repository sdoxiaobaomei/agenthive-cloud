# 单元测试文档

## 测试结构

```
tests/
├── unit/                          # 单元测试
│   ├── jwt.test.ts               # JWT 工具测试
│   ├── sms.test.ts               # 短信服务测试
│   ├── auth.controller.test.ts   # 认证控制器测试
│   ├── agents.controller.test.ts # Agent 控制器测试
│   ├── tasks.controller.test.ts  # Task 控制器测试
│   └── code.controller.test.ts   # Code 控制器测试
├── integration/                   # 集成测试
│   └── api.workflow.test.ts      # API 工作流程测试
├── utils/                         # 测试工具
│   └── test-db.ts                # 测试数据库工具
├── setup.ts                       # 测试环境设置
└── README.md                      # 本文档
```

## 运行测试

```bash
# 运行所有测试
npm test

# 监视模式（开发时使用）
npm run test:watch

# 生成覆盖率报告
npm run test:coverage

# 打开 UI 界面
npm run test:ui
```

## 测试覆盖范围

### 1. JWT 工具测试 (`jwt.test.ts`)

- ✅ Token 生成
- ✅ Token 验证
- ✅ Token 解码
- ✅ 无效 Token 处理
- ✅ Token 篡改检测

### 2. SMS 服务测试 (`sms.test.ts`)

- ✅ 发送验证码
- ✅ 发送频率限制
- ✅ 验证码验证
- ✅ 错误验证码处理
- ✅ 尝试次数限制
- ✅ 过期验证

### 3. 认证控制器测试 (`auth.controller.test.ts`)

- ✅ 发送短信验证码
- ✅ 短信验证码登录
- ✅ 用户名密码登录
- ✅ 用户注册
- ✅ Token 刷新
- ✅ 获取当前用户
- ✅ 登出
- ✅ 错误处理

### 4. Agent 控制器测试 (`agents.controller.test.ts`)

- ✅ 获取 Agent 列表
- ✅ 获取 Agent 详情
- ✅ 创建 Agent
- ✅ 更新 Agent
- ✅ 删除 Agent
- ✅ 启动/停止/暂停/恢复 Agent
- ✅ 发送命令
- ✅ 获取日志

### 5. Task 控制器测试 (`tasks.controller.test.ts`)

- ✅ 获取任务列表（含筛选、分页）
- ✅ 获取任务详情
- ✅ 创建任务
- ✅ 更新任务
- ✅ 删除任务
- ✅ 取消任务
- ✅ 获取子任务

### 6. Code 控制器测试 (`code.controller.test.ts`)

- ✅ 获取文件列表
- ✅ 获取文件内容
- ✅ 更新文件
- ✅ 创建新文件
- ✅ 删除文件
- ✅ 搜索文件
- ✅ 获取最近文件
- ✅ 语言识别

### 7. 集成测试 (`api.workflow.test.ts`)

- ✅ 完整用户工作流程
- ✅ 短信登录工作流程
- ✅ Agent 状态管理流程
- ✅ 代码编辑工作流程
- ✅ 错误处理
- ✅ 健康检查

## 编写新测试

### 基本结构

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import app from '../../src/app.js'
import { clearAllData, initTestData } from '../utils/test-db.js'

describe('Feature Controller', () => {
  beforeEach(() => {
    clearAllData()
    initTestData()
  })

  describe('GET /api/feature', () => {
    it('应该...', async () => {
      const response = await request(app)
        .get('/api/feature')

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
    })
  })
})
```

### 测试最佳实践

1. **每个测试独立** - 使用 `beforeEach` 清理和初始化数据
2. **描述清晰** - 使用中文描述测试目的
3. **断言完整** - 检查状态码、响应结构、数据内容
4. **错误场景** - 包括正常和异常情况的测试
5. **边界情况** - 测试空值、越界、非法输入等

## 测试工具

### SuperTest

用于 HTTP 请求测试：

```typescript
const response = await request(app)
  .post('/api/auth/login')
  .send({ username: 'admin', password: 'password' })
  .set('Authorization', 'Bearer token')
```

### 测试数据库工具

- `clearAllData()` - 清理所有数据
- `initTestData()` - 初始化测试数据

## 覆盖率报告

运行 `npm run test:coverage` 后，会在 `coverage/` 目录生成 HTML 报告：

```
coverage/
├── index.html          # 总览
├── src/
│   ├── controllers/    # 控制器覆盖率
│   ├── services/       # 服务覆盖率
│   └── utils/          # 工具覆盖率
```

## 持续集成

可以在 CI 中添加测试步骤：

```yaml
- name: Run Tests
  run: npm test

- name: Check Coverage
  run: npm run test:coverage
```

# AgentHive Cloud E2E 测试套件

## 简介

本目录包含 AgentHive Cloud Web 应用的完整 Playwright E2E 测试套件。

## 文件说明

| 文件 | 描述 | 测试用例数 |
|------|------|-----------|
| `login.spec.ts` | 登录页面测试 | 16 |
| `dashboard.spec.ts` | 仪表板页面测试 | 12 |
| `agents.spec.ts` | Agent 管理页面测试 | 12 |
| `navigation.spec.ts` | 导航和路由测试 | 17 |
| `settings.spec.ts` | 设置页面测试 | 13 |
| `tasks.spec.ts` | 任务看板页面测试 | 10 |
| `websocket.spec.ts` | WebSocket 连接测试 | 11 |
| `utils/test-data.ts` | 测试数据生成器 | - |

**总计: 91 个测试用例**

## 快速开始

### 安装依赖
```bash
npm install
npx playwright install
```

### 运行所有测试
```bash
npm run test:e2e
```

### 运行特定测试
```bash
# 仅运行 Chromium
npx playwright test --project=chromium

# 运行特定文件
npx playwright test e2e/login.spec.ts

# 运行特定测试
npx playwright test -g "应该显示登录页面标题"
```

### 调试模式
```bash
npx playwright test --headed
npx playwright test --debug
```

### 生成报告
```bash
npx playwright test --reporter=html
# 报告位于 playwright-report/index.html
```

## 测试数据生成器

`utils/test-data.ts` 提供了丰富的测试数据生成功能：

```typescript
import { generateMockAgent, generateMockTask, TEST_USERS } from './utils/test-data'

// 生成 Mock Agent
const agent = generateMockAgent({
  role: 'frontend',
  status: 'working'
})

// 生成 Mock Task
const task = generateMockTask({
  status: 'running',
  priority: 'high'
})

// 使用测试用户
const { username, password } = TEST_USERS.valid
```

## 测试覆盖

### 功能覆盖
- ✅ 页面加载
- ✅ 表单提交
- ✅ 导航切换
- ✅ WebSocket 消息
- ✅ 错误处理
- ✅ 响应式布局

### 浏览器覆盖
- ✅ Chromium (桌面)
- ✅ Firefox (桌面)
- ✅ WebKit/Safari (桌面)
- ✅ Mobile Chrome
- ✅ Mobile Safari

## 编写新测试

```typescript
import { test, expect } from '@playwright/test'
import { generateMockAgent } from './utils/test-data'

test.describe('新功能', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/new-feature')
  })

  test('应该...', async ({ page }) => {
    // 测试步骤
    await expect(page.locator('selector')).toBeVisible()
  })
})
```

## 最佳实践

1. **使用 data-testid**: 优先使用 `data-testid` 属性作为选择器
2. **等待元素**: 使用 `await expect(locator).toBeVisible()` 代替固定等待
3. **测试隔离**: 每个测试应该是独立的，使用 `test.beforeEach`
4. **描述清晰**: 测试描述应该清晰说明测试内容
5. **截图**: 失败的测试会自动截图，可在 `test-results/` 查看

## 故障排除

### 测试超时
增加超时时间:
```typescript
test.setTimeout(60000)
```

### 元素不可见
检查元素是否被遮挡或需要滚动:
```typescript
await page.locator('button').scrollIntoViewIfNeeded()
await page.locator('button').click()
```

### 开发服务器未启动
确保先运行:
```bash
npm run dev
```

## 参考

- [Playwright 文档](https://playwright.dev/)
- [Playwright API 参考](https://playwright.dev/docs/api/class-playwright)
- [断言方法](https://playwright.dev/docs/test-assertions)

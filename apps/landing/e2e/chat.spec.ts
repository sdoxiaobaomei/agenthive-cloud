import { test, expect } from '@playwright/test'

/**
 * Chat Feature E2E Tests
 *
 * Uses real login UI flow with mocked auth/chat APIs.
 * Login redirect ensures client-side navigation to chat,
 * bypassing SSR auth middleware (which can't read localStorage).
 */

const mockUser = {
  id: 'test-user-id',
  name: 'Test User',
  email: 'test@example.com',
  avatar: '/avatars/shiba_tl.png',
}

const mockMessages = [
  {
    id: 'msg-user-1',
    role: 'user',
    messageType: 'message',
    content: '帮我创建一个登录页面',
    createdAt: new Date().toISOString(),
    isVisibleInHistory: true,
  },
  {
    id: 'msg-think-1',
    role: 'assistant',
    messageType: 'think',
    content: '分析用户需求...',
    metadata: {
      intent: 'create_project',
      thinkSummary: '识别到 create_project 意图，涉及前端表单+后端认证',
      thinkContent: '1. 用户想要创建登录页面\n2. 需要前端 UI + 后端 API\n3. 分配小花（前端）和阿铁（后端）并行开发',
    },
    createdAt: new Date().toISOString(),
    isVisibleInHistory: true,
  },
  {
    id: 'msg-sys-1',
    role: 'system',
    messageType: 'system_event',
    content: '意图识别完成: create_project',
    createdAt: new Date().toISOString(),
    isVisibleInHistory: true,
  },
  {
    id: 'msg-resp-1',
    role: 'assistant',
    messageType: 'message',
    content: '收到！已为您分析需求：\n\n- **前端**：使用 Vue 3 + Element Plus 构建登录表单\n- **后端**：Node.js API 处理认证逻辑\n- **下一步**：确认技术栈后即可开始开发',
    metadata: { intent: 'create_project', estimatedCost: 2.5 },
    createdAt: new Date().toISOString(),
    isVisibleInHistory: true,
  },
  {
    id: 'msg-task-1',
    role: 'assistant',
    messageType: 'task',
    content: '以下任务需要您的确认：',
    tasks: [
      { id: 'task-1', title: '创建登录页面前端', description: '小花 (前端开发)', status: 'pending', workerRole: 'frontend' },
      { id: 'task-2', title: '实现登录 API', description: '阿铁 (后端开发)', status: 'pending', workerRole: 'backend' },
    ],
    metadata: {
      intent: 'create_project',
      taskPayload: {
        title: 'Agent 任务待确认',
        description: '- 小花 (前端开发): 创建登录页面前端\n- 阿铁 (后端开发): 实现登录 API',
        actions: [
          { id: 'approve', label: '确认执行', type: 'approve' },
          { id: 'decline', label: '取消', type: 'decline' },
        ],
      },
      approvalStatus: 'pending',
    },
    createdAt: new Date().toISOString(),
    isVisibleInHistory: true,
  },
]

async function mockApis(page: any) {
  // Auth: password login
  await page.route('**/api/auth/login', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 200,
        success: true,
        data: { accessToken: 'mock-jwt-token', refreshToken: 'mock-refresh-token' },
      }),
    })
  })

  // Auth: current user
  await page.route('**/api/auth/me', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ code: 200, success: true, data: mockUser }),
    })
  })

  // Chat session
  await page.route('**/api/chat/sessions/test-session-id', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 200,
        success: true,
        data: {
          id: 'test-session-id',
          title: 'Test Chat',
          projectId: 'test-project-id',
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      }),
    })
  })

  // Chat messages
  await page.route('**/api/chat/sessions/test-session-id/messages**', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 200,
        success: true,
        data: {
          messages: mockMessages,
          total: mockMessages.length,
          page: 1,
          pageSize: 50,
        },
      }),
    })
  })

  // Versions
  await page.route('**/api/chat/sessions/test-session-id/versions', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ code: 200, success: true, data: { versions: [], total: 0 } }),
    })
  })

  // Projects (list)
  await page.route('**/api/projects**', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 200,
        success: true,
        data: {
          items: [{ id: 'test-project-id', name: 'Test Project', description: 'A test project' }],
          total: 1,
        },
      }),
    })
  })

  // Project detail
  await page.route('**/api/projects/test-project-id', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 200,
        success: true,
        data: { id: 'test-project-id', name: 'Test Project', description: 'A test project' },
      }),
    })
  })

  // Credits
  await page.route('**/api/credits/balance', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ code: 200, success: true, data: { balance: 100 } }),
    })
  })
}

/**
 * Perform login via real UI, then client-side navigate to chat.
 * Client-side navigation bypasses SSR auth middleware.
 */
async function loginAndGotoChat(page: any, chatPath: string = '/chat/test-session-id') {
  await mockApis(page)

  // 1. Go to login page with redirect to chat
  await page.goto(`http://localhost:3000/login?redirect=${encodeURIComponent(chatPath)}`)
  await page.waitForLoadState('networkidle')

  // 2. Switch to password login tab
  const passwordTab = page.getByRole('button', { name: '密码登录' })
  await passwordTab.click()
  await page.waitForTimeout(300)

  // 3. Fill credentials (real default user: 18829355062 / admin135)
  await page.locator('input[placeholder*="用户名或手机号"]').fill('18829355062')
  await page.locator('input[type="password"]').fill('admin135')

  // 4. Check agreement
  await page.locator('input[type="checkbox"]').check()

  // 5. Click login
  await page.locator('button:has-text("登录 / 注册")').click()

  // 6. Wait for client-side navigation to chat page
  await page.waitForURL((url: URL) => url.pathname === chatPath, { timeout: 15000 })
  await page.waitForSelector('.chat-panel', { timeout: 15000 })
}

test.describe('Chat Page', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', (msg: any) => {
      if (msg.type() === 'error') console.error(`Console error: ${msg.text()}`)
    })
  })

  test('should load chat page with all message types', async ({ page }) => {
    await loginAndGotoChat(page)

    await expect(page.locator('.chat-panel').first()).toBeVisible()
    await expect(page.locator('.think-block').first()).toBeVisible()
    await expect(page.locator('text=识别到 create_project 意图').first()).toBeVisible()
    await expect(page.locator('.system-event-block').first()).toBeVisible()
    await expect(page.locator('.message-bubble.assistant').first()).toBeVisible()
    await expect(page.locator('.task-block').first()).toBeVisible()
    await expect(page.locator('.task-card').first()).toBeVisible()
    await expect(page.locator('.task-actions button:has-text("确认")').first()).toBeVisible()
    await expect(page.locator('.task-actions button:has-text("拒绝")').first()).toBeVisible()
  })

  test('should expand think block to show detailed reasoning', async ({ page }) => {
    await loginAndGotoChat(page)

    const thinkBlock = page.locator('.think-block').first()
    await expect(thinkBlock).toBeVisible()
    await expect(page.locator('text=用户想要创建登录页面').first()).not.toBeVisible()

    await thinkBlock.locator('.think-header').click()
    await expect(page.locator('text=用户想要创建登录页面').first()).toBeVisible()
  })

  test('should render assistant message with markdown formatting', async ({ page }) => {
    await loginAndGotoChat(page)

    await expect(page.locator('text=前端').first()).toBeVisible()
    await expect(page.locator('text=后端').first()).toBeVisible()
    await expect(page.locator('text=使用 Vue 3 + Element Plus 构建登录表单').first()).toBeVisible()
  })

  test('should show task cards with approve/decline buttons', async ({ page }) => {
    await loginAndGotoChat(page)

    await expect(page.locator('.task-card').first()).toBeVisible()
    await expect(page.locator('.task-actions button:has-text("确认")').first()).toBeVisible()
    await expect(page.locator('.task-actions button:has-text("拒绝")').first()).toBeVisible()
  })

  test('system event should be subtle inline notification', async ({ page }) => {
    await loginAndGotoChat(page)

    const sysBlock = page.locator('.system-event-block').first()
    await expect(sysBlock).toBeVisible()
    await expect(sysBlock).not.toHaveClass(/message-bubble/)

    const fontSize = await sysBlock.evaluate((el: HTMLElement) =>
      window.getComputedStyle(el).fontSize
    )
    expect(fontSize).toBe('11px')
  })
})

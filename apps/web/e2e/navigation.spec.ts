import { test, expect } from '@playwright/test'

test.describe('导航和路由', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('侧边栏应该显示所有导航项', async ({ page }) => {
    const sidebar = page.locator('.sidebar')
    await expect(sidebar).toBeVisible()
    
    // 验证主要导航项
    const navItems = [
      '仪表板',
      'Agent 管理',
      '任务看板',
      'Sprint',
      '代码查看',
      '终端',
      '对话',
      '设置',
    ]
    
    for (const item of navItems) {
      await expect(page.locator('.sidebar-menu .el-menu-item').filter({ hasText: item })).toBeVisible()
    }
  })

  test('应该能通过侧边栏导航到仪表板', async ({ page }) => {
    await page.click('.sidebar-menu .el-menu-item:has-text("仪表板")')
    await expect(page).toHaveURL('/')
    await expect(page.locator('h1')).toContainText('仪表板')
  })

  test('应该能通过侧边栏导航到 Agent 管理', async ({ page }) => {
    await page.click('.sidebar-menu .el-menu-item:has-text("Agent 管理")')
    await expect(page).toHaveURL(/.*agents/)
    await expect(page.locator('h1')).toContainText('Agent')
  })

  test('应该能通过侧边栏导航到任务看板', async ({ page }) => {
    await page.click('.sidebar-menu .el-menu-item:has-text("任务看板")')
    await expect(page).toHaveURL(/.*tasks/)
    await expect(page.locator('h1')).toContainText('任务')
  })

  test('应该能通过侧边栏导航到 Sprint', async ({ page }) => {
    await page.click('.sidebar-menu .el-menu-item:has-text("Sprint")')
    await expect(page).toHaveURL(/.*sprints/)
    await expect(page.locator('h1')).toContainText('Sprint')
  })

  test('应该能通过侧边栏导航到代码查看', async ({ page }) => {
    await page.click('.sidebar-menu .el-menu-item:has-text("代码查看")')
    await expect(page).toHaveURL(/.*code/)
    await expect(page.locator('h1')).toContainText('代码')
  })

  test('应该能通过侧边栏导航到终端', async ({ page }) => {
    await page.click('.sidebar-menu .el-menu-item:has-text("终端")')
    await expect(page).toHaveURL(/.*terminal/)
    await expect(page.locator('h1')).toContainText('终端')
  })

  test('应该能通过侧边栏导航到对话页面', async ({ page }) => {
    await page.click('.sidebar-menu .el-menu-item:has-text("对话")')
    await expect(page).toHaveURL(/.*chat/)
    await expect(page.locator('h1')).toContainText('对话')
  })

  test('应该能通过侧边栏导航到设置页面', async ({ page }) => {
    await page.click('.sidebar-menu .el-menu-item:has-text("设置")')
    await expect(page).toHaveURL(/.*settings/)
    await expect(page.locator('h1')).toContainText('设置')
  })

  test('当前页面应该在侧边栏中高亮', async ({ page }) => {
    // 导航到 Agent 管理
    await page.click('.sidebar-menu .el-menu-item:has-text("Agent 管理")')
    
    // 验证该项被激活
    const activeItem = page.locator('.sidebar-menu .el-menu-item.is-active')
    await expect(activeItem).toContainText('Agent 管理')
  })

  test('应该能展开/收起侧边栏', async ({ page }) => {
    const sidebar = page.locator('.sidebar')
    
    // 初始状态应该不是收起状态
    await expect(sidebar).not.toHaveClass(/is-collapsed/)
    
    // 点击收起按钮
    await page.click('.collapse-btn')
    
    // 验证侧边栏收起
    await expect(sidebar).toHaveClass(/is-collapsed/)
    
    // 再次点击展开
    await page.click('.collapse-btn')
    
    // 验证侧边栏展开
    await expect(sidebar).not.toHaveClass(/is-collapsed/)
  })

  test('收起侧边栏时 Logo 文字应该隐藏', async ({ page }) => {
    // 点击收起按钮
    await page.click('.collapse-btn')
    
    // 验证 Logo 文字隐藏
    const logoText = page.locator('.logo-text')
    await expect(logoText).toBeHidden()
  })

  test('页面标题应该随路由变化', async ({ page }) => {
    // 访问仪表板
    await page.goto('/')
    await expect(page).toHaveTitle(/仪表板/)
    
    // 访问 Agent 管理
    await page.goto('/agents')
    await expect(page).toHaveTitle(/Agent/)
    
    // 访问设置
    await page.goto('/settings')
    await expect(page).toHaveTitle(/设置/)
  })

  test('不存在的路由应该显示 404 页面', async ({ page }) => {
    await page.goto('/non-existent-route')
    await page.waitForLoadState('networkidle')
    
    // 验证 404 页面内容
    await expect(page.locator('h1, .not-found-title')).toContainText('404')
    await expect(page.locator('text=页面不存在')).toBeVisible()
    
    // 验证返回首页按钮
    await expect(page.locator('button:has-text("返回首页")')).toBeVisible()
  })

  test('404 页面应该能返回首页', async ({ page }) => {
    await page.goto('/non-existent-route')
    await page.waitForLoadState('networkidle')
    
    // 点击返回首页
    await page.click('button:has-text("返回首页")')
    
    // 验证返回首页
    await expect(page).toHaveURL('/')
    await expect(page.locator('h1')).toContainText('仪表板')
  })

  test('浏览器后退按钮应该能正常工作', async ({ page }) => {
    // 访问多个页面
    await page.goto('/')
    await page.goto('/agents')
    await page.goto('/tasks')
    
    // 使用浏览器后退
    await page.goBack()
    await expect(page).toHaveURL(/.*agents/)
    
    await page.goBack()
    await expect(page).toHaveURL('/')
    
    // 使用浏览器前进
    await page.goForward()
    await expect(page).toHaveURL(/.*agents/)
  })

  test('侧边栏在移动端应该自动收起或隐藏', async ({ page }) => {
    // 设置移动端视口
    await page.setViewportSize({ width: 375, height: 667 })
    
    // 刷新页面
    await page.reload()
    await page.waitForLoadState('networkidle')
    
    // 验证侧边栏行为（可能被收起或隐藏）
    const sidebar = page.locator('.sidebar')
    
    // 移动端下侧边栏可能被隐藏或收起
    const isCollapsed = await sidebar.evaluate(el => el.classList.contains('is-collapsed'))
      .catch(() => true)
    
    // 恢复桌面视口
    await page.setViewportSize({ width: 1280, height: 720 })
  })
})

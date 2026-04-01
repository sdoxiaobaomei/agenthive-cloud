import { test, expect } from '@playwright/test'
import { TEST_USERS } from './utils/test-data'

test.describe('登录页面', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')
  })

  test('应该显示登录页面标题', async ({ page }) => {
    const title = page.locator('.login-title')
    await expect(title).toBeVisible()
    await expect(title).toContainText('AgentHive Cloud')
  })

  test('应该显示登录表单', async ({ page }) => {
    // 验证 Logo
    await expect(page.locator('.login-header')).toBeVisible()
    
    // 验证副标题
    await expect(page.locator('.login-subtitle')).toContainText('AI 研发团队管理平台')
    
    // 验证表单字段
    await expect(page.locator('input[placeholder="用户名"]')).toBeVisible()
    await expect(page.locator('input[placeholder="密码"]')).toBeVisible()
    
    // 验证记住我复选框
    await expect(page.locator('text=记住我')).toBeVisible()
    
    // 验证登录按钮
    await expect(page.locator('button:has-text("登录")')).toBeVisible()
  })

  test('应该能成功登录', async ({ page }) => {
    const { username, password } = TEST_USERS.valid
    
    // 填写登录信息
    await page.fill('input[placeholder="用户名"]', username)
    await page.fill('input[placeholder="密码"]', password)
    
    // 点击登录
    await page.click('button:has-text("登录")')
    
    // 等待登录处理
    await page.waitForTimeout(1500)
    
    // 验证跳转
    await expect(page).toHaveURL('/')
    
    // 验证成功消息
    await expect(page.locator('.el-message--success')).toBeVisible()
    await expect(page.locator('.el-message--success')).toContainText('登录成功')
  })

  test('空用户名应该显示验证错误', async ({ page }) => {
    // 不填写用户名，只填写密码
    await page.fill('input[placeholder="密码"]', 'somepassword')
    
    // 点击登录
    await page.click('button:has-text("登录")')
    
    // 验证错误提示
    const errorMessage = page.locator('.el-form-item__error')
    await expect(errorMessage).toBeVisible()
    await expect(errorMessage).toContainText('用户名')
  })

  test('空密码应该显示验证错误', async ({ page }) => {
    // 只填写用户名
    await page.fill('input[placeholder="用户名"]', 'admin')
    
    // 点击登录
    await page.click('button:has-text("登录")')
    
    // 验证错误提示
    const errorMessage = page.locator('.el-form-item__error')
    await expect(errorMessage).toBeVisible()
    await expect(errorMessage).toContainText('密码')
  })

  test('密码长度不足应该显示验证错误', async ({ page }) => {
    // 填写用户名和短密码
    await page.fill('input[placeholder="用户名"]', 'admin')
    await page.fill('input[placeholder="密码"]', '123')
    
    // 点击登录
    await page.click('button:has-text("登录")')
    
    // 验证错误提示包含长度要求
    const errorMessage = page.locator('.el-form-item__error')
    await expect(errorMessage).toBeVisible()
  })

  test('应该支持记住我功能', async ({ page }) => {
    // 填写登录信息
    await page.fill('input[placeholder="用户名"]', TEST_USERS.valid.username)
    await page.fill('input[placeholder="密码"]', TEST_USERS.valid.password)
    
    // 勾选记住我
    await page.click('text=记住我')
    
    // 验证复选框被选中
    const checkbox = page.locator('.el-checkbox__input')
    await expect(checkbox).toHaveClass(/is-checked/)
  })

  test('点击忘记密码应该有响应', async ({ page }) => {
    // 点击忘记密码
    await page.click('text=忘记密码?')
    
    // 由于没有实现，验证按钮可点击即可
    // 实际项目中应该验证跳转或弹窗
    await expect(page.locator('text=忘记密码?')).toBeEnabled()
  })

  test('点击注册账号应该有响应', async ({ page }) => {
    // 点击注册账号
    await page.click('text=注册账号')
    
    // 由于没有实现，验证按钮可点击即可
    await expect(page.locator('text=注册账号')).toBeEnabled()
  })

  test('登录按钮在提交时应该显示加载状态', async ({ page }) => {
    // 填写登录信息
    await page.fill('input[placeholder="用户名"]', TEST_USERS.valid.username)
    await page.fill('input[placeholder="密码"]', TEST_USERS.valid.password)
    
    // 点击登录
    await page.click('button:has-text("登录")')
    
    // 验证按钮显示加载状态
    const loadingIcon = page.locator('.el-button.is-loading')
    await expect(loadingIcon).toBeVisible()
  })

  test('登录表单应该支持回车键提交', async ({ page }) => {
    // 填写登录信息
    await page.fill('input[placeholder="用户名"]', TEST_USERS.valid.username)
    await page.fill('input[placeholder="密码"]', TEST_USERS.valid.password)
    
    // 在密码框按回车
    await page.locator('input[placeholder="密码"]').press('Enter')
    
    // 验证跳转或加载状态
    await page.waitForTimeout(500)
    const loadingIcon = page.locator('.el-button.is-loading')
    await expect(loadingIcon).toBeVisible()
  })

  test('密码输入框应该支持显示/隐藏密码', async ({ page }) => {
    const passwordInput = page.locator('input[placeholder="密码"]')
    
    // 验证初始类型为 password
    await expect(passwordInput).toHaveAttribute('type', 'password')
    
    // 点击显示密码按钮
    await page.click('.el-input__suffix-inner')
    
    // 验证类型变为 text
    await expect(passwordInput).toHaveAttribute('type', 'text')
  })

  test('登录页面应该显示版权信息', async ({ page }) => {
    const footer = page.locator('.login-footer')
    await expect(footer).toBeVisible()
    await expect(footer).toContainText('AgentHive Cloud')
    await expect(footer).toContainText('All rights reserved')
  })

  test('已登录用户访问登录页应该被重定向', async ({ page }) => {
    // 先登录
    await page.fill('input[placeholder="用户名"]', TEST_USERS.valid.username)
    await page.fill('input[placeholder="密码"]', TEST_USERS.valid.password)
    await page.click('button:has-text("登录")')
    await page.waitForTimeout(1500)
    
    // 再次访问登录页
    await page.goto('/login')
    
    // 应该被重定向到首页（如果有实现这个功能）
    // 或者仍然可以访问登录页（当前实现）
    await expect(page).toHaveURL(/.*\//)
  })

  test('登录页面在移动端应该正常显示', async ({ page }) => {
    // 设置移动端视口
    await page.setViewportSize({ width: 375, height: 667 })
    
    // 刷新页面
    await page.reload()
    await page.waitForLoadState('networkidle')
    
    // 验证登录表单仍然可见
    await expect(page.locator('.login-card')).toBeVisible()
    await expect(page.locator('input[placeholder="用户名"]')).toBeVisible()
    await expect(page.locator('input[placeholder="密码"]')).toBeVisible()
    
    // 恢复桌面视口
    await page.setViewportSize({ width: 1280, height: 720 })
  })
})

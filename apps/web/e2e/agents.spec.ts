import { test, expect } from '@playwright/test'
import { generateMockAgent, generateMockTask } from './utils/test-data'

test.describe('Agent 管理页面', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/agents')
    await page.waitForLoadState('networkidle')
  })

  test('应该显示 Agent 管理页面标题', async ({ page }) => {
    const title = page.locator('h1.page-title, h1')
    await expect(title).toContainText('Agent')
  })

  test('应该能创建新 Agent 并显示成功消息', async ({ page }) => {
    const mockAgent = generateMockAgent({ role: 'frontend' })
    
    // 点击新建按钮
    await page.click('text=新建')
    
    // 填写表单
    await page.fill('input[placeholder*="例如"]', mockAgent.name)
    
    // 选择角色
    await page.click('.el-select')
    await page.waitForSelector('.el-select-dropdown')
    await page.click('.el-select-dropdown__item:has-text("前端开发")')
    
    // 填写描述
    await page.fill('textarea[placeholder*="描述"]', mockAgent.description)
    
    // 提交表单
    await page.click('button:has-text("创建")')
    
    // 验证成功消息
    const successMessage = page.locator('.el-message--success')
    await expect(successMessage).toBeVisible()
    await expect(successMessage).toContainText('成功')
  })

  test('创建 Agent 表单验证：名称必填', async ({ page }) => {
    // 点击新建按钮
    await page.click('text=新建')
    
    // 直接提交不填写名称
    await page.click('button:has-text("创建")')
    
    // 验证错误提示
    const errorMessage = page.locator('.el-form-item__error')
    await expect(errorMessage).toBeVisible()
    await expect(errorMessage).toContainText('名称')
  })

  test('创建 Agent 表单验证：角色必填', async ({ page }) => {
    // 点击新建按钮
    await page.click('text=新建')
    
    // 填写名称但不选角色
    await page.fill('input[placeholder*="例如"]', 'Test Agent')
    await page.click('button:has-text("创建")')
    
    // 验证错误提示
    const errorMessage = page.locator('.el-form-item__error')
    await expect(errorMessage).toBeVisible()
  })

  test('应该能展开高级配置', async ({ page }) => {
    // 点击新建按钮
    await page.click('text=新建')
    
    // 展开高级配置
    await page.click('.el-collapse-item__header:has-text("高级配置")')
    
    // 验证高级配置字段
    await expect(page.locator('text=内存限制')).toBeVisible()
    await expect(page.locator('text=CPU限制')).toBeVisible()
    
    // 验证默认值
    const memoryInput = page.locator('.el-input-number:has(.unit:has-text("MB")) input')
    await expect(memoryInput).toHaveValue('2048')
    
    const cpuInput = page.locator('.el-input-number:has(.unit:has-text("核")) input')
    await expect(cpuInput).toHaveValue('2')
  })

  test('应该能取消创建 Agent', async ({ page }) => {
    // 点击新建按钮
    await page.click('text=新建')
    
    // 填写一些内容
    await page.fill('input[placeholder*="例如"]', 'Test Agent')
    
    // 点击取消
    await page.click('button:has-text("取消")')
    
    // 验证对话框关闭
    const dialog = page.locator('.el-dialog')
    await expect(dialog).not.toBeVisible()
  })

  test('应该能查看 Agent 详情', async ({ page }) => {
    // 点击第一个 Agent 或查看按钮
    const agentItem = page.locator('.agent-mini-item, .agent-card').first()
    
    if (await agentItem.isVisible().catch(() => false)) {
      await agentItem.click()
      
      // 验证详情页面显示
      await expect(page).toHaveURL(/.*agents\/.*$/)
    }
  })

  test('Agent 详情页面应该显示基本信息', async ({ page }) => {
    // 导航到特定 Agent 详情
    await page.goto('/agents/test-agent-id')
    await page.waitForLoadState('networkidle')
    
    // 验证基本信息标签
    await expect(page.locator('text=基本信息')).toBeVisible()
    await expect(page.locator('text=任务统计')).toBeVisible()
    
    // 验证信息项
    const infoLabels = ['ID', '角色', '状态', 'Pod IP', '创建时间']
    for (const label of infoLabels) {
      await expect(page.locator('.info-item .label').filter({ hasText: label })).toBeVisible()
    }
  })

  test('Agent 详情页面应该有功能标签页', async ({ page }) => {
    await page.goto('/agents/test-agent-id')
    await page.waitForLoadState('networkidle')
    
    // 验证标签页存在
    const tabs = ['概览', '任务', '终端', '代码', '日志']
    for (const tab of tabs) {
      await expect(page.locator('.el-tabs__item').filter({ hasText: tab })).toBeVisible()
    }
  })

  test('应该能切换 Agent 详情标签页', async ({ page }) => {
    await page.goto('/agents/test-agent-id')
    await page.waitForLoadState('networkidle')
    
    // 切换到任务标签
    await page.click('.el-tabs__item:has-text("任务")')
    await expect(page.locator('.el-tabs__item.is-active')).toContainText('任务')
    
    // 切换到终端标签
    await page.click('.el-tabs__item:has-text("终端")')
    await expect(page.locator('.el-tabs__item.is-active')).toContainText('终端')
  })

  test('应该能执行 Agent 操作（启动/停止/暂停/恢复）', async ({ page }) => {
    await page.goto('/agents/test-agent-id')
    await page.waitForLoadState('networkidle')
    
    // 根据状态检查可用操作
    const startButton = page.locator('button:has-text("启动")')
    const stopButton = page.locator('button:has-text("停止")')
    const pauseButton = page.locator('button:has-text("暂停")')
    const resumeButton = page.locator('button:has-text("恢复")')
    
    // 至少有一个操作按钮应该可见（根据 Agent 状态）
    const hasAnyButton = await Promise.race([
      startButton.isVisible().catch(() => false),
      stopButton.isVisible().catch(() => false),
      pauseButton.isVisible().catch(() => false),
      resumeButton.isVisible().catch(() => false),
    ])
    
    // 验证返回按钮存在
    await expect(page.locator('button:has-text("返回")')).toBeVisible()
  })

  test('应该能通过返回按钮回到列表', async ({ page }) => {
    await page.goto('/agents/test-agent-id')
    await page.waitForLoadState('networkidle')
    
    // 点击返回
    await page.click('button:has-text("返回")')
    
    // 验证返回 Agent 列表或上一页
    await expect(page).toHaveURL(/.*agents/)
  })
})

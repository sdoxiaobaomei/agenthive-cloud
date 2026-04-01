import { test, expect } from '@playwright/test'
import { generateMockAgent, generateMockTask } from './utils/test-data'

test.describe('Dashboard 仪表板页面', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    // 等待页面加载完成
    await page.waitForLoadState('networkidle')
  })

  test('应该显示仪表板标题和副标题', async ({ page }) => {
    const title = page.locator('h1.page-title')
    await expect(title).toContainText('仪表板')
    
    const subtitle = page.locator('.page-subtitle')
    await expect(subtitle).toBeVisible()
    await expect(subtitle).toContainText('实时监控')
  })

  test('应该显示统计卡片网格', async ({ page }) => {
    const statsGrid = page.locator('.stats-grid')
    await expect(statsGrid).toBeVisible()
    
    // 验证有4个统计卡片
    const statCards = page.locator('.stat-card')
    await expect(statCards).toHaveCount(4)
    
    // 验证每个卡片都有标签
    const labels = ['工作中', '空闲', '异常', '进行中任务']
    for (const label of labels) {
      await expect(page.locator('.stat-label').filter({ hasText: label })).toBeVisible()
    }
  })

  test('应该显示系统状态卡片', async ({ page }) => {
    const systemStatusCard = page.locator('.system-status')
    await expect(systemStatusCard).toBeVisible()
    
    // 验证状态标签存在
    const statusTag = systemStatusCard.locator('.el-tag')
    await expect(statusTag).toBeVisible()
    
    // 验证状态项
    const statusItems = ['WebSocket 连接', 'Agent 总数', '任务总数', '重连次数']
    for (const item of statusItems) {
      await expect(page.locator('.status-label').filter({ hasText: item })).toBeVisible()
    }
  })

  test('应该显示 Agent 概览卡片', async ({ page }) => {
    const agentOverview = page.locator('.agent-overview')
    await expect(agentOverview).toBeVisible()
    await expect(agentOverview).toContainText('Agent 概览')
    
    // 验证"查看全部"按钮
    const viewAllButton = agentOverview.locator('text=查看全部')
    await expect(viewAllButton).toBeVisible()
  })

  test('应该显示最近任务卡片', async ({ page }) => {
    const recentTasks = page.locator('.recent-tasks')
    await expect(recentTasks).toBeVisible()
    await expect(recentTasks).toContainText('最近任务')
  })

  test('应该显示活动日志卡片', async ({ page }) => {
    const activityLog = page.locator('.activity-log')
    await expect(activityLog).toBeVisible()
    await expect(activityLog).toContainText('活动日志')
  })

  test('应该能打开新建 Agent 对话框', async ({ page }) => {
    // 点击新建 Agent 按钮
    await page.click('button:has-text("新建 Agent")')
    
    // 验证对话框显示
    const dialog = page.locator('.el-dialog')
    await expect(dialog).toBeVisible()
    
    // 验证对话框标题
    const dialogTitle = page.locator('.el-dialog__title')
    await expect(dialogTitle).toContainText('新建 Agent')
    
    // 验证表单字段
    await expect(page.locator('label:has-text("名称")')).toBeVisible()
    await expect(page.locator('label:has-text("角色")')).toBeVisible()
    await expect(page.locator('label:has-text("描述")')).toBeVisible()
    
    // 关闭对话框
    await page.click('.el-dialog__headerbtn')
    await expect(dialog).not.toBeVisible()
  })

  test('应该能通过对话框创建 Agent', async ({ page }) => {
    const mockAgent = generateMockAgent()
    
    // 打开对话框
    await page.click('button:has-text("新建 Agent")')
    
    // 填写表单
    await page.fill('input[placeholder*="例如"]', mockAgent.name)
    
    // 选择角色
    await page.click('.el-select')
    await page.click('.el-select-dropdown__item:has-text("前端开发")')
    
    // 填写描述
    await page.fill('textarea[placeholder*="描述"]', mockAgent.description)
    
    // 点击创建
    await page.click('button:has-text("创建")')
    
    // 验证成功消息
    await expect(page.locator('.el-message--success')).toBeVisible()
    await expect(page.locator('.el-message--success')).toContainText('成功')
  })

  test('应该能刷新数据', async ({ page }) => {
    // 点击刷新按钮
    await page.click('button:has-text("刷新")')
    
    // 验证加载状态或数据更新
    // 注意：由于没有真实 API，这里主要验证按钮可点击
    await expect(page.locator('button:has-text("刷新")')).toBeEnabled()
  })

  test('应该能清空活动日志', async ({ page }) => {
    const activityLog = page.locator('.activity-log')
    
    // 点击清空按钮
    await activityLog.locator('text=清空').click()
    
    // 验证日志被清空或显示空状态
    await expect(activityLog.locator('.el-empty')).toBeVisible()
  })

  test('响应式布局：移动端应该正确显示', async ({ page }) => {
    // 设置移动端视口
    await page.setViewportSize({ width: 375, height: 667 })
    
    // 验证页面标题仍然可见
    await expect(page.locator('h1.page-title')).toBeVisible()
    
    // 验证统计卡片仍然显示（可能变成单列）
    const statCards = page.locator('.stat-card')
    await expect(statCards).toHaveCount(4)
    
    // 恢复桌面视口
    await page.setViewportSize({ width: 1280, height: 720 })
  })
})

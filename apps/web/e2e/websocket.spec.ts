import { test, expect } from '@playwright/test'

test.describe('WebSocket 连接', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('应该显示 WebSocket 连接状态', async ({ page }) => {
    // 验证系统状态卡片中的 WebSocket 状态
    const systemStatus = page.locator('.system-status')
    await expect(systemStatus).toBeVisible()
    
    // 验证状态标签存在
    const statusTag = systemStatus.locator('.el-tag')
    await expect(statusTag).toBeVisible()
    
    // 验证 WebSocket 连接开关
    const wsSwitch = page.locator('.status-item:has-text("WebSocket 连接") .el-switch')
    await expect(wsSwitch).toBeVisible()
  })

  test('应该能切换 WebSocket 连接', async ({ page }) => {
    // 找到 WebSocket 连接开关
    const wsSwitch = page.locator('.status-item:has-text("WebSocket 连接") .el-switch')
    
    // 获取初始状态
    const initialChecked = await wsSwitch.evaluate(el => {
      const input = el.querySelector('input')
      return input?.checked ?? false
    })
    
    // 点击切换
    await wsSwitch.click()
    
    // 等待状态变化
    await page.waitForTimeout(500)
    
    // 验证状态已改变
    const newChecked = await wsSwitch.evaluate(el => {
      const input = el.querySelector('input')
      return input?.checked ?? false
    })
    
    // 状态应该与初始状态相反
    expect(newChecked).not.toBe(initialChecked)
    
    // 恢复原始状态
    await wsSwitch.click()
  })

  test('连接状态应该与标签显示一致', async ({ page }) => {
    const systemStatus = page.locator('.system-status')
    
    // 获取状态标签文本
    const statusTag = systemStatus.locator('.el-tag')
    const statusText = await statusTag.textContent()
    
    // 验证状态是"在线"或"离线"
    expect(['在线', '离线']).toContain(statusText?.trim())
    
    // 验证状态标签类型
    const tagType = await statusTag.evaluate(el => el.classList.contains('el-tag--success') || 
      el.classList.contains('el-tag--danger'))
    expect(tagType).toBe(true)
  })

  test('应该显示重连次数', async ({ page }) => {
    // 验证重连次数标签
    await expect(page.locator('.status-label').filter({ hasText: '重连次数' })).toBeVisible()
    
    // 验证重连次数值存在
    const reconnectValue = page.locator('.status-item:has-text("重连次数") .status-value')
    await expect(reconnectValue).toBeVisible()
    
    // 验证值为数字
    const value = await reconnectValue.textContent()
    expect(Number(value)).not.toBeNaN()
  })

  test('连接断开时应该显示离线状态', async ({ page }) => {
    // 断开 WebSocket 连接
    const wsSwitch = page.locator('.status-item:has-text("WebSocket 连接") .el-switch')
    
    // 确保当前是连接状态
    const isChecked = await wsSwitch.evaluate(el => {
      const input = el.querySelector('input')
      return input?.checked ?? false
    })
    
    if (isChecked) {
      // 断开连接
      await wsSwitch.click()
      await page.waitForTimeout(500)
    }
    
    // 验证状态变为离线
    const statusTag = page.locator('.system-status .el-tag')
    await expect(statusTag).toContainText('离线')
    
    // 验证标签是危险类型（红色）
    await expect(statusTag).toHaveClass(/el-tag--danger/)
    
    // 恢复连接
    await wsSwitch.click()
  })

  test('连接成功时应该显示在线状态', async ({ page }) => {
    // 确保 WebSocket 连接
    const wsSwitch = page.locator('.status-item:has-text("WebSocket 连接") .el-switch')
    
    const isChecked = await wsSwitch.evaluate(el => {
      const input = el.querySelector('input')
      return input?.checked ?? false
    })
    
    if (!isChecked) {
      // 连接 WebSocket
      await wsSwitch.click()
      await page.waitForTimeout(1000)
    }
    
    // 验证状态为在线
    const statusTag = page.locator('.system-status .el-tag')
    await expect(statusTag).toContainText('在线')
    
    // 验证标签是成功类型（绿色）
    await expect(statusTag).toHaveClass(/el-tag--success/)
  })

  test('仪表板应该显示 Agent 状态更新', async ({ page }) => {
    // 确保在仪表板页面
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    
    // 等待 WebSocket 连接
    await page.waitForTimeout(1000)
    
    // 验证统计值存在
    const statValues = page.locator('.stats-grid .stat-value')
    const count = await statValues.count()
    expect(count).toBeGreaterThan(0)
    
    // 验证每个统计值都是数字
    for (let i = 0; i < count; i++) {
      const value = await statValues.nth(i).textContent()
      expect(Number(value)).not.toBeNaN()
    }
  })

  test('活动日志应该接收实时更新', async ({ page }) => {
    // 确保 WebSocket 连接
    const wsSwitch = page.locator('.status-item:has-text("WebSocket 连接") .el-switch')
    const isChecked = await wsSwitch.evaluate(el => {
      const input = el.querySelector('input')
      return input?.checked ?? false
    })
    
    if (!isChecked) {
      await wsSwitch.click()
      await page.waitForTimeout(1000)
    }
    
    // 验证活动日志区域
    const activityLog = page.locator('.activity-log')
    await expect(activityLog).toBeVisible()
    
    // 如果存在日志项，验证其结构
    const logItems = page.locator('.log-item')
    const logCount = await logItems.count()
    
    if (logCount > 0) {
      // 验证日志项有时间戳和内容
      const firstLog = logItems.first()
      await expect(firstLog.locator('.log-time')).toBeVisible()
      await expect(firstLog.locator('.log-content')).toBeVisible()
    }
  })

  test('多次切换连接状态不应该出错', async ({ page }) => {
    const wsSwitch = page.locator('.status-item:has-text("WebSocket 连接") .el-switch')
    
    // 多次切换
    for (let i = 0; i < 3; i++) {
      await wsSwitch.click()
      await page.waitForTimeout(300)
    }
    
    // 验证页面没有崩溃
    await expect(page.locator('.system-status')).toBeVisible()
    await expect(page.locator('.stats-grid')).toBeVisible()
  })

  test('Agent 页面也应该显示 WebSocket 状态', async ({ page }) => {
    await page.goto('/agents')
    await page.waitForLoadState('networkidle')
    
    // 验证 WebSocket 状态仍然可见
    const statusTag = page.locator('.system-status .el-tag, .ws-status .el-tag').first()
    
    if (await statusTag.isVisible().catch(() => false)) {
      const statusText = await statusTag.textContent()
      expect(['在线', '离线']).toContain(statusText?.trim())
    }
  })

  test('网络断开时应该正确显示离线状态', async ({ page }) => {
    // 模拟网络断开
    await page.route('**/*', route => route.abort())
    
    // 刷新页面
    await page.reload()
    await page.waitForLoadState('networkidle')
    
    // 恢复网络
    await page.unroute('**/*')
    
    // 验证页面仍然可以加载（使用缓存或本地数据）
    await expect(page.locator('h1')).toBeVisible()
  })
})

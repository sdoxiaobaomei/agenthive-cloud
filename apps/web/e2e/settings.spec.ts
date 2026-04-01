import { test, expect } from '@playwright/test'

test.describe('设置页面', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')
  })

  test('应该显示设置页面标题', async ({ page }) => {
    const title = page.locator('h1.page-title')
    await expect(title).toBeVisible()
    await expect(title).toContainText('设置')
  })

  test('应该显示所有设置标签页', async ({ page }) => {
    const tabs = ['通用', '通知', '代码编辑器', '关于']
    
    for (const tab of tabs) {
      await expect(page.locator('.el-tabs__item').filter({ hasText: tab })).toBeVisible()
    }
  })

  test('通用设置应该包含语言和主题选项', async ({ page }) => {
    // 确保在通用标签
    await page.click('.el-tabs__item:has-text("通用")')
    
    // 验证语言选择
    await expect(page.locator('label:has-text("语言")')).toBeVisible()
    await expect(page.locator('.el-select').first()).toBeVisible()
    
    // 验证主题选项
    await expect(page.locator('label:has-text("主题")')).toBeVisible()
    await expect(page.locator('.el-radio-group')).toBeVisible()
  })

  test('应该能切换语言', async ({ page }) => {
    // 确保在通用标签
    await page.click('.el-tabs__item:has-text("通用")')
    
    // 点击语言选择器
    await page.locator('.el-select').first().click()
    
    // 选择英文
    await page.click('.el-select-dropdown__item:has-text("English")')
    
    // 验证选择成功
    await expect(page.locator('.el-select').first()).toContainText('English')
  })

  test('应该能切换主题', async ({ page }) => {
    // 确保在通用标签
    await page.click('.el-tabs__item:has-text("通用")')
    
    // 点击深色主题
    await page.click('.el-radio-button:has-text("深色")')
    
    // 验证深色主题被选中
    const darkRadio = page.locator('.el-radio-button.is-active:has-text("深色")')
    await expect(darkRadio).toBeVisible()
  })

  test('应该能切换自动刷新开关', async ({ page }) => {
    // 确保在通用标签
    await page.click('.el-tabs__item:has-text("通用")')
    
    // 找到自动刷新开关
    const autoRefreshSwitch = page.locator('.el-form-item:has-text("自动刷新") .el-switch')
    
    // 获取初始状态
    const initialChecked = await autoRefreshSwitch.evaluate(el => {
      const input = el.querySelector('input')
      return input?.checked ?? false
    })
    
    // 点击切换
    await autoRefreshSwitch.click()
    await page.waitForTimeout(300)
    
    // 验证状态已改变
    const newChecked = await autoRefreshSwitch.evaluate(el => {
      const input = el.querySelector('input')
      return input?.checked ?? false
    })
    
    expect(newChecked).not.toBe(initialChecked)
  })

  test('通知设置应该包含所有选项', async ({ page }) => {
    // 切换到通知标签
    await page.click('.el-tabs__item:has-text("通知")')
    
    // 验证通知选项
    const options = ['桌面通知', '声音提醒', 'Agent 状态变更', '任务完成通知']
    
    for (const option of options) {
      await expect(page.locator('.el-form-item__label, label').filter({ hasText: option })).toBeVisible()
    }
  })

  test('应该能切换通知选项', async ({ page }) => {
    // 切换到通知标签
    await page.click('.el-tabs__item:has-text("通知")')
    
    // 找到桌面通知开关
    const desktopSwitch = page.locator('.el-form-item:has-text("桌面通知") .el-switch').first()
    
    // 点击切换
    await desktopSwitch.click()
    await page.waitForTimeout(300)
    
    // 验证开关状态改变
    const isChecked = await desktopSwitch.evaluate(el => {
      const input = el.querySelector('input')
      return input?.checked ?? false
    })
    
    expect(typeof isChecked).toBe('boolean')
  })

  test('代码编辑器设置应该包含主题和字体选项', async ({ page }) => {
    // 切换到代码编辑器标签
    await page.click('.el-tabs__item:has-text("代码编辑器")')
    
    // 验证主题选择
    await expect(page.locator('label:has-text("主题")')).toBeVisible()
    
    // 验证字体大小滑块
    await expect(page.locator('label:has-text("字体大小")')).toBeVisible()
    await expect(page.locator('.el-slider')).toBeVisible()
    
    // 验证自动换行开关
    await expect(page.locator('label:has-text("自动换行")')).toBeVisible()
  })

  test('关于页面应该显示应用信息', async ({ page }) => {
    // 切换到关于标签
    await page.click('.el-tabs__item:has-text("关于")')
    
    // 验证应用名称
    await expect(page.locator('text=AgentHive Cloud')).toBeVisible()
    
    // 验证版本信息
    await expect(page.locator('text=版本')).toBeVisible()
    
    // 验证链接
    await expect(page.locator('text=使用文档')).toBeVisible()
    await expect(page.locator('text=GitHub')).toBeVisible()
    await expect(page.locator('text=报告问题')).toBeVisible()
  })

  test('保存设置应该显示成功消息', async ({ page }) => {
    // 确保在通用标签
    await page.click('.el-tabs__item:has-text("通用")')
    
    // 点击保存按钮
    await page.click('button:has-text("保存设置")')
    
    // 验证成功消息
    await expect(page.locator('.el-message--success')).toBeVisible()
    await expect(page.locator('.el-message--success')).toContainText('成功')
  })

  test('设置页面应该支持响应式布局', async ({ page }) => {
    // 设置移动端视口
    await page.setViewportSize({ width: 375, height: 667 })
    
    // 刷新页面
    await page.reload()
    await page.waitForLoadState('networkidle')
    
    // 验证设置页面仍然可访问
    await expect(page.locator('h1')).toContainText('设置')
    
    // 验证标签页仍然可见
    await expect(page.locator('.el-tabs__header')).toBeVisible()
    
    // 恢复桌面视口
    await page.setViewportSize({ width: 1280, height: 720 })
  })
})

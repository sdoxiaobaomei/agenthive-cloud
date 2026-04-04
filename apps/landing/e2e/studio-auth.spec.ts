import { test, expect } from '@nuxt/test-utils/e2e'

test.describe('Studio Visitor to Auth Flow', () => {
  test('visitor sees demo mode and can trigger login overlay', async ({ page, goto }) => {
    await goto('/studio')
    await expect(page.locator('text=AI Studio')).toBeVisible()
    await page.locator('textarea').fill('帮我做一个博客系统')
    await page.locator('button:has-text("发送")').click()
    await expect(page.locator('text=柴犬装修队正在分析需求')).toBeVisible()
  })

  test('login overlay appears when clicking locked feature', async ({ page, goto }) => {
    await goto('/studio')
    await page.locator('button:has-text("终端")').click()
    // In visitor mode terminal should show locked panel or login prompt
    await expect(page.locator('text=登录后即可查看').or(page.locator('text=Terminal 已锁定'))).toBeVisible()
  })
})

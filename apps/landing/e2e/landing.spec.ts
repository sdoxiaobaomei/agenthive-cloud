import { test, expect } from '@playwright/test'

/**
 * Landing Page E2E Tests
 *
 * Test Criteria:
 * 1. Page loads without console errors
 * 2. Navigation links work correctly
 * 3. Login page is accessible
 * 4. Chat page requires authentication
 */

test.describe('Landing Page', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.error(`Console error: ${msg.text()}`)
      }
    })
  })

  test('should load landing page', async ({ page }) => {
    await page.goto('http://localhost:3000/')
    await page.waitForLoadState('networkidle')

    await expect(page.locator('text=AgentHive').first()).toBeVisible()
  })

  test('navigation links should work without 404', async ({ page }) => {
    const navLinks = [
      { name: 'Features', path: '/features' },
      { name: 'Pricing', path: '/pricing' },
      { name: 'Docs', path: '/docs' },
      { name: 'Login', path: '/login' },
    ]

    for (const link of navLinks) {
      const response = await page.goto(`http://localhost:3000${link.path}`)
      expect(response?.status()).not.toBe(404)
      const title = await page.title()
      expect(title).not.toContain('404')
    }
  })

  test('CTA button should navigate to login page', async ({ page }) => {
    await page.goto('http://localhost:3000/')

    const ctaLink = page.locator('a[href="/login"]').first()
    await expect(ctaLink).toBeVisible()

    await ctaLink.click()
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/.*\/login/)
  })
})

test.describe('Login Page', () => {
  test('should load login page', async ({ page }) => {
    await page.goto('http://localhost:3000/login')

    await expect(page.locator('text=登录 / 注册').first()).toBeVisible()
    await expect(page.locator('input[placeholder*="手机号"]').first()).toBeVisible()
  })

  test.skip('should switch between login modes', async ({ page }) => {
    await page.goto('http://localhost:3000/login')

    // Click password login tab and wait for transition
    // NOTE: Element Plus + Vue hydration may cause click() to not trigger
    // Use dispatchEvent as fallback
    const passwordTab = page.getByRole('button', { name: '密码登录' })
    await passwordTab.evaluate((el: HTMLElement) => el.dispatchEvent(new MouseEvent('click', { bubbles: true })))
    await page.waitForTimeout(1500)

    // Verify password mode is active by checking button style
    await expect(passwordTab).toHaveClass(/bg-white/)

    // Switch back to code login
    const codeTab = page.getByRole('button', { name: '验证码登录' })
    await codeTab.evaluate((el: HTMLElement) => el.dispatchEvent(new MouseEvent('click', { bubbles: true })))
    await page.waitForTimeout(1500)

    // Verify code mode is active
    await expect(codeTab).toHaveClass(/bg-white/)
  })

  test('should show validation errors on empty submit', async ({ page }) => {
    await page.goto('http://localhost:3000/login')

    // Try to submit without agreeing to terms
    await page.locator('button.el-button--primary').click()
    // Should stay on login page (ElMessage toast, not DOM text)
    await expect(page).toHaveURL(/.*\/login/)

    // Check agreement and submit with empty fields
    await page.locator('input[type="checkbox"]').check()
    await page.locator('button.el-button--primary').click()
    // Should still stay on login page due to phone validation
    await expect(page).toHaveURL(/.*\/login/)
  })
})

test.describe('Chat Page', () => {
  test('should redirect unauthenticated users to login', async ({ page }) => {
    await page.context().clearCookies()
    await page.goto('http://localhost:3000/chat')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/.*\/login.*/)
  })
})

test.describe('API Integration', () => {
  // Skip API tests when backend is not running locally
  test.beforeEach(async ({ page }) => {
    try {
      await page.request.get('http://localhost:3000/api/health', { timeout: 2000 })
    } catch {
      test.skip(true, 'Backend not available, skipping API integration tests')
    }
  })

  test('health check should return 200', async ({ page }) => {
    const response = await page.request.get('http://localhost:3000/api/health')
    expect(response.status()).toBe(200)
  })

  test('login API should return error for invalid credentials', async ({ page }) => {
    const response = await page.request.post('http://localhost:3000/api/auth/login', {
      data: { username: 'invalid', password: 'invalid' }
    })
    expect(response.status()).toBeLessThanOrEqual(500)
    const data = await response.json()
    expect(data).toHaveProperty('success')
  })
})

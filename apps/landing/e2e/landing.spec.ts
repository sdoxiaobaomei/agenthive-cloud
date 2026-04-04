import { test, expect } from '@playwright/test'

/**
 * Landing Page E2E Tests
 * 
 * Test Criteria:
 * 1. CTA links to /app/dashboard must use <a> tag (not NuxtLink) to force server-side request
 * 2. No console errors on page load
 * 3. Navigation links should work without 404
 */

test.describe('Landing Page', () => {
  test.beforeEach(async ({ page }) => {
    // Collect console errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.error(`Console error: ${msg.text()}`)
      }
    })
  })

  test('should load landing page without console errors', async ({ page }) => {
    const consoleErrors: string[] = []
    
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text())
      }
    })

    await page.goto('http://localhost:3000/')
    await page.waitForLoadState('networkidle')

    // Verify no console errors
    expect(consoleErrors).toHaveLength(0)
  })

  test('CTA button should navigate to /app/dashboard without 404', async ({ page }) => {
    await page.goto('http://localhost:3000/')
    
    // Wait for the CTA button
    const ctaButton = page.locator('text=免费开始使用').first()
    await expect(ctaButton).toBeVisible()

    // Verify it's an <a> tag (not NuxtLink) to ensure server-side proxy works
    const tagName = await ctaButton.evaluate(el => el.tagName.toLowerCase())
    expect(tagName).toBe('a')
    
    // Verify href attribute
    const href = await ctaButton.getAttribute('href')
    expect(href).toBe('/app/dashboard')

    // Click and verify navigation (should not show Nuxt 404)
    await ctaButton.click()
    await page.waitForLoadState('networkidle')
    
    // Should NOT be the Nuxt 404 page
    const title = await page.title()
    expect(title).not.toContain('404')
    
    // URL should be /app/dashboard (proxied to Vite)
    await expect(page).toHaveURL(/.*\/app\/dashboard/)
  })

  test('header login link should use <a> tag for /app/dashboard', async ({ page }) => {
    await page.goto('http://localhost:3000/')
    
    const loginLink = page.locator('a[href="/app/dashboard"]').filter({ hasText: '登录' })
    await expect(loginLink).toBeVisible()
    
    const tagName = await loginLink.evaluate(el => el.tagName.toLowerCase())
    expect(tagName).toBe('a')
  })

  test('footer links should not 404', async ({ page }) => {
    await page.goto('http://localhost:3000/')
    
    const footerLinks = [
      { name: '博客', path: '/blog' },
      { name: '教程', path: '/tutorials' },
      { name: '联系我们', path: '/contact' },
    ]

    for (const link of footerLinks) {
      const response = await page.goto(`http://localhost:3000${link.path}`)
      expect(response?.status()).not.toBe(404)
      
      // Go back to home
      await page.goto('http://localhost:3000/')
    }
  })
})

test.describe('Landing → Web Proxy Integration', () => {
  test('should proxy /app/dashboard to Vite dev server', async ({ page }) => {
    await page.goto('http://localhost:3000/app/dashboard')
    
    // Wait for page to load
    await page.waitForLoadState('networkidle')
    
    // Should not be Nuxt 404
    const content = await page.content()
    expect(content).not.toContain('404 - Page not found')
    
    // Should have the web app content (AgentHive dashboard)
    expect(content).toContain('AgentHive') // or any expected content
  })

  test('direct access to /app/ should show web app', async ({ page }) => {
    await page.goto('http://localhost:3000/app/')
    await page.waitForLoadState('networkidle')
    
    const title = await page.title()
    expect(title).not.toContain('404')
  })
})

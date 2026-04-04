import { test, expect } from '@playwright/test'

/**
 * Landing → Web Proxy Integration Tests
 * 
 * These tests verify that the Nuxt landing site correctly proxies
 * /app/** routes to the Vite web app.
 */

test.describe('Landing → Web Proxy', () => {
  test('landing page CTA should navigate to dashboard without 404', async ({ page }) => {
    // Start from landing page
    await page.goto('http://localhost:3000/')
    
    // Wait for the CTA button and verify it's an <a> tag
    const ctaButton = page.locator('a:has-text("免费开始使用")').first()
    await expect(ctaButton).toBeVisible()
    
    // Click should trigger full page reload (server-side request)
    await ctaButton.click()
    
    // Wait for navigation
    await page.waitForURL('**/app/dashboard', { timeout: 10000 })
    
    // Verify we didn't get Nuxt's 404 page
    const title = await page.title()
    expect(title).not.toContain('404')
    expect(title).not.toContain('Page not found')
    
    // Verify the page loaded (has AgentHive content)
    await expect(page.locator('text=AgentHive').first()).toBeVisible()
  })

  test('direct access to /app/dashboard should work', async ({ page }) => {
    await page.goto('http://localhost:3000/app/dashboard')
    
    // Should not be Nuxt 404
    const content = await page.content()
    expect(content).not.toContain('404 - Page not found')
    
    // Should load the web app
    await expect(page.locator('body')).toContainText('AgentHive')
  })

  test('landing page should not have console errors', async ({ page }) => {
    const errors: string[] = []
    
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })
    
    page.on('pageerror', (err) => {
      errors.push(err.message)
    })
    
    await page.goto('http://localhost:3000/')
    await page.waitForLoadState('networkidle')
    
    // Should have no errors related to missing pages
    const relevantErrors = errors.filter(e => 
      e.includes('404') || 
      e.includes('blog') || 
      e.includes('tutorials') || 
      e.includes('contact')
    )
    
    expect(relevantErrors).toHaveLength(0)
  })
})

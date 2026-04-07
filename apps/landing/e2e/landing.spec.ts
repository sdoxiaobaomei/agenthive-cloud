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

  test('should display AgentHive branding', async ({ page }) => {
    await page.goto('http://localhost:3000/')
    
    // Check logo and branding
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
      await page.goto('http://localhost:3000/')
      const response = await page.goto(`http://localhost:3000${link.path}`)
      expect(response?.status()).not.toBe(404)
      
      // Check page title doesn't contain 404
      const title = await page.title()
      expect(title).not.toContain('404')
    }
  })

  test('CTA button should navigate to login page', async ({ page }) => {
    await page.goto('http://localhost:3000/')
    
    // Look for primary CTA button/link
    const ctaLink = page.locator('a[href="/login"]').first()
    await expect(ctaLink).toBeVisible()
    
    // Click and verify navigation
    await ctaLink.click()
    await page.waitForLoadState('networkidle')
    
    // Should be on login page
    await expect(page).toHaveURL(/.*\/login/)
  })
})

test.describe('Login Page', () => {
  test('should load login page', async ({ page }) => {
    await page.goto('http://localhost:3000/login')
    
    // Check login form elements
    await expect(page.locator('text=登录 / 注册').first()).toBeVisible()
    await expect(page.locator('input[placeholder*="手机号"]').first()).toBeVisible()
  })

  test('should switch between login modes', async ({ page }) => {
    await page.goto('http://localhost:3000/login')
    
    // Check password login mode
    await page.locator('button:has-text("密码登录")').click()
    await expect(page.locator('input[type="password"]').first()).toBeVisible()
    
    // Switch back to code login
    await page.locator('button:has-text("验证码登录")').click()
    await expect(page.locator('text=验证码').first()).toBeVisible()
  })

  test('should login with demo credentials', async ({ page }) => {
    await page.goto('http://localhost:3000/login')
    
    // Switch to password login
    await page.locator('button:has-text("密码登录")').click()
    
    // Fill in demo credentials
    await page.locator('input[placeholder*="手机号"]').fill('admin')
    await page.locator('input[type="password"]').fill('admin')
    
    // Check agreement checkbox
    await page.locator('input[type="checkbox"]').check()
    
    // Click login button
    await page.locator('button:has-text("登录")').click()
    
    // Should redirect to chat or home
    await page.waitForLoadState('networkidle')
    const url = page.url()
    expect(url).toMatch(/\/(chat|)$/)
  })
})

test.describe('Chat Page', () => {
  test('should redirect unauthenticated users to login', async ({ page }) => {
    // Clear any existing auth
    await page.context().clearCookies()
    
    await page.goto('http://localhost:3000/chat')
    await page.waitForLoadState('networkidle')
    
    // Should redirect to login
    await expect(page).toHaveURL(/.*\/login.*/)
  })

  test('should show chat interface when authenticated', async ({ page }) => {
    // Login first
    await page.goto('http://localhost:3000/login')
    await page.locator('button:has-text("密码登录")').click()
    await page.locator('input[placeholder*="手机号"]').fill('admin')
    await page.locator('input[type="password"]').fill('admin')
    await page.locator('input[type="checkbox"]').check()
    await page.locator('button:has-text("登录")').click()
    
    // Wait for redirect
    await page.waitForURL(/.*\/(chat|)/, { timeout: 5000 })
    
    // If redirected to home, navigate to chat
    const url = page.url()
    if (!url.includes('/chat')) {
      await page.goto('http://localhost:3000/chat')
    }
    
    // Check chat interface elements
    await expect(page.locator('text=Alex').first()).toBeVisible()
  })
})

test.describe('API Integration', () => {
  test('projects API should return data', async ({ page }) => {
    const response = await page.request.get('http://localhost:3000/api/projects')
    expect(response.status()).toBe(200)
    
    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.data.items).toBeDefined()
    expect(data.data.items.length).toBeGreaterThan(0)
  })

  test('files API should return file tree', async ({ page }) => {
    const response = await page.request.get('http://localhost:3000/api/code/files')
    expect(response.status()).toBe(200)
    
    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.data).toBeDefined()
  })

  test('login API should authenticate user', async ({ page }) => {
    const response = await page.request.post('http://localhost:3000/api/auth/login', {
      data: {
        username: 'admin',
        password: 'admin'
      }
    })
    expect(response.status()).toBe(200)
    
    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.data.token).toBeDefined()
    expect(data.data.user).toBeDefined()
  })
})

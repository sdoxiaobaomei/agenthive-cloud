import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright 配置文件
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './e2e',
  
  /* 在测试文件中并行运行测试 */
  fullyParallel: true,
  
  /* 如果上次测试失败，则禁止并行运行测试 */
  forbidOnly: !!process.env.CI,
  
  /* 在 CI 中重试 */
  retries: process.env.CI ? 2 : 0,
  
  /* 在 CI 中选择性运行测试 */
  workers: process.env.CI ? 1 : undefined,
  
  /* 报告器配置 */
  reporter: 'html',
  
  /* 共享所有测试的设置 */
  use: {
    /* 基础 URL */
    baseURL: 'http://localhost:5173',
    
    /* 收集跟踪信息 */
    trace: 'on-first-retry',
    
    /* 视口大小 */
    viewport: { width: 1280, height: 720 },
    
    /* 自动截图 */
    screenshot: 'only-on-failure',
  },
  
  /* 项目配置 */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    /* 移动端测试 */
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],
  
  /* 本地开发服务器 */
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
})

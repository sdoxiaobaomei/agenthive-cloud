// 测试环境设置
import { beforeEach, afterEach, vi } from 'vitest'

// 设置测试环境
process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test-secret-key'
process.env.REDIS_HOST = 'localhost'
process.env.REDIS_PORT = '6379'
process.env.DB_HOST = 'localhost'
process.env.DB_PORT = '5435'
process.env.DB_NAME = 'agenthive'
process.env.DB_USER = 'agenthive'
process.env.DB_PASSWORD = 'dev'

// 模拟 console 方法以减少测试输出噪音
global.console = {
  ...console,
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  // 保留 warn 和 error 用于调试
  warn: console.warn,
  error: console.error,
}

// 在每个测试前清理
beforeEach(() => {
  vi.clearAllMocks()
})

// 在每个测试后清理
afterEach(() => {
  vi.clearAllTimers()
})

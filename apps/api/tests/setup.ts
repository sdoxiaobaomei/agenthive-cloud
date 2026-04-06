// 测试环境设置
import { beforeEach, afterEach } from 'vitest'

// 在每个测试前清理数据
beforeEach(() => {
  // 清理环境变量
  process.env.NODE_ENV = 'test'
})

afterEach(() => {
  // 清理操作
})

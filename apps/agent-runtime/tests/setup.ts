/**
 * Test Setup - 测试环境配置
 */

import { beforeEach, afterEach } from 'vitest'
import { resetPermissionManager } from '../src/permissions/PermissionManager.js'

// Reset global state before each test
beforeEach(() => {
  resetPermissionManager()
})

// Cleanup after each test
afterEach(() => {
  // Any cleanup needed
})

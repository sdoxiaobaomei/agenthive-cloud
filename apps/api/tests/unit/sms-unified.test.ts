// 统一短信服务测试
import { describe, it, expect } from 'vitest'

// Simple test to verify the module loads correctly
describe('SMS Service (Unified)', () => {
  it('应该导出 smsService', async () => {
    const { smsService } = await import('../../src/services/sms-unified.js')
    expect(smsService).toBeDefined()
    expect(typeof smsService.sendCode).toBe('function')
    expect(typeof smsService.verifyCode).toBe('function')
    expect(typeof smsService.sendNotification).toBe('function')
    expect(typeof smsService.getCodeStatus).toBe('function')
  })
})

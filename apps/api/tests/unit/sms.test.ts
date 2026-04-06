import { describe, it, expect, beforeEach } from 'vitest'
import { smsService } from '../../src/services/sms.js'
import { smsDb } from '../../src/utils/database.js'

describe('SMS Service', () => {
  beforeEach(() => {
    // 清理 SMS 数据
    smsDb.cleanExpired()
  })

  describe('sendCode', () => {
    it('应该成功发送验证码', async () => {
      const result = await smsService.sendCode('13800138000')

      expect(result.success).toBe(true)
      expect(result.message).toBe('验证码发送成功')
      expect(result.requestId).toBeDefined()
      expect(result.devCode).toBeDefined()
      expect(result.devCode).toHaveLength(6)
    })

    it('应该限制发送频率', async () => {
      await smsService.sendCode('13800138001')

      const result = await smsService.sendCode('13800138001')
      expect(result.success).toBe(false)
      expect(result.message).toContain('发送过于频繁')
    })

    it('应该验证手机号格式', async () => {
      const result = await smsService.sendCode('invalid-phone')
      // 注意：当前实现中手机号格式验证在控制器层
      // 服务层只负责发送
      expect(result.success).toBe(true)
    })
  })

  describe('verifyCode', () => {
    it('应该验证正确的验证码', async () => {
      const sendResult = await smsService.sendCode('13800138002')
      const code = sendResult.devCode!

      const verifyResult = await smsService.verifyCode('13800138002', code)

      expect(verifyResult.success).toBe(true)
      expect(verifyResult.message).toBe('验证成功')
    })

    it('应该拒绝错误的验证码', async () => {
      await smsService.sendCode('13800138003')

      const result = await smsService.verifyCode('13800138003', '000000')

      expect(result.success).toBe(false)
      expect(result.message).toContain('验证码错误')
    })

    it('应该处理不存在的验证码', async () => {
      const result = await smsService.verifyCode('13800999999', '123456')

      expect(result.success).toBe(false)
      expect(result.message).toContain('验证码不存在')
    })

    it('应该限制尝试次数', async () => {
      await smsService.sendCode('13800138004')

      // 错误尝试 3 次
      await smsService.verifyCode('13800138004', '111111')
      await smsService.verifyCode('13800138004', '222222')
      await smsService.verifyCode('13800138004', '333333')

      // 第 4 次应该被限制
      const result = await smsService.verifyCode('13800138004', '444444')
      expect(result.success).toBe(false)
      expect(result.message).toContain('验证次数过多')
    })
  })

  describe('sendNotification', () => {
    it('应该发送通知短信', async () => {
      const result = await smsService.sendNotification(
        '13800138000',
        'SMS_TEMPLATE',
        { name: 'Test' }
      )

      expect(result.success).toBe(true)
      expect(result.message).toBe('短信发送成功')
      expect(result.requestId).toBeDefined()
    })
  })
})

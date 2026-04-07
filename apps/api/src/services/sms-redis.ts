// 短信服务 - Redis 版本
import { redisCache } from './redis-cache.js'

// 短信验证码配置
const SMS_CONFIG = {
  codeLength: 6,
  expiryMinutes: 5,
  maxAttempts: 3,
  // 模拟发送延迟
  sendDelay: 1000,
  // 限制同一手机号发送频率（分钟）
  resendInterval: 1,
}

export interface SmsSendResult {
  success: boolean
  message: string
  requestId?: string
  // 开发环境返回验证码（生产环境不应该返回）
  devCode?: string
}

export interface SmsVerifyResult {
  success: boolean
  message: string
}

// 生成数字验证码
function generateSmsCode(length: number): string {
  let code = ''
  for (let i = 0; i < length; i++) {
    code += Math.floor(Math.random() * 10).toString()
  }
  return code
}

// 生成唯一 ID
function generateId(): string {
  return Math.random().toString(36).substring(2, 15)
}

// 存储发送记录（用于频率限制）
const sendRecords: Map<string, number> = new Map()

/**
 * Redis 版短信服务
 */
export const smsServiceRedis = {
  /**
   * 发送验证码
   */
  sendCode: async (phone: string, templateCode?: string): Promise<SmsSendResult> => {
    // 模拟网络延迟
    await new Promise(resolve => setTimeout(resolve, SMS_CONFIG.sendDelay))
    
    // 检查发送频率
    const lastSend = sendRecords.get(phone)
    if (lastSend) {
      const minutesSinceLastSend = (Date.now() - lastSend) / (1000 * 60)
      if (minutesSinceLastSend < SMS_CONFIG.resendInterval) {
        const waitSeconds = Math.ceil((SMS_CONFIG.resendInterval * 60 * 1000 - (Date.now() - lastSend)) / 1000)
        return {
          success: false,
          message: `发送过于频繁，请 ${waitSeconds} 秒后重试`,
        }
      }
    }
    
    // 生成验证码
    const code = generateSmsCode(SMS_CONFIG.codeLength)
    const requestId = `sms-${generateId()}`
    
    // 保存到 Redis（自动过期）
    await redisCache.setSmsCode(phone, code, 0)
    
    // 记录发送时间
    sendRecords.set(phone, Date.now())
    
    // 模拟阿里云 SMS 响应
    console.log(`[SMS] 发送验证码到 ${phone}: ${code} (模板: ${templateCode || 'SMS_123456'})`)
    
    return {
      success: true,
      message: '验证码发送成功',
      requestId,
      // 开发环境和测试环境返回验证码，方便测试
      devCode: code,
    }
  },
  
  /**
   * 验证短信验证码
   */
  verifyCode: async (phone: string, code: string): Promise<SmsVerifyResult> => {
    const smsCode = await redisCache.getSmsCode(phone)
    
    if (!smsCode) {
      return {
        success: false,
        message: '验证码不存在，请先获取验证码',
      }
    }
    
    // 检查尝试次数
    if (smsCode.attempts >= SMS_CONFIG.maxAttempts) {
      await redisCache.delSmsCode(phone)
      return {
        success: false,
        message: '验证次数过多，请重新获取验证码',
      }
    }
    
    // 增加尝试次数
    const attempts = await redisCache.incrementSmsAttempts(phone)
    
    // 验证验证码
    if (smsCode.code !== code) {
      const remainingAttempts = SMS_CONFIG.maxAttempts - attempts
      return {
        success: false,
        message: `验证码错误，还剩 ${remainingAttempts} 次机会`,
      }
    }
    
    // 验证成功，删除验证码
    await redisCache.delSmsCode(phone)
    
    return {
      success: true,
      message: '验证成功',
    }
  },
  
  /**
   * 发送通知短信（Mock）
   */
  sendNotification: async (phone: string, templateCode: string, params: Record<string, string>): Promise<SmsSendResult> => {
    await new Promise(resolve => setTimeout(resolve, SMS_CONFIG.sendDelay))
    
    const requestId = `sms-${generateId()}`
    
    console.log(`[SMS] 发送通知到 ${phone}: 模板=${templateCode}, 参数=${JSON.stringify(params)}`)
    
    return {
      success: true,
      message: '短信发送成功',
      requestId,
    }
  },
  
  /**
   * 获取验证码状态（用于调试）
   */
  getCodeStatus: async (phone: string): Promise<{ exists: boolean; expired: boolean; attempts: number } | null> => {
    const smsCode = await redisCache.getSmsCode(phone)
    if (!smsCode) return null
    
    return {
      exists: true,
      expired: false, // Redis 会自动过期
      attempts: smsCode.attempts,
    }
  },
}

export default smsServiceRedis

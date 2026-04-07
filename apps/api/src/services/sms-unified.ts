// 统一短信服务 - 优先使用 Redis，降级到 PostgreSQL
import { smsService as smsServicePg } from './sms.js'
import { smsServiceRedis } from './sms-redis.js'
import redis from '../config/redis.js'

export interface SmsSendResult {
  success: boolean
  message: string
  requestId?: string
  devCode?: string
}

export interface SmsVerifyResult {
  success: boolean
  message: string
}

// 检查 Redis 是否可用
let redisAvailable = false

redis.on('ready', () => {
  redisAvailable = true
  console.log('[SMS] Using Redis for SMS codes')
})

redis.on('close', () => {
  redisAvailable = false
  console.log('[SMS] Using PostgreSQL for SMS codes')
})

/**
 * 统一短信服务
 * 优先使用 Redis（更快，自动过期），Redis 不可用时降级到 PostgreSQL
 */
export const smsService = {
  /**
   * 发送验证码
   */
  sendCode: async (phone: string, templateCode?: string): Promise<SmsSendResult> => {
    if (redisAvailable) {
      return smsServiceRedis.sendCode(phone, templateCode)
    }
    return smsServicePg.sendCode(phone, templateCode)
  },

  /**
   * 验证短信验证码
   */
  verifyCode: async (phone: string, code: string): Promise<SmsVerifyResult> => {
    if (redisAvailable) {
      return smsServiceRedis.verifyCode(phone, code)
    }
    return smsServicePg.verifyCode(phone, code)
  },

  /**
   * 发送通知短信
   */
  sendNotification: async (phone: string, templateCode: string, params: Record<string, string>): Promise<SmsSendResult> => {
    if (redisAvailable) {
      return smsServiceRedis.sendNotification(phone, templateCode, params)
    }
    return smsServicePg.sendNotification(phone, templateCode, params)
  },

  /**
   * 获取验证码状态
   */
  getCodeStatus: async (phone: string): Promise<{ exists: boolean; expired: boolean; attempts: number } | null> => {
    if (redisAvailable) {
      return smsServiceRedis.getCodeStatus(phone)
    }
    return smsServicePg.getCodeStatus(phone)
  },
}

export default smsService

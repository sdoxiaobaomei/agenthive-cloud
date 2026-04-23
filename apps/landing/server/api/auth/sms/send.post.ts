// 发送短信验证码 API - 代理到后端真实服务
import { proxyToApi } from '../../../utils/apiProxy'

export default defineEventHandler(async (event) => {
  const result = await proxyToApi(event, '/api/auth/sms/send', { method: 'POST' })

  // 格式转换: 后端返回 { success, message, requestId, devCode? }
  // 前端期望 { success, data: { expiresIn } }
  if (result.success) {
    return {
      success: true,
      data: {
        expiresIn: 300,
      },
    }
  }

  return result
})

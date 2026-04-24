// 发送短信验证码 API - 代理到 Gateway（Java auth-service）
import { proxyToApi, getGatewayBase } from '../../../utils/apiProxy'

export default defineEventHandler(async (event) => {
  const result = await proxyToApi(event, '/api/auth/sms/send', { method: 'POST' }, getGatewayBase())

  // Java 返回: { code, message, data: null }
  if (result.code === 200) {
    return {
      success: true,
      data: {
        expiresIn: 300,
      },
    }
  }

  return {
    success: false,
    message: result.message || '发送验证码失败',
    data: null,
  }
})

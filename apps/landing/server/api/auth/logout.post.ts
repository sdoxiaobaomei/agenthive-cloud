// 登出 API - 代理到 Gateway（Java auth-service）
import { proxyToApi, getGatewayBase } from '../../utils/apiProxy'

export default defineEventHandler(async (event) => {
  const result = await proxyToApi(event, '/api/auth/logout', { method: 'POST' }, getGatewayBase())

  // Java 返回: { code, message, data: null }
  if (result.code === 200) {
    return {
      success: true,
      data: null,
    }
  }

  return {
    success: false,
    message: result.message || '登出失败',
    data: null,
  }
})

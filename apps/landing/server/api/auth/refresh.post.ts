// 刷新 Token API - 代理到 Gateway（Java auth-service）
import { proxyToApi, getGatewayBase } from '../../utils/apiProxy'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  const result = await proxyToApi(event, '/api/auth/refresh', { method: 'POST', body }, getGatewayBase())

  // Java 返回: { code, message, data: { accessToken, refreshToken, expiresIn, tokenType } }
  if (result.code === 200 && result.data?.accessToken) {
    return {
      success: true,
      data: {
        accessToken: result.data.accessToken,
        refreshToken: result.data.refreshToken,
      },
    }
  }

  return {
    success: false,
    message: result.message || '刷新 Token 失败',
    data: null,
  }
})

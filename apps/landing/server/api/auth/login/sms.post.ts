// 短信登录 API - 代理到 Gateway（Java auth-service）
import { proxyToApi, getGatewayBase } from '../../../utils/apiProxy'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  const result = await proxyToApi(event, '/api/auth/login/sms', { method: 'POST', body }, getGatewayBase())

  // Java 返回: { code, message, data: { accessToken, refreshToken, expiresIn, tokenType } }
  if (result.code === 200 && result.data?.accessToken) {
    const userResult = await proxyToApi(event, '/api/auth/me', undefined, getGatewayBase())
    const userVO = userResult.code === 200 ? userResult.data : null

    return {
      success: true,
      data: {
        token: result.data.accessToken,
        user: {
          id: String(userVO?.id || ''),
          username: userVO?.username || '',
          name: userVO?.name || userVO?.username || '',
          email: userVO?.email,
          phone: userVO?.phone,
          role: userVO?.roles?.[0] || 'user',
          avatar: userVO?.avatar,
          createdAt: userVO?.createdAt ? String(userVO.createdAt) : new Date().toISOString(),
          updatedAt: userVO?.updatedAt ? String(userVO.updatedAt) : new Date().toISOString(),
        },
      },
    }
  }

  return {
    success: false,
    message: result.message || '登录失败',
    data: null,
  }
})

// 登录 API - 代理到 Gateway（Java auth-service）
import { proxyToApi, getGatewayBase } from '../../utils/apiProxy'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  // 判断是短信登录还是用户名密码登录
  const path = body.phone && body.code ? '/api/auth/login/sms' : '/api/auth/login'

  const result = await proxyToApi(event, path, { method: 'POST', body }, getGatewayBase())

  // Java 返回: { code, message, data: { accessToken, refreshToken, expiresIn, tokenType, isNewUser } }
  if (result.code === 200 && result.data?.accessToken) {
    // 登录成功后获取用户信息
    const userResult = await proxyToApi(event, '/api/auth/me', undefined, getGatewayBase())
    const userVO = userResult.code === 200 ? userResult.data : null

    return {
      success: true,
      data: {
        accessToken: result.data.accessToken,
        refreshToken: result.data.refreshToken,
        isNewUser: result.data.isNewUser ?? false,
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

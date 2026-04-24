// 获取当前用户信息 API - 代理到 Gateway（Java auth-service）
import { proxyToApi, getGatewayBase } from '../../utils/apiProxy'

export default defineEventHandler(async (event) => {
  const result = await proxyToApi(event, '/api/auth/me', undefined, getGatewayBase())

  // Java 返回: { code, message, data: UserVO }
  if (result.code === 200 && result.data) {
    const user = result.data
    return {
      success: true,
      data: {
        id: String(user.id || ''),
        username: user.username || '',
        name: user.name || user.username || '',
        email: user.email,
        phone: user.phone,
        role: user.roles?.[0] || 'user',
        avatar: user.avatar,
        createdAt: user.createdAt ? String(user.createdAt) : new Date().toISOString(),
        updatedAt: user.updatedAt ? String(user.updatedAt) : new Date().toISOString(),
      },
    }
  }

  return {
    success: false,
    message: result.message || '获取用户信息失败',
    data: null,
  }
})

// 短信登录 API - 代理到后端真实服务
import { proxyToApi } from '../../../utils/apiProxy'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  const result = await proxyToApi(event, '/api/auth/login/sms', { method: 'POST', body })

  // 格式转换: 补充 user 缺失字段以匹配前端 User 类型
  if (result.success && result.data?.user) {
    const user = result.data.user
    return {
      success: true,
      data: {
        token: result.data.token,
        user: {
          ...user,
          name: user.name || user.username || '',
          createdAt: user.createdAt || user.created_at || new Date().toISOString(),
          updatedAt: user.updatedAt || user.updated_at || new Date().toISOString(),
        },
      },
    }
  }

  return result
})

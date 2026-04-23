// 获取当前用户信息 API - 代理到后端真实服务
import { proxyToApi } from '../../utils/apiProxy'

export default defineEventHandler(async (event) => {
  const result = await proxyToApi(event, '/api/auth/me')

  // 格式转换: 补充 user 缺失字段以匹配前端 User 类型
  if (result.success && result.data) {
    const user = result.data
    return {
      success: true,
      data: {
        ...user,
        name: user.name || user.username || '',
        createdAt: user.createdAt || user.created_at || new Date().toISOString(),
        updatedAt: user.updatedAt || user.updated_at || new Date().toISOString(),
      },
    }
  }

  return result
})

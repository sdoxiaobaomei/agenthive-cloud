// 项目列表 API - 代理到后端真实服务
import { proxyToApi } from '../utils/apiProxy'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const result = await proxyToApi(event, '/api/projects', { query })

  // 格式转换: 后端返回 { data: { items, total } }，前端期望 { data: { items, total, page, pageSize, totalPages } }
  if (result.success && result.data?.items) {
    const items = result.data.items
    const total = result.data.total || items.length
    return {
      success: true,
      data: {
        items,
        total,
        page: 1,
        pageSize: items.length,
        totalPages: 1,
      },
    }
  }

  return result
})

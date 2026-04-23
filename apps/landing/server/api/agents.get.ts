// Agent 列表 API - 代理到后端真实服务
import { proxyToApi } from '../utils/apiProxy'

export default defineEventHandler(async (event) => {
  const result = await proxyToApi(event, '/api/agents')

  // 格式转换: 后端返回 { data: { agents, total } }，前端期望 { data: { items, total, page, pageSize, totalPages } }
  if (result.success && result.data?.agents) {
    const agents = result.data.agents
    const total = result.data.total || agents.length
    return {
      success: true,
      data: {
        items: agents,
        total,
        page: 1,
        pageSize: agents.length,
        totalPages: 1,
      },
    }
  }

  return result
})

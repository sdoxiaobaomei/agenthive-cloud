// 任务列表 API - 代理到后端真实服务
import { proxyToApi } from '../utils/apiProxy'

export default defineEventHandler(async (event) => {
  const result = await proxyToApi(event, '/api/tasks')

  // 格式转换: 后端返回 { data: { tasks, total, page, pageSize } }，前端期望 { data: { items, total, page, pageSize, totalPages } }
  if (result.success && result.data?.tasks) {
    const tasks = result.data.tasks
    const total = result.data.total || tasks.length
    const page = result.data.page || 1
    const pageSize = result.data.pageSize || tasks.length
    return {
      success: true,
      data: {
        items: tasks,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize) || 1,
      },
    }
  }

  return result
})

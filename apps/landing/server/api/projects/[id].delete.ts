// 删除项目 API - 代理到后端 Node API
import { proxyToApi } from '../../utils/apiProxy'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing project id' })
  }
  const result = await proxyToApi(event, `/api/projects/${id}`, {
    method: 'DELETE',
  })
  return result
})

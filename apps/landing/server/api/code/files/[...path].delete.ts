// 删除文件/目录 API - 代理到后端
// 前端: DELETE /api/code/files/{path}?projectId=xxx
// 后端: DELETE /api/code/workspace/files?projectId=xxx&filePath=xxx
import { proxyToApi } from '../../../utils/apiProxy'

export default defineEventHandler(async (event) => {
  const path = getRouterParam(event, 'path')
  if (!path) {
    throw createError({ statusCode: 400, statusMessage: 'Missing file path' })
  }

  const query = getQuery(event)
  const result = await proxyToApi(event, '/api/code/workspace/files', {
    method: 'DELETE',
    query: { ...query, filePath: path },
  })

  return result
})

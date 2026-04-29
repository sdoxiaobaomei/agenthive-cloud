// 保存文件内容 API - 代理到后端 /api/code/workspace/files/save
import { proxyToApi } from '../../../utils/apiProxy'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const body = await readBody(event)

  // 后端期望 projectId 在 body 中，前端可能放在 query 中
  const result = await proxyToApi(event, '/api/code/workspace/files/save', {
    method: 'POST',
    body: {
      ...body,
      projectId: body?.projectId || query.projectId,
    },
  })
  return result
})

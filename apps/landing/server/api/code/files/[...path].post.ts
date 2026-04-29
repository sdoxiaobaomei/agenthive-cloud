// 创建文件/目录 API - 代理到后端
// 前端: POST /api/code/files/{path}?projectId=xxx  body: { isDirectory }
// 后端目录: POST /api/code/workspace/files/mkdir  body: { projectId, path }
// 后端文件: POST /api/code/workspace/files/save   body: { projectId, filePath, content }
import { proxyToApi } from '../../../utils/apiProxy'

export default defineEventHandler(async (event) => {
  const path = getRouterParam(event, 'path')
  if (!path) {
    throw createError({ statusCode: 400, statusMessage: 'Missing path' })
  }

  const query = getQuery(event)
  const body = await readBody(event)
  const projectId = query.projectId as string | undefined

  if (body?.isDirectory) {
    // 创建目录 -> 后端 mkdir
    const result = await proxyToApi(event, '/api/code/workspace/files/mkdir', {
      method: 'POST',
      body: { projectId, path },
    })
    return result
  }

  // 创建空文件 -> 后端 save (content = '')
  const result = await proxyToApi(event, '/api/code/workspace/files/save', {
    method: 'POST',
    body: { projectId, filePath: path, content: '' },
  })
  return result
})

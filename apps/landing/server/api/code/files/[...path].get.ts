// 获取文件内容 API - 代理到后端 /api/code/workspace/files/content
import { proxyToApi } from '../../../utils/apiProxy'

export default defineEventHandler(async (event) => {
  const path = getRouterParam(event, 'path')
  if (!path) {
    throw createError({ statusCode: 400, statusMessage: 'Missing file path' })
  }

  const query = getQuery(event)
  const result = await proxyToApi(event, '/api/code/workspace/files/content', {
    query: { ...query, filePath: path },
  })

  // 后端返回 { code, message, data: { content, path } }
  // 转为前端期望格式
  if (result.code === 200 && result.data !== undefined) {
    return {
      success: true,
      data: result.data,
    }
  }

  return result
})

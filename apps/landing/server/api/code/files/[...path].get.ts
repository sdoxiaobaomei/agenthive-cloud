// 获取文件内容 API - 代理到后端真实服务
import { proxyToApi } from '../../../utils/apiProxy'

export default defineEventHandler(async (event) => {
  const path = getRouterParam(event, 'path')
  if (!path) {
    throw createError({ statusCode: 400, statusMessage: 'Missing file path' })
  }

  const result = await proxyToApi(event, `/api/code/files/${encodeURIComponent(path)}`)
  return result
})

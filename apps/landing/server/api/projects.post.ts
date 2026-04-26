// 创建项目 API - 代理到后端 Node API
import { proxyToApi } from '../utils/apiProxy'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const result = await proxyToApi(event, '/api/projects', {
    method: 'POST',
    body,
  })
  return result
})

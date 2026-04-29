// 保存文件内容 API - 代理到后端真实服务
import { proxyToApi } from '../../../utils/apiProxy'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const result = await proxyToApi(event, '/api/code/files/save', {
    method: 'POST',
    body,
  })
  return result
})

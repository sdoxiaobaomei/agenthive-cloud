// Credits Balance API - 代理到后端获取当前用户余额
import { proxyToApi } from '../../utils/apiProxy'

export default defineEventHandler(async (event) => {
  const result = await proxyToApi(event, '/api/credits/balance')
  return result
})

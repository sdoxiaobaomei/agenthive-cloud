// Credits Pricing API - 代理到后端获取 Agent 定价
import { proxyToApi } from '../../utils/apiProxy'

export default defineEventHandler(async (event) => {
  const result = await proxyToApi(event, '/api/credits/pricing')
  return result
})

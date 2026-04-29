// Credits Transactions API - 代理到后端获取交易流水
import { proxyToApi } from '../../utils/apiProxy'

export default defineEventHandler(async (event) => {
  const result = await proxyToApi(event, '/api/credits/transactions')
  return result
})

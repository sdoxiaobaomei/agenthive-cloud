// 短信登录 API - 代理到 Gateway（Java auth-service）
// 设计原则：BFF 只做转发，不聚合 /me 请求。前端拿到 token 后自己去调 /api/auth/me。
import { proxyToApi, getGatewayBase } from '../../../utils/apiProxy'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  // 直接透传 Gateway 响应，不额外调用 /me
  return await proxyToApi(event, '/api/auth/login/sms', { method: 'POST', body }, getGatewayBase())
})

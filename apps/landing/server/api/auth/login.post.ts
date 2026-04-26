// 登录 API - 代理到 Gateway（Java auth-service）
// 设计原则：BFF 只做转发，不聚合 /me 请求。前端拿到 token 后自己去调 /api/auth/me。
import { proxyToApi, getGatewayBase } from '../../utils/apiProxy'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  // 判断是短信登录还是用户名密码登录
  const path = body.phone && body.code ? '/api/auth/login/sms' : '/api/auth/login'

  // 直接透传 Gateway 响应，不额外调用 /me
  return await proxyToApi(event, path, { method: 'POST', body }, getGatewayBase())
})

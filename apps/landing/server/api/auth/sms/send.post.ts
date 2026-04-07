// 发送短信验证码 API
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { phone } = body

  // 模拟发送验证码
  console.log(`[SMS] Sending code 123456 to ${phone}`)

  return {
    success: true,
    data: {
      expiresIn: 300, // 5分钟有效
    },
  }
})

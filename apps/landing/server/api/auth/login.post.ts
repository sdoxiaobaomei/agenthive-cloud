// 登录 API
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { username, password } = body

  // 模拟验证（实际项目中应该验证数据库）
  if (username === 'admin' && password === 'admin') {
    return {
      success: true,
      data: {
        token: 'mock-jwt-token-' + Date.now(),
        user: {
          id: '1',
          name: 'Admin User',
          phone: '13800138000',
          email: 'admin@example.com',
          avatar: '/avatars/shiba_be.png',
          createdAt: '2026-04-01T00:00:00Z',
          updatedAt: '2026-04-06T00:00:00Z',
        },
      },
    }
  }

  // 短信登录（验证码 123456）
  if (body.phone && body.code === '123456') {
    return {
      success: true,
      data: {
        token: 'mock-jwt-token-' + Date.now(),
        user: {
          id: '2',
          name: 'Test User',
          phone: body.phone,
          avatar: '/avatars/shiba_fe.png',
          createdAt: '2026-04-01T00:00:00Z',
          updatedAt: '2026-04-06T00:00:00Z',
        },
      },
    }
  }

  throw createError({
    statusCode: 401,
    message: '用户名或密码错误',
  })
})

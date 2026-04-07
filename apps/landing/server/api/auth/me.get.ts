// 获取当前用户信息 API
export default defineEventHandler(async (event) => {
  // 模拟当前登录用户
  return {
    success: true,
    data: {
      id: '1',
      name: 'Demo User',
      phone: '13800138000',
      email: 'demo@example.com',
      avatar: '/avatars/shiba_be.png',
      createdAt: '2026-04-01T00:00:00Z',
      updatedAt: '2026-04-06T00:00:00Z',
    },
  }
})

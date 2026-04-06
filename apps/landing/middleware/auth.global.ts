export default defineNuxtRouteMiddleware((to) => {
  // 公开访问的路径列表
  const publicPaths = [
    '/',
    '/features',
    '/pricing',
    '/docs',
    '/login',
    '/studio',
    '/about',
    '/blog',
    '/contact',
    '/careers',
    '/privacy',
    '/terms',
    '/changelog',
    '/tutorials',
    '/examples',
  ]
  
  // 公开路径前缀
  const publicPrefixes = ['/docs/', '/blog/']
  
  // 检查是否是公开路径
  const isPublicPath = publicPaths.includes(to.path) || 
    publicPrefixes.some(prefix => to.path.startsWith(prefix))
  
  // 公开路径直接放行
  if (isPublicPath) return
  
  // 检查用户认证状态
  const { isAuthenticated } = useAuth()
  
  // 未认证用户访问需要保护的页面，重定向到登录页
  if (!isAuthenticated()) {
    return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`)
  }
  
  // 已认证用户可以访问所有其他页面
})

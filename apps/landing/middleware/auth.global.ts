import { useAuthStore } from '~/stores/auth'

export default defineNuxtRouteMiddleware((to, from) => {
  // 获取页面 meta 信息
  const meta = to.meta
  
  // 如果页面明确标记 auth: false，则不需要认证
  if (meta.auth === false) {
    return
  }
  
  // 公开访问的路径列表 - 包括登录页
  const publicPaths = [
    '/',
    '/features',
    '/pricing',
    '/docs',
    '/login',
    '/register',
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
  
  // 公开路径直接放行（包括登录页）
  if (isPublicPath) {
    return
  }
  
  // API 路由不处理
  if (to.path.startsWith('/api')) {
    return
  }
  
  // 使用 Pinia store 检查认证状态（与登录页保持一致）
  const authStore = useAuthStore()
  const authenticated = authStore.isAuthenticated
  
  // 未认证用户访问需要保护的页面，重定向到登录页
  if (!authenticated) {
    // 避免重复重定向到登录页
    if (to.path === '/login') {
      return
    }
    return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`)
  }
  
  // 已认证用户可以访问所有其他页面（包括登录页，允许切换账号）
})

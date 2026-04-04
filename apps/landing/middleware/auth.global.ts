export default defineNuxtRouteMiddleware((to) => {
  const publicPaths = ['/', '/features', '/pricing', '/docs', '/login', '/studio', '/about', '/blog']
  if (publicPaths.includes(to.path)) return
  if (to.path.startsWith('/app') && !to.path.startsWith('/app/dashboard')) {
    // Allow app routes
  }
})

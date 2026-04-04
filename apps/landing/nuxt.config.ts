export default defineNuxtConfig({
  devtools: { enabled: true },
  
  // 站点配置
  site: {
    url: 'https://agenthive.cloud',
    name: 'AgentHive Cloud',
    description: 'AI驱动的智能开发团队管理平台',
    defaultLocale: 'zh-CN',
  },
  
  // 模块
  modules: [
    '@nuxtjs/tailwindcss',
    '@vueuse/nuxt',
    // '@nuxtjs/seo',  // 暂时禁用，有兼容性问题
  ],
  
  // 应用配置
  app: {
    head: {
      charset: 'utf-8',
      viewport: 'width=device-width, initial-scale=1',
      titleTemplate: '%s | AgentHive Cloud',
      defaultTitle: 'AgentHive Cloud - AI驱动的智能开发团队',
      meta: [
        { name: 'description', content: 'AgentHive Cloud 是一个AI驱动的智能开发团队管理平台，帮助您管理和协调多个AI Agent，实现自动化软件开发。' },
        { name: 'theme-color', content: '#409EFF' },
        // Open Graph
        { property: 'og:site_name', content: 'AgentHive Cloud' },
        { property: 'og:title', content: 'AgentHive Cloud - AI驱动的智能开发团队' },
        { property: 'og:description', content: '管理和协调多个AI Agent，实现自动化软件开发' },
        { property: 'og:image', content: '/og-image.png' },
        // Twitter
        { name: 'twitter:card', content: 'summary_large_image' },
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
      ],
    },
  },
  
  // 自动导入共享组件
  components: [
    { path: '../../packages/ui/src/components', prefix: 'Ah' },
  ],
  
  // 构建配置
  nitro: {
    preset: 'static',
    prerender: {
      crawlLinks: true,
      routes: ['/sitemap.xml', '/robots.txt'],
      failOnError: false,
    },
  },
  
  // 路由配置
  routeRules: {
    // 所有页面由 Nuxt 统一服务，web 已融合到 landing 中
    '/**': { prerender: true },
  },

  // 别名配置
  alias: {
    '@agenthive/ui': '../../packages/ui/src/index.ts',
    '@agenthive/types': '../../packages/types/src/index.ts',
  },

  // 导入共享样式
  css: ['../../packages/ui/src/styles/tokens.css', '~/assets/css/element-plus-override.css'],
  
  // 兼容性日期
  compatibilityDate: '2024-04-01',
})

import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import cjsGuard from './plugins/vite-cjs-guard'

const currentDir = dirname(fileURLToPath(import.meta.url))

export default defineNuxtConfig({
  devtools: { enabled: false },
  buildDir: '.nuxt-build',
  
  // 模块
  modules: [
    '@nuxtjs/tailwindcss',
    '@vueuse/nuxt',
    '@pinia/nuxt',
  ],
  
  // 插件配置
  plugins: [
    { src: '~/plugins/error-handler.ts', mode: 'all' },
  ],
  
  // 应用配置
  app: {
    head: {
      charset: 'utf-8',
      viewport: 'width=device-width, initial-scale=1',
      titleTemplate: '%s | AgentHive Cloud',
      title: 'AgentHive Cloud - AI驱动的智能开发团队',
      meta: [
        { name: 'description', content: 'AgentHive Cloud 是一个AI驱动的智能开发团队管理平台，帮助您管理和协调多个AI Agent，实现自动化软件开发。' },
        { name: 'theme-color', content: '#409EFF' },
        { property: 'og:site_name', content: 'AgentHive Cloud' },
        { property: 'og:title', content: 'AgentHive Cloud - AI驱动的智能开发团队' },
        { property: 'og:description', content: '管理和协调多个AI Agent，实现自动化软件开发' },
        { property: 'og:image', content: '/og-image.png' },
        { name: 'twitter:card', content: 'summary_large_image' },
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap' },
      ],
    },
    // 页面过渡配置
    pageTransition: {
      name: 'page',
      mode: 'out-in'
    },
    // 布局过渡配置
    layoutTransition: {
      name: 'layout',
      mode: 'out-in'
    }
  },
  
  // CSS
  css: [
    '~/assets/css/tailwind.css',
  ],
  
  // 构建配置
  build: {
    transpile: [
      '@element-plus/icons-vue',
      'element-plus',
      '@popperjs/core',
      // dayjs 插件是 CJS/UMD 格式，需要 transpile 才能正确转换为 ESM
      'dayjs',
    ],
  },
  
  // Vite 配置
  vite: {
    cacheDir: '.vite-cache',
    plugins: [
      // CJS Guard：dev 模式下监控未预构建的 CJS 模块，提前预警
      // 防止 "does not provide an export named 'default'" 类错误
      // 详见 plugins/vite-cjs-guard.ts
      cjsGuard(),
    ],
    resolve: {
      alias: {
        '@': resolve(currentDir, './'),
        '~': resolve(currentDir, './'),
      },
    },
    build: {
      // cssCodeSplit: false,
      // 确保生产构建时正确处理混合 ESM/CJS 模块（如 dayjs 插件）
      commonjsOptions: {
        transformMixedEsModules: true,
      },
    },
    optimizeDeps: {
      include: [
        'dayjs',
        // Element Plus ESM builds import dayjs plugins with .js extension
        // Vite treats 'dayjs/plugin/xxx' and 'dayjs/plugin/xxx.js' as different modules
        'dayjs/plugin/customParseFormat.js',
        'dayjs/plugin/localeData.js',
        'dayjs/plugin/advancedFormat.js',
        'dayjs/plugin/weekOfYear.js',
        'dayjs/plugin/weekYear.js',
        'dayjs/plugin/dayOfYear.js',
        'dayjs/plugin/isSameOrAfter.js',
        'dayjs/plugin/isSameOrBefore.js',
      ],
    },
  },
  
  // TypeScript 配置
  typescript: {
    strict: false,
    typeCheck: false,
  },
  
  // 运行时配置
  runtimeConfig: {
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:8080',
    },
  },
  
  // Nitro 配置
  nitro: {
    // 开发环境代理 API 请求统一走 Gateway (8080)
    // Gateway 负责路由分发：/api/auth/** → Java，/api/agents/** → Node API
    // NOTE: devProxy 会绕过 BFF 层 (server/api)。如需 BFF 生效，请保持注释。
    // devProxy: {
    //   '/api': {
    //     target: 'http://localhost:8080',
    //     changeOrigin: true,
    //   },
    // },
  },

  // 兼容性日期
  compatibilityDate: '2024-04-06',
  
  // 禁用实验性 app-manifest（解决开发模式热更新问题）
  experimental: {
    appManifest: false,
  },
})

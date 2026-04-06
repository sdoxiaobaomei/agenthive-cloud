import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineNuxtConfig({
  devtools: { enabled: false },
  
  // 模块
  modules: [
    '@nuxtjs/tailwindcss',
    '@vueuse/nuxt',
    '@pinia/nuxt',
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
  },
  
  // CSS
  css: [
    '~/assets/css/main.css',
  ],
  
  // 构建配置
  build: {
    transpile: ['@element-plus/icons-vue'],
  },
  
  // Vite 配置
  vite: {
    resolve: {
      alias: {
        '@': resolve(__dirname, './'),
        '~': resolve(__dirname, './'),
      },
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
      apiBase: '/api',
    },
  },
  
  // Nitro 配置
  nitro: {
    preset: 'static',
    output: {
      dir: '.output-new',
    },
  },

  // 兼容性日期
  compatibilityDate: '2024-04-06',
  
  // 禁用实验性 app-manifest（解决开发模式热更新问题）
  experimental: {
    appManifest: false,
  },
})

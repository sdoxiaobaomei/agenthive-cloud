import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'

import type { Pinia } from 'pinia'

export default defineNuxtPlugin((nuxtApp) => {
  // 仅在客户端运行
  if (!import.meta.client) {
    return
  }
  
  // 确保 $pinia 存在（由 @pinia/nuxt 模块提供）
  if (!nuxtApp.$pinia) {
    console.warn('[pinia-persistedstate] $pinia not found, plugin will not be installed')
    return
  }
  
  try {
    const pinia = nuxtApp.$pinia as Pinia
    pinia.use(piniaPluginPersistedstate)
  } catch (error) {
    console.error('[pinia-persistedstate] Failed to install plugin:', error)
  }
})

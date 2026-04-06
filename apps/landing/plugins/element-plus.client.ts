import { defineNuxtPlugin } from '#app'
import ElementPlus, { ID_INJECTION_KEY, ZINDEX_INJECTION_KEY } from 'element-plus'
import 'element-plus/dist/index.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'

export default defineNuxtPlugin((nuxtApp) => {
  // Element Plus SSR 配置
  nuxtApp.vueApp.provide(ID_INJECTION_KEY, {
    prefix: 1024,
    current: 0,
  })
  nuxtApp.vueApp.provide(ZINDEX_INJECTION_KEY, {
    current: 0,
  })
  
  nuxtApp.vueApp.use(ElementPlus)
  
  // 注册所有图标
  for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
    nuxtApp.vueApp.component(key, component)
  }
})

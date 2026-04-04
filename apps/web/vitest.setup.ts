import { config } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import { createPinia, setActivePinia } from 'pinia'

// 安装 Element Plus 组件
config.global.plugins.push(ElementPlus)

// 注册所有图标组件
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  config.global.components[key] = component
}

// 设置全局 Pinia
setActivePinia(createPinia())

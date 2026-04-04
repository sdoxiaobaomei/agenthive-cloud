import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import Header from '../layout/Header.vue'
import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory('/app/'),
  routes: [{ path: '/', component: { template: '<div/>' } }],
})

describe('Header', () => {
  it('应该渲染头部导航', async () => {
    await router.push('/')
    await router.isReady()
    const wrapper = mount(Header, {
      props: { sidebarCollapsed: false },
      global: { plugins: [router] },
    })
    expect(wrapper.find('.main-header').exists()).toBe(true)
    expect(wrapper.find('.back-to-site').exists()).toBe(true)
  })

  it('点击侧边栏切换按钮应该触发事件', async () => {
    const wrapper = mount(Header, {
      props: { sidebarCollapsed: false },
      global: { plugins: [router] },
    })
    const btn = wrapper.find('.header-left .el-button')
    await btn.trigger('click')
    expect(wrapper.emitted('toggle-sidebar')).toBeTruthy()
  })
})

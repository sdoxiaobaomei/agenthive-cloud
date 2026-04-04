import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import Sidebar from '../layout/Sidebar.vue'
import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory('/app/'),
  routes: [{ path: '/', component: { template: '<div/>' } }, { path: '/agents', component: { template: '<div/>' } }],
})

describe('Sidebar', () => {
  it('应该渲染 logo 和菜单项', async () => {
    await router.push('/agents')
    await router.isReady()
    const wrapper = mount(Sidebar, {
      props: { collapsed: false },
      global: { plugins: [router] },
    })
    expect(wrapper.find('.logo-text').text()).toBe('AgentHive')
    const items = wrapper.findAll('.el-menu-item')
    expect(items.length).toBeGreaterThan(0)
  })

  it('折叠时应该隐藏 logo 文字', () => {
    const wrapper = mount(Sidebar, {
      props: { collapsed: true },
      global: { plugins: [router] },
    })
    expect(wrapper.find('.logo-text').isVisible()).toBe(false)
    expect(wrapper.find('.sidebar').classes()).toContain('is-collapsed')
  })

  it('点击折叠按钮应该触发 toggle 事件', async () => {
    const wrapper = mount(Sidebar, {
      props: { collapsed: false },
      global: { plugins: [router] },
    })
    const btn = wrapper.find('.collapse-btn')
    await btn.trigger('click')
    expect(wrapper.emitted('toggle')).toBeTruthy()
  })
})

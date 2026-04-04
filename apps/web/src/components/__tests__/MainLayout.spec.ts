import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MainLayout from '../layout/MainLayout.vue'
import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory('/app/'),
  routes: [{ path: '/', component: { template: '<div class="page-home"/>' } }],
})

describe('MainLayout', () => {
  it('应该渲染 Sidebar 和 Header', async () => {
    await router.push('/')
    await router.isReady()
    const wrapper = mount(MainLayout, {
      global: { plugins: [router] },
    })
    expect(wrapper.find('.sidebar').exists()).toBe(true)
    expect(wrapper.find('.main-header').exists()).toBe(true)
    expect(wrapper.find('.main-content').exists()).toBe(true)
  })
})

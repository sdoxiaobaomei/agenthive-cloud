import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AgentWorkflowCard from '../agent/AgentWorkflowCard.vue'
import { createRouter, createWebHistory } from 'vue-router'

const now = new Date().toISOString()

const router = createRouter({
  history: createWebHistory('/app/'),
  routes: [{ path: '/', component: { template: '<div/>' } }],
})

describe('AgentWorkflowCard', () => {
  it('应该渲染代理名称和工作流阶段', async () => {
    await router.push('/')
    await router.isReady()
    const wrapper = mount(AgentWorkflowCard, {
      props: { agent: { id: 'a1', name: 'Frontend', role: 'frontend_dev', status: 'working', lastHeartbeatAt: now, createdAt: now, updatedAt: now } },
      global: { plugins: [router] },
    })
    expect(wrapper.find('.agent-name').text()).toBe('Frontend')
    expect(wrapper.findAll('.phase-item').length).toBeGreaterThan(0)
  })

  it('点击展开按钮应该切换详情', async () => {
    const wrapper = mount(AgentWorkflowCard, {
      props: { agent: { id: 'a1', name: 'Frontend', role: 'frontend_dev', status: 'working', lastHeartbeatAt: now, createdAt: now, updatedAt: now } },
      global: { plugins: [router] },
    })
    const btn = wrapper.find('.card-header .el-button')
    expect(btn.exists()).toBe(true)
    await btn.trigger('click')
    expect(wrapper.find('.workflow-details').isVisible()).toBe(true)
  })
})

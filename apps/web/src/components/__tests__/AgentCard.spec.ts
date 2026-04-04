import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AgentCard from '../agent/AgentCard.vue'

const now = new Date().toISOString()

describe('AgentCard', () => {
  it('应该渲染代理名称和状态', () => {
    const wrapper = mount(AgentCard, {
      props: { agent: { id: 'a1', name: 'Alpha', role: 'frontend_dev', status: 'idle', avatar: '', lastHeartbeatAt: now, createdAt: now, updatedAt: now } },
    })
    expect(wrapper.text()).toContain('Alpha')
    expect(wrapper.text()).toContain('空闲')
  })
})

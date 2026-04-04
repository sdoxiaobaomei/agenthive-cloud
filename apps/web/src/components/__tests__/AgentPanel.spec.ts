import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AgentPanel from '../agent/AgentPanel.vue'

const now = new Date().toISOString()

describe('AgentPanel', () => {
  it('有 agent 时应该渲染详情', () => {
    const wrapper = mount(AgentPanel, {
      props: {
        agent: { id: 'a1', name: 'Alpha', role: 'frontend_dev', status: 'idle', createdAt: now, updatedAt: now, lastHeartbeatAt: now },
      },
    })
    expect(wrapper.find('.agent-name').text()).toBe('Alpha')
    expect(wrapper.find('.panel-body').exists()).toBe(true)
  })

  it('无 agent 时应该显示空状态', () => {
    const wrapper = mount(AgentPanel, {
      props: { agent: null },
    })
    expect(wrapper.find('.agent-panel-empty').exists()).toBe(true)
  })
})

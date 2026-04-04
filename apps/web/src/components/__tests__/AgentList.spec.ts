import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AgentList from '../agent/AgentList.vue'

const now = new Date().toISOString()

describe('AgentList', () => {
  it('应该渲染代理列表', () => {
    const wrapper = mount(AgentList, {
      props: {
        agents: [
          { id: 'a1', name: 'Alpha', role: 'frontend_dev', status: 'idle', lastHeartbeatAt: now, createdAt: now, updatedAt: now },
          { id: 'a2', name: 'Beta', role: 'tech_lead', status: 'working', lastHeartbeatAt: now, createdAt: now, updatedAt: now },
        ],
      },
    })
    expect(wrapper.findAll('.agent-card').length).toBe(2)
  })
})

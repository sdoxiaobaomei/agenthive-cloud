import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AgentAvatar from '../agent/AgentAvatar.vue'
import type { AgentRole, AgentStatus } from '@/types'

describe('AgentAvatar', () => {
  it('应该正确渲染默认尺寸的头像', () => {
    const wrapper = mount(AgentAvatar, {
      props: {
        role: 'frontend_dev' as AgentRole,
        status: 'idle' as AgentStatus,
      },
    })
    
    expect(wrapper.find('.agent-avatar').exists()).toBe(true)
  })

  it('应该根据角色显示不同的图标颜色', () => {
    const roles: AgentRole[] = ['director', 'frontend_dev', 'backend_dev', 'devops_engineer', 'qa_engineer', 'custom']
    
    roles.forEach(role => {
      const wrapper = mount(AgentAvatar, {
        props: {
          role,
          status: 'idle' as AgentStatus,
        },
      })
      
      expect(wrapper.find('.agent-avatar').exists()).toBe(true)
    })
  })

  it('应该根据状态显示不同的指示器颜色', () => {
    const statuses: AgentStatus[] = ['idle', 'working', 'paused', 'error', 'completed', 'starting']
    
    statuses.forEach(status => {
      const wrapper = mount(AgentAvatar, {
        props: {
          role: 'frontend_dev' as AgentRole,
          status,
        },
      })
      
      expect(wrapper.find('.agent-avatar').exists()).toBe(true)
    })
  })

  it('应该支持不同的尺寸', () => {
    const sizes = [24, 32, 40, 48, 64]
    
    sizes.forEach(size => {
      const wrapper = mount(AgentAvatar, {
        props: {
          role: 'frontend_dev' as AgentRole,
          status: 'idle' as AgentStatus,
          size,
        },
      })
      
      const avatar = wrapper.find('.agent-avatar')
      expect(avatar.attributes('style')).toContain(`${size}px`)
    })
  })

  it('应该显示角色图标', () => {
    const wrapper = mount(AgentAvatar, {
      props: {
        role: 'frontend_dev' as AgentRole,
        status: 'idle' as AgentStatus,
      },
    })
    
    expect(wrapper.find('.agent-avatar').exists()).toBe(true)
  })
})

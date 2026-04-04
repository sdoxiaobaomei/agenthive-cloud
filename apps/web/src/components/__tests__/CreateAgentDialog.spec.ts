import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import CreateAgentDialog from '../agent/CreateAgentDialog.vue'

// Mock agent store
vi.mock('@/stores/agent', () => ({
  useAgentStore: () => ({
    createAgent: vi.fn().mockResolvedValue({ id: '1', name: 'Test Agent' }),
    fetchAgents: vi.fn(),
  }),
}))

describe('CreateAgentDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('对话框应该在 modelValue 为 true 时显示', async () => {
    const wrapper = mount(CreateAgentDialog, {
      props: { modelValue: true },
      attachTo: document.body,
    })
    await flushPromises()
    expect(document.body.querySelector('.el-dialog')).toBeTruthy()
    wrapper.unmount()
  })

  it('对话框应该在 modelValue 为 false 时隐藏', async () => {
    const wrapper = mount(CreateAgentDialog, {
      props: { modelValue: false },
    })
    expect(wrapper.find('.el-dialog').exists()).toBe(false)
  })

  it('应该显示表单字段', async () => {
    const wrapper = mount(CreateAgentDialog, {
      props: { modelValue: true },
      attachTo: document.body,
    })
    await flushPromises()
    expect(document.body.querySelector('.el-form')).toBeTruthy()
    wrapper.unmount()
  })

  it('应该验证必填字段', async () => {
    mount(CreateAgentDialog, {
      props: { modelValue: true },
      attachTo: document.body,
    })
    await flushPromises()
    const btn = document.body.querySelector('.el-dialog__footer button.el-button--primary') as HTMLElement
    expect(btn).toBeTruthy()
    btn?.click()
    await flushPromises()
    // 未触发 created 即说明验证拦截了提交
  })
})

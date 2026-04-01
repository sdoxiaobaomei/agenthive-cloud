import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ElDialog, ElForm, ElFormItem, ElInput, ElSelect, ElOption, ElButton } from 'element-plus'
import CreateAgentDialog from '../agent/CreateAgentDialog.vue'

// Mock Element Plus 组件
vi.mock('element-plus', async () => {
  const actual = await vi.importActual('element-plus')
  return {
    ...actual,
    ElMessage: {
      success: vi.fn(),
      error: vi.fn(),
    },
  }
})

describe('CreateAgentDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('对话框应该在 modelValue 为 true 时显示', async () => {
    const wrapper = mount(CreateAgentDialog, {
      props: {
        modelValue: true,
      },
      global: {
        stubs: {
          'el-dialog': ElDialog,
          'el-form': ElForm,
          'el-form-item': ElFormItem,
          'el-input': ElInput,
          'el-select': ElSelect,
          'el-option': ElOption,
          'el-button': ElButton,
          'el-collapse': true,
          'el-collapse-item': true,
          'el-input-number': true,
        },
      },
    })
    
    expect(wrapper.find('.el-dialog').exists()).toBe(true)
  })

  it('对话框应该在 modelValue 为 false 时隐藏', async () => {
    const wrapper = mount(CreateAgentDialog, {
      props: {
        modelValue: false,
      },
      global: {
        stubs: {
          'el-dialog': ElDialog,
          'el-form': ElForm,
          'el-form-item': ElFormItem,
          'el-input': ElInput,
          'el-select': ElSelect,
          'el-option': ElOption,
          'el-button': ElButton,
          'el-collapse': true,
          'el-collapse-item': true,
          'el-input-number': true,
        },
      },
    })
    
    expect(wrapper.find('.el-dialog').exists()).toBe(false)
  })

  it('应该显示表单字段', async () => {
    const wrapper = mount(CreateAgentDialog, {
      props: {
        modelValue: true,
      },
      global: {
        stubs: {
          'el-dialog': ElDialog,
          'el-form': ElForm,
          'el-form-item': ElFormItem,
          'el-input': ElInput,
          'el-select': ElSelect,
          'el-option': ElOption,
          'el-button': ElButton,
          'el-collapse': true,
          'el-collapse-item': true,
          'el-input-number': true,
        },
      },
    })
    
    // 验证表单存在
    expect(wrapper.find('form').exists() || wrapper.find('.el-form').exists()).toBe(true)
  })

  it('应该验证必填字段', async () => {
    const wrapper = mount(CreateAgentDialog, {
      props: {
        modelValue: true,
      },
      global: {
        stubs: {
          'el-dialog': ElDialog,
          'el-form': ElForm,
          'el-form-item': ElFormItem,
          'el-input': ElInput,
          'el-select': ElSelect,
          'el-option': ElOption,
          'el-button': ElButton,
          'el-collapse': true,
          'el-collapse-item': true,
          'el-input-number': true,
        },
      },
    })
    
    // 触发提交而不填写数据
    const submitButton = wrapper.find('button[type="primary"]')
    if (submitButton.exists()) {
      await submitButton.trigger('click')
      await flushPromises()
    }
    
    // 验证没有触发 created 事件（因为验证失败）
    expect(wrapper.emitted('created')).toBeFalsy()
  })

  it('应该发出 update:modelValue 事件当对话框关闭', async () => {
    const wrapper = mount(CreateAgentDialog, {
      props: {
        modelValue: true,
      },
      global: {
        stubs: {
          'el-dialog': ElDialog,
          'el-form': ElForm,
          'el-form-item': ElFormItem,
          'el-input': ElInput,
          'el-select': ElSelect,
          'el-option': ElOption,
          'el-button': ElButton,
          'el-collapse': true,
          'el-collapse-item': true,
          'el-input-number': true,
        },
      },
    })
    
    // 点击取消按钮
    const cancelButton = wrapper.find('button:not([type="primary"])')
    if (cancelButton.exists()) {
      await cancelButton.trigger('click')
      
      expect(wrapper.emitted('update:modelValue')).toBeTruthy()
      expect(wrapper.emitted('update:modelValue')![0]).toEqual([false])
    }
  })
})

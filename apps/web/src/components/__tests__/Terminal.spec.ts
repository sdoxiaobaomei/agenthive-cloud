import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import Terminal from '../terminal/Terminal.vue'

const clearFn = vi.fn()
const writelnFn = vi.fn()

vi.mock('xterm', () => ({
  Terminal: class {
    open = vi.fn()
    write = vi.fn()
    writeln = writelnFn
    clear = clearFn
    dispose = vi.fn()
    onData = vi.fn()
    loadAddon = vi.fn()
    scrollToBottom = vi.fn()
  },
}))

vi.mock('xterm-addon-fit', () => ({
  FitAddon: class {
    fit = vi.fn()
  },
}))

describe('Terminal', () => {
  it('应该渲染终端标题', () => {
    const wrapper = mount(Terminal, {
      props: { agentId: 'agent-123', title: 'Test Terminal' },
    })
    expect(wrapper.find('.terminal-title').text()).toContain('Test Terminal')
  })

  it('应该触发清空', async () => {
    mount(Terminal, {
      props: { agentId: 'agent-123' },
    })
    expect(clearFn).not.toHaveBeenCalled()
    // clearTerminal 在 onMounted  welcome 之后不会自动调用
    // 通过按钮触发
    const wrapper = mount(Terminal, {
      props: { agentId: 'agent-123' },
    })
    const btns = wrapper.findAll('.terminal-actions .el-button')
    const clearBtn = btns.find(b => b.text().includes('清空'))
    expect(clearBtn).toBeTruthy()
    if (clearBtn) await clearBtn.trigger('click')
    expect(clearFn).toHaveBeenCalled()
  })
})

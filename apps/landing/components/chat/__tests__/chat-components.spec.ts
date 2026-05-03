import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import MessageBlock from '../MessageBlock.vue'
import ThinkBlock from '../ThinkBlock.vue'
import TaskBlock from '../TaskBlock.vue'
import RecommendBlock from '../RecommendBlock.vue'
import VersionSwitcher from '../VersionSwitcher.vue'
import type { ChatMessage, ChatVersion } from '~/stores/chat'

// Mock Element Plus icons
vi.mock('@element-plus/icons-vue', () => ({
  ArrowDown: { template: '<span>▼</span>' },
  InfoFilled: { template: '<span>i</span>' },
  Close: { template: '<span>x</span>' },
  Clock: { template: '<span>⏰</span>' },
  Plus: { template: '<span>+</span>' },
}))

// Mock Element Plus components
vi.mock('element-plus', () => ({
  ElTag: { template: '<span class="el-tag"><slot /></span>' },
  ElButton: { template: '<button class="el-button"><slot /></button>' },
  ElIcon: { template: '<span class="el-icon"><slot /></span>' },
  ElDropdown: { template: '<div class="el-dropdown"><slot /><slot name="dropdown"/></div>' },
  ElDropdownMenu: { template: '<div class="el-dropdown-menu"><slot /></div>' },
  ElDropdownItem: { template: '<div class="el-dropdown-item" @click="$emit(\'click\')"><slot /></div>' },
}))

describe('chat components rendering', () => {
  const mockMessage = (overrides: Partial<ChatMessage> = {}): ChatMessage => ({
    id: 'msg-1',
    role: 'assistant',
    type: 'message',
    content: 'Hello world',
    timestamp: '2026-01-01T00:00:00Z',
    conversationId: 'conv-1',
    metadata: {},
    ...overrides,
  })

  describe('MessageBlock', () => {
    it('renders message content', () => {
      const wrapper = mount(MessageBlock, {
        props: { message: mockMessage() },
      })
      expect(wrapper.text()).toContain('Hello world')
      expect(wrapper.find('.message-bubble').exists()).toBe(true)
    })

    it('renders markdown bold text', () => {
      const wrapper = mount(MessageBlock, {
        props: { message: mockMessage({ content: '**bold** text' }) },
      })
      expect(wrapper.find('.message-body').html()).toContain('<strong>bold</strong>')
    })

    it('renders markdown code block', () => {
      const wrapper = mount(MessageBlock, {
        props: { message: mockMessage({ content: '```ts\nconst x = 1\n```' }) },
      })
      expect(wrapper.find('pre.code-block').exists()).toBe(true)
    })

    it('shows typing indicator when isLoading', () => {
      const wrapper = mount(MessageBlock, {
        props: { message: mockMessage(), isLoading: true },
      })
      expect(wrapper.find('.typing-indicator').exists()).toBe(true)
      expect(wrapper.text()).not.toContain('Hello world')
    })

    it('handles array content', () => {
      const wrapper = mount(MessageBlock, {
        props: {
          message: mockMessage({
            content: [
              { type: 'text', content: 'Part 1' },
              { type: 'text', content: 'Part 2' },
            ],
          }),
        },
      })
      expect(wrapper.text()).toContain('Part 1')
      expect(wrapper.text()).toContain('Part 2')
    })
  })

  describe('ThinkBlock', () => {
    it('renders collapsed by default', () => {
      const wrapper = mount(ThinkBlock, {
        props: {
          message: mockMessage({
            type: 'think',
            thinkContent: 'Deep thinking...',
            thinkSummary: 'Thinking about architecture',
          }),
        },
      })
      expect(wrapper.text()).toContain('思考')
      expect(wrapper.text()).toContain('Thinking about architecture')
      // Content hidden by default
      expect(wrapper.find('.think-content').exists()).toBe(false)
    })

    it('expands on header click', async () => {
      const wrapper = mount(ThinkBlock, {
        props: {
          message: mockMessage({
            type: 'think',
            thinkContent: 'Detailed thought process...',
            thinkSummary: 'Summary',
          }),
        },
      })
      await wrapper.find('.think-header').trigger('click')
      expect(wrapper.find('.think-content').exists()).toBe(true)
      expect(wrapper.text()).toContain('Detailed thought process')
    })
  })

  describe('TaskBlock', () => {
    it('renders task list with approve/decline buttons for pending', () => {
      const wrapper = mount(TaskBlock, {
        props: {
          message: mockMessage({
            type: 'task',
            tasks: [
              { id: 't1', title: 'Build UI', status: 'pending', workerRole: 'frontend', description: 'Create components' },
              { id: 't2', title: 'Write API', status: 'running', workerRole: 'backend' },
            ],
          }),
        },
      })
      expect(wrapper.text()).toContain('Build UI')
      expect(wrapper.text()).toContain('Write API')
      expect(wrapper.text()).toContain('frontend')
      expect(wrapper.text()).toContain('backend')
      expect(wrapper.text()).toContain('待处理')
      expect(wrapper.text()).toContain('执行中')
      // Pending task has action buttons
      const buttons = wrapper.findAll('.task-actions .el-button')
      expect(buttons).toHaveLength(2) // confirm + reject for pending task
    })

    it('emits approve event on confirm click', async () => {
      const wrapper = mount(TaskBlock, {
        props: {
          message: mockMessage({
            type: 'task',
            tasks: [{ id: 't1', title: 'Build UI', status: 'pending', workerRole: 'frontend' }],
          }),
        },
      })
      await wrapper.find('.task-actions .el-button').trigger('click')
      expect(wrapper.emitted('approve')).toBeTruthy()
      expect(wrapper.emitted('approve')![0]).toEqual(['t1'])
    })

    it('emits decline event on reject click', async () => {
      const wrapper = mount(TaskBlock, {
        props: {
          message: mockMessage({
            type: 'task',
            tasks: [{ id: 't1', title: 'Build UI', status: 'pending', workerRole: 'frontend' }],
          }),
        },
      })
      const buttons = wrapper.findAll('.task-actions .el-button')
      await buttons[1].trigger('click')
      expect(wrapper.emitted('decline')).toBeTruthy()
      expect(wrapper.emitted('decline')![0]).toEqual(['t1'])
    })

    it('does not show buttons for non-pending tasks', () => {
      const wrapper = mount(TaskBlock, {
        props: {
          message: mockMessage({
            type: 'task',
            tasks: [
              { id: 't1', title: 'Build UI', status: 'approved', workerRole: 'frontend' },
              { id: 't2', title: 'Write API', status: 'completed', workerRole: 'backend' },
            ],
          }),
        },
      })
      expect(wrapper.find('.task-actions').exists()).toBe(false)
      expect(wrapper.text()).toContain('已确认')
      expect(wrapper.text()).toContain('已完成')
    })
  })

  describe('RecommendBlock', () => {
    it('renders options and dismiss button', () => {
      const wrapper = mount(RecommendBlock, {
        props: {
          message: mockMessage({
            type: 'recommend',
            options: [
              { id: 'opt-1', label: 'Option A', prompt: 'Do option A', icon: 'Star' },
              { id: 'opt-2', label: 'Option B', prompt: 'Do option B' },
            ],
          }),
        },
      })
      expect(wrapper.text()).toContain('请选择一个选项')
      expect(wrapper.text()).toContain('Option A')
      expect(wrapper.text()).toContain('Option B')
      expect(wrapper.text()).toContain('Do option A')
    })

    it('emits select event on option click', async () => {
      const wrapper = mount(RecommendBlock, {
        props: {
          message: mockMessage({
            type: 'recommend',
            options: [{ id: 'opt-1', label: 'Option A', prompt: 'Do A' }],
          }),
        },
      })
      await wrapper.find('.option-card').trigger('click')
      expect(wrapper.emitted('select')).toBeTruthy()
      expect(wrapper.emitted('select')![0]).toEqual(['opt-1'])
    })

    it('emits dismiss event on close button click', async () => {
      const wrapper = mount(RecommendBlock, {
        props: {
          message: mockMessage({
            type: 'recommend',
            options: [{ id: 'opt-1', label: 'Option A', prompt: 'Do A' }],
          }),
        },
      })
      await wrapper.find('.dismiss-btn').trigger('click')
      expect(wrapper.emitted('dismiss')).toBeTruthy()
    })
  })

  describe('VersionSwitcher', () => {
    const mockVersions: ChatVersion[] = [
      { id: 'v1', sessionId: 'conv-1', versionNumber: 1, title: '版本 1', isActive: true, createdAt: '2026-01-01T00:00:00Z' },
      { id: 'v2', sessionId: 'conv-1', versionNumber: 2, title: '版本 2', isActive: false, createdAt: '2026-01-02T00:00:00Z' },
    ]

    it('renders current version label', () => {
      const wrapper = mount(VersionSwitcher, {
        props: { versions: mockVersions, currentVersionId: 'v1' },
      })
      expect(wrapper.text()).toContain('版本 1')
    })

    it('shows default label when no currentVersionId', () => {
      const wrapper = mount(VersionSwitcher, {
        props: { versions: mockVersions, currentVersionId: null },
      })
      expect(wrapper.text()).toContain('当前版本')
    })

    it('lists all versions in dropdown', () => {
      const wrapper = mount(VersionSwitcher, {
        props: { versions: mockVersions, currentVersionId: 'v1' },
      })
      expect(wrapper.text()).toContain('版本 1')
      expect(wrapper.text()).toContain('版本 2')
      expect(wrapper.text()).toContain('当前')
      expect(wrapper.text()).toContain('创建新版本')
    })

    it('emits switch event', async () => {
      const wrapper = mount(VersionSwitcher, {
        props: { versions: mockVersions, currentVersionId: 'v1' },
      })
      // Find dropdown item with 'v2' command
      const items = wrapper.findAll('.el-dropdown-item')
      // The second item (index 1) should correspond to v2
      await items[1].trigger('click')
      expect(wrapper.emitted('switch')).toBeTruthy()
      expect(wrapper.emitted('switch')![0]).toEqual(['v2'])
    })

    it('emits create event for new version', async () => {
      const wrapper = mount(VersionSwitcher, {
        props: { versions: mockVersions, currentVersionId: 'v1' },
      })
      const items = wrapper.findAll('.el-dropdown-item')
      // Last item is "create new version"
      await items[items.length - 1].trigger('click')
      expect(wrapper.emitted('create')).toBeTruthy()
    })
  })
})

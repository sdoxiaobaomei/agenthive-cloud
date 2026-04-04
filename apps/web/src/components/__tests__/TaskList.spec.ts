import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import TaskList from '../agent/TaskList.vue'
import type { Task } from '@/types'

const mockTasks: Task[] = [
  { id: 't1', title: 'Task One', type: 'feature', status: 'pending', priority: 'high', assignedTo: 'Frontend Dev', createdAt: new Date().toISOString(), progress: 0, input: {} },
  { id: 't2', title: 'Task Two', type: 'feature', status: 'completed', priority: 'low', assignedTo: 'Backend Dev', createdAt: new Date().toISOString(), progress: 100, input: {} },
]

describe('TaskList', () => {
  it('应该渲染任务列表', () => {
    const wrapper = mount(TaskList, {
      props: { tasks: mockTasks },
    })
    expect(wrapper.find('.el-table').exists()).toBe(true)
  })

  it('应该支持搜索过滤', async () => {
    const wrapper = mount(TaskList, {
      props: { tasks: mockTasks },
    })
    const input = wrapper.find('.el-input__inner')
    await input.setValue('One')
    expect(wrapper.findAll('.task-title').length).toBe(1)
    expect(wrapper.find('.task-title').text()).toBe('Task One')
  })
})

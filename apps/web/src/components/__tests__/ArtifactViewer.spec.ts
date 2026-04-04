import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ArtifactViewer from '../agent/ArtifactViewer.vue'

describe('ArtifactViewer', () => {
  it('应该渲染文档名称和类型标签', () => {
    const wrapper = mount(ArtifactViewer, {
      props: { artifact: { id: '1', name: 'PRD Doc', type: 'prd', status: 'ready', content: 'Requirements' } },
    })
    expect(wrapper.find('.artifact-name').text()).toBe('PRD Doc')
    expect(wrapper.text()).toContain('已完成')
  })

  it('应该显示内容或空状态', () => {
    const wrapper = mount(ArtifactViewer, {
      props: { artifact: { id: '2', name: 'Empty', type: 'code', status: 'pending' } },
    })
    expect(wrapper.find('.content-placeholder').exists()).toBe(true)
  })
})

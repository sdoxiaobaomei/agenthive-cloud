// Agent 列表 API
export default defineEventHandler(async (event) => {
  const agents = [
    {
      id: 'agent-1',
      name: '小花 (Frontend Dev)',
      description: 'Vue 3, Nuxt 3, TypeScript 专家',
      type: 'frontend',
      status: 'idle',
      config: {},
      createdAt: '2026-04-01T00:00:00Z',
      updatedAt: '2026-04-06T00:00:00Z',
    },
    {
      id: 'agent-2',
      name: '阿铁 (Backend Dev)',
      description: 'Node.js, REST API, 数据库专家',
      type: 'backend',
      status: 'running',
      config: {},
      createdAt: '2026-04-01T00:00:00Z',
      updatedAt: '2026-04-06T00:00:00Z',
    },
    {
      id: 'agent-3',
      name: '阿镜 (QA Engineer)',
      description: '代码审查, 测试设计, Bug 发现',
      type: 'qa',
      status: 'idle',
      config: {},
      createdAt: '2026-04-01T00:00:00Z',
      updatedAt: '2026-04-05T00:00:00Z',
    },
  ]

  return {
    success: true,
    data: {
      items: agents,
      total: agents.length,
      page: 1,
      pageSize: 10,
      totalPages: 1,
    },
  }
})

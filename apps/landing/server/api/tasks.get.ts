// 任务列表 API
export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  
  const tasks = [
    {
      id: '1',
      title: '设计首页 UI',
      description: '完成 landing page 的视觉设计',
      status: 'completed',
      priority: 'high',
      agentId: 'agent-1',
      tags: ['ui', 'design'],
      createdAt: '2026-04-01T00:00:00Z',
      updatedAt: '2026-04-03T00:00:00Z',
    },
    {
      id: '2',
      title: '实现登录功能',
      description: '集成短信验证码登录',
      status: 'running',
      priority: 'urgent',
      agentId: 'agent-2',
      tags: ['auth', 'backend'],
      createdAt: '2026-04-02T00:00:00Z',
      updatedAt: '2026-04-06T00:00:00Z',
    },
    {
      id: '3',
      title: '编写 API 文档',
      description: '完善 Swagger 文档',
      status: 'pending',
      priority: 'medium',
      agentId: null,
      tags: ['docs'],
      createdAt: '2026-04-05T00:00:00Z',
      updatedAt: '2026-04-05T00:00:00Z',
    },
  ]

  return {
    success: true,
    data: {
      items: tasks,
      total: tasks.length,
      page: 1,
      pageSize: 10,
      totalPages: 1,
    },
  }
})

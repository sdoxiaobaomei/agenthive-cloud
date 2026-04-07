// 项目列表 API
export default defineEventHandler(async (event) => {
  // 模拟项目数据
  const projects = [
    {
      id: '1',
      name: '任务管理系统',
      description: '支持拖拽排序和团队协作的任务管理应用',
      status: 'active',
      ownerId: 'user-1',
      memberCount: 3,
      taskCount: 12,
      createdAt: '2026-04-01T00:00:00Z',
      updatedAt: '2026-04-06T00:00:00Z',
    },
    {
      id: '2',
      name: '个人博客',
      description: '基于 Markdown 的简洁博客系统',
      status: 'active',
      ownerId: 'user-1',
      memberCount: 1,
      taskCount: 5,
      createdAt: '2026-04-02T00:00:00Z',
      updatedAt: '2026-04-05T00:00:00Z',
    },
    {
      id: '3',
      name: '电商数据看板',
      description: '销售趋势和库存预警分析面板',
      status: 'active',
      ownerId: 'user-1',
      memberCount: 2,
      taskCount: 8,
      createdAt: '2026-04-03T00:00:00Z',
      updatedAt: '2026-04-04T00:00:00Z',
    },
  ]

  return {
    success: true,
    data: {
      items: projects,
      total: projects.length,
      page: 1,
      pageSize: 10,
      totalPages: 1,
    },
  }
})

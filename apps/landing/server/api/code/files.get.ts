// 文件列表 API
export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const path = (query.path as string) || ''

  // 模拟文件系统数据
  const rootFiles = [
    {
      name: 'src',
      path: 'src',
      type: 'directory',
      modifiedAt: '2026-04-06T10:00:00Z',
      children: [
        {
          name: 'components',
          path: 'src/components',
          type: 'directory',
          modifiedAt: '2026-04-06T10:00:00Z',
          children: [
            { name: 'Button.vue', path: 'src/components/Button.vue', type: 'file', size: 1024, modifiedAt: '2026-04-06T10:00:00Z' },
            { name: 'Input.vue', path: 'src/components/Input.vue', type: 'file', size: 2048, modifiedAt: '2026-04-06T09:00:00Z' },
          ]
        },
        {
          name: 'pages',
          path: 'src/pages',
          type: 'directory',
          modifiedAt: '2026-04-06T10:00:00Z',
          children: [
            { name: 'index.vue', path: 'src/pages/index.vue', type: 'file', size: 4096, modifiedAt: '2026-04-06T08:00:00Z' },
            { name: 'about.vue', path: 'src/pages/about.vue', type: 'file', size: 2048, modifiedAt: '2026-04-05T10:00:00Z' },
          ]
        },
        { name: 'App.vue', path: 'src/App.vue', type: 'file', size: 512, modifiedAt: '2026-04-06T10:00:00Z' },
        { name: 'main.ts', path: 'src/main.ts', type: 'file', size: 256, modifiedAt: '2026-04-06T09:00:00Z' },
      ]
    },
    {
      name: 'package.json',
      path: 'package.json',
      type: 'file',
      size: 1024,
      modifiedAt: '2026-04-01T10:00:00Z',
    },
    {
      name: 'README.md',
      path: 'README.md',
      type: 'file',
      size: 2048,
      modifiedAt: '2026-04-01T09:00:00Z',
    },
  ]

  // 根据路径返回对应内容
  if (!path) {
    return { success: true, data: rootFiles }
  }

  // 查找子目录
  const findPath = (items: any[], targetPath: string): any[] => {
    for (const item of items) {
      if (item.path === targetPath) {
        return item.children || []
      }
      if (item.children) {
        const found = findPath(item.children, targetPath)
        if (found.length > 0) return found
      }
    }
    return []
  }

  const result = findPath(rootFiles, path)
  return { success: true, data: result }
})

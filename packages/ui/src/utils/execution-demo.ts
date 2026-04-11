import type { ExecutionPlan } from '@agenthive/types'

/**
 * 示例 Plan：为 Workspace 增加执行控制台入口
 * 用于开发阶段快速初始化 ExecutionSession
 */

export const demoPlan: ExecutionPlan = {
  id: 'plan-demo',
  name: '为 Workspace 增加 Execution HUD 入口',
  summary: '在 agenthive-cloud 的 Workspace 页面中新增 ExecutionBoard 组件入口，并调整路由结构',
  notes: '注意 base URL 为 /app/，所有新增路由需配置在 router 中',
  createdAt: new Date().toISOString(),
  tickets: [
    {
      id: 'T-001',
      role: 'frontend_dev',
      task: '新增 ExecutionBoard.vue 组件骨架',
      status: 'pending',
      order: 0,
      context: {
        relevant_files: [
          'apps/apps/web/src/views/Workspace.vue',
          'apps/apps/web/src/components/execution/ExecutionBoard.vue',
        ],
        constraints: ['使用 Element Plus 组件', '保持暗色主题兼容'],
      },
      createdAt: new Date().toISOString(),
    },
    {
      id: 'T-002',
      role: 'frontend_dev',
      task: '新增 Execution 相关类型定义与 Store',
      status: 'pending',
      order: 0,
      context: {
        relevant_files: [
          'apps/apps/web/src/types/execution.ts',
          'apps/apps/web/src/stores/execution.ts',
        ],
        constraints: ['类型必须与 agents/orchestrator.ts 对齐'],
      },
      createdAt: new Date().toISOString(),
    },
    {
      id: 'T-003',
      role: 'frontend_dev',
      task: '在 Workspace Overview 中嵌入 ExecutionBoard',
      status: 'pending',
      order: 0,
      context: {
        relevant_files: [
          'apps/apps/web/src/views/Workspace.vue',
          'apps/apps/web/src/views/Dashboard.vue',
        ],
        constraints: ['不破坏现有的 Overview/Studio 切换逻辑'],
        depends_on: ['T-001'],
      },
      createdAt: new Date().toISOString(),
    },
    {
      id: 'TQA-001',
      role: 'qa_engineer',
      task: '审查本次前端改动',
      status: 'pending',
      order: 0,
      context: {
        constraints: ['运行 type-check', '运行 test:unit', '检查是否有 base URL 错误'],
        depends_on: ['T-002', 'T-003'],
      },
      createdAt: new Date().toISOString(),
    },
  ],
}

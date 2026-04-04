import { Router } from 'express'

const router = Router()

router.get('/plan', (_req, res) => {
  res.json({
    id: 'demo-plan-1',
    name: '示例 SaaS 项目',
    summary: '一个带会员系统的博客平台',
    tickets: [
      { id: 'T-001', role: 'frontend_dev', task: '设计登录页面', status: 'done' },
      { id: 'T-002', role: 'backend_dev', task: '搭建用户 API', status: 'doing' },
      { id: 'T-003', role: 'qa_engineer', task: '编写测试用例', status: 'pending' },
    ],
  })
})

router.get('/agents', (_req, res) => {
  res.json([
    { id: 'a1', name: '阿黄', role: 'orchestrator', status: 'idle' },
    { id: 'a2', name: '小花', role: 'frontend_dev', status: 'working' },
    { id: 'a3', name: '阿铁', role: 'backend_dev', status: 'working' },
    { id: 'a4', name: '阿镜', role: 'qa_engineer', status: 'idle' },
  ])
})

export default router

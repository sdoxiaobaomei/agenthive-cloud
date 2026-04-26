// Demo 路由 - 示例数据
import { Router } from 'express'
import { agentDb, taskDb, delay } from '../utils/database.js'

const router = Router()

// 获取示例计划
router.get('/plan', async (_req, res) => {
  await delay(200)
  
  res.json({ code: 200, message: 'success', data: {
      id: 'demo-plan-1',
      name: '示例 SaaS 项目',
      summary: '一个带会员系统的博客平台',
      tickets: [
        { id: 'T-001', role: 'frontend_dev', task: '设计登录页面', status: 'done' },
        { id: 'T-002', role: 'backend_dev', task: '搭建用户 API', status: 'doing' },
        { id: 'T-003', role: 'qa_engineer', task: '编写测试用例', status: 'pending' },
      ],
    },
  })
})

// 获取示例 Agents
router.get('/agents', async (_req, res) => {
  await delay(200)
  
  const agents = agentDb.findAll()
  
  res.json({ code: 200, message: 'success', data: agents,
  })
})

// 获取示例任务
router.get('/tasks', async (_req, res) => {
  await delay(200)
  
  const tasks = taskDb.findAll()
  
  res.json({ code: 200, message: 'success', data: tasks,
  })
})

// 访客状态
router.get('/visitor-status', async (_req, res) => {
  await delay(200)
  
  res.json({ code: 200, message: 'success', data: {
      visitorId: `visitor-${Date.now()}`,
      mode: 'visitor',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    },
  })
})

export default router

// 路由配置
import { Router } from 'express'
import authRoutes from './auth.js'
import agentRoutes from './agents.js'
import taskRoutes from './tasks.js'
import codeRoutes from './code.js'
import demoRoutes from './demo.js'

const router = Router()

// 健康检查
router.get('/health', (_req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() })
})

// 各模块路由
router.use('/auth', authRoutes)
router.use('/agents', agentRoutes)
router.use('/tasks', taskRoutes)
router.use('/code', codeRoutes)
router.use('/demo', demoRoutes)

export default router

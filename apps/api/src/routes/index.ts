// 路由配置
import { Router } from 'express'
import agentRoutes from './agents.js'
import taskRoutes from './tasks.js'
import codeRoutes from './code.js'
import demoRoutes from './demo.js'
import projectRoutes from '../project/routes.js'
import chatRoutes from '../chat-controller/routes.js'
import { pool } from '../config/database.js'
import redis from '../config/redis.js'
import { checkLLMConnection } from '../services/llm.js'
import logger from '../utils/logger.js'

const router = Router()

// 健康检查 - 返回完整系统状态
router.get('/health', async (_req, res) => {
  try {
    const checks = await Promise.allSettled([
      pool.query('SELECT NOW()'),
      redis.ping(),
      checkLLMConnection(),
    ])

    const dbCheck = checks[0] as PromiseSettledResult<{ rows: Array<{ now: string }> }>
    const redisCheck = checks[1] as PromiseSettledResult<string>
    const llmCheck = checks[2] as PromiseSettledResult<{ ok: boolean; provider: string; models?: string[]; error?: string }>

    const dbHealthy = dbCheck.status === 'fulfilled'
    const redisHealthy = redisCheck.status === 'fulfilled' && redisCheck.value === 'PONG'
    const llmResult = llmCheck.status === 'fulfilled' ? llmCheck.value : { ok: false, error: 'Check failed' }

    const allHealthy = dbHealthy && redisHealthy

    res.status(allHealthy ? 200 : 503).json({
      ok: allHealthy,
      timestamp: new Date().toISOString(),
      services: {
        database: { ok: dbHealthy, latencyMs: dbHealthy ? 0 : undefined },
        redis: { ok: redisHealthy },
        llm: { ok: llmResult.ok, provider: (llmResult as any).provider, error: llmResult.error },
      },
    })
  } catch (error) {
    logger.error('Health check failed', error instanceof Error ? error : undefined)
    res.status(503).json({ ok: false, error: 'Health check failed' })
  }
})

// 各模块路由
router.use('/agents', agentRoutes)
router.use('/tasks', taskRoutes)
router.use('/code', codeRoutes)
router.use('/demo', demoRoutes)
router.use('/projects', projectRoutes)
router.use('/chat', chatRoutes)

export default router

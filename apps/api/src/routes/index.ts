// 路由配置
import { Router } from 'express'
import agentRoutes from './agents.js'
import taskRoutes from './tasks.js'
import codeRoutes from './code.js'
import demoRoutes from './demo.js'
import projectRoutes from '../project/routes.js'
import chatRoutes from '../chat-controller/routes.js'
import creditsRoutes from './credits.js'
import authRoutes from './auth.js'
import { pool } from '../config/database.js'
import redis from '../config/redis.js'
import { checkLLMConnection } from '../services/llm.js'
import logger from '../utils/logger.js'

const router = Router()

/**
 * @openapi
 * /api/health:
 *   get:
 *     summary: 健康检查
 *     description: 返回 API 服务器及依赖服务（数据库、Redis、LLM）的健康状态
 *     tags:
 *       - System
 *     responses:
 *       200:
 *         description: 所有服务健康
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: integer
 *                   example: 200
 *                 message:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     ok:
 *                       type: boolean
 *                     timestamp:
 *                       type: string
 *                     services:
 *                       type: object
 *       503:
 *         description: 部分服务不可用
 */
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
    const llmResult = llmCheck.status === 'fulfilled' ? llmCheck.value : { ok: false, message: 'Check failed' , data: null }

    const allHealthy = dbHealthy && redisHealthy

    res.status(allHealthy ? 200 : 503).json({
      ok: allHealthy,
      timestamp: new Date().toISOString(),
      services: {
        database: { ok: dbHealthy, latencyMs: dbHealthy ? 0 : undefined },
        redis: { ok: redisHealthy },
        llm: { ok: llmResult.ok, provider: (llmResult as any).provider, error: (llmResult as any).error },
      },
    })
  } catch (error) {
    logger.error('Health check failed', error instanceof Error ? error : undefined)
    res.status(503).json({ ok: false, message: 'Health check failed', data: null })
  }
})

// 各模块路由
router.use('/agents', agentRoutes)
router.use('/tasks', taskRoutes)
router.use('/code', codeRoutes)
router.use('/demo', demoRoutes)
router.use('/projects', projectRoutes)
router.use('/chat', chatRoutes)
router.use('/credits', creditsRoutes)
router.use('/auth', authRoutes)

export default router

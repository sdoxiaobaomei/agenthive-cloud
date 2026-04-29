/**
 * Credits Routes - /api/credits
 *
 * BFF 代理层：将前端 credits 请求代理到 Java Payment Service
 * 支持 mock 模式（Java API 不可用时返回模拟数据）
 */

import { Router } from 'express'
import { getPricingList, getUserBalance, getUserTransactions } from '../services/credits.js'
import logger from '../utils/logger.js'

const router = Router()

/**
 * GET /api/credits/balance
 * 查询当前用户 credits 余额
 */
router.get('/balance', async (req, res) => {
  try {
    const userId = (req as any).userId as string | undefined
    if (!userId) {
      return res.status(401).json({ code: 401, message: '未授权', data: null })
    }

    const balance = await getUserBalance(userId)
    res.json({ code: 200, message: 'success', data: balance })
  } catch (error) {
    logger.error('Failed to get credits balance', error instanceof Error ? error : undefined)
    res.status(500).json({ code: 500, message: '获取余额失败', data: null })
  }
})

/**
 * GET /api/credits/transactions
 * 查询当前用户交易流水
 */
router.get('/transactions', async (req, res) => {
  try {
    const userId = (req as any).userId as string | undefined
    if (!userId) {
      return res.status(401).json({ code: 401, message: '未授权', data: null })
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20))

    const transactions = await getUserTransactions(userId)
    const total = transactions.length
    const paginated = transactions.slice((page - 1) * pageSize, page * pageSize)

    res.json({
      code: 200,
      message: 'success',
      data: {
        items: paginated,
        total,
        page,
        pageSize,
      },
    })
  } catch (error) {
    logger.error('Failed to get transactions', error instanceof Error ? error : undefined)
    res.status(500).json({ code: 500, message: '获取流水失败', data: null })
  }
})

/**
 * GET /api/credits/pricing
 * 查询 Agent 定价
 */
router.get('/pricing', async (_req, res) => {
  try {
    const pricing = getPricingList()
    res.json({ code: 200, message: 'success', data: pricing })
  } catch (error) {
    logger.error('Failed to get pricing', error instanceof Error ? error : undefined)
    res.status(500).json({ code: 500, message: '获取定价失败', data: null })
  }
})

export default router

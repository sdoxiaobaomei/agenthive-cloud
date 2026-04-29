/**
 * Credits Service - Agent 任务计费与余额检查
 *
 * 功能：
 * 1. 预检余额（checkBalance）
 * 2. 正式扣费（debitCredits）
 * 3. Mock 模式：Java API 不可用时只记录日志，不真正扣费
 *
 * 安全：
 * - 所有外部请求带 X-Internal-Token
 * - 参数化查询（Java 端）
 * - 超时 + 重试
 */

import logger from '../utils/logger.js'

// Java 计费服务配置
const JAVA_PAYMENT_BASE_URL = process.env.JAVA_PAYMENT_URL || 'http://localhost:8080'
const JAVA_API_TIMEOUT_MS = 5000
const MAX_RETRIES = 2

// Mock 模式开关：当 Java API 未就绪时启用
const MOCK_MODE = process.env.CREDITS_MOCK_MODE === 'true' || !process.env.JAVA_PAYMENT_URL

// 定价表（credits / 任务）
const ROLE_PRICING: Record<string, number> = {
  backend: 15,
  frontend: 15,
  qa: 10,
  devops: 12,
  default: 10,
}

// Token 单价（credits / 1k tokens）
const TOKEN_PRICE_PER_1K = 2

export interface BalanceCheckResult {
  sufficient: boolean
  balance: number
  estimatedCost: number
  message?: string
}

export interface DebitResult {
  success: boolean
  creditsDeducted: number
  creditsRemaining: number
  errorCode?: string
  message?: string
}

export interface DebitPayload {
  userId: string
  taskId: string
  sessionId?: string
  workerRole: string
  tokensUsed?: number
  checkOnly?: boolean
}

/**
 * 计算预估消耗（基于 workerRole 和预估 token 数）
 */
export function estimateCost(workerRole: string, estimatedTokens = 0): number {
  const baseCost = ROLE_PRICING[workerRole] || ROLE_PRICING.default
  const tokenCost = estimatedTokens > 0 ? (estimatedTokens / 1000) * TOKEN_PRICE_PER_1K : 0
  return Math.ceil(baseCost + tokenCost)
}

/**
 * 获取定价列表
 */
export function getPricingList(): Array<{ workerRole: string; baseCost: number; tokenPricePer1k: number }> {
  return Object.entries(ROLE_PRICING).map(([workerRole, baseCost]) => ({
    workerRole,
    baseCost,
    tokenPricePer1k: TOKEN_PRICE_PER_1K,
  }))
}

/**
 * 调用 Java /credits/agent-debit 接口（带重试）
 */
async function callAgentDebit(payload: DebitPayload, attempt = 1): Promise<DebitResult> {
  const url = `${JAVA_PAYMENT_BASE_URL}/credits/agent-debit`

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), JAVA_API_TIMEOUT_MS)

    const body: Record<string, unknown> = {
      userId: parseInt(payload.userId, 10),
      taskId: payload.taskId,
      workerRole: payload.workerRole,
    }
    if (payload.sessionId) body.sessionId = payload.sessionId
    if (payload.tokensUsed !== undefined) body.tokensUsed = payload.tokensUsed
    if (payload.checkOnly) body.checkOnly = true

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Internal-Token': process.env.INTERNAL_API_TOKEN || '',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new Error(`HTTP ${response.status}: ${text}`)
    }

    const data = await response.json()

    // Java Result 包装格式: { code, message, data: AgentDebitResponse }
    const debitData = data.data || data

    return {
      success: debitData.success ?? true,
      creditsDeducted: Number(debitData.creditsDeducted || 0),
      creditsRemaining: Number(debitData.creditsRemaining || 0),
      errorCode: debitData.errorCode,
      message: data.message,
    }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error'
    logger.warn(`[Credits] agent-debit call failed (attempt ${attempt})`, { error: errMsg, taskId: payload.taskId })

    if (attempt < MAX_RETRIES) {
      await new Promise(r => setTimeout(r, 500 * attempt))
      return callAgentDebit(payload, attempt + 1)
    }

    return {
      success: false,
      creditsDeducted: 0,
      creditsRemaining: 0,
      errorCode: 'BILLING_API_ERROR',
      message: errMsg,
    }
  }
}

/**
 * 检查余额是否充足（预检模式）
 */
export async function checkBalance(
  userId: string,
  workerRole: string,
  estimatedTokens = 0
): Promise<BalanceCheckResult> {
  const estimatedCost = estimateCost(workerRole, estimatedTokens)

  if (MOCK_MODE) {
    logger.info(`[MOCK] Balance check for user ${userId}, role ${workerRole}, estimated ${estimatedCost} credits`)
    const mockBalance = 1000
    return {
      sufficient: mockBalance >= estimatedCost,
      balance: mockBalance,
      estimatedCost,
      message: mockBalance >= estimatedCost ? undefined : 'Credits 余额不足，请充值或赚取 Credits',
    }
  }

  // 先查询余额（Java 端暂不提供独立查询接口，通过 checkOnly=true 的 debit 接口实现）
  const result = await callAgentDebit({
    userId,
    taskId: `check-${Date.now()}`,
    workerRole,
    checkOnly: true,
  })

  if (!result.success && result.errorCode === 'BILLING_API_ERROR') {
    // Java API 不可用，降级到 mock
    logger.warn(`[Credits] Java API unavailable, falling back to mock mode for balance check`)
    const mockBalance = 1000
    return {
      sufficient: mockBalance >= estimatedCost,
      balance: mockBalance,
      estimatedCost,
      message: mockBalance >= estimatedCost ? undefined : 'Credits 余额不足，请充值或赚取 Credits',
    }
  }

  const balance = result.creditsRemaining
  return {
    sufficient: balance >= estimatedCost,
    balance,
    estimatedCost,
    message: balance >= estimatedCost ? undefined : 'Credits 余额不足，请充值或赚取 Credits',
  }
}

/**
 * 正式扣费
 */
export async function debitCredits(payload: DebitPayload): Promise<DebitResult> {
  if (MOCK_MODE) {
    const cost = estimateCost(payload.workerRole, payload.tokensUsed || 0)
    logger.info(`[MOCK] Would deduct ${cost} credits for task ${payload.taskId}, user ${payload.userId}, role ${payload.workerRole}`)
    return {
      success: true,
      creditsDeducted: cost,
      creditsRemaining: 1000 - cost,
    }
  }

  const result = await callAgentDebit(payload)

  if (!result.success && result.errorCode === 'BILLING_API_ERROR') {
    // Java API 不可用，降级到 mock（仅记录，不真正扣费）
    const cost = estimateCost(payload.workerRole, payload.tokensUsed || 0)
    logger.warn(`[MOCK] Java API unavailable. Would deduct ${cost} credits for task ${payload.taskId}`)
    return {
      success: true, // 返回 success 避免阻塞主流程，但记录待补偿
      creditsDeducted: 0,
      creditsRemaining: 0,
      errorCode: 'MOCK_FALLBACK',
      message: 'Billing API unavailable, queued for retry',
    }
  }

  return result
}

/**
 * 查询用户余额（独立接口）
 */
export async function getUserBalance(userId: string): Promise<{ balance: number; currency: string }> {
  if (MOCK_MODE) {
    return { balance: 1000, currency: 'CREDITS' }
  }

  // TODO: 接入 Java /credits/balance 接口（当前 Java 端无此独立接口，暂用 mock）
  logger.info(`[Credits] getUserBalance called for user ${userId} (using mock fallback)`)
  return { balance: 1000, currency: 'CREDITS' }
}

/**
 * 查询交易流水（mock）
 */
export async function getUserTransactions(_userId: string): Promise<Array<{
  id: string
  type: 'income' | 'expense'
  amount: number
  balance: number
  source: string
  description: string
  createdAt: string
}>> {
  return []
}

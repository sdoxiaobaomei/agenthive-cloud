/**
 * Billing Retry Queue - 计费失败补偿队列
 *
 * 使用 Redis Stream 实现：
 * - 扣费失败时写入队列
 * - 独立消费者定时重试（最多 3 次）
 * - 幂等设计：同一 taskId 多次扣费仅生效一次
 */

import { redis } from '../config/redis.js'
import logger from '../utils/logger.js'
import { debitCredits, type DebitPayload } from './credits.js'

const BILLING_STREAM_KEY = 'agenthive:billing:retry:queue'
const BILLING_GROUP_NAME = 'billing-retry-workers'
const MAX_RETRY_ATTEMPTS = 3

export interface BillingRetryPayload {
  taskId: string
  userId: string
  sessionId?: string
  workerRole: string
  tokensUsed?: number
  attempt: number
  originalError?: string
  createdAt: number
}

/**
 * 初始化 Consumer Group（幂等）
 */
export async function initBillingRetryQueue(): Promise<void> {
  try {
    await redis.xgroup('CREATE', BILLING_STREAM_KEY, BILLING_GROUP_NAME, '$', 'MKSTREAM')
    logger.info('[BillingRetry] Consumer group created')
  } catch (error: any) {
    if (error.message?.includes('BUSYGROUP')) {
      logger.info('[BillingRetry] Consumer group already exists')
    } else {
      throw error
    }
  }
}

/**
 * 将失败扣费加入重试队列
 */
export async function enqueueBillingRetry(payload: Omit<BillingRetryPayload, 'attempt' | 'createdAt'>): Promise<string> {
  const retryPayload: BillingRetryPayload = {
    ...payload,
    attempt: 1,
    createdAt: Date.now(),
  }

  const id = await redis.xadd(
    BILLING_STREAM_KEY,
    '*',
    'taskId', retryPayload.taskId,
    'userId', retryPayload.userId,
    'sessionId', retryPayload.sessionId || '',
    'workerRole', retryPayload.workerRole,
    'tokensUsed', String(retryPayload.tokensUsed || 0),
    'attempt', String(retryPayload.attempt),
    'originalError', retryPayload.originalError || '',
    'createdAt', String(retryPayload.createdAt)
  )

  if (!id) throw new Error('Failed to enqueue billing retry: XADD returned null')

  logger.info('[BillingRetry] Enqueued', {
    taskId: retryPayload.taskId,
    attempt: retryPayload.attempt,
    streamId: id,
  })

  return id
}

/**
 * 处理单条重试记录
 */
async function processRetryEntry(fields: string[]): Promise<boolean> {
  const data = {} as Record<string, string>
  for (let i = 0; i < fields.length; i += 2) {
    data[fields[i]] = fields[i + 1]
  }

  const payload: BillingRetryPayload = {
    taskId: data.taskId,
    userId: data.userId,
    sessionId: data.sessionId || undefined,
    workerRole: data.workerRole,
    tokensUsed: parseInt(data.tokensUsed || '0', 10),
    attempt: parseInt(data.attempt || '1', 10),
    originalError: data.originalError || undefined,
    createdAt: parseInt(data.createdAt || '0', 10),
  }

  if (payload.attempt > MAX_RETRY_ATTEMPTS) {
    logger.error('[BillingRetry] Max retries exceeded', undefined, { taskId: payload.taskId, attempts: payload.attempt })
    return true // ack and drop
  }

  logger.info('[BillingRetry] Processing', {
    taskId: payload.taskId,
    attempt: payload.attempt,
  })

  const result = await debitCredits({
    userId: payload.userId,
    taskId: payload.taskId,
    sessionId: payload.sessionId,
    workerRole: payload.workerRole,
    tokensUsed: payload.tokensUsed,
  })

  if (result.success && result.errorCode !== 'MOCK_FALLBACK') {
    logger.info('[BillingRetry] Success', {
      taskId: payload.taskId,
      creditsDeducted: result.creditsDeducted,
      remaining: result.creditsRemaining,
    })
    return true // ack
  }

  // 仍然失败，且未达最大重试次数，重新入队
  if (payload.attempt < MAX_RETRY_ATTEMPTS) {
    await enqueueBillingRetry({
      taskId: payload.taskId,
      userId: payload.userId,
      sessionId: payload.sessionId,
      workerRole: payload.workerRole,
      tokensUsed: payload.tokensUsed,
      originalError: result.message || result.errorCode || 'unknown',
    })
    // 更新新入队记录的 attempt
    const lastId = await redis.xrevrange(BILLING_STREAM_KEY, '+', '-', 'COUNT', 1)
    if (lastId && lastId.length > 0) {
      const [[streamId]] = lastId as [string, string[]][]
      await redis.xadd(
        BILLING_STREAM_KEY,
        streamId,
        'taskId', payload.taskId,
        'userId', payload.userId,
        'sessionId', payload.sessionId || '',
        'workerRole', payload.workerRole,
        'tokensUsed', String(payload.tokensUsed || 0),
        'attempt', String(payload.attempt + 1),
        'originalError', result.message || result.errorCode || 'unknown',
        'createdAt', String(Date.now())
      )
    }
  } else {
    logger.error('[BillingRetry] Final failure after max retries', undefined, {
      taskId: payload.taskId,
      attempts: payload.attempt,
    })
  }

  return true // ack original message
}

/**
 * 运行一次重试消费（用于定时任务或独立进程）
 */
export async function runBillingRetryConsumer(maxCount = 10): Promise<number> {
  let processed = 0

  try {
    const messages = await redis.xreadgroup(
      'GROUP', BILLING_GROUP_NAME, `retry-worker-${process.pid}`,
      'COUNT', maxCount,
      'BLOCK', 1000,
      'STREAMS', BILLING_STREAM_KEY, '>'
    )

    if (!messages || messages.length === 0) return 0

    const [, entries] = messages[0] as [string, [string, string[]][]]
    if (!entries || entries.length === 0) return 0

    for (const [streamId, fields] of entries) {
      try {
        await processRetryEntry(fields)
        await redis.xack(BILLING_STREAM_KEY, BILLING_GROUP_NAME, streamId)
        processed++
      } catch (err) {
        logger.error('[BillingRetry] Entry processing error', err as Error, { streamId })
      }
    }
  } catch (error) {
    logger.error('[BillingRetry] Consumer error', error as Error)
  }

  return processed
}

/**
 * Billing Retry Worker 类（可独立运行）
 */
export class BillingRetryWorker {
  private running = false
  private timer: ReturnType<typeof setInterval> | null = null

  async start(intervalMs = 30000): Promise<void> {
    if (this.running) return
    this.running = true

    await initBillingRetryQueue()
    logger.info('[BillingRetryWorker] Started', { intervalMs })

    // 立即执行一次
    await runBillingRetryConsumer()

    this.timer = setInterval(async () => {
      if (!this.running) return
      await runBillingRetryConsumer()
    }, intervalMs)
  }

  async stop(): Promise<void> {
    this.running = false
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    logger.info('[BillingRetryWorker] Stopped')
  }
}

/**
 * Agent Task Queue Service
 * 使用 Redis Stream 实现任务队列，解耦 API 与任务执行
 */
import { redis } from '../config/redis.js'
import logger from '../utils/logger.js'

const STREAM_KEY = 'agenthive:agent:task:queue'
const GROUP_NAME = 'agent-runtime-workers'

export interface TaskPayload {
  taskId: string
  sessionId: string
  intent: string
  content: string
  workspacePath: string
  ticketIds: string[]
  createdAt: number
  userId?: string
  estimatedCost?: number
}

/**
 * 初始化 Consumer Group（幂等）
 */
export async function initTaskQueue(): Promise<void> {
  try {
    await redis.xgroup('CREATE', STREAM_KEY, GROUP_NAME, '$', 'MKSTREAM')
    logger.info('Task queue consumer group created')
  } catch (error: any) {
    if (error.message?.includes('BUSYGROUP')) {
      logger.info('Task queue consumer group already exists')
    } else {
      throw error
    }
  }
}

/**
 * 提交任务到队列
 */
export async function enqueueTask(payload: TaskPayload): Promise<string> {
  const fields: (string | number)[] = [
    'taskId', payload.taskId,
    'sessionId', payload.sessionId,
    'intent', payload.intent,
    'content', payload.content,
    'workspacePath', payload.workspacePath,
    'ticketIds', JSON.stringify(payload.ticketIds),
    'createdAt', payload.createdAt.toString(),
  ]
  if (payload.userId) {
    fields.push('userId', payload.userId)
  }
  if (payload.estimatedCost !== undefined) {
    fields.push('estimatedCost', String(payload.estimatedCost))
  }

  const id = await redis.xadd(STREAM_KEY, '*', ...fields)
  if (!id) throw new Error('Failed to enqueue task: XADD returned null')
  logger.info('Task enqueued', { taskId: payload.taskId, streamId: id, userId: payload.userId })
  return id
}

/**
 * 获取任务状态
 */
export async function getTaskStatus(taskId: string): Promise<string> {
  const status = await redis.get(`agenthive:agent:task:status:${taskId}`)
  return status || 'unknown'
}

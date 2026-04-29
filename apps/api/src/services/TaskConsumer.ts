/**
 * Agent Runtime Task Consumer
 * 独立进程消费 Redis Stream 队列，执行 Orchestrator 任务
 */
import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'
import { redis, redisPub } from '../config/redis.js'
import { pool } from '../config/database.js'
import { key } from '../config/redis.js'
import logger from '../utils/logger.js'
import { debitCredits } from './credits.js'
import { enqueueBillingRetry } from './billingRetry.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const STREAM_KEY = 'agenthive:agent:task:queue'
const GROUP_NAME = 'agent-runtime-workers'
const ORCHESTRATOR_PATH = path.resolve(__dirname, '../../../../AGENTS/orchestrator.ts')

interface TaskFields {
  taskId: string
  sessionId: string
  intent: string
  content: string
  workspacePath: string
  ticketIds: string
  createdAt: string
  userId?: string
  estimatedCost?: string
}

export class TaskConsumer {
  private running = false
  private consumerName = `worker-${process.pid}`
  private currentChild: ReturnType<typeof spawn> | null = null

  async start(): Promise<void> {
    this.running = true
    logger.info('TaskConsumer started', { consumer: this.consumerName })

    // 确保 consumer group 存在
    try {
      await redis.xgroup('CREATE', STREAM_KEY, GROUP_NAME, '$', 'MKSTREAM')
    } catch (error: any) {
      if (!error.message?.includes('BUSYGROUP')) throw error
    }

    while (this.running) {
      try {
        const messages = await redis.xreadgroup(
          'GROUP', GROUP_NAME, this.consumerName,
          'COUNT', 1,
          'BLOCK', 5000,
          'STREAMS', STREAM_KEY, '>'
        )

        if (!messages || messages.length === 0) continue

        const [, entries] = messages[0] as [string, [string, string[]][]]
        if (!entries || entries.length === 0) continue

        for (const [id, fields] of entries) {
          await this.processTask(id, fields)
        }
      } catch (error) {
        logger.error('TaskConsumer error', error as Error)
        await this.sleep(1000)
      }
    }
  }

  private async processTask(streamId: string, fields: string[]): Promise<void> {
    const task = this.parseTask(fields)
    logger.info('Processing task', { taskId: task.taskId, intent: task.intent })

    await this.publishProgress(task.taskId, {
      status: 'running',
      message: 'Task started',
      timestamp: Date.now(),
    })

    // Write session-level status for backward compatibility
    await redis.setex(key('chat:status', task.sessionId), 86400, 'running')
    await redis.setex(`agenthive:agent:task:status:${task.taskId}`, 86400, 'running')

    const result = await this.runOrchestrator(task, task.sessionId)

    const finalStatus = result.success ? 'completed' : 'failed'
    await redis.setex(key('chat:status', task.sessionId), 86400, finalStatus)
    await redis.setex(`agenthive:agent:task:status:${task.taskId}`, 86400, finalStatus)

    await this.publishProgress(task.taskId, {
      status: finalStatus,
      message: result.success ? 'Task completed' : result.error,
      timestamp: Date.now(),
    })

    // Update agent_tasks in DB
    try {
      await pool.query(
        `UPDATE agent_tasks
         SET status = $1, completed_at = CURRENT_TIMESTAMP
         WHERE session_id = $2 AND status = 'pending'`,
        [finalStatus, task.sessionId]
      )
    } catch (dbError) {
      logger.error('Failed to update agent_tasks', dbError as Error, { sessionId: task.sessionId })
    }

    // Post-task billing
    if (result.success && task.userId) {
      try {
        // 尝试从 Redis 读取 Agent Runtime 上报的实际 token 消耗
        const usageData = await redis.get(`agenthive:task:usage:${task.taskId}`)
        let tokensUsed = 0
        if (usageData) {
          try {
            const usage = JSON.parse(usageData)
            tokensUsed = usage.totalTokens || usage.tokensUsed || 0
          } catch {
            tokensUsed = parseInt(usageData, 10) || 0
          }
        }

        const debitResult = await debitCredits({
          userId: task.userId,
          taskId: task.taskId,
          sessionId: task.sessionId,
          workerRole: task.intent === 'code_review' || task.intent === 'run_tests' ? 'qa' : 'backend',
          tokensUsed,
        })

        if (!debitResult.success) {
          logger.error('Post-task billing failed, enqueuing retry', undefined, {
            taskId: task.taskId,
            error: debitResult.errorCode,
          })
          await enqueueBillingRetry({
            taskId: task.taskId,
            userId: task.userId,
            sessionId: task.sessionId,
            workerRole: task.intent === 'code_review' || task.intent === 'run_tests' ? 'qa' : 'backend',
            tokensUsed,
            originalError: debitResult.errorCode || 'debit_failed',
          })
        } else {
          logger.info('Post-task billing success', {
            taskId: task.taskId,
            creditsDeducted: debitResult.creditsDeducted,
            remaining: debitResult.creditsRemaining,
          })
        }
      } catch (billingError) {
        logger.error('Post-task billing exception, enqueuing retry', billingError as Error, { taskId: task.taskId })
        if (task.userId) {
          // 重新读取 usage（可能在异常前已更新）
          const retryUsageData = await redis.get(`agenthive:task:usage:${task.taskId}`)
          let retryTokensUsed = 0
          if (retryUsageData) {
            try {
              const usage = JSON.parse(retryUsageData)
              retryTokensUsed = usage.totalTokens || usage.tokensUsed || 0
            } catch {
              retryTokensUsed = parseInt(retryUsageData, 10) || 0
            }
          }
          await enqueueBillingRetry({
            taskId: task.taskId,
            userId: task.userId,
            sessionId: task.sessionId,
            workerRole: task.intent === 'code_review' || task.intent === 'run_tests' ? 'qa' : 'backend',
            tokensUsed: retryTokensUsed,
            originalError: billingError instanceof Error ? billingError.message : 'billing_exception',
          })
        }
      }
    }

    await redis.xack(STREAM_KEY, GROUP_NAME, streamId)
    logger.info('Task completed', { taskId: task.taskId, sessionId: task.sessionId, success: result.success })
  }

  private async runOrchestrator(task: TaskFields, sessionId: string): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      const cmd = process.platform === 'win32' ? 'npx.cmd' : 'npx'
      this.currentChild = spawn(cmd, ['tsx', ORCHESTRATOR_PATH, task.content], {
        cwd: path.dirname(ORCHESTRATOR_PATH),
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          TASK_ID: task.taskId,
          SESSION_ID: task.sessionId,
          WORKSPACE_PATH: task.workspacePath,
        },
      })

      this.currentChild.stdout?.on('data', async (data: Buffer) => {
        const log = data.toString()
        // Backward-compat: write to chat:logs list
        await redis.lpush(key('chat:logs', sessionId), log)
        await redis.ltrim(key('chat:logs', sessionId), 0, 499)
        await redis.expire(key('chat:logs', sessionId), 86400)
        // Also publish via Pub/Sub for real-time WebSocket
        await this.publishProgress(task.taskId, {
          type: 'log',
          level: 'info',
          message: log,
          timestamp: Date.now(),
        })
      })

      this.currentChild.stderr?.on('data', async (data: Buffer) => {
        const log = `[ERROR] ${data.toString()}`
        await redis.lpush(key('chat:logs', sessionId), log)
        await redis.ltrim(key('chat:logs', sessionId), 0, 499)
        await redis.expire(key('chat:logs', sessionId), 86400)
        await this.publishProgress(task.taskId, {
          type: 'log',
          level: 'error',
          message: log,
          timestamp: Date.now(),
        })
      })

      this.currentChild.on('close', (code) => {
        this.currentChild = null
        resolve({
          success: code === 0,
          error: code !== 0 ? `Orchestrator exited with code ${code}` : undefined,
        })
      })

      this.currentChild.on('error', (error) => {
        this.currentChild = null
        resolve({ success: false, error: error.message })
      })
    })
  }

  private async publishProgress(taskId: string, payload: Record<string, unknown>): Promise<void> {
    await redisPub.publish(`agenthive:agent:task:progress:${taskId}`, JSON.stringify(payload))
  }

  private parseTask(fields: string[]): TaskFields {
    const result = {} as Record<string, string>
    for (let i = 0; i < fields.length; i += 2) {
      result[fields[i]] = fields[i + 1]
    }
    return result as unknown as TaskFields
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  async stop(): Promise<void> {
    this.running = false
    if (this.currentChild) {
      this.currentChild.kill('SIGTERM')
    }
    logger.info('TaskConsumer stopped')
  }
}

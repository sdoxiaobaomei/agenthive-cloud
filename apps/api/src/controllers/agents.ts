// Agent 控制器
import type { Request, Response } from 'express'
import { z } from 'zod'
import { agentDb, taskDb, logDb, delay } from '../utils/database.js'
import { redisCache } from '../services/redis-cache.js'
import { getTaskExecutionService } from '../services/taskExecution.js'
import logger from '../utils/logger.js'

const createAgentSchema = z.object({
  name: z.string().min(1).max(100),
  role: z.string().min(1).max(50),
  description: z.string().optional(),
  config: z.record(z.unknown()).optional(),
})

const updateAgentSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  config: z.record(z.unknown()).optional(),
})

const commandSchema = z.object({
  type: z.string().min(1),
  payload: z.record(z.unknown()).optional(),
})

const createTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  type: z.string().min(1),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  input: z.record(z.unknown()).optional(),
})

/**
 * 获取 Agent 列表
 * GET /api/agents
 */
export const getAgents = async (req: Request, res: Response) => {
  try {
    await delay(300)
    const agents = await agentDb.findAll()
    res.json({ code: 200, message: 'success', data: { agents, total: agents.length },
    })
  } catch (error) {
    logger.error('Get agents error', error instanceof Error ? error : undefined)
    res.status(500).json({ code: 500, message: '获取 Agent 列表失败' , data: null })
  }
}

/**
 * 获取 Agent 详情
 * GET /api/agents/:id
 */
export const getAgent = async (req: Request, res: Response) => {
  try {
    await delay(300)
    const { id } = req.params
    const agent = await agentDb.findById(id)
    if (!agent) {
      return res.status(404).json({ code: 404, message: 'Agent 不存在' , data: null })
    }
    const tasks = await taskDb.findAll({ assignedTo: id })
    const totalTasks = tasks.length
    const completedTasks = tasks.filter((t: any) => t.status === 'completed').length
    const failedTasks = tasks.filter((t: any) => t.status === 'failed').length
    res.json({ code: 200, message: 'success', data: {
        agent,
        tasks,
        stats: { totalTasks, completedTasks, failedTasks, avgCompletionTime: 0 },
      },
    })
  } catch (error) {
    logger.error('Get agent error', error instanceof Error ? error : undefined)
    res.status(500).json({ code: 500, message: '获取 Agent 详情失败' , data: null })
  }
}

/**
 * 创建 Agent
 * POST /api/agents
 */
export const createAgent = async (req: Request, res: Response) => {
  try {
    await delay(300)
    const parseResult = createAgentSchema.safeParse(req.body)
    if (!parseResult.success) {
      return res.status(400).json({ code: 400, message: '参数校验失败',
        details: parseResult.error.format(),
      })
    }
    const agent = await agentDb.create(parseResult.data as any)
    res.status(201).json({ code: 201, message: 'success', data: agent })
  } catch (error) {
    logger.error('Create agent error', error instanceof Error ? error : undefined)
    res.status(500).json({ code: 500, message: '创建 Agent 失败' , data: null })
  }
}

/**
 * 更新 Agent
 * PATCH /api/agents/:id
 */
export const updateAgent = async (req: Request, res: Response) => {
  try {
    await delay(300)
    const { id } = req.params
    const parseResult = updateAgentSchema.safeParse(req.body)
    if (!parseResult.success) {
      return res.status(400).json({ code: 400, message: '参数校验失败',
        details: parseResult.error.format(),
      })
    }
    const agent = await agentDb.findById(id)
    if (!agent) {
      return res.status(404).json({ code: 404, message: 'Agent 不存在' , data: null })
    }
    const updated = await agentDb.update(id, parseResult.data)
    res.json({ code: 200, message: 'success', data: updated })
  } catch (error) {
    logger.error('Update agent error', error instanceof Error ? error : undefined)
    res.status(500).json({ code: 500, message: '更新 Agent 失败' , data: null })
  }
}

/**
 * 删除 Agent
 * DELETE /api/agents/:id
 */
export const deleteAgent = async (req: Request, res: Response) => {
  try {
    await delay(300)
    const { id } = req.params
    const agent = await agentDb.findById(id)
    if (!agent) {
      return res.status(404).json({ code: 404, message: 'Agent 不存在' , data: null })
    }
    await agentDb.delete(id)
    res.json({ code: 200, message: 'Agent 已删除', data: null })
  } catch (error) {
    logger.error('Delete agent error', error instanceof Error ? error : undefined)
    res.status(500).json({ code: 500, message: '删除 Agent 失败' , data: null })
  }
}

/**
 * 启动 Agent
 * POST /api/agents/:id/start
 */
export const startAgent = async (req: Request, res: Response) => {
  try {
    await delay(300)
    const { id } = req.params
    const agent = await agentDb.findById(id)
    if (!agent) {
      return res.status(404).json({ code: 404, message: 'Agent 不存在' , data: null })
    }
    const updated = await agentDb.update(id, { status: 'working' })
    await logDb.addLog(id, 'Agent started')
    res.json({ code: 200, message: 'success', data: updated })
  } catch (error) {
    logger.error('Start agent error', error instanceof Error ? error : undefined)
    res.status(500).json({ code: 500, message: '启动 Agent 失败' , data: null })
  }
}

/**
 * 停止 Agent
 * POST /api/agents/:id/stop
 */
export const stopAgent = async (req: Request, res: Response) => {
  try {
    await delay(300)
    const { id } = req.params
    const agent = await agentDb.findById(id)
    if (!agent) {
      return res.status(404).json({ code: 404, message: 'Agent 不存在' , data: null })
    }
    const updated = await agentDb.update(id, { status: 'idle' })
    await logDb.addLog(id, 'Agent stopped')
    res.json({ code: 200, message: 'success', data: updated })
  } catch (error) {
    logger.error('Stop agent error', error instanceof Error ? error : undefined)
    res.status(500).json({ code: 500, message: '停止 Agent 失败' , data: null })
  }
}

/**
 * 暂停 Agent
 * POST /api/agents/:id/pause
 */
export const pauseAgent = async (req: Request, res: Response) => {
  try {
    await delay(300)
    const { id } = req.params
    const agent = await agentDb.findById(id)
    if (!agent) {
      return res.status(404).json({ code: 404, message: 'Agent 不存在' , data: null })
    }
    const updated = await agentDb.update(id, { status: 'paused' })
    await logDb.addLog(id, 'Agent paused')
    res.json({ code: 200, message: 'success', data: updated })
  } catch (error) {
    logger.error('Pause agent error', error instanceof Error ? error : undefined)
    res.status(500).json({ code: 500, message: '暂停 Agent 失败' , data: null })
  }
}

/**
 * 恢复 Agent
 * POST /api/agents/:id/resume
 */
export const resumeAgent = async (req: Request, res: Response) => {
  try {
    await delay(300)
    const { id } = req.params
    const agent = await agentDb.findById(id)
    if (!agent) {
      return res.status(404).json({ code: 404, message: 'Agent 不存在' , data: null })
    }
    const updated = await agentDb.update(id, { status: 'working' })
    await logDb.addLog(id, 'Agent resumed')
    res.json({ code: 200, message: 'success', data: updated })
  } catch (error) {
    logger.error('Resume agent error', error instanceof Error ? error : undefined)
    res.status(500).json({ code: 500, message: '恢复 Agent 失败' , data: null })
  }
}

/**
 * 发送命令
 * POST /api/agents/:id/command
 */
export const sendCommand = async (req: Request, res: Response) => {
  try {
    await delay(300)
    const { id } = req.params
    const parseResult = commandSchema.safeParse(req.body)
    if (!parseResult.success) {
      return res.status(400).json({ code: 400, message: '参数校验失败',
        details: parseResult.error.format(),
      })
    }
    const agent = await agentDb.findById(id)
    if (!agent) {
      return res.status(404).json({ code: 404, message: 'Agent 不存在' , data: null })
    }
    await logDb.addLog(id, `Command received: ${parseResult.data.type}`)
    res.json({ code: 200, message: '命令已发送', data: {
        commandId: `cmd-${Date.now()}`,
        type: parseResult.data.type,
        status: 'executing',
      },
    })
  } catch (error) {
    logger.error('Send command error', error instanceof Error ? error : undefined)
    res.status(500).json({ code: 500, message: '发送命令失败' , data: null })
  }
}

/**
 * 获取 Agent 日志
 * GET /api/agents/:id/logs
 */
export const getAgentLogs = async (req: Request, res: Response) => {
  try {
    await delay(300)
    const { id } = req.params
    const lines = parseInt(req.query.lines as string) || 100
    const agent = await agentDb.findById(id)
    if (!agent) {
      return res.status(404).json({ code: 404, message: 'Agent 不存在' , data: null })
    }
    const logs = await logDb.getLogs(id, lines)
    res.json({ code: 200, message: 'success', data: { logs, total: logs.length } })
  } catch (error) {
    logger.error('Get agent logs error', error instanceof Error ? error : undefined)
    res.status(500).json({ code: 500, message: '获取日志失败' , data: null })
  }
}

/**
 * 获取 Agent 实时状态
 * GET /api/agents/:id/status
 */
export const getAgentStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const [agent, redisStatus] = await Promise.all([
      agentDb.findById(id),
      redisCache.getAgentStatus(id),
    ])
    if (!agent) {
      return res.status(404).json({ code: 404, message: 'Agent 不存在' , data: null })
    }
    res.json({ code: 200, message: 'success', data: {
        agentId: id,
        dbStatus: agent.status,
        redisStatus: redisStatus?.status || 'unknown',
        lastHeartbeat: redisStatus?.updatedAt || null,
        metadata: redisStatus?.metadata || null,
      },
    })
  } catch (error) {
    logger.error('Get agent status error', error instanceof Error ? error : undefined)
    res.status(500).json({ code: 500, message: '获取 Agent 状态失败' , data: null })
  }
}

/**
 * 为 Agent 创建并执行任务
 * POST /api/agents/:id/tasks
 */
export const createAgentTask = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const parseResult = createTaskSchema.safeParse(req.body)
    if (!parseResult.success) {
      return res.status(400).json({ code: 400, message: '参数校验失败',
        details: parseResult.error.format(),
      })
    }

    const agent = await agentDb.findById(id)
    if (!agent) {
      return res.status(404).json({ code: 404, message: 'Agent 不存在' , data: null })
    }

    const userId = (req as any).userId || 'anonymous'
    const task = await taskDb.create({
      ...parseResult.data,
      assignedTo: id,
      input: { ...parseResult.data.input, userId },
      status: 'pending',
      progress: 0,
    })

    // Auto-execute via TaskExecutionService
    const executionService = getTaskExecutionService()
    const taskInfo = {
      id: task.id,
      title: task.title,
      description: task.description,
      type: task.type,
      userId,
      projectId: task.input?.projectId as string | undefined,
      status: 'pending' as const,
      progress: 0,
      createdAt: new Date(task.created_at),
    }

    executionService.execute(taskInfo).then(async (result) => {
      await taskDb.update(task.id, {
        status: result.status,
        progress: result.progress,
        output: { result: result.result, error: result.error, completedAt: result.completedAt },
      })
      logger.info(`Agent task ${task.id} execution completed`, { status: result.status })
    }).catch((err) => {
      logger.error(`Agent task ${task.id} execution error`, err)
    })

    res.status(201).json({ code: 201, message: '任务已创建并开始执行', data: { task, agentId: id },
    })
  } catch (error) {
    logger.error('Create agent task error', error instanceof Error ? error : undefined)
    res.status(500).json({ code: 500, message: '创建任务失败' , data: null })
  }
}

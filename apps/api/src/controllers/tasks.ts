// Task 控制器 - 集成 TaskExecutionService
import type { Request, Response } from 'express'
import { z } from 'zod'
import { taskDb, delay } from '../utils/database.js'
import { redisCache } from '../services/redis-cache.js'
import { getTaskExecutionService, type TaskInfo } from '../services/taskExecution.js'
import { broadcast } from '../websocket/hub.js'
import logger from '../utils/logger.js'

const createTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  type: z.string().min(1),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  assignedTo: z.string().optional(),
  input: z.record(z.unknown()).optional(),
})

const updateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  status: z.string().optional(),
  progress: z.number().min(0).max(100).optional(),
  assignedTo: z.string().uuid().optional(),
  input: z.record(z.unknown()).optional(),
})

/**
 * 获取任务列表
 * GET /api/tasks
 */
export const getTasks = async (req: Request, res: Response) => {
  try {
    await delay(300)
    const { status, assignedTo, page = '1', pageSize = '10' } = req.query
    let tasks = await taskDb.findAll({
      status: status as string,
      assignedTo: assignedTo as string,
    })
    const total = tasks.length
    const pageNum = parseInt(page as string)
    const size = parseInt(pageSize as string)
    const start = (pageNum - 1) * size
    tasks = tasks.slice(start, start + size)
    res.json({ code: 200, message: 'success', data: { tasks, total, page: pageNum, pageSize: size },
    })
  } catch (error) {
    logger.error('Get tasks error', error instanceof Error ? error : undefined)
    res.status(500).json({ code: 500, message: '获取任务列表失败' , data: null })
  }
}

/**
 * 获取任务详情
 * GET /api/tasks/:id
 */
export const getTask = async (req: Request, res: Response) => {
  try {
    await delay(300)
    const { id } = req.params
    const task = await taskDb.findById(id)
    if (!task) {
      return res.status(404).json({ code: 404, message: '任务不存在' , data: null })
    }
    let executionStatus = null
    try {
      const executionService = getTaskExecutionService()
      executionStatus = executionService.getTaskStatus(id)
    } catch {
      // TaskExecutionService not initialized, ignore
    }
    res.json({ code: 200, message: 'success', data: { ...task, execution: executionStatus || null },
    })
  } catch (error) {
    logger.error('Get task error', error instanceof Error ? error : undefined)
    res.status(500).json({ code: 500, message: '获取任务详情失败' , data: null })
  }
}

/**
 * 创建任务
 * POST /api/tasks
 */
export const createTask = async (req: Request, res: Response) => {
  try {
    await delay(300)
    const parseResult = createTaskSchema.safeParse(req.body)
    if (!parseResult.success) {
      return res.status(400).json({ code: 400, message: '参数校验失败',
        details: parseResult.error.format(),
      })
    }
    const userId = (req as any).userId
    const task = await taskDb.create({
      ...parseResult.data,
      input: { ...parseResult.data.input, userId },
      status: 'pending',
      progress: 0,
    })
    res.status(201).json({ code: 201, message: 'success', data: task })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error('Create task error', error instanceof Error ? error : undefined)
    res.status(500).json({ code: 500, message: '创建任务失败: ' + errorMessage , data: null })
  }
}

/**
 * 执行任务
 * POST /api/tasks/:id/execute
 */
export const executeTask = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const task = await taskDb.findById(id)
    if (!task) {
      return res.status(404).json({ code: 404, message: '任务不存在' , data: null })
    }
    if (task.status === 'running') {
      return res.status(400).json({ code: 400, message: '任务正在执行中' , data: null })
    }
    const executionService = getTaskExecutionService()
    const taskInfo: TaskInfo = {
      id: task.id,
      title: task.title,
      description: task.description,
      type: task.type,
      userId: task.assigned_to || 'anonymous',
      projectId: task.input?.projectId as string,
      status: 'pending',
      progress: 0,
      createdAt: new Date(task.created_at),
    }
    executionService.execute(taskInfo).then(async (result) => {
      await taskDb.update(id, {
        status: result.status,
        progress: result.progress,
        output: { result: result.result, error: result.error, completedAt: result.completedAt },
      })
      logger.info(`Task ${id} execution completed`, { status: result.status })
    }).catch((error) => {
      logger.error(`Task ${id} execution error`, error)
    })
    res.json({ code: 200, message: '任务开始执行', data: { taskId: id, status: 'running' },
    })
  } catch (error) {
    logger.error('Execute task error', error instanceof Error ? error : undefined)
    res.status(500).json({ code: 500, message: '执行任务失败' , data: null })
  }
}

/**
 * 更新任务
 * PATCH /api/tasks/:id
 */
export const updateTask = async (req: Request, res: Response) => {
  try {
    await delay(300)
    const { id } = req.params
    const parseResult = updateTaskSchema.safeParse(req.body)
    if (!parseResult.success) {
      return res.status(400).json({ code: 400, message: '参数校验失败',
        details: parseResult.error.format(),
      })
    }
    const task = await taskDb.findById(id)
    if (!task) {
      return res.status(404).json({ code: 404, message: '任务不存在' , data: null })
    }
    const updated = await taskDb.update(id, parseResult.data as any)
    res.json({ code: 200, message: 'success', data: updated })
  } catch (error) {
    logger.error('Update task error', error instanceof Error ? error : undefined)
    res.status(500).json({ code: 500, message: '更新任务失败' , data: null })
  }
}

/**
 * 删除任务
 * DELETE /api/tasks/:id
 */
export const deleteTask = async (req: Request, res: Response) => {
  try {
    await delay(300)
    const { id } = req.params
    const task = await taskDb.findById(id)
    if (!task) {
      return res.status(404).json({ code: 404, message: '任务不存在' , data: null })
    }
    await taskDb.delete(id)
    res.json({ code: 200, message: '任务已删除', data: null })
  } catch (error) {
    logger.error('Delete task error', error instanceof Error ? error : undefined)
    res.status(500).json({ code: 500, message: '删除任务失败' , data: null })
  }
}

/**
 * 取消任务
 * POST /api/tasks/:id/cancel
 */
export const cancelTask = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const task = await taskDb.findById(id)
    if (!task) {
      return res.status(404).json({ code: 404, message: '任务不存在' , data: null })
    }
    let cancelled = false
    try {
      const executionService = getTaskExecutionService()
      cancelled = await executionService.cancel(id)
    } catch {
      // TaskExecutionService not initialized
    }
    // Allow cancelling tasks that are not running (just update DB status)
    if (!cancelled && task.status === 'running') {
      return res.status(400).json({ code: 400, message: '任务未在执行中' , data: null })
    }
    const updated = await taskDb.update(id, { status: 'cancelled' })
    res.json({ code: 200, message: 'success', data: updated })
  } catch (error) {
    logger.error('Cancel task error', error instanceof Error ? error : undefined)
    res.status(500).json({ code: 500, message: '取消任务失败' , data: null })
  }
}

/**
 * 获取子任务
 * GET /api/tasks/:id/subtasks
 */
export const getSubtasks = async (req: Request, res: Response) => {
  try {
    await delay(300)
    const { id } = req.params
    const task = await taskDb.findById(id)
    if (!task) {
      return res.status(404).json({ code: 404, message: '任务不存在' , data: null })
    }
    const subtasks = await taskDb.findSubtasks(id)
    res.json({ code: 200, message: 'success', data: { subtasks, total: subtasks.length } })
  } catch (error) {
    logger.error('Get subtasks error', error instanceof Error ? error : undefined)
    res.status(500).json({ code: 500, message: '获取子任务失败' , data: null })
  }
}

/**
 * 获取任务进度
 * GET /api/tasks/:id/progress
 */
export const getTaskProgress = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const executionService = getTaskExecutionService()
    const status = executionService.getTaskStatus(id)
    if (!status) {
      return res.status(404).json({ code: 404, message: '未找到任务执行状态' , data: null })
    }
    res.json({ code: 200, message: 'success', data: {
        taskId: id,
        status: status.status,
        progress: status.progress,
        startedAt: status.startedAt,
        completedAt: status.completedAt,
        error: status.error,
      },
    })
  } catch (error) {
    logger.error('Get task progress error', error instanceof Error ? error : undefined)
    res.status(500).json({ code: 500, message: '获取任务进度失败' , data: null })
  }
}

/**
 * 获取任务日志（从 Redis 流式日志）
 * GET /api/tasks/:id/logs
 */
export const getTaskLogs = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const limit = Math.min(500, parseInt(req.query.limit as string) || 100)
    const logs = await redisCache.getLogs(id, limit)
    res.json({ code: 200, message: 'success', data: { taskId: id, logs, total: logs.length } })
  } catch (error) {
    logger.error('Get task logs error', error instanceof Error ? error : undefined)
    res.status(500).json({ code: 500, message: '获取任务日志失败' , data: null })
  }
}

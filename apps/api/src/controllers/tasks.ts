// Task 控制器 - 集成 TaskExecutionService
import type { Request, Response } from 'express'
import { taskDb, delay } from '../utils/database.js'
import { getTaskExecutionService, type TaskInfo } from '../services/taskExecution.js'
import { broadcast } from '../websocket/hub.js'

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
    const end = start + size
    
    tasks = tasks.slice(start, end)
    
    res.json({
      success: true,
      data: {
        tasks,
        total,
        page: pageNum,
        pageSize: size,
      },
    })
  } catch (error) {
    console.error('Get tasks error:', error)
    res.status(500).json({
      success: false,
      error: '获取任务列表失败',
    })
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
      return res.status(404).json({
        success: false,
        error: '任务不存在',
      })
    }
    
    // 获取执行状态（如果有）
    const executionService = getTaskExecutionService()
    const executionStatus = executionService.getTaskStatus(id)
    
    res.json({
      success: true,
      data: {
        ...task,
        execution: executionStatus || null,
      },
    })
  } catch (error) {
    console.error('Get task error:', error)
    res.status(500).json({
      success: false,
      error: '获取任务详情失败',
    })
  }
}

/**
 * 创建任务
 * POST /api/tasks
 */
export const createTask = async (req: Request, res: Response) => {
  try {
    await delay(300)
    
    const { title, description, type, priority, input, projectId } = req.body
    
    if (!title || !type) {
      return res.status(400).json({
        success: false,
        error: '标题和类型不能为空',
      })
    }
    
    const userId = (req as any).userId
    
    const task = await taskDb.create({
      title,
      description,
      type,
      priority: priority || 'medium',
      input: { ...input, projectId, userId },
      status: 'pending',
      progress: 0,
    })
    
    res.status(201).json({
      success: true,
      data: task,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('Create task error:', error)
    res.status(500).json({
      success: false,
      error: '创建任务失败: ' + errorMessage,
    })
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
      return res.status(404).json({
        success: false,
        error: '任务不存在',
      })
    }
    
    // 检查任务状态
    if (task.status === 'running') {
      return res.status(400).json({
        success: false,
        error: '任务正在执行中',
      })
    }
    
    // 获取执行服务
    const executionService = getTaskExecutionService()
    
    // 构建任务信息
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
    
    // 异步执行任务（不等待完成）
    executionService.execute(taskInfo).then(async (result) => {
      // 更新数据库中的任务状态
      await taskDb.update(id, {
        status: result.status,
        progress: result.progress,
        output: { result: result.result, error: result.error, completedAt: result.completedAt },
      })
      
      console.log(`[TaskController] Task ${id} execution completed: ${result.status}`)
    }).catch(error => {
      console.error(`[TaskController] Task ${id} execution error:`, error)
    })
    
    // 立即返回，不等待执行完成
    res.json({
      success: true,
      message: '任务开始执行',
      data: {
        taskId: id,
        status: 'running',
      },
    })
  } catch (error) {
    console.error('Execute task error:', error)
    res.status(500).json({
      success: false,
      error: '执行任务失败: ' + (error instanceof Error ? error.message : '未知错误'),
    })
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
    const { title, description, priority, status, progress, assignedTo, input } = req.body
    
    const task = await taskDb.findById(id)
    if (!task) {
      return res.status(404).json({
        success: false,
        error: '任务不存在',
      })
    }
    
    const updated = await taskDb.update(id, {
      title,
      description,
      priority,
      status,
      progress,
      assignedTo,
      input,
    })
    
    res.json({
      success: true,
      data: updated,
    })
  } catch (error) {
    console.error('Update task error:', error)
    res.status(500).json({
      success: false,
      error: '更新任务失败',
    })
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
      return res.status(404).json({
        success: false,
        error: '任务不存在',
      })
    }
    
    await taskDb.delete(id)
    
    res.json({
      success: true,
      message: '任务已删除',
    })
  } catch (error) {
    console.error('Delete task error:', error)
    res.status(500).json({
      success: false,
      error: '删除任务失败',
    })
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
      return res.status(404).json({
        success: false,
        error: '任务不存在',
      })
    }
    
    // 调用执行服务取消任务
    const executionService = getTaskExecutionService()
    const cancelled = await executionService.cancel(id)
    
    if (!cancelled) {
      return res.status(400).json({
        success: false,
        error: '任务未在执行中',
      })
    }
    
    // 更新数据库状态
    await taskDb.update(id, { status: 'cancelled' })
    
    res.json({
      success: true,
      message: '任务已取消',
    })
  } catch (error) {
    console.error('Cancel task error:', error)
    res.status(500).json({
      success: false,
      error: '取消任务失败',
    })
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
      return res.status(404).json({
        success: false,
        error: '任务不存在',
      })
    }
    
    const subtasks = await taskDb.findSubtasks(id)
    
    res.json({
      success: true,
      data: {
        subtasks,
        total: subtasks.length,
      },
    })
  } catch (error) {
    console.error('Get subtasks error:', error)
    res.status(500).json({
      success: false,
      error: '获取子任务失败',
    })
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
      return res.status(404).json({
        success: false,
        error: '未找到任务执行状态',
      })
    }
    
    res.json({
      success: true,
      data: {
        taskId: id,
        status: status.status,
        progress: status.progress,
        startedAt: status.startedAt,
        completedAt: status.completedAt,
        error: status.error,
      },
    })
  } catch (error) {
    console.error('Get task progress error:', error)
    res.status(500).json({
      success: false,
      error: '获取任务进度失败',
    })
  }
}

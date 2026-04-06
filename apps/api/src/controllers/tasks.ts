// Task 控制器
import type { Request, Response } from 'express'
import { taskDb, delay } from '../utils/database.js'

/**
 * 获取任务列表
 * GET /api/tasks
 */
export const getTasks = async (req: Request, res: Response) => {
  try {
    await delay(300)
    
    const { status, assignedTo, page = '1', pageSize = '10' } = req.query
    
    let tasks = taskDb.findAll({
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
    const task = taskDb.findById(id)
    
    if (!task) {
      return res.status(404).json({
        success: false,
        error: '任务不存在',
      })
    }
    
    res.json({
      success: true,
      data: task,
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
    
    const { title, description, type, priority, assignedTo, input } = req.body
    
    if (!title || !type) {
      return res.status(400).json({
        success: false,
        error: '标题和类型不能为空',
      })
    }
    
    const task = taskDb.create({
      title,
      description,
      type,
      priority: priority || 'medium',
      assignedTo,
      input,
    })
    
    res.status(201).json({
      success: true,
      data: task,
    })
  } catch (error) {
    console.error('Create task error:', error)
    res.status(500).json({
      success: false,
      error: '创建任务失败',
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
    
    const task = taskDb.findById(id)
    if (!task) {
      return res.status(404).json({
        success: false,
        error: '任务不存在',
      })
    }
    
    const updated = taskDb.update(id, {
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
    
    const task = taskDb.findById(id)
    if (!task) {
      return res.status(404).json({
        success: false,
        error: '任务不存在',
      })
    }
    
    taskDb.delete(id)
    
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
    await delay(300)
    
    const { id } = req.params
    
    const task = taskDb.findById(id)
    if (!task) {
      return res.status(404).json({
        success: false,
        error: '任务不存在',
      })
    }
    
    const updated = taskDb.update(id, { status: 'cancelled' })
    
    res.json({
      success: true,
      data: updated,
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
    
    const task = taskDb.findById(id)
    if (!task) {
      return res.status(404).json({
        success: false,
        error: '任务不存在',
      })
    }
    
    const subtasks = taskDb.findSubtasks(id)
    
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

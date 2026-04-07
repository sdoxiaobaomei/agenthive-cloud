// Agent 控制器
import type { Request, Response } from 'express'
import { agentDb, taskDb, logDb, delay } from '../utils/database.js'

/**
 * 获取 Agent 列表
 * GET /api/agents
 */
export const getAgents = async (req: Request, res: Response) => {
  try {
    await delay(300)
    
    const { teamId } = req.query
    const agents = await agentDb.findAll()
    
    res.json({
      success: true,
      data: {
        agents,
        total: agents.length,
      },
    })
  } catch (error) {
    console.error('Get agents error:', error)
    res.status(500).json({
      success: false,
      error: '获取 Agent 列表失败',
    })
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
      return res.status(404).json({
        success: false,
        error: 'Agent 不存在',
      })
    }
    
    // 获取关联的任务
    const tasks = await taskDb.findAll({ assignedTo: id })
    
    // 计算统计信息
    const totalTasks = tasks.length
    const completedTasks = tasks.filter(t => t.status === 'completed').length
    const failedTasks = tasks.filter(t => t.status === 'failed').length
    
    res.json({
      success: true,
      data: {
        agent,
        tasks,
        stats: {
          totalTasks,
          completedTasks,
          failedTasks,
          avgCompletionTime: 0, // TODO: 计算平均完成时间
        },
      },
    })
  } catch (error) {
    console.error('Get agent error:', error)
    res.status(500).json({
      success: false,
      error: '获取 Agent 详情失败',
    })
  }
}

/**
 * 创建 Agent
 * POST /api/agents
 */
export const createAgent = async (req: Request, res: Response) => {
  try {
    await delay(300)
    
    const { name, role, description, config } = req.body
    
    if (!name || !role) {
      return res.status(400).json({
        success: false,
        error: '名称和角色不能为空',
      })
    }
    
    const agent = await agentDb.create({
      name,
      role,
      description,
      config,
    })
    
    res.status(201).json({
      success: true,
      data: agent,
    })
  } catch (error) {
    console.error('Create agent error:', error)
    res.status(500).json({
      success: false,
      error: '创建 Agent 失败',
    })
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
    const { name, description, config } = req.body
    
    const agent = await agentDb.findById(id)
    if (!agent) {
      return res.status(404).json({
        success: false,
        error: 'Agent 不存在',
      })
    }
    
    const updated = await agentDb.update(id, {
      name,
      description,
      config,
    })
    
    res.json({
      success: true,
      data: updated,
    })
  } catch (error) {
    console.error('Update agent error:', error)
    res.status(500).json({
      success: false,
      error: '更新 Agent 失败',
    })
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
      return res.status(404).json({
        success: false,
        error: 'Agent 不存在',
      })
    }
    
    await agentDb.delete(id)
    
    res.json({
      success: true,
      message: 'Agent 已删除',
    })
  } catch (error) {
    console.error('Delete agent error:', error)
    res.status(500).json({
      success: false,
      error: '删除 Agent 失败',
    })
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
      return res.status(404).json({
        success: false,
        error: 'Agent 不存在',
      })
    }
    
    const updated = await agentDb.update(id, { status: 'working' })
    await logDb.addLog(id, 'Agent started')
    
    res.json({
      success: true,
      data: updated,
    })
  } catch (error) {
    console.error('Start agent error:', error)
    res.status(500).json({
      success: false,
      error: '启动 Agent 失败',
    })
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
      return res.status(404).json({
        success: false,
        error: 'Agent 不存在',
      })
    }
    
    const updated = await agentDb.update(id, { status: 'idle' })
    await logDb.addLog(id, 'Agent stopped')
    
    res.json({
      success: true,
      data: updated,
    })
  } catch (error) {
    console.error('Stop agent error:', error)
    res.status(500).json({
      success: false,
      error: '停止 Agent 失败',
    })
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
      return res.status(404).json({
        success: false,
        error: 'Agent 不存在',
      })
    }
    
    const updated = await agentDb.update(id, { status: 'paused' })
    await logDb.addLog(id, 'Agent paused')
    
    res.json({
      success: true,
      data: updated,
    })
  } catch (error) {
    console.error('Pause agent error:', error)
    res.status(500).json({
      success: false,
      error: '暂停 Agent 失败',
    })
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
      return res.status(404).json({
        success: false,
        error: 'Agent 不存在',
      })
    }
    
    const updated = await agentDb.update(id, { status: 'working' })
    await logDb.addLog(id, 'Agent resumed')
    
    res.json({
      success: true,
      data: updated,
    })
  } catch (error) {
    console.error('Resume agent error:', error)
    res.status(500).json({
      success: false,
      error: '恢复 Agent 失败',
    })
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
    const { type, payload } = req.body
    
    const agent = await agentDb.findById(id)
    if (!agent) {
      return res.status(404).json({
        success: false,
        error: 'Agent 不存在',
      })
    }
    
    await logDb.addLog(id, `Command received: ${type}`)
    
    // 模拟命令执行
    res.json({
      success: true,
      message: '命令已发送',
      data: {
        commandId: `cmd-${Date.now()}`,
        type,
        status: 'executing',
      },
    })
  } catch (error) {
    console.error('Send command error:', error)
    res.status(500).json({
      success: false,
      error: '发送命令失败',
    })
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
      return res.status(404).json({
        success: false,
        error: 'Agent 不存在',
      })
    }
    
    const logs = await logDb.getLogs(id, lines)
    
    res.json({
      success: true,
      data: {
        logs,
        total: logs.length,
      },
    })
  } catch (error) {
    console.error('Get agent logs error:', error)
    res.status(500).json({
      success: false,
      error: '获取日志失败',
    })
  }
}

// Agent 路由
import { Router } from 'express'
import {
  getAgents,
  getAgent,
  createAgent,
  updateAgent,
  deleteAgent,
  startAgent,
  stopAgent,
  pauseAgent,
  resumeAgent,
  sendCommand,
  getAgentLogs,
  getAgentStatus,
  createAgentTask,
} from '../controllers/agents.js'

const router = Router()

// CRUD
router.get('/', getAgents)
router.post('/', createAgent)
router.get('/:id', getAgent)
router.patch('/:id', updateAgent)
router.delete('/:id', deleteAgent)

// 状态控制
router.post('/:id/start', startAgent)
router.post('/:id/stop', stopAgent)
router.post('/:id/pause', pauseAgent)
router.post('/:id/resume', resumeAgent)

// 实时状态与任务
router.get('/:id/status', getAgentStatus)
router.post('/:id/tasks', createAgentTask)

// 命令和日志
router.post('/:id/command', sendCommand)
router.get('/:id/logs', getAgentLogs)

export default router

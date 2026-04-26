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

/**
 * @openapi
 * /api/agents:
 *   get:
 *     summary: 获取 Agent 列表
 *     tags: [Agents]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 成功返回 Agent 列表
 *   post:
 *     summary: 创建 Agent
 *     tags: [Agents]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, role]
 *             properties:
 *               name:
 *                 type: string
 *               role:
 *                 type: string
 *               description:
 *                 type: string
 *               config:
 *                 type: object
 *     responses:
 *       201:
 *         description: 创建成功
 */
router.get('/', getAgents)
router.post('/', createAgent)

/**
 * @openapi
 * /api/agents/{id}:
 *   get:
 *     summary: 获取 Agent 详情
 *     tags: [Agents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 成功返回 Agent 详情
 *       404:
 *         description: Agent 不存在
 *   patch:
 *     summary: 更新 Agent
 *     tags: [Agents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 更新成功
 *   delete:
 *     summary: 删除 Agent
 *     tags: [Agents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 删除成功
 */
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

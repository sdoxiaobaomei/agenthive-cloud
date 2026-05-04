/**
 * Chat Routes - /api/chat
 */

import { Router } from 'express'
import {
  createSession,
  listSessions,
  getSession,
  sendMessage,
  getMessages,
  executeTask,
  getTasks,
  getProgress,
  // 新增
  approveTask,
  selectRecommend,
  dismissRecommend,
  listVersions,
  createVersion,
  switchVersion,
} from './controller.js'

const router = Router()

// 原有路由
router.post('/sessions', createSession)
router.get('/sessions', listSessions)
router.get('/sessions/:id', getSession)
router.post('/sessions/:id/messages', sendMessage)
router.get('/sessions/:id/messages', getMessages)
router.post('/sessions/:id/execute', executeTask)
router.get('/sessions/:id/tasks', getTasks)
router.get('/sessions/:id/progress', getProgress)

// 新增路由
router.post('/sessions/:id/messages/:messageId/approve', approveTask)
router.post('/sessions/:id/messages/:messageId/select', selectRecommend)
router.post('/sessions/:id/messages/:messageId/dismiss', dismissRecommend)
router.get('/sessions/:id/versions', listVersions)
router.post('/sessions/:id/versions', createVersion)
router.patch('/sessions/:id/versions/:versionId/activate', switchVersion)

export default router

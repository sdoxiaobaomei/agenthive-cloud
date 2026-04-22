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
} from './controller.js'

const router = Router()

router.post('/sessions', createSession)
router.get('/sessions', listSessions)
router.get('/sessions/:id', getSession)
router.post('/sessions/:id/messages', sendMessage)
router.get('/sessions/:id/messages', getMessages)
router.post('/sessions/:id/execute', executeTask)
router.get('/sessions/:id/tasks', getTasks)
router.get('/sessions/:id/progress', getProgress)

export default router

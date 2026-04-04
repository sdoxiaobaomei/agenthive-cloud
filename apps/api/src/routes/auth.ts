import { Router } from 'express'
import { visitorMiddleware } from '../middleware/visitor.js'

const router = Router()

// Public health check
router.get('/health', (_req, res) => res.json({ ok: true }))

// Visitor-protected demo endpoints
router.get('/visitor-status', visitorMiddleware, (req, res) => {
  res.json({ visitorId: req.visitorId, mode: 'visitor' })
})

export default router

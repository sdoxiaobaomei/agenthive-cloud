import { Router } from 'express'

const router = Router()

router.post('/migrate-visitor', (req, res) => {
  const { visitorSnapshot, userId } = req.body
  if (!userId || !visitorSnapshot) {
    return res.status(400).json({ error: 'Missing userId or snapshot' })
  }

  // In production this would create a real project from the snapshot
  const projectId = `proj-${Date.now()}`
  res.json({
    code: 200,
    message: 'Visitor project migrated successfully',
    data: { projectId },
  })
})

export default router

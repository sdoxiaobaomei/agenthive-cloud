// Task 路由
import { Router } from 'express'
import {
  getTasks,
  getTask,
  createTask,
  updateTask,
  deleteTask,
  cancelTask,
  getSubtasks,
} from '../controllers/tasks.js'

const router = Router()

router.get('/', getTasks)
router.post('/', createTask)
router.get('/:id', getTask)
router.patch('/:id', updateTask)
router.delete('/:id', deleteTask)
router.post('/:id/cancel', cancelTask)
router.get('/:id/subtasks', getSubtasks)

export default router

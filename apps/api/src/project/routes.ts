/**
 * Project Routes - /api/projects
 */

import { Router } from 'express'
import {
  getProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
} from './controller.js'

const router = Router()

router.get('/', getProjects)
router.post('/', createProject)
router.get('/:id', getProject)
router.patch('/:id', updateProject)
router.delete('/:id', deleteProject)

export default router

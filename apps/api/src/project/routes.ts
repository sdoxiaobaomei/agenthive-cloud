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
  getCloneStatus,
  getProjectChatSessions,
  getProjectAgentTasks,
  getProjectDashboard,
  getProjectMembers,
  inviteProjectMember,
  updateProjectMemberRole,
  removeProjectMember,
  deployProjectController,
  stopDeploymentController,
  getProjectTraffic,
  getProjectRealtimeTraffic,
} from './controller.js'

const router = Router()

// Project CRUD
router.get('/', getProjects)
router.post('/', createProject)
router.get('/:id', getProject)
router.patch('/:id', updateProject)
router.delete('/:id', deleteProject)
router.get('/:id/clone-status', getCloneStatus)

// Project Chat & Agent Tasks
router.get('/:id/chat-sessions', getProjectChatSessions)
router.get('/:id/agent-tasks', getProjectAgentTasks)
router.get('/:id/dashboard', getProjectDashboard)

// Project Members
router.get('/:id/members', getProjectMembers)
router.post('/:id/members', inviteProjectMember)
router.patch('/:id/members/:userId', updateProjectMemberRole)
router.delete('/:id/members/:userId', removeProjectMember)

// Hosting & Traffic
router.post('/:id/deploy', deployProjectController)
router.delete('/:id/deploy', stopDeploymentController)
router.get('/:id/traffic', getProjectTraffic)
router.get('/:id/traffic/realtime', getProjectRealtimeTraffic)

export default router

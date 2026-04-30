/**
 * Project Controller - REST endpoints for projects
 */

import type { Request, Response } from 'express'
import { z } from 'zod'
import { projectService, startGitClone, getCloneJob } from './service.js'
import { deployProject, stopDeployment, findDeployment } from './hosting-service.js'
import { getTrafficTrend, getRealtimeTrafficWithFallback } from './traffic-service.js'
import logger from '../utils/logger.js'

const createProjectSchema = z.object({
  name: z.string().min(1).max(128),
  description: z.string().optional(),
  repo_url: z.string().url().optional().or(z.literal('')),
  type: z.enum(['blank', 'git-import']).optional(),
  tech_stack: z.string().optional(),
  git_url: z.string().optional(),
  git_branch: z.string().optional(),
  is_template: z.boolean().optional(),
})

const updateProjectSchema = z.object({
  name: z.string().min(1).max(128).optional(),
  description: z.string().optional(),
  repo_url: z.string().url().optional().or(z.literal('')),
  status: z.enum(['active', 'archived', 'deleted']).optional(),
  type: z.enum(['blank', 'git-import']).optional(),
  tech_stack: z.string().optional(),
  git_url: z.string().optional(),
  git_branch: z.string().optional(),
  workspace_path: z.string().optional(),
  last_accessed_at: z.string().optional(),
  is_template: z.boolean().optional(),
})

const createProjectWithTypeSchema = z.object({
  name: z.string().min(1).max(128),
  description: z.string().optional(),
  type: z.enum(['blank', 'git-import']).optional(),
  tech_stack: z.string().optional(),
  git_url: z.string().optional(),
  git_branch: z.string().optional(),
  is_template: z.boolean().optional(),
})

export const getProjects = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string | undefined
    const projects = await projectService.findAll(userId)
    res.json({
      code: 200,
      message: 'success',
      data: {
        items: projects,
        total: projects.length,
        page: 1,
        pageSize: projects.length,
        totalPages: 1,
      },
    })
  } catch (error) {
    logger.error('Failed to get projects', error instanceof Error ? error : undefined)
    res.status(500).json({ code: 500, message: '获取项目列表失败' , data: null })
  }
}

export const getProject = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const project = await projectService.findById(id)
    if (!project) {
      return res.status(404).json({ code: 404, message: '项目不存在' , data: null })
    }
    res.json({ code: 200, message: 'success', data: project })
  } catch (error) {
    logger.error('Failed to get project', error instanceof Error ? error : undefined)
    res.status(500).json({ code: 500, message: '获取项目详情失败' , data: null })
  }
}

export const createProject = async (req: Request, res: Response) => {
  let userId: string | undefined
  let data: z.infer<typeof createProjectWithTypeSchema> | undefined

  try {
    const parseResult = createProjectWithTypeSchema.safeParse(req.body)
    if (!parseResult.success) {
      return res.status(400).json({ code: 400, message: '参数校验失败',
        details: parseResult.error.format(),
      })
    }

    userId = (req as any).userId as string | undefined
    if (!userId) {
      return res.status(401).json({ code: 401, message: '未授权' , data: null })
    }

    data = parseResult.data
    const projectType = data.type || 'blank'
    const techStack = data.tech_stack || 'blank'

    // 类型字段校验
    if (projectType === 'git-import' && !data.git_url) {
      return res.status(400).json({ code: 400, message: 'git-import 类型需要提供 git_url', data: null })
    }

    const project = await projectService.create({ ...data, owner_id: userId })

    // blank 类型：复制模板到 workspace
    if (projectType === 'blank') {
      await projectService.initBlankWorkspace(project.id, userId, techStack)
      const updated = await projectService.findById(project.id)
      res.status(201).json({ code: 201, message: 'success', data: updated })
      return
    }

    // git-import 类型：启动异步 clone
    if (projectType === 'git-import') {
      const job = startGitClone(project.id, userId, data.git_url!, data.git_branch || 'main')
      res.status(201).json({
        code: 201,
        message: 'success',
        data: { projectId: project.id, jobId: job.jobId, status: job.status },
      })
      return
    }

    res.status(201).json({ code: 201, message: 'success', data: project })
  } catch (error) {
    logger.error('Failed to create project', error instanceof Error ? error : undefined, {
      ownerId: userId,
      projectName: data?.name,
      projectType: data?.type,
    })
    res.status(500).json({ code: 500, message: '创建项目失败', data: null })
  }
}

export const updateProject = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const parseResult = updateProjectSchema.safeParse(req.body)
    if (!parseResult.success) {
      return res.status(400).json({ code: 400, message: '参数校验失败',
        details: parseResult.error.format(),
      })
    }

    const project = await projectService.update(id, parseResult.data)
    if (!project) {
      return res.status(404).json({ code: 404, message: '项目不存在' , data: null })
    }
    res.json({ code: 200, message: 'success', data: project })
  } catch (error) {
    logger.error('Failed to update project', error instanceof Error ? error : undefined)
    res.status(500).json({ code: 500, message: '更新项目失败' , data: null })
  }
}

export const deleteProject = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    // 先归档关联的 chat_sessions
    const archivedCount = await projectService.archiveChatSessions(id)
    logger.info('Project chat sessions archived', { projectId: id, archivedCount })

    const success = await projectService.delete(id)
    if (!success) {
      return res.status(404).json({ code: 404, message: '项目不存在' , data: null })
    }
    res.json({ code: 200, message: '项目已删除', data: { archivedSessions: archivedCount } })
  } catch (error) {
    logger.error('Failed to delete project', error instanceof Error ? error : undefined)
    res.status(500).json({ code: 500, message: '删除项目失败' , data: null })
  }
}

/** 校验当前用户是否为项目成员 */
async function requireProjectMember(req: Request, res: Response, projectId: string): Promise<boolean> {
  const userId = (req as any).userId as string | undefined
  if (!userId) {
    res.status(401).json({ code: 401, message: '未授权', data: null })
    return false
  }
  const role = await projectService.getMemberRole(projectId, userId)
  if (!role) {
    res.status(403).json({ code: 403, message: '你不是该项目成员', data: null })
    return false
  }
  return true
}

export const getCloneStatus = async (req: Request, res: Response) => {
  try {
    const { id: projectId } = req.params
    const { jobId } = req.query
    if (!jobId || typeof jobId !== 'string') {
      return res.status(400).json({ code: 400, message: 'jobId 不能为空', data: null })
    }
    const job = getCloneJob(jobId)
    if (!job || job.projectId !== projectId) {
      return res.status(404).json({ code: 404, message: 'Clone 任务不存在', data: null })
    }
    res.json({
      code: 200,
      message: 'success',
      data: {
        jobId: job.jobId,
        projectId: job.projectId,
        status: job.status,
        error: job.error,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
      },
    })
  } catch (error) {
    logger.error('Failed to get clone status', error instanceof Error ? error : undefined)
    res.status(500).json({ code: 500, message: '查询 clone 状态失败', data: null })
  }
}

export const getProjectChatSessions = async (req: Request, res: Response) => {
  try {
    const { id: projectId } = req.params
    if (!(await requireProjectMember(req, res, projectId))) return

    const sessions = await projectService.findChatSessions(projectId)
    res.json({ code: 200, message: 'success', data: { items: sessions, total: sessions.length } })
  } catch (error) {
    logger.error('Failed to get project chat sessions', error instanceof Error ? error : undefined)
    res.status(500).json({ code: 500, message: '获取项目会话失败', data: null })
  }
}

export const getProjectAgentTasks = async (req: Request, res: Response) => {
  try {
    const { id: projectId } = req.params
    if (!(await requireProjectMember(req, res, projectId))) return

    const tasks = await projectService.findAgentTasks(projectId)
    res.json({ code: 200, message: 'success', data: { items: tasks, total: tasks.length } })
  } catch (error) {
    logger.error('Failed to get project agent tasks', error instanceof Error ? error : undefined)
    res.status(500).json({ code: 500, message: '获取项目任务失败', data: null })
  }
}

export const getProjectDashboard = async (req: Request, res: Response) => {
  try {
    const { id: projectId } = req.params
    if (!(await requireProjectMember(req, res, projectId))) return

    const dashboard = await projectService.getDashboard(projectId)
    res.json({ code: 200, message: 'success', data: dashboard })
  } catch (error) {
    logger.error('Failed to get project dashboard', error instanceof Error ? error : undefined)
    res.status(500).json({ code: 500, message: '获取 Dashboard 失败', data: null })
  }
}

// ============ Hosting & Deployment ============

export const deployProjectController = async (req: Request, res: Response) => {
  try {
    const { id: projectId } = req.params
    const userId = (req as any).userId as string | undefined
    if (!userId) {
      return res.status(401).json({ code: 401, message: '未授权', data: null })
    }

    const project = await projectService.findById(projectId)
    if (!project) {
      return res.status(404).json({ code: 404, message: '项目不存在', data: null })
    }
    if (project.owner_id !== userId) {
      return res.status(403).json({ code: 403, message: '无权限', data: null })
    }

    if (!project.workspace_path) {
      return res.status(400).json({ code: 400, message: '项目未初始化 workspace', data: null })
    }

    const result = await deployProject(projectId, project.workspace_path, project.tech_stack)
    logger.info('Project deployed', { projectId, accessUrl: result.accessUrl, mock: result.mock })

    res.json({
      code: 200,
      message: result.mock ? '部署已触发 [MOCK]' : '部署已触发',
      data: {
        projectId,
        accessUrl: result.accessUrl,
        status: result.status,
        mock: result.mock,
      },
    })
  } catch (error) {
    logger.error('Failed to deploy project', error instanceof Error ? error : undefined)
    res.status(500).json({ code: 500, message: '部署失败', data: null })
  }
}

export const stopDeploymentController = async (req: Request, res: Response) => {
  try {
    const { id: projectId } = req.params
    const userId = (req as any).userId as string | undefined
    if (!userId) {
      return res.status(401).json({ code: 401, message: '未授权', data: null })
    }

    const project = await projectService.findById(projectId)
    if (!project || project.owner_id !== userId) {
      return res.status(403).json({ code: 403, message: '无权限', data: null })
    }

    const deployment = await findDeployment(projectId)
    if (!deployment) {
      return res.status(404).json({ code: 404, message: '该项目未部署', data: null })
    }

    const result = await stopDeployment(projectId)
    logger.info('Project deployment stopped', { projectId, mock: result.mock })

    res.json({
      code: 200,
      message: result.mock ? '托管已停止 [MOCK]' : '托管已停止',
      data: { projectId, mock: result.mock },
    })
  } catch (error) {
    logger.error('Failed to stop deployment', error instanceof Error ? error : undefined)
    res.status(500).json({ code: 500, message: '停止托管失败', data: null })
  }
}

// ============ Traffic Dashboard ============

export const getProjectTraffic = async (req: Request, res: Response) => {
  try {
    const { id: projectId } = req.params
    if (!(await requireProjectMember(req, res, projectId))) return

    const days = Math.min(parseInt(req.query.days as string) || 7, 30)
    const trend = await getTrafficTrend(projectId, days)

    res.json({ code: 200, message: 'success', data: { projectId, days, trend } })
  } catch (error) {
    logger.error('Failed to get traffic trend', error instanceof Error ? error : undefined)
    res.status(500).json({ code: 500, message: '获取流量趋势失败', data: null })
  }
}

export const getProjectRealtimeTraffic = async (req: Request, res: Response) => {
  try {
    const { id: projectId } = req.params
    if (!(await requireProjectMember(req, res, projectId))) return

    const data = await getRealtimeTrafficWithFallback(projectId)

    res.json({
      code: 200,
      message: 'success',
      data: { projectId, pv: data.pv, uv: data.uv, timestamp: new Date().toISOString() },
    })
  } catch (error) {
    logger.error('Failed to get realtime traffic', error instanceof Error ? error : undefined)
    res.status(500).json({ code: 500, message: '获取实时流量失败', data: null })
  }
}

/**
 * Project Controller - REST endpoints for projects
 */

import type { Request, Response } from 'express'
import { z } from 'zod'
import { projectService } from './service.js'
import logger from '../utils/logger.js'

const createProjectSchema = z.object({
  name: z.string().min(1).max(128),
  description: z.string().optional(),
  repo_url: z.string().url().optional().or(z.literal('')),
})

const updateProjectSchema = z.object({
  name: z.string().min(1).max(128).optional(),
  description: z.string().optional(),
  repo_url: z.string().url().optional().or(z.literal('')),
  status: z.enum(['active', 'archived', 'deleted']).optional(),
})

export const getProjects = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string | undefined
    const projects = await projectService.findAll(userId)
    res.json({ success: true, data: { items: projects, total: projects.length } })
  } catch (error) {
    logger.error('Failed to get projects', error instanceof Error ? error : undefined)
    res.status(500).json({ success: false, error: '获取项目列表失败' })
  }
}

export const getProject = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const project = await projectService.findById(id)
    if (!project) {
      return res.status(404).json({ success: false, error: '项目不存在' })
    }
    res.json({ success: true, data: project })
  } catch (error) {
    logger.error('Failed to get project', error instanceof Error ? error : undefined)
    res.status(500).json({ success: false, error: '获取项目详情失败' })
  }
}

export const createProject = async (req: Request, res: Response) => {
  try {
    const parseResult = createProjectSchema.safeParse(req.body)
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: '参数校验失败',
        details: parseResult.error.format(),
      })
    }

    const userId = (req as any).userId as string | undefined
    if (!userId) {
      return res.status(401).json({ success: false, error: '未授权' })
    }

    const project = await projectService.create({ ...parseResult.data, owner_id: userId })
    res.status(201).json({ success: true, data: project })
  } catch (error) {
    logger.error('Failed to create project', error instanceof Error ? error : undefined)
    res.status(500).json({ success: false, error: '创建项目失败' })
  }
}

export const updateProject = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const parseResult = updateProjectSchema.safeParse(req.body)
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: '参数校验失败',
        details: parseResult.error.format(),
      })
    }

    const project = await projectService.update(id, parseResult.data)
    if (!project) {
      return res.status(404).json({ success: false, error: '项目不存在' })
    }
    res.json({ success: true, data: project })
  } catch (error) {
    logger.error('Failed to update project', error instanceof Error ? error : undefined)
    res.status(500).json({ success: false, error: '更新项目失败' })
  }
}

export const deleteProject = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const success = await projectService.delete(id)
    if (!success) {
      return res.status(404).json({ success: false, error: '项目不存在' })
    }
    res.json({ success: true, message: '项目已删除' })
  } catch (error) {
    logger.error('Failed to delete project', error instanceof Error ? error : undefined)
    res.status(500).json({ success: false, error: '删除项目失败' })
  }
}

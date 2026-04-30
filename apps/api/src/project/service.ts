/**
 * Project Service - CRUD operations for projects
 */

import { pool } from '../config/database.js'
import logger from '../utils/logger.js'
import type { Project, CreateProjectInput, UpdateProjectInput, ProjectMember } from './types.js'
import { cp, mkdir, rm } from 'fs/promises'
import { resolve, join } from 'path'
import { spawn } from 'child_process'
import { randomUUID } from 'crypto'
import { WORKSPACE_BASE, getWorkspacePath } from '../config/workspace.js'

export const projectService = {
  async findAll(userId?: string): Promise<Project[]> {
    let query = 'SELECT * FROM projects WHERE status != $1'
    const params: any[] = ['deleted']

    if (userId) {
      query += ' AND owner_id = $2'
      params.push(userId)
    }

    query += ' ORDER BY updated_at DESC'

    const result = await pool.query(query, params)
    return result.rows
  },

  async findById(id: string): Promise<Project | undefined> {
    const result = await pool.query('SELECT * FROM projects WHERE id = $1', [id])
    return result.rows[0] || undefined
  },

  async create(data: CreateProjectInput & { owner_id: string }): Promise<Project> {
    const result = await pool.query(
      `INSERT INTO projects (
         name, description, repo_url, owner_id, status,
         type, tech_stack, git_url, git_branch, is_template
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        data.name,
        data.description || null,
        data.repo_url || null,
        data.owner_id,
        'active',
        data.type || 'blank',
        data.tech_stack || null,
        data.git_url || null,
        data.git_branch || 'main',
        data.is_template ?? false,
      ]
    )
    logger.info('Project created', { projectId: result.rows[0].id, name: data.name, type: data.type })
    return result.rows[0]
  },

  async update(id: string, data: UpdateProjectInput): Promise<Project | undefined> {
    const result = await pool.query(
      `UPDATE projects
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           repo_url = COALESCE($3, repo_url),
           status = COALESCE($4, status),
           type = COALESCE($5, type),
           tech_stack = COALESCE($6, tech_stack),
           git_url = COALESCE($7, git_url),
           git_branch = COALESCE($8, git_branch),
           workspace_path = COALESCE($9, workspace_path),
           last_accessed_at = COALESCE($10, last_accessed_at),
           is_template = COALESCE($11, is_template),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $12
       RETURNING *`,
      [
        data.name,
        data.description,
        data.repo_url,
        data.status,
        data.type,
        data.tech_stack,
        data.git_url,
        data.git_branch,
        data.workspace_path,
        data.last_accessed_at,
        data.is_template,
        id,
      ]
    )
    logger.info('Project updated', { projectId: id })
    return result.rows[0] || undefined
  },

  async delete(id: string): Promise<boolean> {
    const result = await pool.query(
      'UPDATE projects SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['deleted', id]
    )
    logger.info('Project deleted', { projectId: id })
    return (result.rowCount ?? 0) > 0
  },

  // Deprecated: members feature removed from API
  // ============ Project Members ============
  async findMembers(projectId: string): Promise<ProjectMember[]> {
    const result = await pool.query(
      `SELECT pm.*, u.username, u.avatar
       FROM project_members pm
       JOIN users u ON pm.user_id = u.id
       WHERE pm.project_id = $1
       ORDER BY pm.joined_at ASC`,
      [projectId]
    )
    return result.rows
  },

  async addMember(projectId: string, userId: string, role: string = 'member'): Promise<ProjectMember> {
    const result = await pool.query(
      `INSERT INTO project_members (project_id, user_id, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (project_id, user_id) DO UPDATE SET role = EXCLUDED.role
       RETURNING *`,
      [projectId, userId, role]
    )
    logger.info('Project member added', { projectId, userId, role })
    return result.rows[0]
  },

  async removeMember(projectId: string, userId: string): Promise<boolean> {
    const result = await pool.query(
      'DELETE FROM project_members WHERE project_id = $1 AND user_id = $2',
      [projectId, userId]
    )
    logger.info('Project member removed', { projectId, userId })
    return (result.rowCount ?? 0) > 0
  },

  async updateMemberRole(projectId: string, userId: string, role: string): Promise<ProjectMember | undefined> {
    const result = await pool.query(
      `UPDATE project_members
       SET role = $1
       WHERE project_id = $2 AND user_id = $3
       RETURNING *`,
      [role, projectId, userId]
    )
    logger.info('Project member role updated', { projectId, userId, role })
    return result.rows[0] || undefined
  },

  async getMemberRole(projectId: string, userId: string): Promise<string | undefined> {
    const result = await pool.query(
      `SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2`,
      [projectId, userId]
    )
    return result.rows[0]?.role
  },

  async countOwners(projectId: string): Promise<number> {
    const result = await pool.query(
      `SELECT COUNT(*) FROM project_members WHERE project_id = $1 AND role = 'owner'`,
      [projectId]
    )
    return parseInt(result.rows[0].count, 10)
  },

  // ============ Project Chat Sessions ============
  async findChatSessions(projectId: string): Promise<any[]> {
    const result = await pool.query(
      `SELECT id, user_id, project_id, title, status, created_at, updated_at
       FROM chat_sessions
       WHERE project_id = $1
       ORDER BY updated_at DESC`,
      [projectId]
    )
    return result.rows
  },

  async archiveChatSessions(projectId: string): Promise<number> {
    const result = await pool.query(
      `UPDATE chat_sessions
       SET status = 'archived', updated_at = CURRENT_TIMESTAMP
       WHERE project_id = $1 AND status = 'active'`,
      [projectId]
    )
    return result.rowCount ?? 0
  },

  // ============ Project Agent Tasks ============
  async findAgentTasks(projectId: string): Promise<any[]> {
    const result = await pool.query(
      `SELECT at.*, cs.title as session_title
       FROM agent_tasks at
       JOIN chat_sessions cs ON at.session_id = cs.id
       WHERE at.project_id = $1
       ORDER BY at.created_at DESC`,
      [projectId]
    )
    return result.rows
  },

  // ============ Project Dashboard ============
  async getDashboard(projectId: string): Promise<any> {
    // 项目基本信息
    const projectResult = await pool.query('SELECT * FROM projects WHERE id = $1', [projectId])
    const project = projectResult.rows[0]

    // 最近 5 个任务
    const tasksResult = await pool.query(
      `SELECT at.id, at.ticket_id, at.worker_role, at.status, at.created_at, cs.title as session_title
       FROM agent_tasks at
       JOIN chat_sessions cs ON at.session_id = cs.id
       WHERE at.project_id = $1
       ORDER BY at.created_at DESC
       LIMIT 5`,
      [projectId]
    )

    // 最近 5 个文件变更（基于 workspace_path 存在且最近访问）
    const filesResult = await pool.query(
      `SELECT workspace_path, updated_at
       FROM projects
       WHERE id = $1 AND workspace_path IS NOT NULL`,
      [projectId]
    )

    // 活跃成员
    const membersResult = await pool.query(
      `SELECT pm.user_id, pm.role, u.username, u.avatar
       FROM project_members pm
       JOIN users u ON pm.user_id = u.id
       WHERE pm.project_id = $1
       ORDER BY pm.joined_at ASC`,
      [projectId]
    )

    // 未读消息数（基于 chat_messages 中未读的统计）
    const unreadResult = await pool.query(
      `SELECT COUNT(*) as count
       FROM chat_messages cm
       JOIN chat_sessions cs ON cm.session_id = cs.id
       WHERE cs.project_id = $1`,
      [projectId]
    )

    return {
      project,
      recentTasks: tasksResult.rows,
      workspaceInfo: filesResult.rows[0] || null,
      activeMembers: membersResult.rows,
      messageCount: parseInt(unreadResult.rows[0]?.count || '0', 10),
    }
  },

  // ============ Workspace Initialization ============
  async initBlankWorkspace(projectId: string, userId: string, techStack: string): Promise<void> {
    const workspacePath = getWorkspacePath(userId, projectId)
    const templatePath = resolve(process.cwd(), 'apps/api/templates', techStack)

    try {
      await mkdir(workspacePath, { recursive: true })
    } catch (mkdirErr) {
      const msg = mkdirErr instanceof Error ? mkdirErr.message : String(mkdirErr)
      logger.error('Failed to create workspace directory', mkdirErr instanceof Error ? mkdirErr : undefined, {
        workspacePath,
        error: msg,
      })
      throw new Error(`Workspace directory creation failed: ${msg}`)
    }

    // 如果模板存在则复制，否则只创建空目录
    try {
      await cp(templatePath, workspacePath, { recursive: true, force: false })
    } catch {
      // 模板不存在，保留空目录
    }

    await pool.query(
      `UPDATE projects SET workspace_path = $1 WHERE id = $2`,
      [workspacePath, projectId]
    )
    logger.info('Blank workspace initialized', { projectId, userId, techStack, workspacePath })
  },
}

// ============ Git Clone Jobs ============
export interface CloneJob {
  jobId: string
  projectId: string
  status: 'cloning' | 'completed' | 'failed'
  error?: string
  startedAt: Date
  completedAt?: Date
}

const cloneJobs = new Map<string, CloneJob>()

async function rollbackClone(projectId: string, workspacePath: string): Promise<void> {
  try {
    await pool.query('DELETE FROM project_members WHERE project_id = $1', [projectId])
    await pool.query('DELETE FROM projects WHERE id = $1', [projectId])
    await rm(workspacePath, { recursive: true, force: true })
    logger.info('Git clone rolled back', { projectId })
  } catch (err) {
    logger.error('Git clone rollback error', err instanceof Error ? err : undefined)
  }
}

export function startGitClone(projectId: string, userId: string, gitUrl: string, gitBranch: string = 'main'): CloneJob {
  const workspacePath = getWorkspacePath(userId, projectId)
  const job: CloneJob = {
    jobId: randomUUID(),
    projectId,
    status: 'cloning',
    startedAt: new Date(),
  }
  cloneJobs.set(job.jobId, job)

  // 异步执行
  runGitClone(job, workspacePath, gitUrl, gitBranch)

  return job
}

async function runGitClone(job: CloneJob, workspacePath: string, gitUrl: string, gitBranch: string): Promise<void> {
  try {
    await mkdir(workspacePath, { recursive: true })

    const child = spawn('git', ['clone', '--branch', gitBranch, '--single-branch', gitUrl, workspacePath], {
      env: process.env,
      timeout: 60 * 1000,
    })

    let stderr = ''
    child.stderr.on('data', (data: Buffer) => {
      stderr += data.toString()
    })

    child.on('close', async (code: number | null) => {
      if (code === 0) {
        job.status = 'completed'
        job.completedAt = new Date()
        await pool.query(
          `UPDATE projects SET workspace_path = $1, git_branch = $2 WHERE id = $3`,
          [workspacePath, gitBranch, job.projectId]
        )
        logger.info('Git clone completed', { jobId: job.jobId, projectId: job.projectId })
      } else {
        job.status = 'failed'
        job.error = stderr.trim() || `Git clone exited with code ${code}`
        job.completedAt = new Date()
        await rollbackClone(job.projectId, workspacePath)
        logger.error('Git clone failed', new Error(job.error), { jobId: job.jobId, projectId: job.projectId })
      }
    })

    child.on('error', async (err: Error) => {
      job.status = 'failed'
      job.error = err.message
      job.completedAt = new Date()
      await rollbackClone(job.projectId, workspacePath)
      logger.error('Git clone spawn error', err)
    })
  } catch (error) {
    job.status = 'failed'
    job.error = error instanceof Error ? error.message : 'Unknown error'
    job.completedAt = new Date()
    await rollbackClone(job.projectId, workspacePath)
    logger.error('Git clone unexpected error', error instanceof Error ? error : undefined)
  }
}

export function getCloneJob(jobId: string): CloneJob | undefined {
  return cloneJobs.get(jobId)
}

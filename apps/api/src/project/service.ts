/**
 * Project Service - CRUD operations for projects
 */

import { pool } from '../config/database.js'
import logger from '../utils/logger.js'
import type { Project, CreateProjectInput, UpdateProjectInput } from './types.js'

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
      `INSERT INTO projects (name, description, repo_url, owner_id, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [data.name, data.description || null, data.repo_url || null, data.owner_id, 'active']
    )
    logger.info('Project created', { projectId: result.rows[0].id, name: data.name })
    return result.rows[0]
  },

  async update(id: string, data: UpdateProjectInput): Promise<Project | undefined> {
    const result = await pool.query(
      `UPDATE projects
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           repo_url = COALESCE($3, repo_url),
           status = COALESCE($4, status),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING *`,
      [data.name, data.description, data.repo_url, data.status, id]
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
}

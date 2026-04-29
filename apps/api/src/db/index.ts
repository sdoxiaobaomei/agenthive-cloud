// PostgreSQL 数据访问层
import { pool } from '../config/database.js'
import type { Agent, Task, User } from '../types/index.js'

// 模拟延迟（保持与原来一致的 API 响应时间体验）
export const delay = (ms = 300) => new Promise(resolve => setTimeout(resolve, ms))

// ============ Users ============
function isInvalidUUID(err: any): boolean {
  return err?.code === '22P02'
}

export const userDb = {
  findById: async (id: string): Promise<User | undefined> => {
    try {
      const result = await pool.query('SELECT * FROM users WHERE id = $1', [id])
      return result.rows[0] || undefined
    } catch (err) {
      if (isInvalidUUID(err)) return undefined
      throw err
    }
  },

  findByPhone: async (phone: string): Promise<User | undefined> => {
    const result = await pool.query('SELECT * FROM users WHERE phone = $1', [phone])
    return result.rows[0] || undefined
  },

  findByUsername: async (username: string): Promise<User | undefined> => {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username])
    return result.rows[0] || undefined
  },

  findByExternalId: async (externalId: string): Promise<User | undefined> => {
    const result = await pool.query('SELECT * FROM users WHERE external_user_id = $1', [externalId])
    return result.rows[0] || undefined
  },

  create: async (data: Partial<User>): Promise<User> => {
    const result = await pool.query(
      `INSERT INTO users (username, phone, email, role, avatar, password_hash, external_user_id) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING *`,
      [
        data.username || `user_${Math.random().toString(36).substring(2, 8)}`,
        data.phone,
        data.email,
        data.role || 'user',
        data.avatar,
        data.password_hash,
        data.external_user_id,
      ]
    )
    return result.rows[0]
  },

  update: async (id: string, data: Partial<User>): Promise<User | undefined> => {
    const result = await pool.query(
      `UPDATE users 
       SET username = COALESCE($1, username),
           phone = COALESCE($2, phone),
           email = COALESCE($3, email),
           role = COALESCE($4, role),
           avatar = COALESCE($5, avatar)
       WHERE id = $6 
       RETURNING *`,
      [data.username, data.phone, data.email, data.role, data.avatar, id]
    )
    return result.rows[0] || undefined
  },

  delete: async (id: string): Promise<boolean> => {
    const result = await pool.query('DELETE FROM users WHERE id = $1', [id])
    return result.rowCount ? result.rowCount > 0 : false
  },

  getAll: async (): Promise<User[]> => {
    const result = await pool.query('SELECT * FROM users ORDER BY created_at DESC')
    return result.rows
  },
}

// ============ Agents ============
export const agentDb = {
  findById: async (id: string): Promise<Agent | undefined> => {
    try {
      const result = await pool.query('SELECT * FROM agents WHERE id = $1', [id])
      return result.rows[0] || undefined
    } catch (err) {
      if (isInvalidUUID(err)) return undefined
      throw err
    }
  },

  findAll: async (): Promise<Agent[]> => {
    const result = await pool.query('SELECT * FROM agents ORDER BY created_at DESC')
    return result.rows
  },

  create: async (data: Partial<Agent>): Promise<Agent> => {
    const result = await pool.query(
      `INSERT INTO agents (name, role, status, description, avatar, pod_ip, config, current_task_id) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
       RETURNING *`,
      [
        data.name || 'New Agent',
        data.role || 'custom',
        data.status || 'idle',
        data.description,
        data.avatar,
        data.pod_ip || data.podIp,
        JSON.stringify(data.config || {}),
        data.currentTask?.id,
      ]
    )
    return result.rows[0]
  },

  update: async (id: string, data: Partial<Agent>): Promise<Agent | undefined> => {
    const result = await pool.query(
      `UPDATE agents 
       SET name = COALESCE($1, name),
           role = COALESCE($2, role),
           status = COALESCE($3, status),
           description = COALESCE($4, description),
           avatar = COALESCE($5, avatar),
           pod_ip = COALESCE($6, pod_ip),
           config = COALESCE($7, config),
           last_heartbeat_at = COALESCE($8, last_heartbeat_at)
       WHERE id = $9 
       RETURNING *`,
      [
        data.name,
        data.role,
        data.status,
        data.description,
        data.avatar,
        data.podIp,
        data.config ? JSON.stringify(data.config) : undefined,
        data.last_heartbeat_at || data.lastHeartbeatAt,
        id,
      ]
    )
    return result.rows[0] || undefined
  },

  delete: async (id: string): Promise<boolean> => {
    const result = await pool.query('DELETE FROM agents WHERE id = $1', [id])
    return result.rowCount ? result.rowCount > 0 : false
  },
}

function mapTaskRow(row: any): Task {
  if (!row) return row
  return {
    ...row,
    assignedTo: row.assigned_to,
    parentId: row.parent_id,
    createdAt: row.created_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  }
}

function isValidUUID(value: string | undefined): boolean {
  if (!value) return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

// ============ Tasks ============
export const taskDb = {
  findById: async (id: string): Promise<Task | undefined> => {
    try {
      const result = await pool.query('SELECT * FROM tasks WHERE id = $1', [id])
      return mapTaskRow(result.rows[0]) || undefined
    } catch (err) {
      if (isInvalidUUID(err)) return undefined
      throw err
    }
  },

  findAll: async (filters?: { status?: string; assignedTo?: string }): Promise<Task[]> => {
    let query = 'SELECT * FROM tasks WHERE 1=1'
    const params: any[] = []
    let paramIndex = 1

    if (filters?.status) {
      query += ` AND status = $${paramIndex++}`
      params.push(filters.status)
    }
    if (filters?.assignedTo) {
      if (isValidUUID(filters.assignedTo)) {
        query += ` AND assigned_to = $${paramIndex++}`
        params.push(filters.assignedTo)
      } else {
        return []
      }
    }

    query += ' ORDER BY created_at DESC'

    const result = await pool.query(query, params)
    return result.rows.map(mapTaskRow)
  },

  create: async (data: Partial<Task>): Promise<Task> => {
    const result = await pool.query(
      `INSERT INTO tasks (title, description, type, status, priority, progress, assigned_to, parent_id, input, output) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
       RETURNING *`,
      [
        data.title || 'New Task',
        data.description,
        data.type || 'feature',
        data.status || 'pending',
        data.priority || 'medium',
        data.progress || 0,
        isValidUUID(data.assignedTo) ? data.assignedTo : null,
        isValidUUID(data.parentId) ? data.parentId : null,
        JSON.stringify(data.input || {}),
        data.output ? JSON.stringify(data.output) : null,
      ]
    )
    return mapTaskRow(result.rows[0])
  },

  update: async (id: string, data: Partial<Task>): Promise<Task | undefined> => {
    const result = await pool.query(
      `UPDATE tasks 
       SET title = COALESCE($1, title),
           description = COALESCE($2, description),
           type = COALESCE($3, type),
           status = COALESCE($4, status),
           priority = COALESCE($5, priority),
           progress = COALESCE($6, progress),
           assigned_to = COALESCE($7, assigned_to),
           input = COALESCE($8, input),
           output = COALESCE($9, output),
           completed_at = CASE WHEN $4 = 'completed' THEN CURRENT_TIMESTAMP ELSE completed_at END
       WHERE id = $10 
       RETURNING *`,
      [
        data.title,
        data.description,
        data.type,
        data.status,
        data.priority,
        data.progress,
        isValidUUID(data.assignedTo) ? data.assignedTo : undefined,
        data.input ? JSON.stringify(data.input) : undefined,
        data.output ? JSON.stringify(data.output) : undefined,
        id,
      ]
    )
    return mapTaskRow(result.rows[0]) || undefined
  },

  delete: async (id: string): Promise<boolean> => {
    const result = await pool.query('DELETE FROM tasks WHERE id = $1', [id])
    return result.rowCount ? result.rowCount > 0 : false
  },

  findSubtasks: async (parentId: string): Promise<Task[]> => {
    const result = await pool.query(
      'SELECT * FROM tasks WHERE parent_id = $1 ORDER BY created_at DESC',
      [parentId]
    )
    return result.rows.map(mapTaskRow)
  },
}

// ============ Projects ============
export const projectDb = {
  findById: async (id: string): Promise<any | undefined> => {
    try {
      const result = await pool.query('SELECT * FROM projects WHERE id = $1', [id])
      return result.rows[0] || undefined
    } catch (err) {
      if (isInvalidUUID(err)) return undefined
      throw err
    }
  },

  findAll: async (userId?: string): Promise<any[]> => {
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

  create: async (data: any): Promise<any> => {
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
    return result.rows[0]
  },

  update: async (id: string, data: any): Promise<any | undefined> => {
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
    return result.rows[0] || undefined
  },

  delete: async (id: string): Promise<boolean> => {
    const result = await pool.query('DELETE FROM projects WHERE id = $1', [id])
    return result.rowCount ? result.rowCount > 0 : false
  },
}

// ============ Chat Sessions ============
export const chatSessionDb = {
  findById: async (id: string): Promise<any | undefined> => {
    try {
      const result = await pool.query('SELECT * FROM chat_sessions WHERE id = $1', [id])
      return result.rows[0] || undefined
    } catch (err) {
      if (isInvalidUUID(err)) return undefined
      throw err
    }
  },

  findAllByUser: async (userId: string): Promise<any[]> => {
    const result = await pool.query(
      'SELECT * FROM chat_sessions WHERE user_id = $1 AND status = $2 ORDER BY updated_at DESC',
      [userId, 'active']
    )
    return result.rows
  },

  create: async (data: any): Promise<any> => {
    const result = await pool.query(
      `INSERT INTO chat_sessions (user_id, project_id, title, status)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [data.userId, data.projectId || null, data.title || '新会话', 'active']
    )
    return result.rows[0]
  },

  update: async (id: string, data: any): Promise<any | undefined> => {
    const result = await pool.query(
      `UPDATE chat_sessions
       SET title = COALESCE($1, title),
           project_id = COALESCE($2, project_id),
           status = COALESCE($3, status),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [data.title, data.projectId, data.status, id]
    )
    return result.rows[0] || undefined
  },

  delete: async (id: string): Promise<boolean> => {
    const result = await pool.query('DELETE FROM chat_sessions WHERE id = $1', [id])
    return result.rowCount ? result.rowCount > 0 : false
  },
}

// ============ Chat Messages ============
export const chatMessageDb = {
  findBySession: async (sessionId: string, limit: number = 50, offset: number = 0): Promise<any[]> => {
    const result = await pool.query(
      `SELECT * FROM chat_messages
       WHERE session_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [sessionId, limit, offset]
    )
    return result.rows.reverse()
  },

  create: async (data: any): Promise<any> => {
    const result = await pool.query(
      `INSERT INTO chat_messages (session_id, role, content, metadata)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [data.sessionId, data.role, data.content, JSON.stringify(data.metadata || {})]
    )
    return result.rows[0]
  },
}

// ============ Agent Tasks ============
export const agentTaskDb = {
  findBySession: async (sessionId: string): Promise<any[]> => {
    const result = await pool.query(
      'SELECT * FROM agent_tasks WHERE session_id = $1 ORDER BY created_at DESC',
      [sessionId]
    )
    return result.rows
  },

  findById: async (id: string): Promise<any | undefined> => {
    try {
      const result = await pool.query('SELECT * FROM agent_tasks WHERE id = $1', [id])
      return result.rows[0] || undefined
    } catch (err) {
      if (isInvalidUUID(err)) return undefined
      throw err
    }
  },

  create: async (data: any): Promise<any> => {
    const result = await pool.query(
      `INSERT INTO agent_tasks (session_id, ticket_id, worker_role, status, workspace_path, result)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [data.sessionId, data.ticketId, data.workerRole, data.status || 'pending', data.workspacePath, JSON.stringify(data.result || {})]
    )
    return result.rows[0]
  },

  update: async (id: string, data: any): Promise<any | undefined> => {
    const result = await pool.query(
      `UPDATE agent_tasks
       SET status = COALESCE($1, status),
           result = COALESCE($2, result),
           started_at = COALESCE($3, started_at),
           completed_at = COALESCE($4, completed_at)
       WHERE id = $5
       RETURNING *`,
      [data.status, data.result ? JSON.stringify(data.result) : undefined, data.startedAt, data.completedAt, id]
    )
    return result.rows[0] || undefined
  },
}

// ============ Agent Logs ============
export const logDb = {
  getLogs: async (agentId: string, limit: number = 100): Promise<string[]> => {
    const result = await pool.query(
      `SELECT message FROM agent_logs 
       WHERE agent_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2`,
      [agentId, limit]
    )
    return result.rows.map(row => row.message).reverse()
  },

  addLog: async (agentId: string, message: string, level: string = 'info'): Promise<void> => {
    await pool.query(
      'INSERT INTO agent_logs (agent_id, message, level) VALUES ($1, $2, $3)',
      [agentId, message, level]
    )
  },

  clearLogs: async (agentId: string): Promise<void> => {
    await pool.query('DELETE FROM agent_logs WHERE agent_id = $1', [agentId])
  },
}

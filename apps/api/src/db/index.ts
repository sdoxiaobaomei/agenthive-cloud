// PostgreSQL 数据访问层
import { pool } from '../config/database.js'
import type { Agent, Task, User } from '../types/index.js'
import type {
  UserCreateInput,
  UserUpdateInput,
  UserRow,
  AgentCreateInput,
  AgentUpdateInput,
  AgentRow,
  TaskCreateInput,
  TaskUpdateInput,
  TaskFilterInput,
  TaskRow,
  MappedTask,
  ProjectCreateInput,
  ProjectUpdateInput,
  ProjectRow,
  ChatSessionCreateInput,
  ChatSessionUpdateInput,
  ChatSessionRow,
  ChatMessageCreateInput,
  ChatMessageRow,
  AgentTaskCreateInput,
  AgentTaskUpdateInput,
  AgentTaskRow,
} from './types.js'

// 模拟延迟（保持与原来一致的 API 响应时间体验）
export const delay = (ms = 300) => new Promise(resolve => setTimeout(resolve, ms))

// ============ Shared Helpers ============

/** PostgreSQL error code for invalid UUID format */
const PG_INVALID_UUID_CODE = '22P02'

/** Check if a PostgreSQL error is an invalid UUID error */
function isInvalidUUID(err: unknown): boolean {
  return err instanceof Error && 'code' in err && (err as { code: string }).code === PG_INVALID_UUID_CODE
}

/**
 * Execute a query by ID, returning undefined for invalid UUID format
 * instead of throwing. Eliminates the repeated try/catch-isInvalidUUID pattern.
 */
async function safeQueryById<T>(
  sql: string,
  id: string
): Promise<T | undefined> {
  try {
    const result = await pool.query(sql, [id])
    return (result.rows[0] as T | undefined) ?? undefined
  } catch (err) {
    if (isInvalidUUID(err)) return undefined
    throw err
  }
}

/** Validate a string looks like a UUID v4 — accepts null/undefined for convenience */
function isValidUUID(value: string | null | undefined): boolean {
  if (!value) return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

// ============ Users ============

export const userDb = {
  findById: (id: string): Promise<User | undefined> =>
    safeQueryById<User>('SELECT * FROM users WHERE id = $1', id),

  findByPhone: async (phone: string): Promise<User | undefined> => {
    const result = await pool.query('SELECT * FROM users WHERE phone = $1', [phone])
    return (result.rows[0] as User | undefined) ?? undefined
  },

  findByUsername: async (username: string): Promise<User | undefined> => {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username])
    return (result.rows[0] as User | undefined) ?? undefined
  },

  findByExternalId: async (externalId: string): Promise<User | undefined> => {
    const result = await pool.query('SELECT * FROM users WHERE external_user_id = $1', [externalId])
    return (result.rows[0] as User | undefined) ?? undefined
  },

  create: async (data: UserCreateInput): Promise<User> => {
    const result = await pool.query(
      `INSERT INTO users (username, phone, email, role, password_hash, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        data.username || `user_${Math.random().toString(36).substring(2, 8)}`,
        data.phone ?? null,
        data.email || `${data.username || 'user'}@test.local`,
        data.role || 'user',
        data.password_hash ?? null,
        'active',
      ]
    )
    return result.rows[0] as User
  },

  update: async (id: string, data: UserUpdateInput): Promise<User | undefined> => {
    const result = await pool.query(
      `UPDATE users
       SET username = COALESCE($1, username),
           phone = COALESCE($2, phone),
           email = COALESCE($3, email),
           role = COALESCE($4, role),
           status = COALESCE($5, status)
       WHERE id = $6
       RETURNING *`,
      [data.username, data.phone, data.email, data.role, data.status, id]
    )
    return (result.rows[0] as User | undefined) ?? undefined
  },

  delete: async (id: string): Promise<boolean> => {
    const result = await pool.query('DELETE FROM users WHERE id = $1', [id])
    return (result.rowCount ?? 0) > 0
  },

  getAll: async (): Promise<User[]> => {
    const result = await pool.query('SELECT * FROM users ORDER BY created_at DESC')
    return result.rows as User[]
  },
}

// ============ Agents ============

export const agentDb = {
  findById: (id: string): Promise<Agent | undefined> =>
    safeQueryById<Agent>('SELECT * FROM agents WHERE id = $1', id),

  findAll: async (): Promise<Agent[]> => {
    const result = await pool.query('SELECT * FROM agents ORDER BY created_at DESC')
    return result.rows as Agent[]
  },

  create: async (data: AgentCreateInput): Promise<Agent> => {
    const result = await pool.query(
      `INSERT INTO agents (name, role, status, description, config, owner_id, project_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        data.name || 'New Agent',
        data.role || 'custom',
        data.status || 'idle',
        data.description ?? null,
        JSON.stringify(data.config || {}),
        data.owner_id ?? null,
        data.project_id ?? null,
      ]
    )
    return result.rows[0] as Agent
  },

  update: async (id: string, data: AgentUpdateInput): Promise<Agent | undefined> => {
    const result = await pool.query(
      `UPDATE agents
       SET name = COALESCE($1, name),
           role = COALESCE($2, role),
           status = COALESCE($3, status),
           description = COALESCE($4, description),
           config = COALESCE($5, config),
           owner_id = COALESCE($6, owner_id)
       WHERE id = $7
       RETURNING *`,
      [
        data.name,
        data.role,
        data.status,
        data.description,
        data.config ? JSON.stringify(data.config) : undefined,
        data.owner_id,
        id,
      ]
    )
    return (result.rows[0] as Agent | undefined) ?? undefined
  },

  delete: async (id: string): Promise<boolean> => {
    const result = await pool.query('DELETE FROM agents WHERE id = $1', [id])
    return (result.rowCount ?? 0) > 0
  },
}

/** Map a DB task row to a Task object with camelCase aliases */
function mapTaskRow(row: TaskRow | undefined): MappedTask | undefined {
  if (!row) return undefined
  return {
    ...row,
    assignedTo: row.assigned_to,
    userId: row.user_id,
    projectId: row.project_id,
    parentId: row.parent_id ?? undefined,
    input: typeof row.input === 'string' ? JSON.parse(row.input) : row.input,
    output: row.output ? (typeof row.output === 'string' ? JSON.parse(row.output) : row.output) : null,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  }
}

// ============ Tasks ============

export const taskDb = {
  findById: async (id: string): Promise<MappedTask | undefined> => {
    const row = await safeQueryById<TaskRow>('SELECT * FROM tasks WHERE id = $1', id)
    return mapTaskRow(row)
  },

  findAll: async (filters?: TaskFilterInput): Promise<MappedTask[]> => {
    let query = 'SELECT * FROM tasks WHERE 1=1'
    const params: string[] = []
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
    return result.rows.map((row: TaskRow) => mapTaskRow(row)!)
  },

  create: async (data: TaskCreateInput): Promise<MappedTask> => {
    const result = await pool.query(
      `INSERT INTO tasks (title, description, type, status, priority, progress, assigned_to, user_id, project_id, input, output)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        data.title || 'New Task',
        data.description ?? null,
        data.type || 'feature',
        data.status || 'pending',
        data.priority || 'medium',
        data.progress || 0,
        isValidUUID(data.assignedTo) ? data.assignedTo : null,
        isValidUUID(data.userId ?? data.user_id) ? (data.userId ?? data.user_id) : null,
        isValidUUID(data.projectId ?? data.project_id) ? (data.projectId ?? data.project_id) : null,
        JSON.stringify(data.input || {}),
        data.output ? JSON.stringify(data.output) : null,
      ]
    )
    return mapTaskRow(result.rows[0] as TaskRow)!
  },

  update: async (id: string, data: TaskUpdateInput): Promise<MappedTask | undefined> => {
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
    return mapTaskRow(result.rows[0] as TaskRow | undefined)
  },

  delete: async (id: string): Promise<boolean> => {
    const result = await pool.query('DELETE FROM tasks WHERE id = $1', [id])
    return (result.rowCount ?? 0) > 0
  },

  findSubtasks: async (parentId: string): Promise<MappedTask[]> => {
    if (!isValidUUID(parentId)) return []
    const result = await pool.query(
      'SELECT * FROM tasks WHERE project_id = $1 ORDER BY created_at DESC',
      [parentId]
    )
    return result.rows.map((row: TaskRow) => mapTaskRow(row)!)
  },
}

// ============ Projects ============

export const projectDb = {
  findById: (id: string): Promise<ProjectRow | undefined> =>
    safeQueryById<ProjectRow>('SELECT * FROM projects WHERE id = $1', id),

  findAll: async (userId?: string): Promise<ProjectRow[]> => {
    let query = 'SELECT * FROM projects WHERE status != $1'
    const params: string[] = ['deleted']
    if (userId) {
      query += ' AND owner_id = $2'
      params.push(userId)
    }
    query += ' ORDER BY updated_at DESC'
    const result = await pool.query(query, params)
    return result.rows as ProjectRow[]
  },

  create: async (data: ProjectCreateInput): Promise<ProjectRow> => {
    const result = await pool.query(
      `INSERT INTO projects (
         name, description, repo_url, owner_id, status,
         type, tech_stack, git_url, git_branch, is_template
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        data.name,
        data.description ?? null,
        data.repo_url ?? null,
        data.owner_id,
        'active',
        data.type || 'blank',
        data.tech_stack ?? null,
        data.git_url ?? null,
        data.git_branch || 'main',
        data.is_template ?? false,
      ]
    )
    return result.rows[0] as ProjectRow
  },

  update: async (id: string, data: ProjectUpdateInput): Promise<ProjectRow | undefined> => {
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
    return (result.rows[0] as ProjectRow | undefined) ?? undefined
  },

  delete: async (id: string): Promise<boolean> => {
    const result = await pool.query('DELETE FROM projects WHERE id = $1', [id])
    return (result.rowCount ?? 0) > 0
  },
}

// ============ Chat Sessions ============

export const chatSessionDb = {
  findById: (id: string): Promise<ChatSessionRow | undefined> =>
    safeQueryById<ChatSessionRow>('SELECT * FROM chat_sessions WHERE id = $1', id),

  findAllByUser: async (userId: string): Promise<ChatSessionRow[]> => {
    const result = await pool.query(
      'SELECT * FROM chat_sessions WHERE user_id = $1 AND status = $2 ORDER BY updated_at DESC',
      [userId, 'active']
    )
    return result.rows as ChatSessionRow[]
  },

  create: async (data: ChatSessionCreateInput): Promise<ChatSessionRow> => {
    const result = await pool.query(
      `INSERT INTO chat_sessions (user_id, project_id, title, status)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [data.userId, data.projectId ?? null, data.title || '新会话', 'active']
    )
    return result.rows[0] as ChatSessionRow
  },

  update: async (id: string, data: ChatSessionUpdateInput): Promise<ChatSessionRow | undefined> => {
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
    return (result.rows[0] as ChatSessionRow | undefined) ?? undefined
  },

  delete: async (id: string): Promise<boolean> => {
    const result = await pool.query('DELETE FROM chat_sessions WHERE id = $1', [id])
    return (result.rowCount ?? 0) > 0
  },
}

// ============ Chat Messages ============

export const chatMessageDb = {
  findBySession: async (sessionId: string, limit: number = 50, offset: number = 0): Promise<ChatMessageRow[]> => {
    const result = await pool.query(
      `SELECT * FROM chat_messages
       WHERE session_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [sessionId, limit, offset]
    )
    return (result.rows as ChatMessageRow[]).reverse()
  },

  create: async (data: ChatMessageCreateInput): Promise<ChatMessageRow> => {
    const result = await pool.query(
      `INSERT INTO chat_messages (session_id, role, content, metadata)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [data.sessionId, data.role, data.content, JSON.stringify(data.metadata || {})]
    )
    return result.rows[0] as ChatMessageRow
  },
}

// ============ Agent Tasks ============

export const agentTaskDb = {
  findBySession: async (sessionId: string): Promise<AgentTaskRow[]> => {
    const result = await pool.query(
      'SELECT * FROM agent_tasks WHERE session_id = $1 ORDER BY created_at DESC',
      [sessionId]
    )
    return result.rows as AgentTaskRow[]
  },

  findById: (id: string): Promise<AgentTaskRow | undefined> =>
    safeQueryById<AgentTaskRow>('SELECT * FROM agent_tasks WHERE id = $1', id),

  create: async (data: AgentTaskCreateInput): Promise<AgentTaskRow> => {
    const result = await pool.query(
      `INSERT INTO agent_tasks (session_id, ticket_id, worker_role, status, workspace_path, result)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [data.sessionId, data.ticketId, data.workerRole, data.status || 'pending', data.workspacePath ?? null, JSON.stringify(data.result || {})]
    )
    return result.rows[0] as AgentTaskRow
  },

  update: async (id: string, data: AgentTaskUpdateInput): Promise<AgentTaskRow | undefined> => {
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
    return (result.rows[0] as AgentTaskRow | undefined) ?? undefined
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
    return result.rows.map((row: { message: string }) => row.message).reverse()
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

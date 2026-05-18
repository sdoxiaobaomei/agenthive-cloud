/**
 * Database row & input types for the DAO layer.
 *
 * Row types mirror PostgreSQL column names (snake_case).
 * Create/Update input types use camelCase matching the application layer.
 */

// ============ User ============

/** Raw DB row shape (snake_case columns) */
export interface UserRow {
  id: string
  username: string
  email: string | null
  phone: string | null
  password_hash: string | null
  role: string
  status: string
  avatar: string | null
  external_user_id: string | null
  created_at: string
  updated_at: string
}

/** Input for userDb.create — matches what callers actually pass */
export interface UserCreateInput {
  username?: string
  phone?: string | null
  email?: string | null
  role?: string
  password_hash?: string | null
  external_user_id?: string | null
  avatar?: string | null
}

/** Input for userDb.update — all fields optional */
export interface UserUpdateInput {
  username?: string | null
  phone?: string | null
  email?: string | null
  role?: string | null
  status?: string | null
  external_user_id?: string | null
  avatar?: string | null
}

// ============ Agent ============

export interface AgentRow {
  id: string
  name: string
  role: string
  status: string
  avatar: string | null
  description: string | null
  config: string // JSON string from DB
  owner_id: string | null
  project_id: string | null
  pod_ip: string | null
  current_task_id: string | null
  last_heartbeat_at: string | null
  created_at: string
  updated_at: string
}

export interface AgentCreateInput {
  name?: string
  role?: string
  status?: string
  description?: string | null
  config?: Record<string, unknown>
  owner_id?: string | null
  project_id?: string | null
}

export interface AgentUpdateInput {
  name?: string | null
  role?: string | null
  status?: string | null
  description?: string | null
  config?: Record<string, unknown> | null
  owner_id?: string | null
}

// ============ Task ============

export interface TaskRow {
  id: string
  title: string
  description: string | null
  type: string
  status: string
  priority: string
  progress: number
  assigned_to: string | null
  user_id: string | null
  project_id: string | null
  parent_id: string | null
  input: string // JSON string from DB
  output: string | null // JSON string from DB
  created_at: string
  started_at: string | null
  completed_at: string | null
}

export interface TaskCreateInput {
  title?: string
  description?: string | null
  type?: string
  status?: string
  priority?: string
  progress?: number
  assignedTo?: string | null
  userId?: string | null
  user_id?: string | null
  projectId?: string | null
  project_id?: string | null
  input?: Record<string, unknown>
  output?: Record<string, unknown> | null
}

export interface TaskUpdateInput {
  title?: string | null
  description?: string | null
  type?: string | null
  status?: string | null
  priority?: string | null
  progress?: number | null
  assignedTo?: string | null
  input?: Record<string, unknown> | null
  output?: Record<string, unknown> | null
}

export interface TaskFilterInput {
  status?: string
  assignedTo?: string
}

/** Mapped Task with camelCase aliases */
export interface MappedTask {
  id: string
  title: string
  description: string | null
  type: string
  status: string
  priority: string
  progress: number
  assigned_to: string | null
  assignedTo: string | null
  user_id: string | null
  userId: string | null
  project_id: string | null
  projectId: string | null
  parent_id?: string | null
  parentId?: string | null
  input: Record<string, unknown>
  output: Record<string, unknown> | null
  created_at: string
  started_at: string | null
  startedAt?: string | null
  completed_at: string | null
  completedAt?: string | null
}

// ============ Project ============

export interface ProjectRow {
  id: string
  name: string
  description: string | null
  repo_url: string | null
  owner_id: string | null
  status: string
  type: string
  tech_stack: string | null
  git_url: string | null
  git_branch: string
  is_template: boolean
  workspace_path: string | null
  last_accessed_at: string | null
  created_at: string
  updated_at: string
}

export interface ProjectCreateInput {
  name: string
  description?: string | null
  repo_url?: string | null
  owner_id: string
  type?: string
  tech_stack?: string | null
  git_url?: string | null
  git_branch?: string
  is_template?: boolean
}

export interface ProjectUpdateInput {
  name?: string | null
  description?: string | null
  repo_url?: string | null
  status?: string | null
  type?: string | null
  tech_stack?: string | null
  git_url?: string | null
  git_branch?: string | null
  workspace_path?: string | null
  last_accessed_at?: string | null
  is_template?: boolean | null
}

// ============ Chat Session ============

export interface ChatSessionRow {
  id: string
  user_id: string
  workspace_id: string | null
  project_id: string | null
  title: string
  status: string
  session_type: string
  current_version_id: string | null
  created_at: string
  updated_at: string
}

export interface ChatSessionCreateInput {
  userId: string
  projectId?: string | null
  title?: string
  sessionType?: string
}

export interface ChatSessionUpdateInput {
  title?: string | null
  projectId?: string | null
  status?: string | null
}

// ============ Chat Message ============

export interface ChatMessageRow {
  id: string
  session_id: string
  version_id: string | null
  role: string
  message_type: string
  content: string
  metadata: string // JSON string from DB
  is_visible_in_history: boolean
  created_at: string
}

export interface ChatMessageCreateInput {
  sessionId: string
  role: string
  content: string
  metadata?: Record<string, unknown>
  messageType?: string
  versionId?: string | null
  isVisibleInHistory?: boolean
}

// ============ Agent Task ============

export interface AgentTaskRow {
  id: string
  session_id: string
  project_id: string | null
  ticket_id: string
  worker_role: string
  status: string
  workspace_path: string | null
  result: string | null // JSON string from DB
  started_at: string | null
  completed_at: string | null
  created_at: string
}

export interface AgentTaskCreateInput {
  sessionId: string
  ticketId: string
  workerRole: string
  status?: string
  workspacePath?: string | null
  result?: Record<string, unknown>
}

export interface AgentTaskUpdateInput {
  status?: string | null
  result?: Record<string, unknown> | null
  startedAt?: string | null
  completedAt?: string | null
}

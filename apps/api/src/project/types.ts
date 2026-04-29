/**
 * Project module types
 */

export interface Project {
  id: string
  name: string
  description?: string
  repo_url?: string
  owner_id: string
  status: 'active' | 'archived' | 'deleted'
  type: 'blank' | 'git-import' | string
  tech_stack?: string
  git_url?: string
  git_branch?: string
  workspace_path?: string
  last_accessed_at?: string
  is_template?: boolean
  created_at: string
  updated_at: string
}

export interface ProjectMember {
  id: string
  project_id: string
  user_id: string
  role: 'owner' | 'admin' | 'member' | 'viewer'
  joined_at: string
}

export interface CreateProjectInput {
  name: string
  description?: string
  repo_url?: string
  type?: 'blank' | 'git-import'
  tech_stack?: string
  git_url?: string
  git_branch?: string
  is_template?: boolean
}

export interface UpdateProjectInput {
  name?: string
  description?: string
  repo_url?: string
  status?: 'active' | 'archived' | 'deleted'
  type?: 'blank' | 'git-import'
  tech_stack?: string
  git_url?: string
  git_branch?: string
  workspace_path?: string
  last_accessed_at?: string
  is_template?: boolean
}

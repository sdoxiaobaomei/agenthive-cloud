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
  created_at: string
  updated_at: string
}

export interface CreateProjectInput {
  name: string
  description?: string
  repo_url?: string
}

export interface UpdateProjectInput {
  name?: string
  description?: string
  repo_url?: string
  status?: 'active' | 'archived' | 'deleted'
}

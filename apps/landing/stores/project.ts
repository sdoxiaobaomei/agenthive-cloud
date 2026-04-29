import { defineStore } from 'pinia'
import type { PaginatedResponse, PaginationParams } from '@agenthive/types'

/** 项目信息 */
export interface Project {
  id: string
  name: string
  description?: string
  avatar?: string
  status: 'active' | 'archived' | 'deleted'
  ownerId: string
  memberCount: number
  taskCount: number
  createdAt: string
  updatedAt: string
  /** 扩展字段：技术栈（FEAT-001a） */
  techStack?: string
  /** 扩展字段：项目类型 */
  type?: 'blank' | 'git-import' | string
  /** 扩展字段：Git 地址 */
  gitUrl?: string
  /** 扩展字段：最后访问时间 */
  lastAccessedAt?: string
}

/** 项目成员 */
export interface ProjectMember {
  id: string
  userId: string
  name: string
  avatar?: string
  role: 'owner' | 'admin' | 'member' | 'viewer'
  joinedAt: string
}

/** 视图模式 */
export type ViewMode = 'card' | 'table'

/** 项目状态过滤 */
export type StatusFilter = 'all' | 'active' | 'archived'

/** 项目状态 */
interface ProjectState {
  projects: Project[]
  currentProject: Project | null
  members: ProjectMember[]
  loading: boolean
  error: string | null
  /** 列表视图模式 */
  viewMode: ViewMode
  /** 状态过滤 */
  statusFilter: StatusFilter
  /** 当前页码 */
  currentPage: number
  /** 每页条数 */
  itemsPerPage: number
}

export const useProjectStore = defineStore('project', {
  state: (): ProjectState => ({
    projects: [],
    currentProject: null,
    members: [],
    loading: false,
    error: null,
    viewMode: 'card',
    statusFilter: 'all',
    currentPage: 1,
    itemsPerPage: 12,
  }),

  getters: {
    /** 获取当前项目ID */
    currentProjectId: (state): string | null => state.currentProject?.id || null,

    /** 获取项目数量 */
    projectCount: (state): number => state.projects.length,

    /** 获取活跃项目 */
    activeProjects: (state): Project[] => 
      state.projects.filter(p => p.status === 'active'),

    /** 是否已选择项目 */
    hasSelectedProject: (state): boolean => !!state.currentProject,

    /** 获取当前项目名称 */
    currentProjectName: (state): string => state.currentProject?.name || '',

    /** 过滤后的项目列表（根据状态过滤） */
    filteredProjects: (state): Project[] => {
      let result = state.projects
      if (state.statusFilter !== 'all') {
        result = result.filter(p => p.status === state.statusFilter)
      }
      return result
    },

    /** 分页后的项目列表 */
    paginatedProjects: (state): Project[] => {
      const filtered = state.projects
      if (state.statusFilter !== 'all') {
        // Re-filter to avoid circular dependency issues with getters in options api
        const filteredList = state.projects.filter(p => p.status === state.statusFilter)
        const start = (state.currentPage - 1) * state.itemsPerPage
        return filteredList.slice(start, start + state.itemsPerPage)
      }
      const start = (state.currentPage - 1) * state.itemsPerPage
      return filtered.slice(start, start + state.itemsPerPage)
    },

    /** 过滤后的总数 */
    filteredTotal: (state): number => {
      if (state.statusFilter !== 'all') {
        return state.projects.filter(p => p.status === state.statusFilter).length
      }
      return state.projects.length
    },

    /** 总页数 */
    totalPages: (state): number => {
      const total = state.statusFilter !== 'all'
        ? state.projects.filter(p => p.status === state.statusFilter).length
        : state.projects.length
      return Math.ceil(total / state.itemsPerPage)
    },
  },

  actions: {
    /**
     * 设置当前项目
     * @param project 项目信息或项目ID
     */
    setCurrentProject(project: Project | string | null): void {
      if (project === null) {
        this.currentProject = null
        return
      }

      if (typeof project === 'string') {
        const found = this.projects.find(p => p.id === project)
        if (found) {
          this.currentProject = found
        }
      } else {
        this.currentProject = project
        // 如果项目不在列表中，添加到列表
        const exists = this.projects.find(p => p.id === project.id)
        if (!exists) {
          this.projects.push(project)
        }
      }
    },

    /**
     * 获取项目列表 - 使用 useApi() 调用真实 API
     * @param params 分页参数
     */
    async fetchProjects(params?: PaginationParams): Promise<Project[]> {
      const { get } = useApi()
      
      this.loading = true
      this.error = null

      try {
        // 调用真实 API 获取项目列表
        const queryParams = params ? new URLSearchParams()
          : undefined
        
        if (params) {
          if (params.page) queryParams!.append('page', params.page.toString())
          if (params.pageSize) queryParams!.append('pageSize', params.pageSize.toString())
          if (params.sortBy) queryParams!.append('sortBy', params.sortBy)
          if (params.sortOrder) queryParams!.append('sortOrder', params.sortOrder)
        }

        const path = queryParams 
          ? `/api/projects?${queryParams.toString()}` 
          : '/api/projects'

        const response = await get<PaginatedResponse<Project>>(path)

        if (!response.success || !response.data) {
          throw new Error(response.message || '获取项目列表失败')
        }

        this.projects = response.data.items
        return response.data.items
      } catch (err: any) {
        this.error = err.message || '获取项目列表失败'
        throw err
      } finally {
        this.loading = false
      }
    },

    /**
     * 选择项目
     * @param projectId 项目ID
     */
    async selectProject(projectId: string): Promise<Project> {
      // 如果项目已在列表中，直接选择
      const existing = this.projects.find(p => p.id === projectId)
      if (existing) {
        this.setCurrentProject(existing)
        return existing
      }

      // 否则需要先获取项目列表
      await this.fetchProjects()
      const project = this.projects.find(p => p.id === projectId)
      
      if (!project) {
        throw new Error('项目不存在')
      }

      this.setCurrentProject(project)
      return project
    },

    /**
     * 创建项目 - 使用 useApi() 调用真实 API
     * @param data 项目数据（支持扩展字段）
     */
    async createProject(data: Partial<Project> & {
      type?: 'blank' | 'git-import'
      techStack?: string
      gitUrl?: string
      gitBranch?: string
    }): Promise<Project> {
      const { post } = useApi()
      
      this.loading = true
      this.error = null

      try {
        const response = await post<Project>('/api/projects', {
          name: data.name,
          description: data.description,
          avatar: data.avatar,
          type: data.type,
          tech_stack: data.techStack,
          git_url: data.gitUrl,
          git_branch: data.gitBranch,
        })

        if (!response.success || !response.data) {
          throw new Error(response.message || '创建项目失败')
        }

        this.projects.push(response.data)
        return response.data
      } catch (err: any) {
        this.error = err.message || '创建项目失败'
        throw err
      } finally {
        this.loading = false
      }
    },

    /**
     * 更新项目 - 使用 useApi() 调用真实 API
     * @param projectId 项目ID
     * @param data 更新数据
     */
    async updateProject(projectId: string, data: Partial<Project>): Promise<Project> {
      const { patch } = useApi()
      
      this.loading = true
      this.error = null

      try {
        const response = await patch<Project>(`/api/projects/${projectId}`, {
          name: data.name,
          description: data.description,
          avatar: data.avatar,
          status: data.status,
        })

        if (!response.success || !response.data) {
          throw new Error(response.message || '更新项目失败')
        }

        const updated = response.data
        const index = this.projects.findIndex(p => p.id === projectId)
        if (index !== -1) {
          this.projects[index] = updated
        }

        // 如果当前项目被更新，同步更新
        if (this.currentProject?.id === projectId) {
          this.currentProject = updated
        }

        return updated
      } catch (err: any) {
        this.error = err.message || '更新项目失败'
        throw err
      } finally {
        this.loading = false
      }
    },

    /**
     * 删除项目 - 使用 useApi() 调用真实 API
     * @param projectId 项目ID
     */
    async deleteProject(projectId: string): Promise<void> {
      const { del } = useApi()
      
      this.loading = true
      this.error = null

      try {
        const response = await del<void>(`/api/projects/${projectId}`)

        if (!response.success) {
          throw new Error(response.message || '删除项目失败')
        }

        const index = this.projects.findIndex(p => p.id === projectId)
        if (index !== -1) {
          this.projects.splice(index, 1)
        }

        // 如果删除的是当前项目，清空当前项目
        if (this.currentProject?.id === projectId) {
          this.currentProject = null
        }
      } catch (err: any) {
        this.error = err.message || '删除项目失败'
        throw err
      } finally {
        this.loading = false
      }
    },

    /**
     * 获取项目成员 - 使用 useApi() 调用真实 API
     * @param projectId 项目ID
     */
    async fetchMembers(projectId: string): Promise<ProjectMember[]> {
      const { get } = useApi()
      
      this.loading = true
      this.error = null

      try {
        const response = await get<ProjectMember[]>(`/api/projects/${projectId}/members`)

        if (!response.success || !response.data) {
          throw new Error(response.message || '获取成员列表失败')
        }

        this.members = response.data
        return response.data
      } catch (err: any) {
        this.error = err.message || '获取成员列表失败'
        throw err
      } finally {
        this.loading = false
      }
    },

    /**
     * 设置视图模式
     */
    setViewMode(mode: ViewMode): void {
      this.viewMode = mode
    },

    /**
     * 设置状态过滤
     */
    setStatusFilter(filter: StatusFilter): void {
      this.statusFilter = filter
      this.currentPage = 1 // 重置到第一页
    },

    /**
     * 设置当前页码
     */
    setPage(page: number): void {
      this.currentPage = page
    },

    /**
     * 设置每页条数
     */
    setItemsPerPage(size: number): void {
      this.itemsPerPage = size
      this.currentPage = 1
    },

    /**
     * 清除所有过滤条件
     */
    clearFilters(): void {
      this.statusFilter = 'all'
      this.currentPage = 1
    },

    /**
     * 清除错误状态
     */
    clearError(): void {
      this.error = null
    },
  },

  persist: {
    key: 'agenthive:project',
    storage: typeof window !== 'undefined' ? localStorage : undefined,
    pick: ['currentProject', 'viewMode'],
  },
})

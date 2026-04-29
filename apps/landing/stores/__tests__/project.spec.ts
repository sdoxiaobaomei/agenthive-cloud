import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useProjectStore } from '../project'

// Mock useApi composable
vi.mock('~/composables/useApi', () => ({
  useApi: () => ({
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    del: vi.fn(),
  }),
}))

describe('useProjectStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  const mockProject = (overrides: Partial<any> = {}): any => ({
    id: 'proj-1',
    name: 'Test Project',
    description: 'A test project',
    status: 'active',
    ownerId: 'user-1',
    memberCount: 3,
    taskCount: 10,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-04-01T00:00:00Z',
    ...overrides,
  })

  describe('getters', () => {
    it('returns correct initial state', () => {
      const store = useProjectStore()
      expect(store.projects).toEqual([])
      expect(store.currentProject).toBeNull()
      expect(store.viewMode).toBe('card')
      expect(store.statusFilter).toBe('all')
      expect(store.currentPage).toBe(1)
      expect(store.itemsPerPage).toBe(12)
    })

    it('projectCount returns number of projects', () => {
      const store = useProjectStore()
      store.projects = [mockProject(), mockProject({ id: 'proj-2' })]
      expect(store.projectCount).toBe(2)
    })

    it('activeProjects filters only active status', () => {
      const store = useProjectStore()
      store.projects = [
        mockProject({ id: 'p1', status: 'active' }),
        mockProject({ id: 'p2', status: 'archived' }),
        mockProject({ id: 'p3', status: 'active' }),
      ]
      expect(store.activeProjects).toHaveLength(2)
      expect(store.activeProjects.every(p => p.status === 'active')).toBe(true)
    })

    it('hasSelectedProject returns true when currentProject is set', () => {
      const store = useProjectStore()
      expect(store.hasSelectedProject).toBe(false)
      store.currentProject = mockProject()
      expect(store.hasSelectedProject).toBe(true)
    })

    it('currentProjectName returns project name', () => {
      const store = useProjectStore()
      expect(store.currentProjectName).toBe('')
      store.currentProject = mockProject({ name: 'My App' })
      expect(store.currentProjectName).toBe('My App')
    })

    it('filteredProjects filters by status', () => {
      const store = useProjectStore()
      store.projects = [
        mockProject({ id: 'p1', status: 'active' }),
        mockProject({ id: 'p2', status: 'archived' }),
      ]
      store.setStatusFilter('archived')
      expect(store.filteredProjects).toHaveLength(1)
      expect(store.filteredProjects[0].id).toBe('p2')
    })

    it('paginatedProjects returns correct slice', () => {
      const store = useProjectStore()
      store.projects = Array.from({ length: 25 }, (_, i) => mockProject({ id: `p${i}` }))
      store.setItemsPerPage(10)
      store.setPage(1)
      expect(store.paginatedProjects).toHaveLength(10)
      expect(store.paginatedProjects[0].id).toBe('p0')
      store.setPage(2)
      expect(store.paginatedProjects[0].id).toBe('p10')
    })

    it('totalPages calculates correctly', () => {
      const store = useProjectStore()
      store.projects = Array.from({ length: 25 }, (_, i) => mockProject({ id: `p${i}` }))
      store.setItemsPerPage(10)
      expect(store.totalPages).toBe(3)
    })
  })

  describe('actions', () => {
    it('setCurrentProject sets by object', () => {
      const store = useProjectStore()
      const project = mockProject()
      store.setCurrentProject(project)
      expect(store.currentProject).toEqual(project)
    })

    it('setCurrentProject sets by id', () => {
      const store = useProjectStore()
      store.projects = [mockProject(), mockProject({ id: 'proj-2', name: 'Second' })]
      store.setCurrentProject('proj-2')
      expect(store.currentProject?.name).toBe('Second')
    })

    it('setCurrentProject adds to list if not exists', () => {
      const store = useProjectStore()
      const project = mockProject({ id: 'new-proj' })
      store.setCurrentProject(project)
      expect(store.projects).toHaveLength(1)
      expect(store.projects[0].id).toBe('new-proj')
    })

    it('setCurrentProject with null clears selection', () => {
      const store = useProjectStore()
      store.currentProject = mockProject()
      store.setCurrentProject(null)
      expect(store.currentProject).toBeNull()
    })

    it('setViewMode updates view mode', () => {
      const store = useProjectStore()
      store.setViewMode('table')
      expect(store.viewMode).toBe('table')
    })

    it('setStatusFilter resets page to 1', () => {
      const store = useProjectStore()
      store.currentPage = 5
      store.setStatusFilter('active')
      expect(store.statusFilter).toBe('active')
      expect(store.currentPage).toBe(1)
    })

    it('setPage updates current page', () => {
      const store = useProjectStore()
      store.setPage(3)
      expect(store.currentPage).toBe(3)
    })

    it('setItemsPerPage resets page to 1', () => {
      const store = useProjectStore()
      store.currentPage = 5
      store.setItemsPerPage(24)
      expect(store.itemsPerPage).toBe(24)
      expect(store.currentPage).toBe(1)
    })

    it('clearFilters resets to defaults', () => {
      const store = useProjectStore()
      store.statusFilter = 'archived'
      store.currentPage = 5
      store.clearFilters()
      expect(store.statusFilter).toBe('all')
      expect(store.currentPage).toBe(1)
    })

    it('clearError resets error', () => {
      const store = useProjectStore()
      store.error = 'Something wrong'
      store.clearError()
      expect(store.error).toBeNull()
    })
  })
})

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useWorkspaceStore } from '../workspace'

// Mock useApi composable
vi.mock('~/composables/useApi', () => ({
  useApi: () => ({
    get: vi.fn(),
    post: vi.fn(),
  }),
}))

describe('useWorkspaceStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  const mockNode = (overrides: Partial<any> = {}): any => ({
    name: 'file.ts',
    path: 'src/file.ts',
    type: 'file',
    ...overrides,
  })

  describe('getters', () => {
    it('returns correct initial state', () => {
      const store = useWorkspaceStore()
      expect(store.fileTree).toEqual([])
      expect(store.selectedFile).toBeNull()
      expect(store.sidebarCollapsed).toBe(false)
      expect(store.openedFiles).toEqual([])
      expect(store.activeFilePath).toBeNull()
      expect(store.hasDirtyFiles).toBe(false)
    })

    it('hasSelectedFile returns true when file is selected', () => {
      const store = useWorkspaceStore()
      expect(store.hasSelectedFile).toBe(false)
      store.selectedFile = 'src/App.vue'
      expect(store.hasSelectedFile).toBe(true)
    })

    it('selectedFileNode finds node in tree', () => {
      const store = useWorkspaceStore()
      store.fileTree = [
        mockNode({ name: 'src', path: 'src', type: 'folder', children: [
          mockNode({ name: 'App.vue', path: 'src/App.vue', type: 'file' }),
        ]}),
      ]
      store.selectedFile = 'src/App.vue'
      expect(store.selectedFileNode).not.toBeNull()
      expect(store.selectedFileNode?.name).toBe('App.vue')
    })

    it('breadcrumbSegments splits current path', () => {
      const store = useWorkspaceStore()
      store.currentPath = 'src/components/ui'
      expect(store.breadcrumbSegments).toEqual(['src', 'components', 'ui'])
    })

    it('activeFile returns currently active file', () => {
      const store = useWorkspaceStore()
      store.openedFiles = [
        { path: 'a.ts', name: 'a.ts', content: '', originalContent: '', language: 'typescript', isDirty: false },
        { path: 'b.ts', name: 'b.ts', content: '', originalContent: '', language: 'typescript', isDirty: false },
      ]
      store.activeFilePath = 'b.ts'
      expect(store.activeFile?.name).toBe('b.ts')
    })

    it('hasDirtyFiles returns true when file is modified', () => {
      const store = useWorkspaceStore()
      store.openedFiles = [
        { path: 'a.ts', name: 'a.ts', content: 'x', originalContent: '', language: 'typescript', isDirty: true },
      ]
      expect(store.hasDirtyFiles).toBe(true)
    })

    it('isFileOpened checks opened files', () => {
      const store = useWorkspaceStore()
      store.openedFiles = [
        { path: 'src/App.vue', name: 'App.vue', content: '', originalContent: '', language: 'vue', isDirty: false },
      ]
      expect(store.isFileOpened('src/App.vue')).toBe(true)
      expect(store.isFileOpened('src/main.ts')).toBe(false)
    })
  })

  describe('actions', () => {
    it('toggleFolder adds path to expanded set', () => {
      const store = useWorkspaceStore()
      store.toggleFolder('src')
      expect(store.expandedPaths.has('src')).toBe(true)
    })

    it('toggleFolder removes path if already expanded', () => {
      const store = useWorkspaceStore()
      store.expandedPaths = new Set(['src'])
      store.toggleFolder('src')
      expect(store.expandedPaths.has('src')).toBe(false)
    })

    it('selectFile updates selectedFile and currentPath', () => {
      const store = useWorkspaceStore()
      store.selectFile('src/components/Button.vue')
      expect(store.selectedFile).toBe('src/components/Button.vue')
      expect(store.currentPath).toBe('src/components/')
    })

    it('selectFile with null clears selection', () => {
      const store = useWorkspaceStore()
      store.selectedFile = 'src/App.vue'
      store.selectFile(null)
      expect(store.selectedFile).toBeNull()
    })

    it('setSidebarCollapsed updates state', () => {
      const store = useWorkspaceStore()
      store.setSidebarCollapsed(true)
      expect(store.sidebarCollapsed).toBe(true)
    })

    it('closeFile removes file from openedFiles', () => {
      const store = useWorkspaceStore()
      store.openedFiles = [
        { path: 'a.ts', name: 'a.ts', content: '', originalContent: '', language: 'typescript', isDirty: false },
        { path: 'b.ts', name: 'b.ts', content: '', originalContent: '', language: 'typescript', isDirty: false },
      ]
      store.closeFile('a.ts')
      expect(store.openedFiles).toHaveLength(1)
      expect(store.openedFiles[0].path).toBe('b.ts')
    })

    it('closeFile switches active to adjacent tab', () => {
      const store = useWorkspaceStore()
      store.openedFiles = [
        { path: 'a.ts', name: 'a.ts', content: '', originalContent: '', language: 'typescript', isDirty: false },
        { path: 'b.ts', name: 'b.ts', content: '', originalContent: '', language: 'typescript', isDirty: false },
        { path: 'c.ts', name: 'c.ts', content: '', originalContent: '', language: 'typescript', isDirty: false },
      ]
      store.activeFilePath = 'b.ts'
      store.closeFile('b.ts')
      expect(store.activeFilePath).toBe('c.ts')
    })

    it('closeFile clears active if last tab closed', () => {
      const store = useWorkspaceStore()
      store.openedFiles = [
        { path: 'a.ts', name: 'a.ts', content: '', originalContent: '', language: 'typescript', isDirty: false },
      ]
      store.activeFilePath = 'a.ts'
      store.closeFile('a.ts')
      expect(store.activeFilePath).toBeNull()
      expect(store.selectedFile).toBeNull()
    })

    it('setActiveFile updates activeFilePath', () => {
      const store = useWorkspaceStore()
      store.openedFiles = [
        { path: 'a.ts', name: 'a.ts', content: '', originalContent: '', language: 'typescript', isDirty: false },
      ]
      store.setActiveFile('a.ts')
      expect(store.activeFilePath).toBe('a.ts')
    })

    it('setActiveFile ignores unopened files', () => {
      const store = useWorkspaceStore()
      store.openedFiles = []
      store.setActiveFile('a.ts')
      expect(store.activeFilePath).toBeNull()
    })

    it('updateFileContent marks file dirty when changed', () => {
      const store = useWorkspaceStore()
      store.openedFiles = [
        { path: 'a.ts', name: 'a.ts', content: 'original', originalContent: 'original', language: 'typescript', isDirty: false },
      ]
      store.updateFileContent('a.ts', 'modified')
      expect(store.openedFiles[0].content).toBe('modified')
      expect(store.openedFiles[0].isDirty).toBe(true)
    })

    it('updateFileContent does not mark dirty when unchanged', () => {
      const store = useWorkspaceStore()
      store.openedFiles = [
        { path: 'a.ts', name: 'a.ts', content: 'same', originalContent: 'same', language: 'typescript', isDirty: false },
      ]
      store.updateFileContent('a.ts', 'same')
      expect(store.openedFiles[0].isDirty).toBe(false)
    })

    it('markFileSaved clears dirty flag', () => {
      const store = useWorkspaceStore()
      store.openedFiles = [
        { path: 'a.ts', name: 'a.ts', content: 'new', originalContent: 'old', language: 'typescript', isDirty: true },
      ]
      store.markFileSaved('a.ts')
      expect(store.openedFiles[0].isDirty).toBe(false)
      expect(store.openedFiles[0].originalContent).toBe('new')
    })

    it('updateNodeChildren updates nested folder children', () => {
      const store = useWorkspaceStore()
      store.fileTree = [
        mockNode({ name: 'src', path: 'src', type: 'folder', children: [] }),
      ]
      const newChildren = [mockNode({ name: 'App.vue', path: 'src/App.vue', type: 'file' })]
      const result = store.updateNodeChildren(store.fileTree, 'src', newChildren)
      expect(result).toBe(true)
      expect(store.fileTree[0].children).toHaveLength(1)
    })

    it('updateNodeChildren returns false for non-existent path', () => {
      const store = useWorkspaceStore()
      store.fileTree = []
      const result = store.updateNodeChildren(store.fileTree, 'nonexistent', [])
      expect(result).toBe(false)
    })

    it('clearError resets error', () => {
      const store = useWorkspaceStore()
      store.error = 'Failed'
      store.clearError()
      expect(store.error).toBeNull()
    })
  })
})

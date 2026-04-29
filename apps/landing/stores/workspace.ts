import { defineStore } from 'pinia'
import type { FileTreeNode } from '~/stores/chat'

/** 已打开的文件 */
export interface OpenedFile {
  path: string
  name: string
  content: string
  originalContent: string
  language: string
  isDirty: boolean
}

/** Workspace 状态 */
interface WorkspaceState {
  fileTree: FileTreeNode[]
  selectedFile: string | null
  expandedPaths: Set<string>
  sidebarCollapsed: boolean
  currentPath: string
  loading: boolean
  error: string | null
  /** 已打开的文件列表（Tab） */
  openedFiles: OpenedFile[]
  /** 当前激活的文件路径 */
  activeFilePath: string | null
}

export const useWorkspaceStore = defineStore('workspace', {
  state: (): WorkspaceState => ({
    fileTree: [],
    selectedFile: null,
    expandedPaths: new Set(),
    sidebarCollapsed: false,
    currentPath: '',
    loading: false,
    error: null,
    openedFiles: [],
    activeFilePath: null,
  }),

  getters: {
    /** 是否已选中文件 */
    hasSelectedFile: (state): boolean => !!state.selectedFile,

    /** 获取当前选中文件的节点信息 */
    selectedFileNode: (state): FileTreeNode | null => {
      if (!state.selectedFile) return null
      return findNodeByPath(state.fileTree, state.selectedFile)
    },

    /** 面包屑路径段 */
    breadcrumbSegments: (state): string[] => {
      if (!state.currentPath) return []
      return state.currentPath.split('/').filter(Boolean)
    },

    /** 当前激活的文件 */
    activeFile: (state): OpenedFile | null => {
      if (!state.activeFilePath) return null
      return state.openedFiles.find(f => f.path === state.activeFilePath) || null
    },

    /** 是否有未保存的文件 */
    hasDirtyFiles: (state): boolean => {
      return state.openedFiles.some(f => f.isDirty)
    },

    /** 指定路径的文件是否已打开 */
    isFileOpened: (state) => (path: string): boolean => {
      return state.openedFiles.some(f => f.path === path)
    },
  },

  actions: {
    /**
     * 获取文件列表
     * @param projectId 项目ID（用于日志/调试，实际路径中不传递）
     * @param path 目录路径，空字符串表示根目录
     */
    async fetchFiles(_projectId: string, path: string = ''): Promise<FileTreeNode[]> {
      const { get } = useApi()

      this.loading = true
      this.error = null

      try {
        const query = path ? `?path=${encodeURIComponent(path)}` : ''
        const response = await get<FileTreeNode[]>(`/api/code/files${query}`)

        if (!response.success || !response.data) {
          throw new Error(response.message || '获取文件列表失败')
        }

        const files = response.data

        if (!path) {
          // 根目录：替换整个文件树
          this.fileTree = files
        } else {
          // 子目录：更新对应节点的 children
          const updated = this.updateNodeChildren(this.fileTree, path, files)
          if (!updated) {
            // 如果找不到对应节点（可能树结构不一致），刷新根目录
            this.fileTree = files
          }
        }

        return files
      } catch (err: any) {
        this.error = err.message || '获取文件列表失败'
        throw err
      } finally {
        this.loading = false
      }
    },

    /**
     * 递归更新指定路径节点的 children
     */
    updateNodeChildren(nodes: FileTreeNode[], path: string, children: FileTreeNode[]): boolean {
      for (const node of nodes) {
        if (node.path === path && node.type === 'folder') {
          node.children = children
          return true
        }
        if (node.children?.length) {
          if (this.updateNodeChildren(node.children, path, children)) {
            return true
          }
        }
      }
      return false
    },

    /**
     * 展开/折叠文件夹
     */
    toggleFolder(path: string): void {
      const newSet = new Set(this.expandedPaths)
      if (newSet.has(path)) {
        newSet.delete(path)
      } else {
        newSet.add(path)
      }
      this.expandedPaths = newSet
    },

    /**
     * 选中文件
     */
    selectFile(path: string | null): void {
      this.selectedFile = path
      if (path) {
        this.currentPath = path.substring(0, path.lastIndexOf('/') + 1)
      }
    },

    /**
     * 设置侧边栏折叠状态
     */
    setSidebarCollapsed(collapsed: boolean): void {
      this.sidebarCollapsed = collapsed
    },

    /**
     * 刷新当前文件树
     */
    async refreshFiles(projectId: string): Promise<void> {
      this.expandedPaths = new Set()
      this.selectedFile = null
      await this.fetchFiles(projectId, '')
    },

    /**
     * 打开文件（获取内容并添加到 Tab）
     * @param path 文件路径
     */
    async openFile(path: string): Promise<void> {
      const { get } = useApi()

      // 已打开则直接切换
      const existing = this.openedFiles.find(f => f.path === path)
      if (existing) {
        this.activeFilePath = path
        this.selectedFile = path
        return
      }

      try {
        const response = await get<{ path: string; name: string; content: string; language: string }>(
          `/api/code/files/${encodeURIComponent(path)}`
        )

        if (!response.success || !response.data) {
          throw new Error(response.message || '获取文件内容失败')
        }

        const fileData = response.data
        this.openedFiles.push({
          path: fileData.path,
          name: fileData.name || path.split('/').pop() || path,
          content: fileData.content,
          originalContent: fileData.content,
          language: detectLanguage(fileData.name || path),
          isDirty: false,
        })

        this.activeFilePath = path
        this.selectedFile = path
      } catch (err: any) {
        this.error = err.message || '获取文件内容失败'
        throw err
      }
    },

    /**
     * 关闭文件（从 Tab 移除）
     */
    closeFile(path: string): void {
      const index = this.openedFiles.findIndex(f => f.path === path)
      if (index === -1) return

      this.openedFiles.splice(index, 1)

      // 如果关闭的是当前激活文件，切换到相邻 Tab
      if (this.activeFilePath === path) {
        const nextFile = this.openedFiles[index] || this.openedFiles[index - 1] || null
        this.activeFilePath = nextFile?.path || null
        this.selectedFile = nextFile?.path || null
      }
    },

    /**
     * 设置当前激活文件
     */
    setActiveFile(path: string): void {
      if (this.openedFiles.some(f => f.path === path)) {
        this.activeFilePath = path
        this.selectedFile = path
      }
    },

    /**
     * 更新文件内容（编辑器输入时）
     */
    updateFileContent(path: string, content: string): void {
      const file = this.openedFiles.find(f => f.path === path)
      if (!file) return
      file.content = content
      file.isDirty = content !== file.originalContent
    },

    /**
     * 保存文件到服务器
     */
    async saveFile(path: string): Promise<void> {
      const file = this.openedFiles.find(f => f.path === path)
      if (!file || !file.isDirty) return

      const { post } = useApi()

      try {
        const response = await post(`/api/code/files/save`, {
          path: file.path,
          content: file.content,
        })

        if (!response.success) {
          throw new Error(response.message || '保存文件失败')
        }

        file.originalContent = file.content
        file.isDirty = false
      } catch (err: any) {
        this.error = err.message || '保存文件失败'
        throw err
      }
    },

    /**
     * 保存文件（将 current 设为 original，本地标记）
     */
    markFileSaved(path: string): void {
      const file = this.openedFiles.find(f => f.path === path)
      if (!file) return
      file.originalContent = file.content
      file.isDirty = false
    },

    /**
     * 清除错误状态
     */
    clearError(): void {
      this.error = null
    },
  },

  persist: {
    key: 'agenthive:workspace',
    storage: typeof window !== 'undefined' ? localStorage : undefined,
    pick: ['sidebarCollapsed'],
  },
})

/** 根据路径查找节点 */
function findNodeByPath(nodes: FileTreeNode[], path: string): FileTreeNode | null {
  for (const node of nodes) {
    if (node.path === path) return node
    if (node.children?.length) {
      const found = findNodeByPath(node.children, path)
      if (found) return found
    }
  }
  return null
}

/** 根据文件名检测 Monaco language */
function detectLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  const map: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    mts: 'typescript',
    cts: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    mjs: 'javascript',
    cjs: 'javascript',
    vue: 'html',
    html: 'html',
    htm: 'html',
    css: 'css',
    scss: 'scss',
    sass: 'scss',
    less: 'less',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    md: 'markdown',
    java: 'java',
    go: 'go',
    py: 'python',
    rs: 'rust',
    sql: 'sql',
    sh: 'shell',
    bash: 'shell',
    zsh: 'shell',
    dockerfile: 'dockerfile',
    xml: 'xml',
    svg: 'xml',
  }
  return map[ext] || 'plaintext'
}

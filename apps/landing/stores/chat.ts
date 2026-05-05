import { defineStore } from 'pinia'
import type { FileInfo } from '@agenthive/types'

/** 消息角色 */
export type MessageRole = 'user' | 'assistant' | 'system'

/** 消息类型（v2 扩展） */
export type MessageType =
  | 'message'      // 普通消息
  | 'think'        // agent 思考过程
  | 'task'         // 用户可 approve/decline 的任务
  | 'recommend'    // 用户选择选项（不展示在历史消息中）
  | 'system_event' // 系统事件

/** 任务状态 */
export type TaskStatus = 'pending' | 'approved' | 'declined' | 'running' | 'completed' | 'failed'

/** 推荐选项 */
export interface RecommendOption {
  id: string
  label: string
  prompt: string
  icon?: string
}

/** 任务项 */
export interface TaskItem {
  id: string
  title: string
  description?: string
  status: TaskStatus
  workerRole?: string
}

/** 消息内容类型 */
export type MessageContentType = 'text' | 'code' | 'image' | 'file' | 'thinking'

/** 消息内容块 */
export interface MessageContent {
  type: MessageContentType
  content: string
  language?: string
  fileName?: string
  metadata?: Record<string, any>
}

/** 聊天消息（v2 扩展） */
export interface ChatMessage {
  id: string
  role: MessageRole
  type: MessageType        // v2: 消息类型
  content: string | MessageContent[]
  timestamp: string
  conversationId: string
  parentId?: string
  versionId?: string       // v2: 所属版本 ID
  // type === 'task' 时的专属结构
  tasks?: TaskItem[]
  // type === 'recommend' 时的专属结构
  options?: RecommendOption[]
  selectedOptionId?: string
  // type === 'think' 时的专属结构
  thinkContent?: string
  thinkSummary?: string
  metadata?: {
    model?: string
    tokens?: number
    processingTime?: number
    files?: string[]
    intent?: string
  }
}

/** 会话信息 */
export interface Conversation {
  id: string
  title: string
  projectId?: string
  agentId?: string
  createdAt: string
  updatedAt: string
  messageCount: number
  isPinned?: boolean
}

/** 聊天版本 */
export interface ChatVersion {
  id: string
  sessionId: string
  versionNumber: number
  title: string
  description?: string
  baseMessageId?: string
  isActive: boolean
  createdAt: string
}

/** 文件树节点 - 与组件兼容的类型 */
export interface FileTreeNode {
  name: string
  path: string
  type: 'file' | 'folder'
  size?: number
  modifiedAt?: string
  language?: string
  gitStatus?: 'modified' | 'added' | 'deleted' | 'untracked' | 'unchanged'
  isOpen?: boolean
  isSelected?: boolean
  isExpanded?: boolean
  children?: FileTreeNode[]
}

export type ChatTab = 'files' | 'editor' | 'preview'

/** 聊天状态 */
interface ChatState {
  messages: ChatMessage[]
  conversations: Conversation[]
  currentConversation: Conversation | null
  fileTree: FileTreeNode[]
  isLoading: boolean
  isStreaming: boolean
  error: string | null
  selectedFiles: string[]
  // 文件树相关状态
  expandedFolders: Set<string>
  selectedFile: string | null
  openedFiles: FileTreeNode[]
  activeFilePath: string | null
  // 页面活动标签
  activeTab: ChatTab
  // v2: 版本管理
  versions: ChatVersion[]
  currentVersionId: string | null
}

// 默认演示文件树数据（当 API 不可用时使用）
const defaultFileTree: FileTreeNode[] = [
  {
    name: 'src',
    path: 'src',
    type: 'folder',
    isExpanded: true,
    children: [
      {
        name: 'components',
        path: 'src/components',
        type: 'folder',
        isExpanded: false,
        children: [
          { name: 'Button.vue', path: 'src/components/Button.vue', type: 'file' },
          { name: 'Input.vue', path: 'src/components/Input.vue', type: 'file' },
        ]
      },
      {
        name: 'pages',
        path: 'src/pages',
        type: 'folder',
        isExpanded: false,
        children: [
          { name: 'index.vue', path: 'src/pages/index.vue', type: 'file' },
          { name: 'about.vue', path: 'src/pages/about.vue', type: 'file' },
        ]
      },
      { name: 'App.vue', path: 'src/App.vue', type: 'file' },
      { name: 'main.ts', path: 'src/main.ts', type: 'file' },
    ]
  },
  {
    name: 'package.json',
    path: 'package.json',
    type: 'file',
  },
  {
    name: 'README.md',
    path: 'README.md',
    type: 'file',
  },
]

export const useChatStore = defineStore('chat', {
  state: (): ChatState => ({
    messages: [],
    conversations: [],
    currentConversation: null,
    fileTree: [],
    isLoading: false,
    isStreaming: false,
    error: null,
    selectedFiles: [],
    // 文件树相关状态
    expandedFolders: new Set<string>(['src']),
    selectedFile: null,
    openedFiles: [],
    activeFilePath: null,
    // 页面活动标签
    activeTab: 'editor',
    // v2: 版本管理
    versions: [],
    currentVersionId: null,
  }),

  getters: {
    /** 当前会话ID */
    currentConversationId: (state): string | null => 
      state.currentConversation?.id || null,

    /** 当前会话关联的项目ID */
    projectId: (state): string | null =>
      state.currentConversation?.projectId || null,

    /** 当前会话消息（含 recommend，原始全部消息） */
    currentMessages: (state): ChatMessage[] => {
      if (!state.currentConversation) return []
      return state.messages.filter(
        m => m.conversationId === state.currentConversation!.id
      )
    },

    /** v2: visibleMessages — 过滤掉已选择/已关闭的 recommend，其他 recommend inline 展示 */
    visibleMessages: (state): ChatMessage[] => {
      if (!state.currentConversation) return []
      return state.messages.filter(
        (m) =>
          m.conversationId === state.currentConversation!.id &&
          // 过滤掉已选择或已关闭的 recommend
          !(m.type === 'recommend' && (m.selectedOptionId || m.metadata?.dismissed === true))
      )
    },

    /** v2: 获取当前版本的消息 */
    currentVersionMessages: (state): ChatMessage[] => {
      if (!state.currentVersionId) return state.visibleMessages
      return state.visibleMessages.filter(
        m => m.versionId === state.currentVersionId
      )
    },

    /** v2: 获取当前活跃的 recommend（如果有） */
    activeRecommend: (state): ChatMessage | null => {
      if (!state.currentConversation) return null
      const recommends = state.messages.filter(
        m => m.conversationId === state.currentConversation!.id
          && m.type === 'recommend'
          && !m.selectedOptionId           // 未选择
          && m.metadata?.dismissed !== true // 未关闭
      )
      return recommends.length > 0 ? recommends[recommends.length - 1] : null
    },

    /** 消息数量 */
    messageCount: (state): number => state.messages.length,

    /** 会话数量 */
    conversationCount: (state): number => state.conversations.length,

    /** 置顶会话 */
    pinnedConversations: (state): Conversation[] => 
      state.conversations.filter(c => c.isPinned),

    /** 最近会话（按更新时间排序） */
    recentConversations: (state): Conversation[] => 
      [...state.conversations]
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 10),

    /** 是否正在等待响应 */
    isWaiting: (state): boolean => state.isLoading || state.isStreaming,

    /** 获取最后一条消息 */
    lastMessage: (state): ChatMessage | null => {
      if (state.messages.length === 0) return null
      return state.messages[state.messages.length - 1]
    },
  },

  actions: {
    /**
     * 设置当前会话
     * @param conversation 会话信息或会话ID
     */
    setCurrentConversation(conversation: Conversation | string | null): void {
      if (conversation === null) {
        this.currentConversation = null
        return
      }

      if (typeof conversation === 'string') {
        const found = this.conversations.find(c => c.id === conversation)
        if (found) {
          this.currentConversation = found
        }
      } else {
        this.currentConversation = conversation
        // 如果会话不在列表中，添加到列表
        const exists = this.conversations.find(c => c.id === conversation.id)
        if (!exists) {
          this.conversations.push(conversation)
        }
      }
    },

    /**
     * 创建新会话
     * @param title 会话标题
     * @param projectId 关联项目ID
     * @param agentId 关联Agent ID
     */
    async createConversation(
      title: string = '新会话',
      projectId?: string,
      agentId?: string
    ): Promise<Conversation> {
      try {
        const { chat } = useApi()
        const result = await chat.createSession({ title, projectId })
        
        if (!result.success) {
          throw new Error(result.message || '创建会话失败')
        }

        const conversation: Conversation = {
          id: result.data!.id,
          title: result.data!.title,
          projectId: result.data!.projectId,
          agentId,
          createdAt: result.data!.createdAt,
          updatedAt: result.data!.createdAt,
          messageCount: 0,
          isPinned: false,
        }

        this.conversations.unshift(conversation)
        this.currentConversation = conversation
        return conversation
      } catch (err: any) {
        this.error = err.message || '创建会话失败'
        throw err
      }
    },

    /**
     * 发送消息
     * @param content 消息内容
     * @param role 消息角色
     */
    async sendMessage(
      content: string,
      role: MessageRole = 'user'
    ): Promise<ChatMessage> {
      if (!this.currentConversation) {
        await this.createConversation()
      }

      const conversationId = this.currentConversation!.id

      const message: ChatMessage = {
        id: `msg-${Date.now()}`,
        role,
        content,
        timestamp: new Date().toISOString(),
        conversationId,
        metadata: {
          files: this.selectedFiles.length > 0 ? [...this.selectedFiles] : undefined,
        },
      }

      this.messages.push(message)
      this.currentConversation!.messageCount++
      this.currentConversation!.updatedAt = new Date().toISOString()

      // 清空已选文件
      if (this.selectedFiles.length > 0) {
        this.selectedFiles = []
      }

      return message
    },

    /**
     * 发送用户消息并获取AI回复
     * @param content 用户消息内容
     */
    async sendMessageWithResponse(content: string): Promise<void> {
      // 添加用户消息
      await this.sendMessage(content, 'user')

      this.isLoading = true
      
      try {
        const conversationId = this.currentConversation!.id
        const { chat } = useApi()
        
        const result = await chat.sendMessage(conversationId, { content })
        
        if (!result.success) {
          throw new Error(result.message || '发送消息失败')
        }

        if (!result.data?.message?.id) {
          throw new Error('服务器返回数据缺少消息 ID')
        }

        const assistantMessage: ChatMessage = {
          id: result.data.message.id,
          role: 'assistant',
          content: result.data.message.content || '处理完成',
          timestamp: result.data.message.timestamp || new Date().toISOString(),
          conversationId,
          metadata: {
            model: 'agenthive-ai',
            intent: result.data?.intent,
            tasks: result.data?.tasks,
          },
        }

        this.messages.push(assistantMessage)

      } catch (err: any) {
        this.error = err.message || '获取回复失败'
      } finally {
        this.isLoading = false
      }
    },

    /**
     * 加载会话列表
     * @param projectId 项目ID筛选
     */
    async loadConversations(projectId?: string): Promise<Conversation[]> {
      this.isLoading = true
      this.error = null

      try {
        const { chat } = useApi()
        const result = await chat.listSessions()
        
        if (!result.success) {
          throw new Error(result.message || '加载会话列表失败')
        }

        const conversations: Conversation[] = (result.data?.items || []).map(item => ({
          id: item.id,
          title: item.title,
          projectId: item.projectId,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
          messageCount: 0,
          isPinned: false,
        }))

        this.conversations = projectId
          ? conversations.filter(c => c.projectId === projectId)
          : conversations

        return this.conversations
      } catch (err: any) {
        this.error = err.message || '加载会话列表失败'
        this.conversations = []
        throw err
      } finally {
        this.isLoading = false
      }
    },

    /**
     * 加载消息历史
     * @param conversationId 会话ID
     */
    async loadMessages(conversationId: string): Promise<ChatMessage[]> {
      this.isLoading = true
      this.error = null

      try {
        const { chat } = useApi()
        const result = await chat.getMessages(conversationId)
        
        if (!result.success) {
          throw new Error(result.message || '加载消息失败')
        }

        const messages: ChatMessage[] = (result.data?.messages || []).map(msg => ({
          id: msg.id,
          role: msg.role as MessageRole,
          content: msg.content,
          timestamp: msg.timestamp,
          conversationId,
          metadata: msg.metadata,
        }))

        // 合并新消息，避免重复
        const existingIds = new Set(this.messages.map(m => m.id))
        const newMessages = messages.filter(m => !existingIds.has(m.id))
        this.messages.push(...newMessages)

        return messages
      } catch (err: any) {
        this.error = err.message || '加载消息失败'
        return []
      } finally {
        this.isLoading = false
      }
    },

    /**
     * 加载文件树
     * @param path 路径
     */
    async loadFileTree(path: string = ''): Promise<FileTreeNode[]> {
      this.isLoading = true
      this.error = null

      try {
        const projectId = this.currentConversation?.projectId
        if (!projectId) {
          if (!path && this.fileTree.length === 0) {
            this.fileTree = defaultFileTree
          }
          return this.fileTree
        }

        // 使用实际的 API 调用
        const { code: codeApi } = useApi()
        const response = await codeApi.getFiles(projectId, path)

        if (!response.success || !response.data) {
          throw new Error(response.message || '加载文件树失败')
        }

        // 转换 API 返回的 FileInfo 为组件兼容的 FileTreeNode
        const transformNode = (node: FileInfo): FileTreeNode => ({
          name: node.name,
          path: node.path,
          type: node.type === 'directory' ? 'folder' : 'file',
          size: node.size,
          modifiedAt: node.modifiedAt,
          isOpen: this.expandedFolders.has(node.path),
          isSelected: this.selectedFile === node.path,
          isExpanded: this.expandedFolders.has(node.path),
          children: node.children?.map(transformNode),
        })

        // 如果是根路径，替换整个树；否则更新对应节点
        if (!path) {
          this.fileTree = response.data?.map(transformNode) ?? []
        } else {
          // 递归更新子节点
          const updateNodeChildren = (nodes: FileTreeNode[]): boolean => {
            for (const node of nodes) {
              if (node.path === path && node.type === 'folder') {
                node.children = response.data?.map(transformNode) ?? []
                return true
              }
              if (node.children && updateNodeChildren(node.children)) {
                return true
              }
            }
            return false
          }
          updateNodeChildren(this.fileTree)
        }

        return this.fileTree
      } catch (err: any) {
        this.error = err.message || '加载文件树失败'
        throw err
      } finally {
        this.isLoading = false
      }
    },

    /**
     * 展开/折叠文件夹
     * @param path 文件路径
     */
    toggleFolder(path: string): void {
      // 更新 expandedFolders Set
      if (this.expandedFolders.has(path)) {
        this.expandedFolders.delete(path)
      } else {
        this.expandedFolders.add(path)
        // 如果展开且没有子节点，重新加载该路径
        const findNode = (nodes: FileTreeNode[]): FileTreeNode | null => {
          for (const node of nodes) {
            if (node.path === path) return node
            if (node.children) {
              const found = findNode(node.children)
              if (found) return found
            }
          }
          return null
        }
        const node = findNode(this.fileTree)
        if (node && (!node.children || node.children.length === 0)) {
          this.loadFileTree(path)
        }
      }

      // 同步更新节点状态
      const findAndToggle = (nodes: FileTreeNode[]): boolean => {
        for (const node of nodes) {
          if (node.path === path) {
            if (node.type === 'folder') {
              node.isOpen = this.expandedFolders.has(path)
              node.isExpanded = this.expandedFolders.has(path)
            }
            return true
          }
          if (node.children && findAndToggle(node.children)) {
            return true
          }
        }
        return false
      }

      findAndToggle(this.fileTree)
    },

    /**
     * 选择文件
     * @param path 文件路径
     */
    selectFile(path: string | null): void {
      // 更新之前选中节点的状态
      if (this.selectedFile) {
        const findAndDeselect = (nodes: FileTreeNode[]): boolean => {
          for (const node of nodes) {
            if (node.path === this.selectedFile) {
              node.isSelected = false
              return true
            }
            if (node.children && findAndDeselect(node.children)) {
              return true
            }
          }
          return false
        }
        findAndDeselect(this.fileTree)
      }

      this.selectedFile = path

      // 更新新选中节点的状态
      if (path) {
        const findAndSelect = (nodes: FileTreeNode[]): boolean => {
          for (const node of nodes) {
            if (node.path === path) {
              node.isSelected = true
              return true
            }
            if (node.children && findAndSelect(node.children)) {
              return true
            }
          }
          return false
        }
        findAndSelect(this.fileTree)
      }
    },

    /**
     * 在编辑器中打开文件
     * @param file 文件节点
     */
    openFileInEditor(file: FileTreeNode): void {
      if (file.type !== 'file') return

      // 检查文件是否已打开
      const existingIndex = this.openedFiles.findIndex(f => f.path === file.path)
      
      if (existingIndex === -1) {
        // 添加新文件到打开列表
        this.openedFiles.push({ ...file, isSelected: false })
      }
      
      // 设置为活动文件
      this.activeFilePath = file.path
      this.selectFile(file.path)
    },

    /**
     * 关闭编辑器中的文件
     * @param path 文件路径
     */
    closeFileInEditor(path: string): void {
      const index = this.openedFiles.findIndex(f => f.path === path)
      if (index > -1) {
        this.openedFiles.splice(index, 1)
        
        // 如果关闭的是当前活动文件，切换到上一个文件
        if (this.activeFilePath === path) {
          const newActive = this.openedFiles[index] || this.openedFiles[index - 1] || null
          this.activeFilePath = newActive?.path || null
          this.selectFile(newActive?.path || null)
        }
      }
    },

    /**
     * 设置活动文件
     * @param path 文件路径
     */
    setActiveFile(path: string): void {
      this.activeFilePath = path
      this.selectFile(path)
    },

    /**
     * 创建新文件/文件夹
     * @param parentPath 父目录路径
     * @param name 文件名
     * @param isDirectory 是否为目录
     */
    async createFile(parentPath: string, name: string, isDirectory: boolean = false): Promise<void> {
      try {
        const projectId = this.currentConversation?.projectId
        if (!projectId) throw new Error('当前会话未关联项目')

        const fullPath = parentPath ? `${parentPath}/${name}` : name
        const { code: codeApi } = useApi()
        const response = await codeApi.create(projectId, fullPath, isDirectory)
        
        if (response.success) {
          // 刷新父目录
          await this.loadFileTree(parentPath)
        } else {
          throw new Error(response.message || '创建失败')
        }
      } catch (err: any) {
        this.error = err.message || '创建文件失败'
        throw err
      }
    },

    /**
     * 重命名文件/文件夹
     * @param oldPath 原路径
     * @param newName 新名称
     */
    async renameFile(oldPath: string, newName: string): Promise<void> {
      try {
        const projectId = this.currentConversation?.projectId
        if (!projectId) throw new Error('当前会话未关联项目')

        const parentPath = oldPath.split('/').slice(0, -1).join('/')
        const newPath = parentPath ? `${parentPath}/${newName}` : newName
        const { code: codeApi } = useApi()
        const response = await codeApi.move(projectId, oldPath, newPath)
        
        if (response.success) {
          // 刷新文件树
          await this.loadFileTree()
        } else {
          throw new Error(response.message || '重命名失败')
        }
      } catch (err: any) {
        this.error = err.message || '重命名文件失败'
        throw err
      }
    },

    /**
     * 删除文件/文件夹
     * @param path 文件路径
     */
    async deleteFile(path: string): Promise<void> {
      try {
        const projectId = this.currentConversation?.projectId
        if (!projectId) throw new Error('当前会话未关联项目')

        const { code: codeApi } = useApi()
        const response = await codeApi.delete(projectId, path)
        
        if (response.success) {
          // 如果删除的是已打开的文件，关闭它
          this.closeFileInEditor(path)
          // 刷新文件树
          await this.loadFileTree()
        } else {
          throw new Error(response.message || '删除失败')
        }
      } catch (err: any) {
        this.error = err.message || '删除文件失败'
        throw err
      }
    },

    /**
     * 选择/取消选择文件
     * @param path 文件路径
     */
    toggleFileSelection(path: string): void {
      const index = this.selectedFiles.indexOf(path)
      if (index === -1) {
        this.selectedFiles.push(path)
      } else {
        this.selectedFiles.splice(index, 1)
      }

      // 同步更新文件树状态
      const findAndUpdate = (nodes: FileTreeNode[]): boolean => {
        for (const node of nodes) {
          if (node.path === path) {
            node.isSelected = !node.isSelected
            return true
          }
          if (node.children && findAndUpdate(node.children)) {
            return true
          }
        }
        return false
      }

      findAndUpdate(this.fileTree)
    },

    /**
     * 删除会话
     * @param conversationId 会话ID
     */
    deleteConversation(conversationId: string): void {
      const index = this.conversations.findIndex(c => c.id === conversationId)
      if (index === -1) return

      this.conversations.splice(index, 1)
      
      // 删除相关消息
      this.messages = this.messages.filter(m => m.conversationId !== conversationId)

      // 如果删除的是当前会话，清空当前会话
      if (this.currentConversation?.id === conversationId) {
        this.currentConversation = null
      }
    },

    /**
     * 置顶/取消置顶会话
     * @param conversationId 会话ID
     */
    togglePinConversation(conversationId: string): void {
      const conversation = this.conversations.find(c => c.id === conversationId)
      if (conversation) {
        conversation.isPinned = !conversation.isPinned
      }
    },

    /**
     * 重命名会话
     * @param conversationId 会话ID
     * @param title 新标题
     */
    renameConversation(conversationId: string, title: string): void {
      const conversation = this.conversations.find(c => c.id === conversationId)
      if (conversation) {
        conversation.title = title
        conversation.updatedAt = new Date().toISOString()
      }
    },

    /**
     * 清除错误状态
     */
    clearError(): void {
      this.error = null
    },

    /**
     * 清空当前会话消息
     */
    clearCurrentMessages(): void {
      if (!this.currentConversation) return
      
      this.messages = this.messages.filter(
        m => m.conversationId !== this.currentConversation!.id
      )
      this.currentConversation.messageCount = 0
    },

    /**
     * 设置活动标签
     */
    setActiveTab(tab: ChatTab): void {
      this.activeTab = tab
    },

    // ===== v2: 版本管理 =====

    /**
     * 加载版本列表
     */
    async loadVersions(sessionId: string): Promise<ChatVersion[]> {
      this.isLoading = true
      try {
        const { chat } = useApi()
        const result = await chat.listVersions(sessionId)
        if (result.success && result.data) {
          this.versions = result.data.versions || []
        }
        return this.versions
      } catch (err: any) {
        this.error = err.message || '加载版本列表失败'
        return []
      } finally {
        this.isLoading = false
      }
    },

    /**
     * 切换版本
     * 后端 PATCH 返回 version + messages，直接使用返回数据
     */
    async switchVersion(versionId: string): Promise<ChatMessage[]> {
      if (!this.currentConversation) return []
      const sessionId = this.currentConversation.id
      this.isLoading = true
      try {
        const { chat } = useApi()
        const result = await chat.switchVersion(sessionId, versionId)
        if (result.success && result.data) {
          this.currentVersionId = versionId
          // 后端返回 messages，直接使用
          if (result.data.messages && result.data.messages.length > 0) {
            const loaded: ChatMessage[] = result.data.messages.map((msg: any) => ({
              id: msg.id,
              role: msg.role as 'user' | 'assistant' | 'system',
              type: msg.type || 'message',
              content: msg.content,
              timestamp: msg.timestamp || msg.createdAt,
              conversationId: sessionId,
              versionId: msg.versionId || versionId,
              tasks: msg.tasks,
              options: msg.options,
              thinkContent: msg.thinkContent,
              thinkSummary: msg.thinkSummary,
              metadata: msg.metadata || {},
            }))
            // 清除当前会话旧消息，替换为返回的 messages
            this.messages = this.messages.filter(
              m => m.conversationId !== sessionId
            )
            this.messages.push(...loaded)
          }
        }
        return this.currentVersionMessages
      } catch (err: any) {
        this.error = err.message || '切换版本失败'
        return []
      } finally {
        this.isLoading = false
      }
    },

    /**
     * 创建新版本
     * 后端返回直接 version 对象
     */
    async createVersion(title: string, description?: string): Promise<ChatVersion | null> {
      if (!this.currentConversation) return null
      const sessionId = this.currentConversation.id
      this.isLoading = true
      try {
        const { chat } = useApi()
        const result = await chat.createVersion(sessionId, { title, description })
        if (result.success && result.data) {
          const newVersion: ChatVersion = result.data as ChatVersion
          this.versions.unshift(newVersion)
          this.currentVersionId = newVersion.id
          return newVersion
        }
        return null
      } catch (err: any) {
        this.error = err.message || '创建版本失败'
        return null
      } finally {
        this.isLoading = false
      }
    },

    // ===== v2: Task 操作 =====

    /**
     * 确认/拒绝任务
     * 对齐后端: POST /messages/:messageId/approve { action: 'approve'|'decline', reason? }
     */
    async approveTask(taskId: string, approved: boolean): Promise<void> {
      if (!this.currentConversation) return
      const sessionId = this.currentConversation.id
      // 找到包含该 task 的 message
      const msg = this.messages.find(
        m => m.conversationId === sessionId && m.tasks?.some(t => t.id === taskId)
      )
      if (!msg || !msg.tasks) {
        this.error = '未找到对应任务'
        return
      }
      try {
        const { chat } = useApi()
        await chat.approveTask(sessionId, msg.id, {
          action: approved ? 'approve' : 'decline',
        })
        // 乐观更新本地状态
        const task = msg.tasks.find(t => t.id === taskId)
        if (task) {
          task.status = approved ? 'approved' : 'declined'
        }
      } catch (err: any) {
        this.error = err.message || '操作任务失败'
      }
    },

    // ===== v2: Recommend 操作 =====

    /**
     * 选择推荐选项
     * 对齐后端: POST /messages/:messageId/select { optionId }
     */
    async selectRecommend(optionId: string): Promise<void> {
      if (!this.currentConversation) return
      const sessionId = this.currentConversation.id
      const recommendMsg = this.messages.find(
        m => m.conversationId === sessionId
          && m.type === 'recommend'
          && !m.selectedOptionId
          && m.metadata?.dismissed !== true
      )
      if (!recommendMsg) return
      try {
        const { chat } = useApi()
        await chat.selectRecommend(sessionId, recommendMsg.id, { optionId })
        // 标记为已选择，visibleMessages 自动过滤掉
        recommendMsg.selectedOptionId = optionId
      } catch (err: any) {
        this.error = err.message || '选择推荐失败'
      }
    },

    /**
     * 关闭/忽略推荐
     * 对齐后端: POST /messages/:messageId/dismiss
     */
    async dismissRecommend(): Promise<void> {
      if (!this.currentConversation) return
      const sessionId = this.currentConversation.id
      const recommendMsg = this.messages.find(
        m => m.conversationId === sessionId
          && m.type === 'recommend'
          && !m.selectedOptionId
          && m.metadata?.dismissed !== true
      )
      if (!recommendMsg) return
      try {
        const { chat } = useApi()
        await chat.dismissRecommend(sessionId, recommendMsg.id)
        // 标记为已关闭，visibleMessages 自动过滤掉
        if (!recommendMsg.metadata) recommendMsg.metadata = {}
        recommendMsg.metadata.dismissed = true
      } catch (err: any) {
        this.error = err.message || '关闭推荐失败'
      }
    },
  },

  persist: {
    key: 'agenthive:chat',
    storage: typeof window !== 'undefined' ? localStorage : undefined,
    pick: ['conversations', 'currentConversation', 'selectedFiles'],
  },
})

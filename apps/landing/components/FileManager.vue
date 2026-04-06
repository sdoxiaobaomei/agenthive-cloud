<template>
  <div class="file-manager">
    <!-- Toolbar -->
    <div class="file-toolbar">
      <div class="toolbar-breadcrumbs">
        <button 
          v-for="(crumb, index) in breadcrumbs" 
          :key="index"
          class="breadcrumb-item"
          @click="navigateTo(index)"
        >
          {{ crumb }}
          <el-icon v-if="index < breadcrumbs.length - 1"><ArrowRight /></el-icon>
        </button>
      </div>
      <div class="toolbar-actions">
        <div class="search-box">
          <el-icon><Search /></el-icon>
          <input v-model="searchQuery" type="text" placeholder="Search files..." />
        </div>
        <button class="toolbar-btn" @click="showNewMenu = !showNewMenu">
          <el-icon><Plus /></el-icon>
          New
        </button>
        <div v-if="showNewMenu" class="new-menu">
          <button @click="createFile">
            <el-icon><Document /></el-icon>
            New File
          </button>
          <button @click="createFolder">
            <el-icon><Folder /></el-icon>
            New Folder
          </button>
          <button @click="uploadFile">
            <el-icon><Upload /></el-icon>
            Upload
          </button>
        </div>
      </div>
    </div>

    <!-- File Tree & Editor -->
    <div class="file-workspace">
      <!-- File Tree Sidebar -->
      <div class="file-tree" :style="{ width: sidebarWidth + 'px' }">
        <div class="tree-header">
          <span>Files</span>
          <button class="collapse-btn" @click="toggleAllFolders">
            <el-icon><Fold /></el-icon>
          </button>
        </div>
        <div class="tree-content">
          <FileTreeNode 
            v-for="node in fileTree" 
            :key="node.path"
            :node="node"
            :selected-path="selectedFile?.path"
            :expanded-paths="expandedPaths"
            @select="selectFile"
            @toggle="toggleFolder"
            @rename="renameNode"
            @delete="deleteNode"
            @contextmenu="showContextMenu"
          />
        </div>
      </div>

      <!-- Resize Handle -->
      <div class="resize-handle" @mousedown="startResize" />

      <!-- Editor Area -->
      <div class="editor-area">
        <!-- Tabs -->
        <div class="editor-tabs">
          <div 
            v-for="tab in openTabs" 
            :key="tab.path"
            class="editor-tab"
            :class="{ active: activeTab === tab.path, modified: tab.isModified }"
            @click="switchTab(tab)"
          >
            <FileIcon :filename="tab.name" />
            <span class="tab-name">{{ tab.name }}</span>
            <span v-if="tab.isModified" class="modified-indicator">●</span>
            <button class="close-tab" @click.stop="closeTab(tab)">
              <el-icon><Close /></el-icon>
            </button>
          </div>
        </div>

        <!-- Code Editor -->
        <div v-if="selectedFile" class="code-editor">
          <div class="editor-header">
            <div class="file-info">
              <span class="file-path">{{ selectedFile.path }}</span>
              <span class="git-status" :class="selectedFile.gitStatus">
                {{ selectedFile.gitStatus }}
              </span>
            </div>
            <div class="editor-actions">
              <button class="action-btn" @click="formatCode">
                <el-icon><Star /></el-icon>
                Format
              </button>
              <button class="action-btn" @click="foldAll">
                <el-icon><Fold /></el-icon>
                Fold
              </button>
              <button class="action-btn" @click="unfoldAll">
                <el-icon><Expand /></el-icon>
                Unfold
              </button>
            </div>
          </div>
          
          <div class="editor-content">
            <div class="line-numbers">
              <span v-for="n in lineCount" :key="n">{{ n }}</span>
            </div>
            <textarea
              v-model="fileContent"
              class="code-textarea"
              @input="onContentChange"
              @keydown="handleKeydown"
              spellcheck="false"
            />
          </div>

          <!-- Status Bar -->
          <div class="status-bar">
            <div class="status-left">
              <span class="status-item">{{ selectedFile.language }}</span>
              <span class="status-item">UTF-8</span>
              <span class="status-item">{{ lineCount }} lines</span>
              <span class="status-item">{{ fileContent.length }} chars</span>
            </div>
            <div class="status-right">
              <span class="status-item">Ln {{ cursorLine }}, Col {{ cursorCol }}</span>
              <span class="status-item">UTF-8</span>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div v-else class="empty-editor">
          <el-icon class="empty-icon"><Document /></el-icon>
          <p>Select a file to start editing</p>
          <div class="recent-files">
            <h4>Recent Files</h4>
            <button 
              v-for="file in recentFiles" 
              :key="file.path"
              @click="selectFileByPath(file.path)"
            >
              {{ file.name }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Context Menu -->
    <div 
      v-if="contextMenu.show" 
      class="context-menu"
      :style="{ top: contextMenu.y + 'px', left: contextMenu.x + 'px' }"
    >
      <button @click="contextAction('rename')">
        <el-icon><Edit /></el-icon>
        Rename
      </button>
      <button @click="contextAction('duplicate')">
        <el-icon><CopyDocument /></el-icon>
        Duplicate
      </button>
      <button @click="contextAction('copy')">
        <el-icon><DocumentCopy /></el-icon>
        Copy Path
      </button>
      <div class="menu-divider" />
      <button @click="contextAction('git')">
        <el-icon><Connection /></el-icon>
        Git History
      </button>
      <div class="menu-divider" />
      <button class="danger" @click="contextAction('delete')">
        <el-icon><Delete /></el-icon>
        Delete
      </button>
    </div>

    <!-- Snippets Panel -->
    <div v-if="showSnippets" class="snippets-panel">
      <div class="snippets-header">
        <h4>Code Snippets</h4>
        <button @click="showSnippets = false">
          <el-icon><Close /></el-icon>
        </button>
      </div>
      <div class="snippets-list">
        <div 
          v-for="snippet in codeSnippets" 
          :key="snippet.id"
          class="snippet-item"
          @click="insertSnippet(snippet)"
        >
          <span class="snippet-name">{{ snippet.name }}</span>
          <code class="snippet-preview">{{ snippet.preview }}</code>
          <span class="snippet-lang">{{ snippet.language }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
  ArrowRight,
  Search,
  Plus,
  Document,
  Folder,
  Upload,
  Fold,
  Close,
  Star,
  Expand,
  Edit,
  CopyDocument,
  Delete,
  Connection
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import FileTreeNode from './FileTreeNode.vue'
import FileIcon from './FileIcon.vue'

interface FileNode {
  name: string
  path: string
  type: 'file' | 'folder'
  language?: string
  gitStatus?: 'modified' | 'added' | 'deleted' | 'untracked' | 'unchanged'
  children?: FileNode[]
  isExpanded?: boolean
}

interface OpenTab {
  name: string
  path: string
  content: string
  isModified: boolean
}

interface CodeSnippet {
  id: string
  name: string
  code: string
  preview: string
  language: string
}

// File Tree
const fileTree = ref<FileNode[]>([
  {
    name: 'src',
    path: '/src',
    type: 'folder',
    isExpanded: true,
    children: [
      {
        name: 'components',
        path: '/src/components',
        type: 'folder',
        isExpanded: true,
        children: [
          { name: 'Button.tsx', path: '/src/components/Button.tsx', type: 'file', language: 'typescript', gitStatus: 'modified' },
          { name: 'Card.vue', path: '/src/components/Card.vue', type: 'file', language: 'vue', gitStatus: 'unchanged' }
        ]
      },
      {
        name: 'pages',
        path: '/src/pages',
        type: 'folder',
        isExpanded: false,
        children: [
          { name: 'index.tsx', path: '/src/pages/index.tsx', type: 'file', language: 'typescript', gitStatus: 'added' },
          { name: 'about.tsx', path: '/src/pages/about.tsx', type: 'file', language: 'typescript', gitStatus: 'unchanged' }
        ]
      },
      { name: 'App.tsx', path: '/src/App.tsx', type: 'file', language: 'typescript', gitStatus: 'modified' },
      { name: 'main.ts', path: '/src/main.ts', type: 'file', language: 'typescript', gitStatus: 'unchanged' }
    ]
  },
  {
    name: 'public',
    path: '/public',
    type: 'folder',
    isExpanded: false,
    children: [
      { name: 'favicon.ico', path: '/public/favicon.ico', type: 'file', language: 'binary', gitStatus: 'unchanged' }
    ]
  },
  { name: 'package.json', path: '/package.json', type: 'file', language: 'json', gitStatus: 'modified' },
  { name: 'README.md', path: '/README.md', type: 'file', language: 'markdown', gitStatus: 'unchanged' }
])

// State
const selectedFile = ref<FileNode | null>(null)
const expandedPaths = ref<Set<string>>(new Set(['/src', '/src/components']))
const openTabs = ref<OpenTab[]>([])
const activeTab = ref<string>('')
const fileContent = ref('')
const searchQuery = ref('')
const showNewMenu = ref(false)
const showSnippets = ref(false)
const sidebarWidth = ref(240)
const cursorLine = ref(1)
const cursorCol = ref(1)

const breadcrumbs = computed(() => {
  if (!selectedFile.value) return ['Project']
  const parts = selectedFile.value.path.split('/').filter(Boolean)
  return ['Project', ...parts]
})

const lineCount = computed(() => fileContent.value.split('\n').length)

const recentFiles = computed(() => {
  return openTabs.value.slice(0, 5)
})

const codeSnippets = ref<CodeSnippet[]>([
  { id: '1', name: 'React Component', code: 'const Component = () => {\n  return <div></div>\n}', preview: 'const Component...', language: 'tsx' },
  { id: '2', name: 'Vue Component', code: '<template>\n  <div></div>\n</template>', preview: '<template>...', language: 'vue' },
  { id: '3', name: 'useState Hook', code: 'const [state, setState] = useState(initial)', preview: 'useState...', language: 'ts' }
])

const contextMenu = ref({ show: false, x: 0, y: 0, node: null as FileNode | null })

// Methods
const selectFile = (node: FileNode) => {
  if (node.type === 'folder') {
    toggleFolder(node)
    return
  }
  
  selectedFile.value = node
  
  // Add to tabs if not open
  const existingTab = openTabs.value.find(t => t.path === node.path)
  if (!existingTab) {
    openTabs.value.push({
      name: node.name,
      path: node.path,
      content: getFileContent(node),
      isModified: false
    })
  }
  
  activeTab.value = node.path
  fileContent.value = existingTab?.content || getFileContent(node)
}

// 通过路径选择文件（用于 recent files）
const selectFileByPath = (path: string) => {
  // 在已打开的 tabs 中查找
  const existingTab = openTabs.value.find(t => t.path === path)
  if (existingTab) {
    selectedFile.value = {
      name: existingTab.name,
      path: existingTab.path,
      type: 'file' as const
    }
    activeTab.value = path
    fileContent.value = existingTab.content
    return
  }
  
  // 在文件树中查找
  const findNode = (nodes: FileNode[]): FileNode | null => {
    for (const node of nodes) {
      if (node.path === path) return node
      if (node.children) {
        const found = findNode(node.children)
        if (found) return found
      }
    }
    return null
  }
  
  const node = findNode(fileTree.value)
  if (node) {
    selectFile(node)
  }
}

const getFileContent = (node: FileNode): string => {
  // Simulate file content
  if (node.name.endsWith('.tsx')) {
    return `import React from 'react'\n\nexport const ${node.name.replace('.tsx', '')} = () => {\n  return (\n    <div className="component">\n      {/* Component content */}\n    </div>\n  )\n}`
  }
  return `// ${node.name}\n// File content here`
}

const toggleFolder = (node: FileNode) => {
  node.isExpanded = !node.isExpanded
  if (node.isExpanded) {
    expandedPaths.value.add(node.path)
  } else {
    expandedPaths.value.delete(node.path)
  }
}

const toggleAllFolders = () => {
  const allExpanded = fileTree.value.every(node => node.isExpanded)
  const setExpanded = (nodes: FileNode[], expanded: boolean) => {
    nodes.forEach(node => {
      if (node.type === 'folder') {
        node.isExpanded = expanded
        if (expanded) {
          expandedPaths.value.add(node.path)
        } else {
          expandedPaths.value.delete(node.path)
        }
        if (node.children) setExpanded(node.children, expanded)
      }
    })
  }
  setExpanded(fileTree.value, !allExpanded)
}

const switchTab = (tab: OpenTab) => {
  activeTab.value = tab.path
  fileContent.value = tab.content
  // Find file node
  const findNode = (nodes: FileNode[]): FileNode | null => {
    for (const node of nodes) {
      if (node.path === tab.path) return node
      if (node.children) {
        const found = findNode(node.children)
        if (found) return found
      }
    }
    return null
  }
  selectedFile.value = findNode(fileTree.value)
}

const closeTab = (tab: OpenTab) => {
  const index = openTabs.value.findIndex(t => t.path === tab.path)
  openTabs.value = openTabs.value.filter(t => t.path !== tab.path)
  
  if (activeTab.value === tab.path) {
    const newActive = openTabs.value[index] || openTabs.value[index - 1] || openTabs.value[0]
    if (newActive) {
      switchTab(newActive)
    } else {
      activeTab.value = ''
      selectedFile.value = null
      fileContent.value = ''
    }
  }
}

const onContentChange = () => {
  const tab = openTabs.value.find(t => t.path === activeTab.value)
  if (tab) {
    tab.isModified = true
    tab.content = fileContent.value
  }
}

const handleKeydown = (e: KeyboardEvent) => {
  // Auto-indent
  if (e.key === 'Enter') {
    const textarea = e.target as HTMLTextAreaElement
    const cursorPosition = textarea.selectionStart
    const beforeCursor = fileContent.value.substring(0, cursorPosition)
    const currentLine = beforeCursor.split('\n').pop() || ''
    const indent = currentLine.match(/^\s*/)?.[0] || ''
    
    if (currentLine.trim().endsWith('{')) {
      e.preventDefault()
      const insertText = '\n' + indent + '  \n' + indent
      fileContent.value = beforeCursor + insertText + fileContent.value.substring(cursorPosition)
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = cursorPosition + indent.length + 3
      })
    }
  }
  
  // Update cursor position
  updateCursorPosition()
}

const updateCursorPosition = () => {
  const textarea = document.querySelector('.code-textarea') as HTMLTextAreaElement
  if (!textarea) return
  
  const value = textarea.value
  const position = textarea.selectionStart
  const lines = value.substring(0, position).split('\n')
  cursorLine.value = lines.length
  cursorCol.value = lines[lines.length - 1].length + 1
}

const formatCode = () => {
  // Simulate formatting
  fileContent.value = fileContent.value
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .replace(/ {2,}/g, '  ')
  ElMessage.success('Code formatted')
}

const foldAll = () => {
  ElMessage.info('Code folded')
}

const unfoldAll = () => {
  ElMessage.info('Code unfolded')
}

const createFile = () => {
  const name = prompt('File name:')
  if (name) {
    ElMessage.success(`Created ${name}`)
  }
  showNewMenu.value = false
}

const createFolder = () => {
  const name = prompt('Folder name:')
  if (name) {
    ElMessage.success(`Created ${name}/`)
  }
  showNewMenu.value = false
}

const uploadFile = () => {
  ElMessage.info('Upload file dialog opened')
  showNewMenu.value = false
}

const renameNode = (node: FileNode) => {
  const newName = prompt('New name:', node.name)
  if (newName) {
    node.name = newName
  }
}

const deleteNode = (node: FileNode) => {
  if (confirm(`Delete ${node.name}?`)) {
    ElMessage.success(`Deleted ${node.name}`)
  }
}

const showContextMenu = (e: MouseEvent, node: FileNode) => {
  e.preventDefault()
  contextMenu.value = { show: true, x: e.clientX, y: e.clientY, node }
}

const contextAction = (action: string) => {
  if (!contextMenu.value.node) return
  
  switch (action) {
    case 'rename':
      renameNode(contextMenu.value.node)
      break
    case 'duplicate':
      ElMessage.success('File duplicated')
      break
    case 'copy':
      navigator.clipboard.writeText(contextMenu.value.node.path)
      ElMessage.success('Path copied')
      break
    case 'git':
      ElMessage.info('Git history opened')
      break
    case 'delete':
      deleteNode(contextMenu.value.node)
      break
  }
  contextMenu.value.show = false
}

const navigateTo = (index: number) => {
  if (index === 0) {
    selectedFile.value = null
  }
}

const startResize = (e: MouseEvent) => {
  const startX = e.clientX
  const startWidth = sidebarWidth.value
  
  const handleMouseMove = (e: MouseEvent) => {
    const diff = e.clientX - startX
    sidebarWidth.value = Math.max(180, Math.min(400, startWidth + diff))
  }
  
  const handleMouseUp = () => {
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)
  }
  
  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
}

const insertSnippet = (snippet: CodeSnippet) => {
  fileContent.value += '\n' + snippet.code
  ElMessage.success(`Inserted ${snippet.name}`)
}

// Close context menu on click outside
const handleClickOutside = () => {
  contextMenu.value.show = false
  showNewMenu.value = false
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.file-manager {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #ffffff;
}

/* Toolbar */
.file-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
}

.toolbar-breadcrumbs {
  display: flex;
  align-items: center;
  gap: 4px;
}

.breadcrumb-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: transparent;
  border: none;
  font-size: 13px;
  color: #6b7280;
  cursor: pointer;
  border-radius: 6px;
}

.breadcrumb-item:hover {
  background: #f3f4f6;
  color: #374151;
}

.breadcrumb-item:last-child {
  color: #111827;
  font-weight: 500;
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  position: relative;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  width: 200px;
}

.search-box input {
  flex: 1;
  border: none;
  outline: none;
  font-size: 13px;
}

.toolbar-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: #4f46e5;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  color: white;
  cursor: pointer;
}

.new-menu {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  box-shadow: 0 10px 40px rgba(0,0,0,0.15);
  padding: 6px;
  z-index: 50;
}

.new-menu button {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  background: transparent;
  border: none;
  font-size: 13px;
  color: #374151;
  cursor: pointer;
  border-radius: 6px;
}

.new-menu button:hover {
  background: #f3f4f6;
}

/* Workspace */
.file-workspace {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* File Tree */
.file-tree {
  display: flex;
  flex-direction: column;
  background: #f9fafb;
  border-right: 1px solid #e5e7eb;
  overflow: hidden;
}

.tree-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid #e5e7eb;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  color: #9ca3af;
  letter-spacing: 0.5px;
}

.collapse-btn {
  width: 20px;
  height: 20px;
  border: none;
  background: transparent;
  color: #9ca3af;
  cursor: pointer;
  border-radius: 4px;
}

.collapse-btn:hover {
  background: #e5e7eb;
  color: #6b7280;
}

.tree-content {
  flex: 1;
  overflow-y: auto;
  padding: 4px;
}

/* Resize Handle */
.resize-handle {
  width: 4px;
  cursor: col-resize;
  background: transparent;
  transition: background 0.15s;
}

.resize-handle:hover {
  background: #4f46e5;
}

/* Editor Area */
.editor-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Tabs */
.editor-tabs {
  display: flex;
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
  overflow-x: auto;
}

.editor-tab {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: transparent;
  border: none;
  border-right: 1px solid #e5e7eb;
  font-size: 13px;
  color: #6b7280;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s;
}

.editor-tab:hover {
  background: #f3f4f6;
  color: #374151;
}

.editor-tab.active {
  background: #ffffff;
  color: #111827;
  border-bottom: 2px solid #4f46e5;
}

.tab-name {
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.modified-indicator {
  color: #4f46e5;
  font-size: 8px;
}

.close-tab {
  width: 18px;
  height: 18px;
  border: none;
  background: transparent;
  border-radius: 4px;
  color: #9ca3af;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.15s;
}

.editor-tab:hover .close-tab,
.editor-tab.active .close-tab {
  opacity: 1;
}

.close-tab:hover {
  background: #e5e7eb;
  color: #374151;
}

/* Code Editor */
.code-editor {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background: #ffffff;
  border-bottom: 1px solid #f3f4f6;
}

.file-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.file-path {
  font-family: 'Fira Code', monospace;
  font-size: 12px;
  color: #6b7280;
}

.git-status {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
}

.git-status.modified {
  background: #fef3c7;
  color: #92400e;
}

.git-status.added {
  background: #dcfce7;
  color: #166534;
}

.git-status.unchanged {
  background: #f3f4f6;
  color: #9ca3af;
}

.editor-actions {
  display: flex;
  gap: 6px;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  font-size: 11px;
  color: #6b7280;
  cursor: pointer;
}

.action-btn:hover {
  background: #f3f4f6;
  border-color: #d1d5db;
}

/* Editor Content */
.editor-content {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.line-numbers {
  padding: 12px 12px 12px 16px;
  background: #f9fafb;
  border-right: 1px solid #e5e7eb;
  font-family: 'Fira Code', monospace;
  font-size: 13px;
  line-height: 1.6;
  color: #9ca3af;
  text-align: right;
  user-select: none;
  overflow-y: hidden;
}

.line-numbers span {
  display: block;
}

.code-textarea {
  flex: 1;
  padding: 12px 16px;
  border: none;
  outline: none;
  font-family: 'Fira Code', monospace;
  font-size: 13px;
  line-height: 1.6;
  color: #374151;
  resize: none;
  white-space: pre;
  overflow: auto;
  tab-size: 2;
}

/* Status Bar */
.status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 16px;
  background: #4f46e5;
  font-size: 11px;
  color: rgba(255,255,255,0.8);
}

.status-left,
.status-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.status-item {
  white-space: nowrap;
}

/* Empty State */
.empty-editor {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #9ca3af;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.empty-editor p {
  font-size: 14px;
  margin: 0 0 24px;
}

.recent-files {
  text-align: center;
}

.recent-files h4 {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 0 0 12px;
  color: #6b7280;
}

.recent-files button {
  display: block;
  width: 100%;
  padding: 8px 16px;
  background: transparent;
  border: none;
  font-size: 13px;
  color: #4f46e5;
  cursor: pointer;
  border-radius: 6px;
}

.recent-files button:hover {
  background: #f3f4f6;
}

/* Context Menu */
.context-menu {
  position: fixed;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  box-shadow: 0 10px 40px rgba(0,0,0,0.15);
  padding: 6px;
  z-index: 100;
  min-width: 160px;
}

.context-menu button {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 12px;
  background: transparent;
  border: none;
  font-size: 13px;
  color: #374151;
  cursor: pointer;
  border-radius: 6px;
}

.context-menu button:hover {
  background: #f3f4f6;
}

.context-menu button.danger {
  color: #ef4444;
}

.context-menu button.danger:hover {
  background: #fef2f2;
}

.menu-divider {
  height: 1px;
  background: #e5e7eb;
  margin: 6px;
}

/* Snippets Panel */
.snippets-panel {
  position: fixed;
  top: 80px;
  right: 20px;
  width: 280px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0,0,0,0.15);
  z-index: 50;
}

.snippets-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid #e5e7eb;
}

.snippets-header h4 {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
  margin: 0;
}

.snippets-header button {
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  border-radius: 6px;
  color: #9ca3af;
  cursor: pointer;
}

.snippets-list {
  padding: 8px;
  max-height: 400px;
  overflow-y: auto;
}

.snippet-item {
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;
}

.snippet-item:hover {
  background: #f9fafb;
}

.snippet-name {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: #111827;
  margin-bottom: 4px;
}

.snippet-preview {
  display: block;
  font-family: 'Fira Code', monospace;
  font-size: 11px;
  color: #6b7280;
  margin-bottom: 4px;
}

.snippet-lang {
  font-size: 10px;
  color: #9ca3af;
  text-transform: uppercase;
}
</style>

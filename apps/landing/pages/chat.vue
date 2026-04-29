<template>
  <div class="chat-page">
    <!-- Left Chat Panel -->
    <aside class="chat-sidebar" :class="{ collapsed: isChatSidebarCollapsed }">
      <div class="chat-sidebar-header">
        <button
          class="sidebar-collapse-btn"
          :title="isChatSidebarCollapsed ? 'Expand chat' : 'Collapse chat'"
          @click="toggleChatSidebar"
        >
          <el-icon><ArrowLeft v-if="!isChatSidebarCollapsed" /><ArrowRight v-else /></el-icon>
        </button>
      </div>
      <div v-show="!isChatSidebarCollapsed" class="chat-sidebar-body">
        <ChatPanel :current-project="currentProject" embedded />
      </div>
      <div v-show="isChatSidebarCollapsed" class="chat-sidebar-collapsed">
        <button class="collapsed-expand-btn" @click="toggleChatSidebar">
          <img src="/avatars/shiba_tl.png" class="collapsed-avatar" alt="Agent" />
          <span class="collapsed-badge">AI</span>
        </button>
      </div>
    </aside>

    <!-- Center Content Area -->
    <div class="center-area">
      <!-- Tab Content -->
      <div class="center-content">
        <!-- Files Tab - Full File System -->
        <div v-if="chatStore.activeTab === 'files'" class="files-view">
          <div class="files-header">
            <span class="files-title">File System</span>
          </div>
          <div class="file-tree">
            <FileTreeNode
              v-for="node in chatStore.fileTree"
              :key="node.path"
              :node="node"
              :selected-path="chatStore.selectedFile || undefined"
              :expanded-paths="chatStore.expandedFolders"
              @select="handleFileSelect"
              @toggle="handleFolderToggle"
              @contextmenu="handleContextMenu"
            />
            <div v-if="chatStore.fileTree.length === 0 && !chatStore.isLoading" class="empty-tree">
              <el-icon><Folder /></el-icon>
              <span>No files found</span>
            </div>
          </div>
        </div>

        <!-- Editor Tab - Apps Directory Only -->
        <div v-if="chatStore.activeTab === 'editor'" class="editor-view">
          <!-- Editor Sidebar - Apps Files -->
          <div class="editor-sidebar">
            <div class="editor-sidebar-header">
              <span class="editor-sidebar-title">Explorer</span>
              <div class="editor-actions">
                <button class="editor-btn" title="New File" @click="showCreateDialog('file')">
                  <el-icon><DocumentAdd /></el-icon>
                </button>
                <button class="editor-btn" title="New Folder" @click="showCreateDialog('folder')">
                  <el-icon><FolderAdd /></el-icon>
                </button>
              </div>
            </div>
            <div class="editor-file-tree">
              <FileTreeNode
                v-for="node in editorFileTree"
                :key="node.path"
                :node="node"
                :selected-path="chatStore.selectedFile || undefined"
                :expanded-paths="chatStore.expandedFolders"
                @select="handleFileSelect"
                @toggle="handleFolderToggle"
                @contextmenu="handleContextMenu"
              />
              <div v-if="editorFileTree.length === 0 && !chatStore.isLoading" class="empty-tree">
                <span>No files found</span>
              </div>
            </div>
          </div>

          <!-- Code Editor -->
          <div class="code-editor">
            <!-- Opened Files Tabs -->
            <div v-if="chatStore.openedFiles.length > 0" class="code-tabs">
              <div
                v-for="file in chatStore.openedFiles"
                :key="file.path"
                class="code-tab"
                :class="{ active: chatStore.activeFilePath === file.path }"
                @click="chatStore.setActiveFile(file.path)"
              >
                <el-icon><Document /></el-icon>
                <span>{{ file.name }}</span>
                <button class="tab-close" @click.stop="chatStore.closeFileInEditor(file.path)">
                  <el-icon><Close /></el-icon>
                </button>
              </div>
            </div>

            <div class="code-content">
              <div v-if="currentFile" class="code-header">
                <span class="code-path">{{ currentFile.path }}</span>
              </div>
              <div class="code-body">
                <div v-if="!currentFile" class="code-placeholder">
                  <el-icon class="placeholder-icon"><Document /></el-icon>
                  <p>Select a file to view its content</p>
                </div>
                <pre v-else class="code-block"><code>{{ fileContent || '// File content will be loaded here' }}</code></pre>
              </div>
            </div>
          </div>
        </div>

        <!-- Preview Tab -->
        <div v-if="chatStore.activeTab === 'preview'" class="preview-view">
          <div class="preview-frame">
            <div class="preview-header">
              <div class="window-controls">
                <span class="dot red"></span>
                <span class="dot yellow"></span>
                <span class="dot green"></span>
              </div>
              <div class="url-bar">localhost:3000</div>
            </div>
            <div class="preview-body">
              <div v-if="!currentProject" class="preview-placeholder">
                <el-icon class="placeholder-icon"><Monitor /></el-icon>
                <h3>App Preview</h3>
                <p>Select a project to see preview</p>
              </div>
              <div v-else class="preview-content">
                <div class="mock-hero">
                  <h1>{{ currentProject.name }}</h1>
                  <p>{{ currentProject.description }}</p>
                </div>
                <div class="mock-grid">
                  <div class="mock-card" v-for="i in 6" :key="i">
                    <div class="mock-card-img"></div>
                    <div class="mock-card-text">
                      <div class="mock-line"></div>
                      <div class="mock-line short"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Context Menu -->
    <div
      v-if="contextMenu.visible"
      class="context-menu"
      :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
    >
      <div class="context-menu-item" @click="handleMenuAction('rename')">
        <el-icon><Edit /></el-icon>
        <span>Rename</span>
      </div>
      <div class="context-menu-item" @click="handleMenuAction('delete')">
        <el-icon><Delete /></el-icon>
        <span>Delete</span>
      </div>
      <div class="context-menu-divider"></div>
      <div class="context-menu-item" @click="handleMenuAction('newFile')">
        <el-icon><DocumentAdd /></el-icon>
        <span>New File</span>
      </div>
      <div class="context-menu-item" @click="handleMenuAction('newFolder')">
        <el-icon><FolderAdd /></el-icon>
        <span>New Folder</span>
      </div>
    </div>

    <!-- Create File/Folder Dialog -->
    <el-dialog
      v-model="createDialog.visible"
      :title="createDialog.isDirectory ? 'New Folder' : 'New File'"
      width="400px"
    >
      <el-input
        v-model="createDialog.name"
        :placeholder="createDialog.isDirectory ? 'Folder name' : 'File name'"
        @keyup.enter="confirmCreate"
      />
      <template #footer>
        <el-button @click="createDialog.visible = false">Cancel</el-button>
        <el-button type="primary" @click="confirmCreate" :loading="chatStore.isLoading">
          Create
        </el-button>
      </template>
    </el-dialog>

    <!-- Rename Dialog -->
    <el-dialog
      v-model="renameDialog.visible"
      title="Rename"
      width="400px"
    >
      <el-input
        v-model="renameDialog.name"
        placeholder="New name"
        @keyup.enter="confirmRename"
      />
      <template #footer>
        <el-button @click="renameDialog.visible = false">Cancel</el-button>
        <el-button type="primary" @click="confirmRename" :loading="chatStore.isLoading">
          Rename
        </el-button>
      </template>
    </el-dialog>

    <!-- Delete Confirm Dialog -->
    <el-dialog
      v-model="deleteDialog.visible"
      title="Confirm Delete"
      width="400px"
    >
      <p>Are you sure you want to delete "{{ deleteDialog.node?.name }}"?</p>
      <p class="delete-warning">This action cannot be undone.</p>
      <template #footer>
        <el-button @click="deleteDialog.visible = false">Cancel</el-button>
        <el-button type="danger" @click="confirmDelete" :loading="chatStore.isLoading">
          Delete
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  Document,
  DocumentAdd,
  Folder,
  FolderAdd,
  Close,
  Monitor,
  Edit,
  Delete,
  ArrowLeft,
  ArrowRight,
} from '@element-plus/icons-vue'
import ChatPanel from '~/components/ChatPanel.vue'
import FileTreeNode from '~/components/FileTreeNode.vue'
import { useChatStore, type FileTreeNode as FileTreeNodeType } from '~/stores/chat'
import { useProjectStore } from '~/stores/project'

definePageMeta({
  layout: 'chat',
  pageTransition: {
    name: 'chat-page',
    mode: 'out-in',
    duration: 400
  }
})

interface Project {
  id: string
  name: string
  description: string
}

const router = useRouter()
const chatStore = useChatStore()
const projectStore = useProjectStore()
const currentProject = computed(() => projectStore.currentProject)
const fileContent = ref('')

// Chat sidebar collapse state
const isChatSidebarCollapsed = ref(false)
const toggleChatSidebar = () => {
  isChatSidebarCollapsed.value = !isChatSidebarCollapsed.value
}

// Context Menu State
const contextMenu = ref({
  visible: false,
  x: 0,
  y: 0,
  node: null as FileTreeNodeType | null,
})

// Create Dialog State
const createDialog = ref({
  visible: false,
  isDirectory: false,
  name: '',
  parentPath: '',
})

// Rename Dialog State
const renameDialog = ref({
  visible: false,
  name: '',
  node: null as FileTreeNodeType | null,
})

// Delete Dialog State
const deleteDialog = ref({
  visible: false,
  node: null as FileTreeNodeType | null,
})

// Editor file tree - filter to show only app directory or full tree
const editorFileTree = computed(() => {
  // For now, show full tree in editor, can be filtered later
  return chatStore.fileTree
})

// Current file being edited
const currentFile = computed(() => {
  if (!chatStore.activeFilePath) return null
  return chatStore.openedFiles.find(f => f.path === chatStore.activeFilePath) || null
})

// Load file content when active file changes
watch(() => chatStore.activeFilePath, async (path) => {
  if (path) {
    await loadFileContent(path)
  } else {
    fileContent.value = ''
  }
})

onMounted(() => {
  // Redirect to workspace if a current project exists (URL-first approach)
  const project = projectStore.currentProject
  if (project?.id) {
    router.replace(`/workspace/${project.id}`)
    return
  }

  // Load file tree on mount
  chatStore.loadFileTree().catch((err) => {
    console.warn('Failed to load file tree:', err)
    // 不显示错误提示，因为用户可能未登录
  })

  // Close context menu on click outside
  document.addEventListener('click', hideContextMenu)
})

onUnmounted(() => {
  document.removeEventListener('click', hideContextMenu)
})

// Load file content from API
async function loadFileContent(path: string) {
  try {
    const { code: codeApi } = useApi()
    const response = await codeApi.getFile(path)
    if (response.success && response.data) {
      fileContent.value = response.data.content
    }
  } catch (err) {
    console.error('Failed to load file content:', err)
    fileContent.value = '// Error loading file content'
  }
}

// Handle file/folder selection
function handleFileSelect(node: FileTreeNodeType) {
  if (node.type === 'file') {
    chatStore.openFileInEditor(node)
    chatStore.setActiveTab('editor')
  }
  hideContextMenu()
}

// Handle folder toggle
function handleFolderToggle(node: FileTreeNodeType) {
  chatStore.toggleFolder(node.path)
}

// Handle right-click context menu
function handleContextMenu(event: MouseEvent, node: FileTreeNodeType) {
  event.preventDefault()
  contextMenu.value = {
    visible: true,
    x: event.clientX,
    y: event.clientY,
    node,
  }
}

// Hide context menu
function hideContextMenu() {
  contextMenu.value.visible = false
}

// Handle context menu action
function handleMenuAction(action: string) {
  const node = contextMenu.value.node
  if (!node) return

  switch (action) {
    case 'rename':
      renameDialog.value = {
        visible: true,
        name: node.name,
        node,
      }
      break
    case 'delete':
      deleteDialog.value = {
        visible: true,
        node,
      }
      break
    case 'newFile':
      createDialog.value = {
        visible: true,
        isDirectory: false,
        name: '',
        parentPath: node.type === 'folder' ? node.path : getParentPath(node.path),
      }
      break
    case 'newFolder':
      createDialog.value = {
        visible: true,
        isDirectory: true,
        name: '',
        parentPath: node.type === 'folder' ? node.path : getParentPath(node.path),
      }
      break
  }
  hideContextMenu()
}

// Get parent path
function getParentPath(path: string): string {
  const parts = path.split('/')
  parts.pop()
  return parts.join('/')
}

// Show create dialog
function showCreateDialog(type: 'file' | 'folder') {
  createDialog.value = {
    visible: true,
    isDirectory: type === 'folder',
    name: '',
    parentPath: '',
  }
}

// Confirm create
async function confirmCreate() {
  if (!createDialog.value.name) return

  try {
    await chatStore.createFile(
      createDialog.value.parentPath,
      createDialog.value.name,
      createDialog.value.isDirectory
    )
    createDialog.value.visible = false
    ElMessage.success(createDialog.value.isDirectory ? 'Folder created' : 'File created')
  } catch (err: any) {
    ElMessage.error(err.message || 'Failed to create')
  }
}

// Confirm rename
async function confirmRename() {
  if (!renameDialog.value.name || !renameDialog.value.node) return

  try {
    await chatStore.renameFile(renameDialog.value.node.path, renameDialog.value.name)
    renameDialog.value.visible = false
    ElMessage.success('Renamed successfully')
  } catch (err: any) {
    ElMessage.error(err.message || 'Failed to rename')
  }
}

// Confirm delete
async function confirmDelete() {
  if (!deleteDialog.value.node) return

  try {
    await chatStore.deleteFile(deleteDialog.value.node.path)
    deleteDialog.value.visible = false
    ElMessage.success('Deleted successfully')
  } catch (err: any) {
    ElMessage.error(err.message || 'Failed to delete')
  }
}
</script>

<style scoped>
.chat-page {
  display: flex;
  width: 100%;
  height: 100%;
  background: #fafafa;
}

/* Chat 页面特殊入场动画 - 淡入 + 轻微缩放 */
:global(.chat-page-enter-active) {
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

:global(.chat-page-leave-active) {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

:global(.chat-page-enter-from) {
  opacity: 0;
  transform: scale(0.98);
}

:global(.chat-page-leave-to) {
  opacity: 0;
  transform: scale(1.02);
}

/* Left Chat Sidebar */
.chat-sidebar {
  width: 320px;
  background: #ffffff;
  border-right: 1px solid #e5e7eb;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

.chat-sidebar.collapsed {
  width: 56px;
}

.chat-sidebar-header {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 8px;
  border-bottom: 1px solid #f3f4f6;
  flex-shrink: 0;
}

.sidebar-collapse-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #9ca3af;
  cursor: pointer;
  transition: all 0.15s ease;
}

.sidebar-collapse-btn:hover {
  background: #f3f4f6;
  color: #374151;
}

.chat-sidebar-body {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.chat-sidebar-collapsed {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
}

.collapsed-expand-btn {
  position: relative;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  border: none;
  background: #f3f4f6;
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.collapsed-avatar {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  object-fit: cover;
}

.collapsed-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  background: #4f46e5;
  color: white;
  font-size: 10px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 10px;
}

/* Center Area */
.center-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: #ffffff;
}

/* Center Content */
.center-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* Files View */
.files-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.files-header {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #e5e7eb;
}

.files-title {
  font-size: 12px;
  font-weight: 600;
  color: #9ca3af;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Editor View */
.editor-view {
  flex: 1;
  display: flex;
  overflow: hidden;
}

/* Editor Sidebar */
.editor-sidebar {
  width: 240px;
  background: #f9fafb;
  border-right: 1px solid #e5e7eb;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.editor-sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #e5e7eb;
}

.editor-sidebar-title {
  font-size: 11px;
  font-weight: 600;
  color: #9ca3af;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.editor-actions {
  display: flex;
  gap: 4px;
}

.editor-btn {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: #9ca3af;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.editor-btn:hover {
  background: #f3f4f6;
  color: #6b7280;
}

.editor-file-tree {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

/* Code Editor */
.code-editor {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: #1e1e1e;
}

.code-tabs {
  display: flex;
  background: #252526;
  border-bottom: 1px solid #333;
  overflow-x: auto;
}

.code-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: #2d2d2d;
  color: #9ca3af;
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
  border-right: 1px solid #333;
  transition: all 0.15s ease;
}

.code-tab:hover {
  background: #3c3c3c;
}

.code-tab.active {
  background: #1e1e1e;
  color: #fff;
}

.tab-close {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  border: none;
  background: transparent;
  color: #9ca3af;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: 8px;
  opacity: 0;
  transition: all 0.15s ease;
}

.code-tab:hover .tab-close {
  opacity: 1;
}

.tab-close:hover {
  background: #333;
  color: #fff;
}

.code-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.code-header {
  padding: 10px 16px;
  background: #1e1e1e;
  border-bottom: 1px solid #333;
}

.code-path {
  font-size: 12px;
  color: #9ca3af;
  font-family: 'Fira Code', 'Consolas', monospace;
}

.code-body {
  flex: 1;
  overflow: auto;
  padding: 16px;
}

.code-placeholder {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #6b7280;
  gap: 12px;
}

.code-placeholder .placeholder-icon {
  font-size: 48px;
  color: #4b5563;
}

.code-block {
  margin: 0;
  font-family: 'Fira Code', 'Consolas', monospace;
  font-size: 13px;
  line-height: 1.6;
  color: #d4d4d4;
}

/* File Tree Common Styles */
.file-tree {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.empty-tree {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px;
  color: #9ca3af;
  font-size: 13px;
}

/* Context Menu */
.context-menu {
  position: fixed;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  min-width: 160px;
  padding: 4px;
}

.context-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
  border-radius: 6px;
  font-size: 13px;
  color: #374151;
  transition: all 0.15s ease;
}

.context-menu-item:hover {
  background: #f3f4f6;
}

.context-menu-divider {
  height: 1px;
  background: #e5e7eb;
  margin: 4px 0;
}

/* Delete warning */
.delete-warning {
  color: #ef4444;
  font-size: 13px;
  margin-top: 8px;
}

/* Preview View */
.preview-view {
  flex: 1;
  overflow: auto;
  padding: 0;
  background: #f3f4f6;
}

.preview-frame {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.08);
  overflow: hidden;
}

.preview-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
}

.window-controls {
  display: flex;
  gap: 8px;
}

.dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.dot.red { background: #ff5f57; }
.dot.yellow { background: #febc2e; }
.dot.green { background: #28c840; }

.url-bar {
  flex: 1;
  background: white;
  padding: 6px 16px;
  border-radius: 6px;
  font-size: 13px;
  color: #6b7280;
  text-align: center;
  font-family: monospace;
  border: 1px solid #e5e7eb;
}

.preview-body {
  flex: 1;
  overflow: auto;
  padding: 0;
}

.preview-placeholder {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #9ca3af;
  text-align: center;
}

.placeholder-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.preview-content {
  padding: 24px;
}

.mock-hero {
  text-align: center;
  margin-bottom: 32px;
}

.mock-hero h1 {
  font-size: 24px;
  font-weight: 600;
  color: #111827;
  margin-bottom: 8px;
}

.mock-hero p {
  font-size: 14px;
  color: #6b7280;
}

.mock-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.mock-card {
  background: white;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #e5e7eb;
}

.mock-card-img {
  height: 120px;
  background: linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%);
}

.mock-card-text {
  padding: 12px;
}

.mock-line {
  height: 12px;
  background: #e5e7eb;
  border-radius: 6px;
  margin-bottom: 8px;
}

.mock-line.short {
  width: 60%;
}

@media (max-width: 768px) {
  .chat-sidebar {
    position: fixed;
    top: 48px;
    left: 0;
    height: calc(100vh - 48px);
    z-index: 45;
    transform: translateX(0);
  }

  .chat-sidebar.collapsed {
    transform: translateX(-100%);
    width: 320px;
  }

  .mock-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>

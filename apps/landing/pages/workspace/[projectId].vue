<template>
  <div class="workspace-page">
    <!-- Sidebar -->
    <aside
      class="workspace-sidebar"
      :class="{ collapsed: workspaceStore.sidebarCollapsed }"
    >
      <!-- Sidebar Toolbar -->
      <div class="sidebar-toolbar">
        <span
          v-if="!workspaceStore.sidebarCollapsed"
          class="toolbar-project-name"
          :title="projectName"
        >
          {{ projectName }}
        </span>
        <div class="toolbar-actions">
          <el-button
            text
            size="small"
            :icon="Refresh"
            :loading="workspaceStore.loading"
            @click="refreshFiles"
          />
          <el-button
            text
            size="small"
            :icon="workspaceStore.sidebarCollapsed ? Expand : Fold"
            @click="toggleSidebar"
          />
        </div>
      </div>

      <!-- Breadcrumb -->
      <div
        v-if="!workspaceStore.sidebarCollapsed"
        class="sidebar-breadcrumb"
      >
        <span class="breadcrumb-root">workspace</span>
        <el-icon class="breadcrumb-sep"><ArrowRight /></el-icon>
        <span class="breadcrumb-project">{{ projectName }}</span>
        <template v-if="workspaceStore.currentPath">
          <el-icon class="breadcrumb-sep"><ArrowRight /></el-icon>
          <span class="breadcrumb-path">{{ workspaceStore.currentPath }}</span>
        </template>
      </div>

      <!-- File Tree -->
      <div
        v-if="!workspaceStore.sidebarCollapsed"
        class="sidebar-content"
      >
        <ClientOnly>
          <div v-if="workspaceStore.loading && workspaceStore.fileTree.length === 0" class="tree-loading">
            <el-skeleton :rows="8" animated />
          </div>

          <el-empty
            v-else-if="workspaceStore.fileTree.length === 0"
            description="Empty workspace"
            :image-size="120"
          >
            <template #description>
              <div class="empty-tree-desc">
                <p class="empty-title">Empty workspace</p>
                <p class="empty-subtitle">Create a file to get started</p>
              </div>
            </template>
          </el-empty>

          <div v-else class="file-tree">
            <FileTreeNode
              v-for="node in workspaceStore.fileTree"
              :key="node.path"
              :node="node"
              :selected-path="workspaceStore.selectedFile || undefined"
              :expanded-paths="workspaceStore.expandedPaths"
              @select="handleFileSelect"
              @toggle="handleFolderToggle"
              @contextmenu="handleContextMenu"
            />
          </div>

          <!-- Context Menu -->
          <ContextMenu
            :visible="contextMenuVisible"
            :x="contextMenuX"
            :y="contextMenuY"
            :items="contextMenuItems"
            @select="handleMenuSelect"
            @close="closeContextMenu"
          />

          <template #fallback>
            <div class="tree-loading">
              <el-skeleton :rows="8" animated />
            </div>
          </template>
        </ClientOnly>
      </div>
    </aside>

    <!-- Main Content -->
    <main class="workspace-main">
      <!-- Project Not Found -->
      <el-empty
        v-if="projectNotFound"
        :image-size="180"
        description="Project not found"
      >
        <template #description>
          <div class="empty-tree-desc">
            <p class="empty-title">Project not found</p>
            <p class="empty-subtitle">The project you are looking for does not exist or has been deleted</p>
          </div>
        </template>
        <el-button type="primary" @click="goToProjects">
          <el-icon><ArrowLeft /></el-icon>
          Back to Projects
        </el-button>
      </el-empty>

      <!-- Welcome Page -->
      <div v-else-if="!workspaceStore.selectedFile" class="welcome-page">
        <div class="welcome-content">
          <div class="welcome-logo">{{ projectInitial }}</div>
          <h2 class="welcome-title">{{ projectName }}</h2>
          <p class="welcome-subtitle">
            Select a file from the sidebar to start editing
          </p>
          <div class="welcome-hints">
            <div class="hint-item">
              <el-icon><Document /></el-icon>
              <span>Browse files in the sidebar</span>
            </div>
            <div class="hint-item">
              <el-icon><Refresh /></el-icon>
              <span>Click refresh to sync changes</span>
            </div>
            <div class="hint-item">
              <el-icon><Fold /></el-icon>
              <span>Collapse sidebar for more space</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Editor Area with Tabs -->
      <div v-else class="editor-area">
        <!-- Tab Bar -->
        <div v-if="workspaceStore.openedFiles.length > 0" class="editor-tabs">
          <div
            v-for="file in workspaceStore.openedFiles"
            :key="file.path"
            class="editor-tab"
            :class="{
              active: workspaceStore.activeFilePath === file.path,
              dirty: file.isDirty,
            }"
            @click="workspaceStore.setActiveFile(file.path)"
          >
            <FileIcon :filename="file.name" :is-folder="false" class="tab-icon" />
            <span class="tab-name">{{ file.name }}</span>
            <span v-if="file.isDirty" class="tab-dirty">●</span>
            <button
              class="tab-close"
              @click.stop="handleCloseFile(file.path)"
            >
              <el-icon><Close /></el-icon>
            </button>
          </div>
        </div>

        <!-- Editor Content -->
        <div class="editor-content">
          <MonacoEditor
            v-if="workspaceStore.activeFile"
            v-model="workspaceStore.activeFile.content"
            :language="workspaceStore.activeFile.language"
            :theme="systemTheme"
            @change="handleEditorChange"
          />
        </div>
      </div>

      <!-- Bottom Toolbar -->
      <WorkspaceToolbar
        :project-id="projectId.value"
        @open-file="handleToolbarOpenFile"
      />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useDebounceFn } from '@vueuse/core'
import {
  Refresh,
  Fold,
  Expand,
  ArrowRight,
  ArrowLeft,
  Document,
  Close,
  DocumentAdd,
  FolderAdd,
  EditPen,
  Delete,
  CopyDocument,
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useProjectStore } from '~/stores/project'
import { useWorkspaceStore } from '~/stores/workspace'
import FileTreeNode from '~/components/FileTreeNode.vue'
import FileIcon from '~/components/FileIcon.vue'
import MonacoEditor from '~/components/MonacoEditor.vue'
import ContextMenu from '~/components/ContextMenu.vue'
import WorkspaceToolbar from '~/components/WorkspaceToolbar.vue'
import type { MenuItem } from '~/components/ContextMenu.vue'

definePageMeta({
  layout: 'app',
})

const route = useRoute()
const router = useRouter()
const projectStore = useProjectStore()
const workspaceStore = useWorkspaceStore()

const projectId = computed(() => route.params.projectId as string)
const projectNotFound = ref(false)

// ============ 项目信息 ============
const projectName = computed(() => {
  return projectStore.currentProject?.name || 'Loading...'
})

const projectInitial = computed(() => {
  return projectStore.currentProject?.name?.charAt(0).toUpperCase() || '?'
})

const selectedFileName = computed(() => {
  const path = workspaceStore.selectedFile
  if (!path) return ''
  const parts = path.split('/')
  return parts[parts.length - 1]
})

// ============ 文件树交互 ============
const handleFileSelect = async (node: any) => {
  if (node.type === 'file') {
    try {
      await workspaceStore.openFile(node.path)
    } catch (err: any) {
      if (import.meta.dev) {
        console.debug('[Workspace] Failed to open file:', err.message)
      }
    }
  }
}

const handleFolderToggle = async (node: any) => {
  workspaceStore.toggleFolder(node.path)

  // 懒加载：如果展开且没有 children，尝试加载
  if (node.type === 'folder' && workspaceStore.expandedPaths.has(node.path)) {
    const hasChildren = node.children && node.children.length > 0
    if (!hasChildren) {
      try {
        await workspaceStore.fetchFiles(projectId.value, node.path)
      } catch (err: any) {
        if (import.meta.dev) {
          console.debug('[Workspace] Failed to load folder:', err.message)
        }
      }
    }
  }
}

// ============ 工具栏交互 ============
const refreshFiles = async () => {
  try {
    await workspaceStore.refreshFiles(projectId.value)
  } catch (err: any) {
    if (import.meta.dev) {
      console.debug('[Workspace] Failed to refresh:', err.message)
    }
  }
}

const toggleSidebar = () => {
  workspaceStore.setSidebarCollapsed(!workspaceStore.sidebarCollapsed)
}

const goToProjects = () => {
  router.push('/projects')
}

// ============ 右键菜单 ============
const contextMenuVisible = ref(false)
const contextMenuX = ref(0)
const contextMenuY = ref(0)
const contextMenuNode = ref<any>(null)

const contextMenuItems = computed((): MenuItem[] => {
  const node = contextMenuNode.value
  if (!node) return []

  const isFolder = node.type === 'folder'
  return [
    { key: 'new-file', label: 'New File', icon: DocumentAdd },
    { key: 'new-folder', label: 'New Folder', icon: FolderAdd },
    ...(isFolder ? [] : [{ key: 'rename', label: 'Rename', icon: EditPen }]),
    { key: 'copy-path', label: 'Copy Path', icon: CopyDocument },
    { key: 'delete', label: 'Delete', icon: Delete, danger: true },
  ]
})

const handleContextMenu = (event: MouseEvent, node: any) => {
  event.preventDefault()
  contextMenuNode.value = node
  contextMenuX.value = event.clientX
  contextMenuY.value = event.clientY
  contextMenuVisible.value = true
}

const closeContextMenu = () => {
  contextMenuVisible.value = false
  contextMenuNode.value = null
}

const handleMenuSelect = async (key: string) => {
  const node = contextMenuNode.value
  if (!node) return

  switch (key) {
    case 'new-file':
      await handleNewFile(node)
      break
    case 'new-folder':
      await handleNewFolder(node)
      break
    case 'rename':
      handleRename(node)
      break
    case 'copy-path':
      await navigator.clipboard.writeText(node.path)
      ElMessage.success('Path copied')
      break
    case 'delete':
      await handleDelete(node)
      break
  }
}

const handleNewFile = async (node: any) => {
  const parentPath = node.type === 'folder' ? node.path : node.path.substring(0, node.path.lastIndexOf('/'))
  try {
    const { value } = await ElMessageBox.prompt('Enter file name', 'New File', {
      confirmButtonText: 'Create',
      cancelButtonText: 'Cancel',
      inputValidator: (val) => {
        if (!val.trim()) return 'Name is required'
        return true
      },
    })
    const fileName = value.trim()
    const newPath = parentPath ? `${parentPath}/${fileName}` : fileName

    const { post } = useApi()
    const response = await post('/api/code/files/create', {
      path: newPath,
      isDirectory: false,
    })

    if (response.success) {
      ElMessage.success(`Created ${fileName}`)
      await workspaceStore.refreshFiles(projectId.value)
      await workspaceStore.openFile(newPath)
    } else {
      throw new Error(response.message || 'Create failed')
    }
  } catch (err: any) {
    if (err !== 'cancel') {
      ElMessage.error(err.message || 'Failed to create file')
    }
  }
}

const handleNewFolder = async (node: any) => {
  const parentPath = node.type === 'folder' ? node.path : node.path.substring(0, node.path.lastIndexOf('/'))
  try {
    const { value } = await ElMessageBox.prompt('Enter folder name', 'New Folder', {
      confirmButtonText: 'Create',
      cancelButtonText: 'Cancel',
      inputValidator: (val) => {
        if (!val.trim()) return 'Name is required'
        return true
      },
    })
    const folderName = value.trim()
    const newPath = parentPath ? `${parentPath}/${folderName}` : folderName

    const { post } = useApi()
    const response = await post('/api/code/files/create', {
      path: newPath,
      isDirectory: true,
    })

    if (response.success) {
      ElMessage.success(`Created ${folderName}`)
      await workspaceStore.refreshFiles(projectId.value)
      workspaceStore.toggleFolder(newPath)
    } else {
      throw new Error(response.message || 'Create failed')
    }
  } catch (err: any) {
    if (err !== 'cancel') {
      ElMessage.error(err.message || 'Failed to create folder')
    }
  }
}

const handleRename = (node: any) => {
  // 触发自定义事件让 FileTreeNode 进入重命名模式
  // 由于 FileTreeNode 是递归组件，这里通过事件冒泡处理
  // 简化方案：使用 MessageBox 输入新名称
  ElMessageBox.prompt('Enter new name', 'Rename', {
    confirmButtonText: 'Rename',
    cancelButtonText: 'Cancel',
    inputValue: node.name,
    inputValidator: (val) => {
      if (!val.trim()) return 'Name is required'
      if (val.trim() === node.name) return 'Name unchanged'
      return true
    },
  }).then(async ({ value }) => {
    const newName = value.trim()
    const parentPath = node.path.substring(0, node.path.lastIndexOf('/'))
    const newPath = parentPath ? `${parentPath}/${newName}` : newName

    const { patch } = useApi()
    const response = await patch('/api/code/files/rename', {
      fromPath: node.path,
      toPath: newPath,
    })

    if (response.success) {
      ElMessage.success('Renamed')
      await workspaceStore.refreshFiles(projectId.value)
      // 如果重命名的是已打开的文件，更新 openedFiles 中的路径
      const openedFile = workspaceStore.openedFiles.find(f => f.path === node.path)
      if (openedFile) {
        openedFile.path = newPath
        openedFile.name = newName
        if (workspaceStore.activeFilePath === node.path) {
          workspaceStore.activeFilePath = newPath
        }
        if (workspaceStore.selectedFile === node.path) {
          workspaceStore.selectedFile = newPath
        }
      }
    } else {
      throw new Error(response.message || 'Rename failed')
    }
  }).catch((err: any) => {
    if (err !== 'cancel') {
      ElMessage.error(err.message || 'Failed to rename')
    }
  })
}

const handleDelete = async (node: any) => {
  try {
    await ElMessageBox.confirm(
      `Are you sure you want to delete "${node.name}"?`,
      'Delete',
      {
        confirmButtonText: 'Delete',
        cancelButtonText: 'Cancel',
        type: 'warning',
      }
    )

    const { del } = useApi()
    const response = await del(`/api/code/files/${encodeURIComponent(node.path)}`)

    if (response.success) {
      ElMessage.success('Deleted')
      // 如果删除的是已打开的文件，关闭对应 Tab
      workspaceStore.closeFile(node.path)
      await workspaceStore.refreshFiles(projectId.value)
    } else {
      throw new Error(response.message || 'Delete failed')
    }
  } catch (err: any) {
    if (err !== 'cancel') {
      ElMessage.error(err.message || 'Failed to delete')
    }
  }
}

// ============ Tab 交互 ============
const handleCloseFile = (path: string) => {
  workspaceStore.closeFile(path)
}

const handleToolbarOpenFile = async (path: string) => {
  try {
    await workspaceStore.openFile(path)
  } catch (err: any) {
    if (import.meta.dev) {
      console.debug('[Workspace] Toolbar open file failed:', err.message)
    }
  }
}

// ============ 自动保存 ============
const debouncedSave = useDebounceFn(async () => {
  const active = workspaceStore.activeFile
  if (!active || !active.isDirty) return

  try {
    await workspaceStore.saveFile(active.path)
  } catch (err: any) {
    if (import.meta.dev) {
      console.debug('[Workspace] Auto-save failed:', err.message)
    }
    // 错误已在 store 中设置，不阻塞编辑
  }
}, 1000)

const handleEditorChange = () => {
  const active = workspaceStore.activeFile
  if (active) {
    workspaceStore.updateFileContent(active.path, active.content)
    debouncedSave()
  }
}

// ============ 键盘快捷键 ============
const handleKeyDown = (e: KeyboardEvent) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault()
    const active = workspaceStore.activeFile
    if (active && active.isDirty) {
      workspaceStore.saveFile(active.path).catch((err: any) => {
        if (import.meta.dev) {
          console.debug('[Workspace] Manual save failed:', err.message)
        }
      })
    }
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
})

// ============ 系统主题 ============
const systemTheme = computed<'light' | 'dark'>(() => {
  if (!import.meta.client) return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
})

// ============ 生命周期 ============
onMounted(async () => {
  // 加载项目信息
  try {
    await projectStore.selectProject(projectId.value)
    projectNotFound.value = false
  } catch (err: any) {
    projectNotFound.value = true
    if (import.meta.dev) {
      console.debug('[Workspace] Project not found:', err.message)
    }
    return
  }

  // 加载文件树
  try {
    await workspaceStore.fetchFiles(projectId.value, '')
  } catch (err: any) {
    if (import.meta.dev) {
      console.debug('[Workspace] Failed to fetch files:', err.message)
    }
  }
})
</script>

<style scoped>
.workspace-page {
  display: flex;
  height: 100%;
  width: 100%;
  overflow: hidden;
}

/* ============ Sidebar ============ */
.workspace-sidebar {
  width: 260px;
  flex-shrink: 0;
  background: #f9fafb;
  border-right: 1px solid #e5e7eb;
  display: flex;
  flex-direction: column;
  transition: width 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

.workspace-sidebar.collapsed {
  width: 48px;
}

/* Sidebar Toolbar */
.sidebar-toolbar {
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  border-bottom: 1px solid #e5e7eb;
  flex-shrink: 0;
}

.toolbar-project-name {
  font-size: 13px;
  font-weight: 600;
  color: #111827;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 140px;
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 2px;
}

.toolbar-actions :deep(.el-button) {
  padding: 6px;
  height: 28px;
  width: 28px;
  color: #6b7280;
}

.toolbar-actions :deep(.el-button:hover) {
  color: #4f46e5;
  background: #f3f4f6;
}

/* Breadcrumb */
.sidebar-breadcrumb {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 12px;
  font-size: 11px;
  color: #9ca3af;
  border-bottom: 1px solid #f3f4f6;
  flex-shrink: 0;
  white-space: nowrap;
  overflow: hidden;
}

.breadcrumb-root,
.breadcrumb-project {
  font-weight: 500;
}

.breadcrumb-project {
  color: #6b7280;
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.breadcrumb-path {
  color: #6b7280;
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.breadcrumb-sep {
  font-size: 10px;
  color: #d1d5db;
  flex-shrink: 0;
}

/* Sidebar Content */
.sidebar-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 8px 0;
}

.tree-loading {
  padding: 12px;
}

.file-tree {
  padding: 0 4px;
}

.empty-tree-desc {
  text-align: center;
}

.empty-title {
  font-size: 14px;
  font-weight: 500;
  color: #374151;
  margin: 0 0 4px;
}

.empty-subtitle {
  font-size: 12px;
  color: #9ca3af;
  margin: 0;
}

/* ============ Main Content ============ */
.workspace-main {
  flex: 1;
  min-width: 0;
  background: #ffffff;
  overflow: auto;
  display: flex;
  flex-direction: column;
}

/* Welcome Page */
.welcome-page {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.welcome-content {
  text-align: center;
  padding: 40px;
}

.welcome-logo {
  width: 64px;
  height: 64px;
  border-radius: 16px;
  background: #4f46e5;
  color: white;
  font-size: 28px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 20px;
}

.welcome-title {
  font-size: 20px;
  font-weight: 600;
  color: #111827;
  margin: 0 0 8px;
}

.welcome-subtitle {
  font-size: 14px;
  color: #9ca3af;
  margin: 0 0 32px;
}

.welcome-hints {
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: center;
}

.hint-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #6b7280;
}

.hint-item .el-icon {
  font-size: 16px;
  color: #9ca3af;
}

/* ============ Editor Area ============ */
.editor-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

/* Tab Bar */
.editor-tabs {
  display: flex;
  align-items: flex-end;
  gap: 1px;
  padding: 0 4px;
  background: #f3f4f6;
  border-bottom: 1px solid #e5e7eb;
  flex-shrink: 0;
  overflow-x: auto;
  overflow-y: hidden;
}

.editor-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  font-size: 12px;
  color: #6b7280;
  background: #f9fafb;
  border: 1px solid transparent;
  border-bottom: none;
  border-radius: 6px 6px 0 0;
  cursor: pointer;
  white-space: nowrap;
  user-select: none;
  transition: all 0.15s ease;
  max-width: 180px;
}

.editor-tab:hover {
  background: #ffffff;
  color: #374151;
}

.editor-tab.active {
  background: #ffffff;
  color: #111827;
  border-color: #e5e7eb;
  border-bottom-color: #ffffff;
  margin-bottom: -1px;
  z-index: 1;
}

.editor-tab.dirty .tab-name {
  font-style: italic;
}

.tab-icon {
  flex-shrink: 0;
  font-size: 14px;
}

.tab-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.tab-dirty {
  color: #f59e0b;
  font-size: 8px;
  flex-shrink: 0;
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
  flex-shrink: 0;
  padding: 0;
  margin-left: 2px;
  opacity: 0;
  transition: all 0.15s ease;
}

.editor-tab:hover .tab-close {
  opacity: 1;
}

.tab-close:hover {
  background: #e5e7eb;
  color: #ef4444;
}

.editor-tab.active .tab-close:hover {
  background: #f3f4f6;
}

/* Editor Content */
.editor-content {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
</style>

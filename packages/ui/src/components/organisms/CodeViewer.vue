<template>
  <div class="code-viewer-page" :class="{ embedded: props.embedded }">
    <div v-if="!embedded" class="page-header">
      <div>
        <h1 class="page-title">代码查看</h1>
        <p class="page-subtitle">实时查看 Agent 编写的代码</p>
      </div>
      <div class="header-actions">
        <el-button :icon="Refresh" @click="refreshFiles" :loading="loading">
          刷新
        </el-button>
        <el-button type="primary" :icon="Download" @click="downloadCurrentFile">
          下载
        </el-button>
      </div>
    </div>
    
    <div class="code-viewer-content">
      <!-- 文件侧边栏 -->
      <div class="file-sidebar">
        <el-input
          v-model="searchQuery"
          placeholder="搜索文件..."
          :prefix-icon="Search"
          clearable
          size="small"
        />
        
        <div class="file-tree-header">
          <span class="file-tree-title">文件列表</span>
          <el-tag size="small" type="info">{{ filteredFiles.length }}</el-tag>
        </div>
        
        <el-scrollbar class="file-tree">
          <el-tree
            v-if="fileTree.length > 0"
            :data="fileTree"
            :props="{ label: 'name', children: 'children' }"
            :highlight-current="true"
            :default-expand-all="true"
            @node-click="handleNodeClick"
            node-key="path"
            :current-node-key="currentFile"
          >
            <template #default="{ data }">
              <div class="tree-node" :class="{ 'is-file': !data.isDirectory }">
                <el-icon v-if="data.isDirectory"><Folder /></el-icon>
                <el-icon v-else><Document /></el-icon>
                <span class="node-label" :title="data.name">{{ data.name }}</span>
              </div>
            </template>
          </el-tree>
          
          <div v-else-if="loading" class="loading-wrapper">
            <el-skeleton :rows="5" animated />
          </div>
          
          <div v-else class="empty-wrapper">
            <el-empty description="暂无文件" />
          </div>
        </el-scrollbar>
      </div>
      
      <!-- 代码编辑器区域 -->
      <div class="code-editor-wrapper">
        <div v-if="currentFile" class="editor-tabs">
          <div 
            v-for="file in openFiles" 
            :key="file.path"
            class="editor-tab"
            :class="{ active: currentFile === file.path }"
            @click="selectFile(file)"
          >
            <el-icon><Document /></el-icon>
            <span class="tab-name">{{ file.name }}</span>
            <el-icon class="tab-close" @click.stop="closeFile(file)"><Close /></el-icon>
          </div>
          <div class="tab-actions">
            <el-tooltip content="代码对比" placement="bottom">
              <el-button text size="small" @click="showDiff = !showDiff">
                <el-icon><SwitchButton /></el-icon>
              </el-button>
            </el-tooltip>
          </div>
        </div>
        
        <div class="editor-content">
          <!-- 代码对比视图 -->
          <CodeDiffViewer
            v-if="currentFile && showDiff"
            :title="`对比: ${currentFileName}`"
            :old-code="originalCode"
            :new-code="codeContent"
            :old-file-name="currentFileName"
            :new-file-name="currentFileName"
          />
          
          <CodeEditor
            v-else-if="currentFile"
            ref="codeEditorRef"
            v-model="codeContent"
            :file-name="currentFileName"
            :show-header="false"
            :show-footer="true"
            :loading="fileLoading"
          />
          
          <div v-else class="empty-editor">
            <el-empty description="选择一个文件开始查看">
              <template #image>
                <el-icon :size="64" color="#ccc"><Document /></el-icon>
              </template>
            </el-empty>
          </div>
        </div>
        
        <!-- 文件信息栏 -->
        <div v-if="currentFile" class="file-info-bar">
          <div class="info-left">
            <span class="info-item">
              <el-icon><Document /></el-icon>
              {{ currentFile }}
            </span>
            <span class="info-item" v-if="currentFileInfo">
              <el-icon><Timer /></el-icon>
              {{ formatDateTime(currentFileInfo.lastModified) }}
            </span>
          </div>
          <div class="info-right">
            <span class="info-item" v-if="codeContent">
              {{ codeContent.split('\n').length }} 行
            </span>
            <span class="info-item" v-if="codeContent">
              {{ codeContent.length }} 字符
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { 
  Search, Document, Folder, Refresh, Download, 
  Close, Timer, SwitchButton
} from '@element-plus/icons-vue'
import CodeEditor from '../molecules/CodeEditor.vue'
import CodeDiffViewer from '../molecules/CodeDiffViewer.vue'
import { useWebSocketStore } from '../../stores/websocket'
import { ElMessage } from 'element-plus'
// 本地实现工具函数
function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleString('zh-CN')
}

// 模拟 code API
const codeApi = {
  async getFiles() { return [] },
  async getFileContent(path: string) { return '' },
}
import type { CodeFile } from '@agenthive/types'

// 文件树节点类型
interface FileNode {
  name: string
  path: string
  isDirectory: boolean
  children?: FileNode[]
  content?: string
  language?: string
  lastModified?: string
}

const props = withDefaults(defineProps<{
  embedded?: boolean
}>(), {
  embedded: false,
})

const wsStore = useWebSocketStore()
const codeEditorRef = ref<InstanceType<typeof CodeEditor>>()

// 状态
const searchQuery = ref('')
const currentFile = ref('')
const codeContent = ref('')
const originalCode = ref('')  // 用于对比的原始代码
const fileLoading = ref(false)
const loading = ref(false)
const files = ref<CodeFile[]>([])
const openFiles = ref<CodeFile[]>([])
const currentFileInfo = ref<CodeFile | null>(null)
const showDiff = ref(false)   // 是否显示对比视图

// 计算属性
const currentFileName = computed(() => {
  if (!currentFile.value) return ''
  return currentFile.value.split('/').pop() || ''
})

// 构建文件树
const fileTree = computed((): FileNode[] => {
  const query = searchQuery.value.toLowerCase()
  const filtered = query 
    ? files.value.filter(f => f.path.toLowerCase().includes(query))
    : files.value
  
  const root: FileNode[] = []
  const nodeMap = new Map<string, FileNode>()
  
  filtered.forEach(file => {
    const parts = file.path.split('/').filter(Boolean)
    let currentPath = ''
    
    parts.forEach((part, index) => {
      const isLast = index === parts.length - 1
      currentPath += '/' + part
      
      if (!nodeMap.has(currentPath)) {
        const node: FileNode = {
          name: part,
          path: currentPath,
          isDirectory: !isLast,
          children: isLast ? undefined : [],
          content: isLast ? file.content : undefined,
          language: isLast ? file.language : undefined,
          lastModified: isLast ? file.lastModified : undefined,
        }
        
        nodeMap.set(currentPath, node)
        
        if (index === 0) {
          root.push(node)
        } else {
          const parentPath = currentPath.substring(0, currentPath.lastIndexOf('/'))
          const parent = nodeMap.get(parentPath)
          if (parent && parent.children) {
            parent.children.push(node)
          }
        }
      }
    })
  })
  
  return root
})

const filteredFiles = computed(() => {
  if (!searchQuery.value) return files.value
  const query = searchQuery.value.toLowerCase()
  return files.value.filter(f => f.path.toLowerCase().includes(query))
})

// 方法
const selectFile = async (file: CodeFile) => {
  if (!file.content && !file.isDirectory) {
    await loadFileContent(file.path)
  }
  
  currentFile.value = file.path
  currentFileInfo.value = file
  codeContent.value = file.content || ''
  originalCode.value = file.content || ''  // 保存原始代码用于对比
  showDiff.value = false  // 切换文件时关闭对比视图
  
  // 添加到打开的文件列表
  if (!openFiles.value.find(f => f.path === file.path)) {
    openFiles.value.push(file)
  }
  // 限制打开的文件数量
  if (openFiles.value.length > 10) {
    openFiles.value.shift()
  }
}

const handleNodeClick = (data: FileNode) => {
  if (data.isDirectory) return
  
  const file: CodeFile = {
    path: data.path,
    name: data.name,
    content: data.content || '',
    language: data.language || 'plaintext',
    lastModified: data.lastModified || new Date().toISOString(),
  }
  selectFile(file)
}

const closeFile = (file: CodeFile) => {
  const index = openFiles.value.findIndex(f => f.path === file.path)
  if (index > -1) {
    openFiles.value.splice(index, 1)
    
    // 如果关闭的是当前文件，切换到其他文件
    if (currentFile.value === file.path) {
      if (openFiles.value.length > 0) {
        const nextFile = openFiles.value[Math.min(index, openFiles.value.length - 1)]
        selectFile(nextFile)
      } else {
        currentFile.value = ''
        codeContent.value = ''
        currentFileInfo.value = null
      }
    }
  }
}

const loadFileContent = async (path: string) => {
  fileLoading.value = true
  try {
    // TODO: 调用后端 API 获取文件内容
    // const response = await fetch(`/api/files${path}`)
    // const content = await response.text()
    
    // 模拟加载延迟
    await new Promise(resolve => setTimeout(resolve, 300))
    
    // 模拟文件内容
    const mockContent = `// File: ${path}
// Loaded at: ${new Date().toLocaleString()}

// This is a placeholder content.
// In production, this would be fetched from the backend API.

function example() {
  console.log("Hello from ${path}");
}
`
    
    const file = files.value.find(f => f.path === path)
    if (file) {
      file.content = mockContent
    }
  } catch (error) {
    ElMessage.error('加载文件失败')
  } finally {
    fileLoading.value = false
  }
}

const refreshFiles = async () => {
  loading.value = true
  try {
    const response = await codeApi.getFileList()
    files.value = response.files
    
    ElMessage.success('文件列表已刷新')
  } catch (error) {
    ElMessage.error('刷新失败')
  } finally {
    loading.value = false
  }
}

const downloadCurrentFile = () => {
  if (!codeContent.value || !currentFile.value) {
    ElMessage.warning('请先选择一个文件')
    return
  }
  
  const blob = new Blob([codeContent.value], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = currentFileName.value
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  
  ElMessage.success('文件下载成功')
}

// 监听 WebSocket 代码更新
watch(() => wsStore.currentCode, (newCode) => {
  if (newCode) {
    // 检查文件是否已存在
    const existingFile = files.value.find(f => f.path === newCode.path)
    if (existingFile) {
      existingFile.content = newCode.content
      existingFile.lastModified = newCode.lastModified
    } else {
      files.value.push(newCode)
    }
    
    // 如果当前正在查看该文件，更新内容
    if (currentFile.value === newCode.path) {
      codeContent.value = newCode.content
      currentFileInfo.value = newCode
    }
  }
}, { deep: true })

onMounted(() => {
  refreshFiles()
  
  // 如果有 WebSocket 传来的代码，显示它
  if (wsStore.currentCode) {
    selectFile(wsStore.currentCode)
  }
})
</script>

<style scoped>
.code-viewer-page {
  padding: 8px;
  height: calc(100vh - 100px);
  display: flex;
  flex-direction: column;
}

.code-viewer-page.embedded {
  padding: 0;
  height: 100%;
}

.code-viewer-page.embedded .code-viewer-content {
  gap: 0;
}

.code-viewer-page.embedded .file-sidebar {
  border-radius: 0;
  border-left: none;
  border-top: none;
  border-bottom: none;
}

.code-viewer-page.embedded .code-editor-wrapper {
  border-radius: 0;
  border: none;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  flex-shrink: 0;
}

.page-title {
  margin: 0 0 8px 0;
  font-size: 24px;
  font-weight: 600;
}

.page-subtitle {
  margin: 0;
  color: var(--el-text-color-secondary);
}

.header-actions {
  display: flex;
  gap: 8px;
}

.code-viewer-content {
  flex: 1;
  display: flex;
  gap: 16px;
  min-height: 0;
}

/* 文件侧边栏 */
.file-sidebar {
  width: 260px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: var(--radius-md);
  padding: 12px;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.file-tree-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 12px 0 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--el-border-color-light);
}

.file-tree-title {
  font-weight: 500;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.file-tree {
  flex: 1;
  min-height: 0;
}

.tree-node {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}

.tree-node.is-file {
  color: var(--el-text-color-regular);
}

.node-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.loading-wrapper {
  padding: 20px;
}

.empty-wrapper {
  padding: 40px 0;
}

/* 代码编辑器区域 */
.code-editor-wrapper {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.editor-tabs {
  display: flex;
  background: #252526;
  overflow-x: auto;
  scrollbar-width: thin;
  scrollbar-color: #666 transparent;
}

.editor-tabs::-webkit-scrollbar {
  height: 4px;
}

.editor-tabs::-webkit-scrollbar-thumb {
  background: #666;
  border-radius: 2px;
}

.editor-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: #2d2d2d;
  border-right: 1px solid #333;
  color: #969696;
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;
}

.editor-tab:hover {
  background: #3c3c3c;
}

.editor-tab.active {
  background: #1e1e1e;
  color: #fff;
  border-top: 2px solid var(--el-color-primary);
}

.tab-name {
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tab-close {
  font-size: 12px;
  opacity: 0;
  transition: opacity 0.2s;
}

.editor-tab:hover .tab-close {
  opacity: 1;
}

.tab-close:hover {
  color: var(--el-color-danger);
}

.tab-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  padding: 0 8px;
  background: #252526;
}

.editor-content {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.empty-editor {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 文件信息栏 */
.file-info-bar {
  display: flex;
  justify-content: space-between;
  padding: 6px 12px;
  background: #007acc;
  color: white;
  font-size: 12px;
}

.info-left,
.info-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.info-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

/* 响应式布局 */
@media (max-width: 768px) {
  .file-sidebar {
    width: 200px;
  }
  
  .tab-name {
    max-width: 80px;
  }
}

@media (max-width: 576px) {
  .code-viewer-content {
    flex-direction: column;
  }
  
  .file-sidebar {
    width: 100%;
    height: 200px;
  }
}
</style>

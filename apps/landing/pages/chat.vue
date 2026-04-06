<template>
  <div class="chat-page">
    <!-- Left Chat Panel -->
    <aside class="chat-sidebar">
      <ChatPanel :current-project="currentProject" embedded />
    </aside>

    <!-- Center Content Area -->
    <div class="center-area">
      <!-- Tab Navigation -->
      <div class="center-tabs">
        <button 
          v-for="tab in tabs" 
          :key="tab.id"
          class="tab-btn"
          :class="{ active: activeTab === tab.id }"
          @click="activeTab = tab.id"
        >
          <el-icon><component :is="tab.icon" /></el-icon>
          <span>{{ tab.label }}</span>
        </button>
      </div>

      <!-- Tab Content -->
      <div class="center-content">
        <!-- Files Tab - Full File System -->
        <div v-if="activeTab === 'files'" class="files-view">
          <div class="files-header">
            <span class="files-title">File System</span>
          </div>
          <div class="file-tree">
            <div class="tree-item expanded">
              <div class="tree-row folder">
                <el-icon class="tree-icon"><FolderOpened /></el-icon>
                <span>root</span>
              </div>
              <div class="tree-children">
                <div class="tree-row folder">
                  <el-icon class="tree-icon"><Folder /></el-icon>
                  <span>app</span>
                </div>
                <div class="tree-row folder">
                  <el-icon class="tree-icon"><Folder /></el-icon>
                  <span>components</span>
                </div>
                <div class="tree-row folder">
                  <el-icon class="tree-icon"><Folder /></el-icon>
                  <span>lib</span>
                </div>
                <div class="tree-row file">
                  <el-icon class="tree-icon"><Document /></el-icon>
                  <span>package.json</span>
                </div>
                <div class="tree-row file">
                  <el-icon class="tree-icon"><Document /></el-icon>
                  <span>README.md</span>
                </div>
                <div class="tree-row file">
                  <el-icon class="tree-icon"><Document /></el-icon>
                  <span>tsconfig.json</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Editor Tab - Apps Directory Only -->
        <div v-if="activeTab === 'editor'" class="editor-view">
          <!-- Editor Sidebar - Apps Files -->
          <div class="editor-sidebar">
            <div class="editor-sidebar-header">
              <span class="editor-sidebar-title">Explorer (app)</span>
              <div class="editor-actions">
                <button class="editor-btn" title="New File">
                  <el-icon><DocumentAdd /></el-icon>
                </button>
                <button class="editor-btn" title="New Folder">
                  <el-icon><FolderAdd /></el-icon>
                </button>
              </div>
            </div>
            <div class="editor-file-tree">
              <div class="tree-item expanded">
                <div class="tree-row folder">
                  <el-icon class="tree-icon"><FolderOpened /></el-icon>
                  <span>app</span>
                </div>
                <div class="tree-children">
                  <div class="tree-row file active">
                    <el-icon class="tree-icon"><Document /></el-icon>
                    <span>page.tsx</span>
                  </div>
                  <div class="tree-row file">
                    <el-icon class="tree-icon"><Document /></el-icon>
                    <span>layout.tsx</span>
                  </div>
                  <div class="tree-row folder">
                    <el-icon class="tree-icon"><Folder /></el-icon>
                    <span>components</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Code Editor -->
          <div class="code-editor">
            <div class="code-tabs">
              <div class="code-tab active">
                <el-icon><Document /></el-icon>
                <span>page.tsx</span>
                <button class="tab-close">
                  <el-icon><Close /></el-icon>
                </button>
              </div>
            </div>
            <div class="code-content">
              <div class="code-header">
                <span class="code-path">app/page.tsx</span>
              </div>
              <div class="code-body">
                <pre class="code-block"><code><span class="line"><span class="keyword">export default function</span> <span class="function">Home</span>() {</span>
<span class="line">  <span class="keyword">return</span> (</span>
<span class="line">    &lt;<span class="tag">main</span> <span class="attr">className</span>=<span class="string">"min-h-screen"</span>&gt;</span>
<span class="line">      &lt;<span class="tag">h1</span>&gt;{{ currentProject?.name || 'Welcome' }}&lt;/<span class="tag">h1</span>&gt;</span>
<span class="line">      &lt;<span class="tag">p</span>&gt;{{ currentProject?.description || 'Start building your app' }}&lt;/<span class="tag">p</span>&gt;</span>
<span class="line">    &lt;/<span class="tag">main</span>&gt;</span>
<span class="line">  );</span>
<span class="line">}</span></code></pre>
              </div>
            </div>
          </div>
        </div>

        <!-- Preview Tab -->
        <div v-if="activeTab === 'preview'" class="preview-view">
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
  </div>
</template>

<script setup lang="ts">
import { inject, ref } from 'vue'
import {
  Document,
  DocumentAdd,
  Folder,
  FolderAdd,
  FolderOpened,
  Close,
  Monitor,
  ChatDotRound,
  View,
  Edit
} from '@element-plus/icons-vue'
import ChatPanel from '~/components/ChatPanel.vue'

definePageMeta({
  layout: 'chat',
})

interface Project {
  id: string
  name: string
  description: string
}

const currentProject = inject<Project | null>('currentProject', null)
const activeTab = ref<'files' | 'editor' | 'preview'>('editor')

const tabs = [
  { id: 'files', label: 'Files', icon: 'Folder' },
  { id: 'editor', label: 'Editor', icon: 'Edit' },
  { id: 'preview', label: 'Preview', icon: 'View' },
]
</script>

<style scoped>
.chat-page {
  display: flex;
  width: 100%;
  height: 100%;
  background: #fafafa;
}

/* Left Chat Sidebar */
.chat-sidebar {
  width: 320px;
  background: #ffffff;
  border-right: 1px solid #e5e7eb;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

/* Center Area */
.center-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: #ffffff;
}

/* Center Tabs */
.center-tabs {
  display: flex;
  padding: 8px 16px;
  gap: 8px;
  border-bottom: 1px solid #e5e7eb;
  background: #f9fafb;
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #6b7280;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.tab-btn:hover {
  background: #f3f4f6;
  color: #374151;
}

.tab-btn.active {
  background: #4f46e5;
  color: white;
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

.code-block {
  margin: 0;
  font-family: 'Fira Code', 'Consolas', monospace;
  font-size: 13px;
  line-height: 1.6;
}

.line {
  display: block;
}

.keyword { color: #c586c0; }
.function { color: #dcdcaa; }
.tag { color: #569cd6; }
.attr { color: #9cdcfe; }
.string { color: #ce9178; }

/* File Tree Common Styles */
.file-tree {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.tree-item {
  margin-bottom: 2px;
}

.tree-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  color: #374151;
  transition: all 0.15s ease;
}

.tree-row:hover {
  background: #f3f4f6;
}

.tree-row.active {
  background: #4f46e5;
  color: white;
}

.tree-icon {
  font-size: 14px;
  color: #9ca3af;
}

.tree-row.active .tree-icon {
  color: white;
}

.tree-children {
  margin-left: 20px;
  border-left: 1px solid #e5e7eb;
  padding-left: 4px;
}

/* Preview View */
.preview-view {
  flex: 1;
  overflow: auto;
  padding: 20px;
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

.preview-placeholder h3 {
  font-size: 18px;
  font-weight: 600;
  color: #374151;
  margin: 0 0 8px;
}

.preview-placeholder p {
  font-size: 14px;
  margin: 0;
}

.preview-content {
  min-height: 100%;
  padding: 40px;
}

.mock-hero {
  text-align: center;
  padding: 60px 40px;
  background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%);
  border-radius: 16px;
  margin-bottom: 40px;
}

.mock-hero h1 {
  font-size: 42px;
  font-weight: 700;
  color: #111827;
  margin: 0 0 16px;
}

.mock-hero p {
  font-size: 18px;
  color: #6b7280;
  margin: 0;
}

.mock-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
}

.mock-card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  overflow: hidden;
}

.mock-card-img {
  height: 160px;
  background: linear-gradient(135deg, #e5e7eb 0%, #d1d5db 100%);
}

.mock-card-text {
  padding: 16px;
}

.mock-line {
  height: 12px;
  background: #e5e7eb;
  border-radius: 2px;
  margin-bottom: 8px;
}

.mock-line.short {
  width: 60%;
}
</style>

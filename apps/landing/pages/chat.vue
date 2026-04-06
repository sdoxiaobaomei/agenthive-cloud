<template>
  <div class="chat-page">
    <!-- Main Panel with Tabs -->
    <div class="main-panel">
      <!-- Tab Navigation -->
      <div class="panel-tabs">
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
      <div class="panel-content">
        <!-- Files Tab -->
        <div v-if="activeTab === 'files'" class="files-panel">
          <div class="files-header">
            <span class="files-title">Explorer</span>
            <div class="files-actions">
              <button class="file-btn" title="New File">
                <el-icon><DocumentAdd /></el-icon>
              </button>
              <button class="file-btn" title="New Folder">
                <el-icon><FolderAdd /></el-icon>
              </button>
              <button class="file-btn" title="Refresh">
                <el-icon><Refresh /></el-icon>
              </button>
            </div>
          </div>
          <div class="file-tree">
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
            <div class="tree-item">
              <div class="tree-row folder">
                <el-icon class="tree-icon"><Folder /></el-icon>
                <span>components</span>
              </div>
            </div>
            <div class="tree-item">
              <div class="tree-row folder">
                <el-icon class="tree-icon"><Folder /></el-icon>
                <span>lib</span>
              </div>
            </div>
            <div class="tree-item">
              <div class="tree-row file">
                <el-icon class="tree-icon"><Document /></el-icon>
                <span>package.json</span>
              </div>
            </div>
            <div class="tree-item">
              <div class="tree-row file">
                <el-icon class="tree-icon"><Document /></el-icon>
                <span>README.md</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Chat Tab -->
        <div v-if="activeTab === 'chat'" class="chat-panel-container">
          <ChatPanel :current-project="currentProject" embedded />
        </div>

        <!-- Preview Tab -->
        <div v-if="activeTab === 'preview'" class="preview-panel-container">
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

    <!-- Right Editor Area -->
    <div class="editor-area">
      <!-- Editor Tabs -->
      <div class="editor-tabs">
        <div class="tab active">
          <el-icon><Document /></el-icon>
          <span>page.tsx</span>
          <button class="tab-close">
            <el-icon><Close /></el-icon>
          </button>
        </div>
        <div class="tab-actions">
          <button 
            class="view-btn" 
            :class="{ active: viewMode === 'editor' }"
            @click="viewMode = 'editor'"
          >
            <el-icon><Edit /></el-icon>
          </button>
          <button 
            class="view-btn" 
            :class="{ active: viewMode === 'split' }"
            @click="viewMode = 'split'"
          >
            <el-icon><FullScreen /></el-icon>
          </button>
        </div>
      </div>

      <!-- Editor Content -->
      <div class="editor-content" :class="viewMode">
        <!-- Code Editor -->
        <div class="code-panel">
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

        <!-- Preview Panel (in editor area) -->
        <div v-if="viewMode === 'split'" class="preview-panel-right">
          <div class="preview-frame compact">
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
                <p>Select a project</p>
              </div>
              <div v-else class="preview-content compact">
                <div class="mock-hero compact">
                  <h1>{{ currentProject.name }}</h1>
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
  Refresh,
  Close,
  Edit,
  FullScreen,
  Monitor,
  ChatDotRound,
  View
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
const activeTab = ref<'files' | 'chat' | 'preview'>('files')
const viewMode = ref<'editor' | 'split'>('split')

const tabs = [
  { id: 'files', label: 'Files', icon: 'Folder' },
  { id: 'chat', label: 'Chat', icon: 'ChatDotRound' },
  { id: 'preview', label: 'Preview', icon: 'View' },
]
</script>

<style scoped>
.chat-page {
  display: flex;
  height: 100%;
  background: #fafafa;
}

/* Main Panel (Files/Chat/Preview) */
.main-panel {
  width: 280px;
  background: #ffffff;
  border-right: 1px solid #e5e7eb;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

/* Panel Tabs */
.panel-tabs {
  display: flex;
  padding: 8px;
  gap: 4px;
  border-bottom: 1px solid #e5e7eb;
  background: #f9fafb;
}

.tab-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 12px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #6b7280;
  font-size: 13px;
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

/* Panel Content */
.panel-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* Files Panel */
.files-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.files-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #e5e7eb;
}

.files-title {
  font-size: 11px;
  font-weight: 600;
  color: #9ca3af;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.files-actions {
  display: flex;
  gap: 4px;
}

.file-btn {
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

.file-btn:hover {
  background: #f3f4f6;
  color: #6b7280;
}

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

/* Chat Panel */
.chat-panel-container {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* Preview Panel */
.preview-panel-container {
  flex: 1;
  overflow: auto;
  padding: 16px;
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

.preview-frame.compact {
  border-radius: 8px;
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

.preview-content.compact {
  padding: 20px;
}

.mock-hero {
  text-align: center;
  padding: 60px 40px;
  background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%);
  border-radius: 16px;
  margin-bottom: 40px;
}

.mock-hero.compact {
  padding: 30px 20px;
  margin-bottom: 0;
}

.mock-hero h1 {
  font-size: 42px;
  font-weight: 700;
  color: #111827;
  margin: 0 0 16px;
}

.mock-hero.compact h1 {
  font-size: 24px;
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

/* Editor Area */
.editor-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

/* Editor Tabs */
.editor-tabs {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background: #ffffff;
  border-bottom: 1px solid #e5e7eb;
}

.tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: #f3f4f6;
  border-radius: 8px;
  font-size: 13px;
  color: #374151;
}

.tab .el-icon {
  font-size: 14px;
  color: #9ca3af;
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
  margin-left: 4px;
}

.tab-close:hover {
  background: #e5e7eb;
  color: #6b7280;
}

.tab-actions {
  display: flex;
  gap: 4px;
}

.view-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.15s ease;
}

.view-btn:hover {
  background: #f3f4f6;
  color: #374151;
}

.view-btn.active {
  background: #4f46e5;
  color: white;
}

/* Editor Content */
.editor-content {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.code-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #1e1e1e;
  min-width: 0;
}

.code-header {
  padding: 10px 16px;
  background: #252526;
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

/* Preview Panel (in editor area) */
.preview-panel-right {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #f3f4f6;
  padding: 16px;
  border-left: 1px solid #e5e7eb;
  min-width: 0;
}
</style>

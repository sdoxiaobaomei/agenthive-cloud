<template>
  <div class="workspace-toolbar" :class="{ expanded: visible }">
    <!-- Toolbar Header -->
    <div class="toolbar-header" @click="toggle">
      <div class="toolbar-tabs">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          class="toolbar-tab"
          :class="{ active: activeTab === tab.key }"
          @click.stop="activeTab = tab.key"
        >
          <el-icon><component :is="tab.icon" /></el-icon>
          <span>{{ tab.label }}</span>
        </button>
      </div>
      <div class="toolbar-actions">
        <el-icon class="toggle-icon" :class="{ expanded: visible }"><ArrowDown /></el-icon>
      </div>
    </div>

    <!-- Toolbar Content -->
    <div v-show="visible" class="toolbar-content">
      <!-- Git Panel -->
      <div v-if="activeTab === 'git'" class="panel git-panel">
        <div v-if="!gitStatus.isGitRepo" class="panel-empty">
          <el-icon :size="32"><Warning /></el-icon>
          <p>Not a Git repository</p>
          <el-button size="small" type="primary">Initialize Git</el-button>
        </div>
        <div v-else class="git-list">
          <div class="git-section">
            <span class="section-title">Modified ({{ gitStatus.modified.length }})</span>
            <div
              v-for="file in gitStatus.modified"
              :key="file.path"
              class="git-file modified"
              @click="openFile(file.path)"
            >
              <el-icon><EditPen /></el-icon>
              <span class="file-path">{{ file.path }}</span>
            </div>
          </div>
          <div class="git-section">
            <span class="section-title">Added ({{ gitStatus.added.length }})</span>
            <div
              v-for="file in gitStatus.added"
              :key="file.path"
              class="git-file added"
              @click="openFile(file.path)"
            >
              <el-icon><CirclePlus /></el-icon>
              <span class="file-path">{{ file.path }}</span>
            </div>
          </div>
          <div class="git-section">
            <span class="section-title">Untracked ({{ gitStatus.untracked.length }})</span>
            <div
              v-for="file in gitStatus.untracked"
              :key="file.path"
              class="git-file untracked"
              @click="openFile(file.path)"
            >
              <el-icon><QuestionFilled /></el-icon>
              <span class="file-path">{{ file.path }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Terminal Panel -->
      <div v-if="activeTab === 'terminal'" class="panel terminal-panel">
        <div ref="terminalRef" class="terminal-output">
          <div v-for="(line, i) in terminalLines" :key="i" class="terminal-line">
            <span class="terminal-prompt">$</span>
            <span class="terminal-text">{{ line }}</span>
          </div>
          <div class="terminal-line input-line">
            <span class="terminal-prompt">$</span>
            <input
              v-model="terminalInput"
              class="terminal-input"
              placeholder="Type command..."
              @keydown.enter="executeCommand"
            />
          </div>
        </div>
      </div>

      <!-- Preview Panel -->
      <div v-if="activeTab === 'preview'" class="panel preview-panel">
        <div v-if="!canPreview" class="panel-empty">
          <el-icon :size="32"><Monitor /></el-icon>
          <p>Preview not available for this project type</p>
        </div>
        <iframe
          v-else
          :src="previewUrl"
          class="preview-frame"
          sandbox="allow-scripts allow-same-origin"
        />
      </div>

      <!-- Search Panel -->
      <div v-if="activeTab === 'search'" class="panel search-panel">
        <div class="search-bar">
          <el-input
            v-model="searchQuery"
            placeholder="Search in workspace (Ctrl+Shift+F)"
            clearable
            @keydown.enter="performSearch"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
          <el-checkbox v-model="includeContent">Include file content</el-checkbox>
        </div>
        <div class="search-results">
          <div v-if="searchResults.length === 0 && searchQuery" class="panel-empty">
            <p>No matches found</p>
          </div>
          <div
            v-for="result in searchResults"
            :key="result.path"
            class="search-result"
            @click="openFile(result.path)"
          >
            <el-icon><Document /></el-icon>
            <div class="result-info">
              <span class="result-path">{{ result.path }}</span>
              <span v-if="result.line" class="result-line">line {{ result.line }}: {{ result.text }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  ArrowDown,
  EditPen,
  CirclePlus,
  QuestionFilled,
  Warning,
  Monitor,
  Search,
  Document,
} from '@element-plus/icons-vue'

const props = defineProps<{
  projectId: string
}>()

const emit = defineEmits<{
  openFile: [path: string]
}>()

// ============ Toolbar State ============
const STORAGE_KEY = 'agenthive:workspace-toolbar'

const visible = ref(false)
const activeTab = ref<'git' | 'terminal' | 'preview' | 'search'>('git')

const tabs = [
  { key: 'git' as const, label: 'Git', icon: EditPen },
  { key: 'terminal' as const, label: 'Terminal', icon: Monitor },
  { key: 'preview' as const, label: 'Preview', icon: Monitor },
  { key: 'search' as const, label: 'Search', icon: Search },
]

const toggle = () => {
  visible.value = !visible.value
  saveState()
}

const saveState = () => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      visible: visible.value,
      activeTab: activeTab.value,
    }))
  }
}

onMounted(() => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        const state = JSON.parse(saved)
        visible.value = state.visible ?? false
        activeTab.value = state.activeTab ?? 'git'
      } catch { /* ignore */ }
    }
  }
})

// ============ Git Panel ============
const gitStatus = ref({
  isGitRepo: true,
  modified: [
    { path: 'src/components/Header.vue', status: 'modified' },
    { path: 'src/App.vue', status: 'modified' },
  ],
  added: [
    { path: 'src/utils/helper.ts', status: 'added' },
  ],
  untracked: [
    { path: 'docs/README.md', status: 'untracked' },
    { path: '.env.local', status: 'untracked' },
  ],
})

// ============ Terminal Panel ============
const terminalRef = ref<HTMLDivElement | null>(null)
const terminalInput = ref('')
const terminalLines = ref<string[]>([
  'Welcome to AgentHive Workspace Terminal',
  'Type commands to interact with your project',
])

const executeCommand = () => {
  const cmd = terminalInput.value.trim()
  if (!cmd) return
  terminalLines.value.push(cmd)
  // Mock responses
  if (cmd === 'ls') {
    terminalLines.value.push('src/  docs/  package.json  README.md')
  } else if (cmd === 'git status') {
    terminalLines.value.push('On branch main')
    terminalLines.value.push('Changes not staged for commit:')
    gitStatus.value.modified.forEach(f => terminalLines.value.push(`  modified: ${f.path}`))
  } else if (cmd.startsWith('npm ')) {
    terminalLines.value.push(`> ${cmd}`)
    terminalLines.value.push('Installing dependencies...')
    terminalLines.value.push('Done in 2.34s')
  } else {
    terminalLines.value.push(`Command not found: ${cmd.split(' ')[0]}`)
  }
  terminalInput.value = ''
  // Auto scroll
  setTimeout(() => {
    if (terminalRef.value) {
      terminalRef.value.scrollTop = terminalRef.value.scrollHeight
    }
  }, 10)
}

// ============ Preview Panel ============
const canPreview = ref(true)
const previewUrl = ref(`https://demo.example.com/preview/${props.projectId}`)

// ============ Search Panel ============
const searchQuery = ref('')
const includeContent = ref(true)

interface SearchResult {
  path: string
  line?: number
  text?: string
}

const searchResults = ref<SearchResult[]>([])

const performSearch = () => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) {
    searchResults.value = []
    return
  }
  // Mock search results
  searchResults.value = [
    { path: 'src/components/Header.vue', line: 12, text: `...${q}...` },
    { path: 'src/App.vue', line: 24, text: `...${q}...` },
    { path: 'src/utils/helper.ts', line: 5, text: `...${q}...` },
  ]
}

const openFile = (path: string) => {
  emit('openFile', path)
}
</script>

<style scoped>
.workspace-toolbar {
  border-top: 1px solid #e5e7eb;
  background: #ffffff;
  flex-shrink: 0;
}

.toolbar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 36px;
  padding: 0 12px;
  background: #f9fafb;
  border-bottom: 1px solid transparent;
  cursor: pointer;
  user-select: none;
  transition: border-color 0.2s;
}

.workspace-toolbar.expanded .toolbar-header {
  border-bottom-color: #e5e7eb;
}

.toolbar-tabs {
  display: flex;
  align-items: center;
  gap: 4px;
}

.toolbar-tab {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 4px;
  border: none;
  background: transparent;
  font-size: 12px;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.15s ease;
}

.toolbar-tab:hover {
  background: #e5e7eb;
  color: #374151;
}

.toolbar-tab.active {
  background: #4f46e5;
  color: #ffffff;
}

.toggle-icon {
  font-size: 12px;
  color: #9ca3af;
  transition: transform 0.2s ease;
}

.toggle-icon.expanded {
  transform: rotate(180deg);
}

/* Content */
.toolbar-content {
  height: 200px;
  overflow: hidden;
}

.panel {
  height: 100%;
  overflow: auto;
  padding: 12px;
}

.panel-empty {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #9ca3af;
  font-size: 13px;
}

/* Git Panel */
.git-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.git-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.section-title {
  font-size: 11px;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.git-file {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  color: #374151;
  cursor: pointer;
  transition: background 0.15s;
}

.git-file:hover {
  background: #f3f4f6;
}

.git-file.modified { color: #f59e0b; }
.git-file.added { color: #10b981; }
.git-file.untracked { color: #9ca3af; }

.file-path {
  color: #374151;
}

/* Terminal Panel */
.terminal-panel {
  background: #1e1e1e;
  padding: 8px 12px;
}

.terminal-output {
  height: 100%;
  overflow-y: auto;
  font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
  font-size: 12px;
  line-height: 1.6;
}

.terminal-line {
  display: flex;
  gap: 8px;
  color: #d4d4d4;
}

.terminal-prompt {
  color: #10b981;
  flex-shrink: 0;
}

.terminal-text {
  word-break: break-all;
}

.input-line {
  align-items: center;
}

.terminal-input {
  background: transparent;
  border: none;
  outline: none;
  color: #d4d4d4;
  font-family: inherit;
  font-size: inherit;
  flex: 1;
  caret-color: #10b981;
}

/* Preview Panel */
.preview-panel {
  padding: 0;
}

.preview-frame {
  width: 100%;
  height: 100%;
  border: none;
}

/* Search Panel */
.search-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.search-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.search-bar :deep(.el-input) {
  flex: 1;
}

.search-results {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.search-result {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: background 0.15s;
}

.search-result:hover {
  background: #f3f4f6;
}

.result-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.result-path {
  font-weight: 500;
  color: #374151;
}

.result-line {
  color: #9ca3af;
}
</style>

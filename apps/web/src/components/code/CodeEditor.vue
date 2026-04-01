<template>
  <div class="code-editor-wrapper" :class="{ 'is-loading': loading }">
    <div class="editor-header" v-if="showHeader">
      <div class="file-info">
        <el-icon><Document /></el-icon>
        <span class="file-name">{{ fileName || 'untitled' }}</span>
        <el-tag v-if="language" size="small" type="info">{{ language }}</el-tag>
      </div>
      <div class="editor-actions">
        <el-button 
          :icon="CopyDocument" 
          text 
          size="small"
          @click="handleCopy"
        >
          复制
        </el-button>
        <el-button 
          :icon="FullScreen" 
          text 
          size="small"
          @click="handleFullscreen"
        >
          全屏
        </el-button>
      </div>
    </div>
    
    <div ref="editorContainer" class="editor-container"></div>
    
    <div class="editor-footer" v-if="showFooter">
      <div class="footer-left">
        <span v-if="cursorPosition">
          行 {{ cursorPosition.lineNumber }}, 列 {{ cursorPosition.column }}
        </span>
      </div>
      <div class="footer-right">
        <span v-if="modelValue">{{ modelValue.length }} 字符</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue'
import * as monaco from 'monaco-editor'
import { Document, CopyDocument, FullScreen } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { CODE_LANGUAGES } from '@/utils/constants'

// 配置 Monaco Editor worker
self.MonacoEnvironment = {
  getWorker(_: string, label: string) {
    const getWorkerModule = (url: string) => {
      return new Worker(new URL(url, import.meta.url), {
        type: 'module'
      })
    }
    
    switch (label) {
      case 'json':
        return getWorkerModule('monaco-editor/esm/vs/language/json/json.worker?worker')
      case 'css':
      case 'scss':
      case 'less':
        return getWorkerModule('monaco-editor/esm/vs/language/css/css.worker?worker')
      case 'html':
      case 'handlebars':
      case 'razor':
        return getWorkerModule('monaco-editor/esm/vs/language/html/html.worker?worker')
      case 'typescript':
      case 'javascript':
        return getWorkerModule('monaco-editor/esm/vs/language/typescript/ts.worker?worker')
      default:
        return getWorkerModule('monaco-editor/esm/vs/editor/editor.worker?worker')
    }
  }
}

const props = withDefaults(defineProps<{
  modelValue: string
  fileName?: string
  language?: string
  readOnly?: boolean
  theme?: 'vs' | 'vs-dark' | 'hc-black'
  showHeader?: boolean
  showFooter?: boolean
  loading?: boolean
}>(), {
  readOnly: true,
  theme: 'vs-dark',
  showHeader: true,
  showFooter: true,
  loading: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  change: [value: string]
  cursorChange: [position: { lineNumber: number; column: number }]
}>()

const editorContainer = ref<HTMLElement>()
let editor: monaco.editor.IStandaloneCodeEditor | null = null
const cursorPosition = ref<{ lineNumber: number; column: number } | null>(null)

// 根据文件扩展名自动检测语言
const detectedLanguage = computed(() => {
  if (props.language) return props.language
  if (!props.fileName) return 'plaintext'
  
  const ext = '.' + props.fileName.split('.').pop()?.toLowerCase()
  return CODE_LANGUAGES[ext] || 'plaintext'
})

onMounted(() => {
  if (!editorContainer.value) return
  
  editor = monaco.editor.create(editorContainer.value, {
    value: props.modelValue,
    language: detectedLanguage.value,
    theme: props.theme,
    readOnly: props.readOnly,
    automaticLayout: true,
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    fontSize: 14,
    lineNumbers: 'on',
    roundedSelection: false,
    scrollbar: {
      useShadows: false,
      verticalHasArrows: false,
      horizontalHasArrows: false,
      vertical: 'auto',
      horizontal: 'auto',
    },
    folding: true,
    foldingStrategy: 'auto',
    showFoldingControls: 'always',
    bracketPairColorization: { enabled: true },
    guides: {
      bracketPairs: true,
      indentation: true,
    },
    // 代码格式化
    formatOnPaste: true,
    formatOnType: true,
    // 智能提示
    quickSuggestions: true,
    suggestOnTriggerCharacters: true,
    wordBasedSuggestions: 'allDocuments',
  })
  
  // 监听内容变化
  editor.onDidChangeModelContent(() => {
    const value = editor?.getValue() || ''
    emit('update:modelValue', value)
    emit('change', value)
  })
  
  // 监听光标位置变化
  editor.onDidChangeCursorPosition((e) => {
    cursorPosition.value = {
      lineNumber: e.position.lineNumber,
      column: e.position.column,
    }
    emit('cursorChange', cursorPosition.value)
  })
})

// 响应外部内容变化
watch(() => props.modelValue, (newValue) => {
  if (editor && newValue !== editor.getValue()) {
    editor.setValue(newValue)
  }
})

// 响应语言变化
watch(() => detectedLanguage.value, (newLanguage) => {
  if (editor) {
    const model = editor.getModel()
    if (model) {
      monaco.editor.setModelLanguage(model, newLanguage)
    }
  }
})

// 响应主题变化
watch(() => props.theme, (newTheme) => {
  if (editor) {
    monaco.editor.setTheme(newTheme)
  }
})

onBeforeUnmount(() => {
  editor?.dispose()
  editor = null
})

// 方法
const handleCopy = async () => {
  try {
    await navigator.clipboard.writeText(props.modelValue)
    ElMessage.success('代码已复制到剪贴板')
  } catch {
    ElMessage.error('复制失败')
  }
}

const handleFullscreen = () => {
  if (!editorContainer.value) return
  
  if (document.fullscreenElement) {
    document.exitFullscreen()
  } else {
    editorContainer.value.requestFullscreen()
  }
}

// 暴露方法
const focus = () => editor?.focus()
const getEditor = () => editor
const getValue = () => editor?.getValue() || ''
const setValue = (value: string) => editor?.setValue(value)
const getModel = () => editor?.getModel()

// 代码格式化
const formatCode = async () => {
  if (!editor) return
  await editor.getAction('editor.action.formatDocument')?.run()
}

// 查找替换
const openFindReplace = () => {
  editor?.getAction('editor.action.startFindReplaceAction:action')?.run()
}

defineExpose({
  focus,
  getEditor,
  getValue,
  setValue,
  getModel,
  formatCode,
  openFindReplace,
})
</script>

<style scoped>
.code-editor-wrapper {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #1e1e1e;
  border-radius: var(--radius-md);
  overflow: hidden;
}

.code-editor-wrapper.is-loading {
  opacity: 0.7;
  pointer-events: none;
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #252526;
  border-bottom: 1px solid #333;
}

.file-info {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #cccccc;
  font-size: 13px;
}

.file-name {
  font-weight: 500;
}

.editor-actions {
  display: flex;
  gap: 4px;
}

.editor-container {
  flex: 1;
  min-height: 200px;
}

.editor-footer {
  display: flex;
  justify-content: space-between;
  padding: 4px 12px;
  background: #007acc;
  color: white;
  font-size: 12px;
}

:deep(.monaco-editor) {
  .overflow-guard {
    border-radius: 0 0 var(--radius-md) var(--radius-md);
  }
}
</style>

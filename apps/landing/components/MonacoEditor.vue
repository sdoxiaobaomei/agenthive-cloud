<template>
  <div class="monaco-wrapper">
    <!-- 加载中 / 服务端占位 -->
    <div v-if="!isReady" class="monaco-placeholder">
      <el-skeleton :rows="16" animated />
    </div>

    <!-- 大文件警告 -->
    <div v-if="isLargeFile" class="large-file-warning">
      <el-alert
        :title="`Large file (${formatFileSize(fileSize)}) — opened in read-only mode`"
        type="warning"
        :closable="false"
        show-icon
      />
    </div>

    <!-- 编辑器容器 -->
    <div
      v-show="isReady"
      ref="editorContainer"
      class="monaco-editor-container"
      :class="{ 'has-warning': isLargeFile }"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'

const props = defineProps<{
  modelValue: string
  language: string
  theme?: 'light' | 'dark'
  readonly?: boolean
  path?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'change': [value: string]
  'ready': []
}>()

const editorContainer = ref<HTMLDivElement | null>(null)
const isReady = ref(false)
let editor: any = null
let monacoInstance: any = null

// ============ 大文件检测 ============
const fileSize = computed(() => {
  return new Blob([props.modelValue]).size
})

const isLargeFile = computed(() => {
  return fileSize.value > 1024 * 1024 // 1MB
})

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ============ 编辑器初始化 ============
const initEditor = async () => {
  if (!editorContainer.value || !import.meta.client) return

  try {
    const monaco = await import('monaco-editor')
    monacoInstance = monaco

    editor = monaco.editor.create(editorContainer.value, {
      value: props.modelValue,
      language: props.language,
      theme: props.theme === 'dark' ? 'vs-dark' : 'vs',
      readOnly: props.readonly || isLargeFile.value,
      minimap: { enabled: true },
      lineNumbers: 'on',
      automaticLayout: true,
      autoClosingBrackets: 'always',
      autoClosingQuotes: 'always',
      scrollBeyondLastLine: false,
      fontSize: 14,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
      tabSize: 2,
      wordWrap: 'on',
      roundedSelection: false,
      renderWhitespace: 'selection',
      folding: true,
      foldingHighlight: true,
      showFoldingControls: 'always',
    })

    editor.onDidChangeModelContent(() => {
      const value = editor.getValue()
      emit('update:modelValue', value)
      emit('change', value)
    })

    isReady.value = true
    emit('ready')
  } catch (err: any) {
    console.error('[MonacoEditor] Failed to initialize:', err)
  }
}

const destroyEditor = () => {
  if (editor) {
    editor.dispose()
    editor = null
  }
  monacoInstance = null
  isReady.value = false
}

// ============ 生命周期 ============
onMounted(() => {
  initEditor()
})

onUnmounted(() => {
  destroyEditor()
})

// ============ 响应外部变化 ============
watch(() => props.modelValue, (newVal) => {
  if (editor && editor.getValue() !== newVal) {
    editor.setValue(newVal)
  }
})

watch(() => props.language, (newLang) => {
  if (editor && monacoInstance) {
    const model = editor.getModel()
    if (model) {
      monacoInstance.editor.setModelLanguage(model, newLang)
    }
  }
})

watch(() => props.theme, (newTheme) => {
  if (monacoInstance) {
    monacoInstance.editor.setTheme(newTheme === 'dark' ? 'vs-dark' : 'vs')
  }
})

watch(() => props.readonly, (newReadonly) => {
  if (editor) {
    editor.updateOptions({ readOnly: newReadonly || isLargeFile.value })
  }
})
</script>

<style scoped>
.monaco-wrapper {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.monaco-placeholder {
  flex: 1;
  padding: 24px;
}

.large-file-warning {
  flex-shrink: 0;
  padding: 8px 16px;
  background: #fefce8;
  border-bottom: 1px solid #fef08a;
}

.monaco-editor-container {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.monaco-editor-container.has-warning {
  /* 如果有警告栏，编辑器自动适应剩余空间 */
}
</style>

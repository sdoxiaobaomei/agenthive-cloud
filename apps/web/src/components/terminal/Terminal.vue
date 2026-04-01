<template>
  <div class="terminal-wrapper" :class="{ 'is-fullscreen': isFullscreen }">
    <div class="terminal-header" v-if="showHeader">
      <div class="terminal-title">
        <el-icon><Monitor /></el-icon>
        <span>{{ title || `Terminal - ${agentId?.slice(0, 8) || 'Unknown'}` }}</span>
      </div>
      <div class="terminal-actions">
        <el-button 
          :icon="isPaused ? VideoPlay : VideoPause" 
          text 
          size="small"
          @click="togglePause"
        >
          {{ isPaused ? '继续' : '暂停' }}
        </el-button>
        <el-button 
          :icon="Delete" 
          text 
          size="small"
          @click="clearTerminal"
        >
          清空
        </el-button>
        <el-button 
          :icon="isFullscreen ? Crop : FullScreen" 
          text 
          size="small"
          @click="toggleFullscreen"
        >
          {{ isFullscreen ? '退出全屏' : '全屏' }}
        </el-button>
      </div>
    </div>
    
    <div ref="terminalContainer" class="terminal-container"></div>
    
    <div v-if="showInput" class="terminal-input-wrapper">
      <div class="terminal-input">
        <span class="prompt">$</span>
        <input 
          ref="inputRef"
          v-model="inputValue" 
          type="text"
          placeholder="输入命令... (↑↓ 浏览历史, Tab 补全)"
          @keyup.enter="handleSubmit"
          @keyup.up="handleHistoryUp"
          @keyup.down="handleHistoryDown"
          @keydown.tab.prevent="handleTabComplete"
          @focus="isInputFocused = true"
          @blur="isInputFocused = false"
        />
      </div>
      <div v-if="commandHistory.length > 0" class="history-hint">
        历史: {{ commandHistory.length }} 条
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
// import { WebLinksAddon } from 'xterm-addon-web-links'
import { 
  Monitor, Delete, FullScreen, Crop, 
  VideoPlay, VideoPause 
} from '@element-plus/icons-vue'
import 'xterm/css/xterm.css'

const props = withDefaults(defineProps<{
  agentId?: string
  title?: string
  showHeader?: boolean
  showInput?: boolean
  readonly?: boolean
}>(), {
  showHeader: true,
  showInput: false,
  readonly: true,
})

const emit = defineEmits<{
  command: [command: string]
  data: [data: string]
}>()

const terminalContainer = ref<HTMLElement>()
const inputRef = ref<HTMLInputElement>()
const inputValue = ref('')
const isPaused = ref(false)
const isFullscreen = ref(false)
const isInputFocused = ref(false)

// 命令历史
const commandHistory = ref<string[]>([])
const historyIndex = ref(-1)
const maxHistorySize = 100

let terminal: Terminal | null = null
let fitAddon: FitAddon | null = null
const buffer: string[] = []

onMounted(() => {
  if (!terminalContainer.value) return
  
  terminal = new Terminal({
    cursorBlink: true,
    cursorStyle: 'block',
    theme: {
      background: '#1e1e1e',
      foreground: '#d4d4d4',
      cursor: '#d4d4d4',
      selectionBackground: '#264f78',
      black: '#000000',
      red: '#cd3131',
      green: '#0dbc79',
      yellow: '#e5e510',
      blue: '#2472c8',
      magenta: '#bc3fbc',
      cyan: '#11a8cd',
      white: '#e5e5e5',
      brightBlack: '#666666',
      brightRed: '#f14c4c',
      brightGreen: '#23d18b',
      brightYellow: '#f5f543',
      brightBlue: '#3b8eea',
      brightMagenta: '#d670d6',
      brightCyan: '#29b8db',
      brightWhite: '#e5e5e5',
    },
    fontFamily: 'Consolas, "Courier New", monospace',
    fontSize: 14,
    lineHeight: 1.2,
    scrollback: 10000,
    allowProposedApi: true,
    // wordWrap: true,  // not valid in xterm
    convertEol: true,
  })
  
  fitAddon = new FitAddon()
  terminal.loadAddon(fitAddon)
  
  // 添加链接检测 (disabled - web-links addon not installed)
  // terminal.loadAddon(new WebLinksAddon())
  
  terminal.open(terminalContainer.value)
  fitAddon.fit()
  
  // 欢迎信息
  writeWelcome()
  
  // 处理输入（如果允许）
  if (!props.readonly) {
    terminal.onData((data) => {
      emit('data', data)
    })
  }
  
  // 窗口大小变化时自适应
  window.addEventListener('resize', handleResize)
  
  // 点击终端聚焦输入框
  terminalContainer.value?.addEventListener('click', () => {
    if (props.showInput) {
      inputRef.value?.focus()
    }
  })
  
  // 加载本地存储的命令历史
  loadCommandHistory()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  terminal?.dispose()
  terminal = null
})

const handleResize = () => {
  fitAddon?.fit()
}

const writeWelcome = () => {
  if (!terminal) return
  
  const welcomeText = [
    '\x1b[1;32m╔══════════════════════════════════════════════════════════════╗\x1b[0m',
    '\x1b[1;32m║\x1b[0m            \x1b[1;36mAgentHive Cloud Terminal\x1b[0m                      \x1b[1;32m║\x1b[0m',
    '\x1b[1;32m╚══════════════════════════════════════════════════════════════╝\x1b[0m',
    '',
    `\x1b[90mConnected to agent: \x1b[0m\x1b[33m${props.agentId || 'Unknown'}\x1b[0m`,
    '\x1b[90mType \'help\' for available commands\x1b[0m',
    '\x1b[90mUse ↑↓ arrow keys to browse command history\x1b[0m',
    '',
  ]
  
  welcomeText.forEach(line => terminal?.writeln(line))
}

// 外部写入日志
const writeLog = (data: string, isError = false) => {
  if (isPaused.value) {
    buffer.push(data)
    return
  }
  
  const color = isError ? '\x1b[31m' : '\x1b[0m'
  const lines = data.split('\n')
  lines.forEach(line => {
    terminal?.writeln(`${color}${line}\x1b[0m`)
  })
  
  // 自动滚动到底部
  scrollToBottom()
}

// 外部写入原始数据
const writeRaw = (data: string) => {
  if (isPaused.value) {
    buffer.push(data)
    return
  }
  terminal?.write(data)
  scrollToBottom()
}

// 滚动到底部
const scrollToBottom = () => {
  nextTick(() => {
    terminal?.scrollToBottom()
  })
}

const clearTerminal = () => {
  terminal?.clear()
  buffer.length = 0
  writeWelcome()
}

const togglePause = () => {
  isPaused.value = !isPaused.value
  
  if (!isPaused.value && buffer.length > 0) {
    // 恢复时刷新缓冲区的内容
    buffer.forEach(data => {
      terminal?.writeln(data)
    })
    buffer.length = 0
    scrollToBottom()
  }
}

const toggleFullscreen = () => {
  isFullscreen.value = !isFullscreen.value
  setTimeout(() => {
    fitAddon?.fit()
  }, 100)
}

// 加载命令历史
const loadCommandHistory = () => {
  try {
    const stored = localStorage.getItem(`terminal_history_${props.agentId || 'default'}`)
    if (stored) {
      commandHistory.value = JSON.parse(stored)
    }
  } catch {
    commandHistory.value = []
  }
}

// 保存命令历史
const saveCommandHistory = () => {
  try {
    localStorage.setItem(
      `terminal_history_${props.agentId || 'default'}`,
      JSON.stringify(commandHistory.value.slice(-maxHistorySize))
    )
  } catch {
    // 忽略存储错误
  }
}

// 添加命令到历史
const addToHistory = (command: string) => {
  // 避免重复添加相同的连续命令
  if (commandHistory.value.length === 0 || commandHistory.value[commandHistory.value.length - 1] !== command) {
    commandHistory.value.push(command)
    // 限制历史记录大小
    if (commandHistory.value.length > maxHistorySize) {
      commandHistory.value = commandHistory.value.slice(-maxHistorySize)
    }
    saveCommandHistory()
  }
  historyIndex.value = -1
}

// 处理命令提交
const handleSubmit = () => {
  const command = inputValue.value.trim()
  if (!command) return
  
  writeLog(`$ ${command}`)
  emit('command', command)
  addToHistory(command)
  inputValue.value = ''
}

// 向上浏览历史
const handleHistoryUp = () => {
  if (commandHistory.value.length === 0) return
  
  if (historyIndex.value < commandHistory.value.length - 1) {
    historyIndex.value++
    inputValue.value = commandHistory.value[commandHistory.value.length - 1 - historyIndex.value]
  }
}

// 向下浏览历史
const handleHistoryDown = () => {
  if (historyIndex.value > 0) {
    historyIndex.value--
    inputValue.value = commandHistory.value[commandHistory.value.length - 1 - historyIndex.value]
  } else if (historyIndex.value === 0) {
    historyIndex.value = -1
    inputValue.value = ''
  }
}

// Tab 补全（简化版本）
const handleTabComplete = () => {
  const currentInput = inputValue.value.trim()
  if (!currentInput) return
  
  // 简单的命令补全逻辑
  const commonCommands = ['help', 'clear', 'ls', 'pwd', 'cat', 'echo', 'cd', 'mkdir', 'rm', 'cp', 'mv']
  const matches = commonCommands.filter(cmd => cmd.startsWith(currentInput.toLowerCase()))
  
  if (matches.length === 1) {
    inputValue.value = matches[0]
  } else if (matches.length > 1) {
    writeLog(matches.join('  '))
  }
}

// 键盘快捷键处理 (currently unused)
// const handleKeyDown = (e: KeyboardEvent) => {
//   // Ctrl+L 清屏
//   if (e.ctrlKey && e.key === 'l') {
//     e.preventDefault()
//     clearTerminal()
//   }
//   // Ctrl+C 复制选中文本
//   if (e.ctrlKey && e.key === 'c' && terminal?.hasSelection()) {
//     const selection = terminal.getSelection()
//     navigator.clipboard.writeText(selection)
//     terminal.clearSelection()
//   }
// }

// 监听 fullscreen 变化
watch(isFullscreen, () => {
  setTimeout(() => {
    fitAddon?.fit()
  }, 100)
})

// 暴露方法
defineExpose({
  writeLog,
  writeRaw,
  clear: clearTerminal,
  terminal: () => terminal,
  fit: () => fitAddon?.fit(),
  focus: () => inputRef.value?.focus(),
})
</script>

<style scoped>
.terminal-wrapper {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #1e1e1e;
  border-radius: var(--radius-md);
  overflow: hidden;
}

.terminal-wrapper.is-fullscreen {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9999;
  border-radius: 0;
}

.terminal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #252526;
  border-bottom: 1px solid #333;
  flex-shrink: 0;
}

.terminal-title {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #cccccc;
  font-size: 13px;
  font-weight: 500;
}

.terminal-actions {
  display: flex;
  gap: 4px;
}

.terminal-container {
  flex: 1;
  min-height: 0;
  padding: 4px;
  overflow: hidden;
}

.terminal-input-wrapper {
  flex-shrink: 0;
  background: #252526;
  border-top: 1px solid #333;
}

.terminal-input {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  gap: 8px;
}

.prompt {
  color: #0dbc79;
  font-family: var(--font-mono);
  font-weight: bold;
  flex-shrink: 0;
}

.terminal-input input {
  flex: 1;
  background: transparent;
  border: none;
  color: #d4d4d4;
  font-family: var(--font-mono);
  font-size: 14px;
  outline: none;
}

.terminal-input input::placeholder {
  color: #666;
}

.terminal-input input:focus {
  outline: none;
}

.history-hint {
  padding: 2px 12px 4px;
  font-size: 11px;
  color: #666;
  text-align: right;
}

:deep(.xterm) {
  height: 100%;
  padding: 8px;
}

:deep(.xterm-screen) {
  width: 100% !important;
}

:deep(.xterm-viewport) {
  scrollbar-width: thin;
  scrollbar-color: #666 transparent;
}

:deep(.xterm-viewport::-webkit-scrollbar) {
  width: 6px;
}

:deep(.xterm-viewport::-webkit-scrollbar-thumb) {
  background: #666;
  border-radius: 3px;
}
</style>

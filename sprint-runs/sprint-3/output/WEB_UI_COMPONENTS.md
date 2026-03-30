# Web UI Components

**Auto-generated**: 2026-03-31  
**Sprint**: 3  
**Status**: ✅ Completed

---

## Components Structure

```
apps/web/src/
├── components/
│   ├── agent/
│   │   ├── AgentCard.vue       # Agent状态卡片
│   │   ├── AgentPanel.vue      # Agent详情面板
│   │   ├── AgentList.vue       # Agent列表
│   │   └── AgentStatus.vue     # 状态指示器
│   │
│   ├── chat/
│   │   ├── ChatView.vue        # 主对话视图 (迁移)
│   │   ├── ChatBubble.vue      # 消息气泡
│   │   └── ChatInput.vue       # 输入框
│   │
│   ├── code/
│   │   ├── CodeEditor.vue      # Monaco Editor封装
│   │   ├── CodeDiff.vue        # 代码对比
│   │   └── CodeViewer.vue      # 代码查看
│   │
│   ├── terminal/
│   │   ├── Terminal.vue        # xterm.js封装
│   │   └── TerminalPanel.vue   # 终端面板
│   │
│   └── layout/
│       ├── MainLayout.vue      # 主布局
│       ├── Sidebar.vue         # 侧边栏
│       └── Header.vue          # 顶部导航
```

---

## Key Features

### 1. AgentCard.vue
```vue
<template>
  <div class="agent-card" :class="status">
    <div class="agent-avatar">{{ avatar }}</div>
    <div class="agent-info">
      <h4>{{ name }}</h4>
      <span class="role">{{ role }}</span>
      <div class="progress-bar">
        <div class="progress" :style="{ width: progress + '%' }"></div>
      </div>
    </div>
    <div class="status-badge" :class="status">
      {{ status }}
    </div>
  </div>
</template>
```

### 2. CodeEditor.vue (Monaco)
```vue
<script setup>
import { onMounted, ref } from 'vue'
import * as monaco from 'monaco-editor'

const editorRef = ref(null)
let editor = null

onMounted(() => {
  editor = monaco.editor.create(editorRef.value, {
    value: '// Agent is coding...',
    language: 'go',
    theme: 'vs-dark',
    readOnly: true,
    automaticLayout: true
  })
})

// Update content from WebSocket
const updateCode = (code) => {
  editor.setValue(code)
}
</script>
```

### 3. Terminal.vue (xterm.js)
```vue
<script setup>
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'

const terminal = new Terminal({
  cursorBlink: true,
  theme: {
    background: '#1e1e1e',
    foreground: '#d4d4d4'
  }
})

const fitAddon = new FitAddon()
terminal.loadAddon(fitAddon)

// Stream logs from WebSocket
const writeLog = (data) => {
  terminal.writeln(data)
}
</script>
```

---

## WebSocket Integration

```typescript
// stores/agent.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { io } from 'socket.io-client'

export const useAgentStore = defineStore('agent', () => {
  const agents = ref([])
  const socket = io('/ws')
  
  socket.on('agent_state_change', (data) => {
    const agent = agents.value.find(a => a.id === data.agent_id)
    if (agent) {
      agent.status = data.state
      agent.progress = data.progress
    }
  })
  
  socket.on('code_update', (data) => {
    // Update code editor
  })
  
  socket.on('log_output', (data) => {
    // Append to terminal
  })
  
  return { agents }
})
```

---

## Screenshots

![Dashboard](mock/dashboard.png)
![Agent Panel](mock/agent-panel.png)
![Code Editor](mock/code-editor.png)

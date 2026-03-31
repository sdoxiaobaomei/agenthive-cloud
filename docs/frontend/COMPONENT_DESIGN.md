# 前端组件设计

**框架**: Vue3 + TypeScript + Vite  
**UI库**: Element Plus  
**状态管理**: Pinia  
**日期**: 2026-03-31

---

## 1. 组件架构

```
src/
├── components/
│   ├── agent/                 # Agent相关组件
│   │   ├── AgentCard.vue      # Agent卡片
│   │   ├── AgentPanel.vue     # Agent详情面板
│   │   ├── AgentList.vue      # Agent列表
│   │   ├── AgentStatus.vue    # 状态指示器
│   │   └── AgentAvatar.vue    # Agent头像
│   │
│   ├── code/                  # 代码展示组件
│   │   ├── CodeEditor.vue     # Monaco编辑器封装
│   │   ├── CodeDiff.vue       # 代码对比
│   │   └── CodeViewer.vue     # 只读代码查看
│   │
│   ├── terminal/              # 终端组件
│   │   ├── Terminal.vue       # xterm.js封装
│   │   └── TerminalPanel.vue  # 终端面板
│   │
│   ├── chat/                  # 对话组件
│   │   ├── ChatView.vue       # 主对话视图
│   │   ├── ChatBubble.vue     # 消息气泡
│   │   ├── ChatInput.vue      # 输入框
│   │   └── ChatToolbar.vue    # 工具栏
│   │
│   ├── layout/                # 布局组件
│   │   ├── MainLayout.vue     # 主布局
│   │   ├── Sidebar.vue        # 侧边栏
│   │   ├── Header.vue         # 顶部导航
│   │   └── Workspace.vue      # 工作区
│   │
│   └── common/                # 通用组件
│       ├── Loading.vue        # 加载中
│       ├── Empty.vue          # 空状态
│       └── Error.vue          # 错误提示
│
├── views/                     # 页面视图
│   ├── Dashboard.vue          # 仪表板
│   ├── AgentDetail.vue        # Agent详情页
│   ├── TaskBoard.vue          # 任务看板
│   ├── SprintBoard.vue        # Sprint看板
│   └── Settings.vue           # 设置
│
├── stores/                    # Pinia状态
│   ├── agent.ts               # Agent状态
│   ├── task.ts                # 任务状态
│   ├── chat.ts                # 对话状态
│   ├── code.ts                # 代码状态
│   ├── terminal.ts            # 终端状态
│   └── ws.ts                  # WebSocket状态
│
├── api/                       # API客户端
│   ├── client.ts              # Axios实例
│   ├── agents.ts              # Agent API
│   ├── tasks.ts               # 任务API
│   └── websocket.ts           # WebSocket管理
│
└── composables/               # 组合式函数
    ├── useAgent.ts            # Agent操作
    ├── useTask.ts             # 任务操作
    ├── useWebSocket.ts        # WebSocket
    └── useTheme.ts            # 主题切换
```

---

## 2. 核心组件详解

### 2.1 AgentCard.vue

**功能**: 展示单个Agent的概要信息

```vue
<template>
  <div class="agent-card" :class="statusClass" @click="handleClick">
    <AgentAvatar :role="agent.role" :status="agent.status" />
    <div class="info">
      <h4 class="name">{{ agent.name }}</h4>
      <span class="role">{{ roleText }}</span>
      <div class="progress-bar" v-if="agent.progress > 0">
        <div class="progress" :style="{ width: agent.progress + '%' }"></div>
      </div>
    </div>
    <AgentStatus :status="agent.status" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Agent } from '@/types'

const props = defineProps<{
  agent: Agent
}>()

const emit = defineEmits<{
  click: [agent: Agent]
}>()

const statusClass = computed(() => `status-${props.agent.status}`)
const roleText = computed(() => formatRole(props.agent.role))

const handleClick = () => emit('click', props.agent)
</script>

<style scoped>
.agent-card {
  display: flex;
  align-items: center;
  padding: 16px;
  border-radius: 8px;
  background: var(--el-bg-color);
  cursor: pointer;
  transition: all 0.3s;
}

.agent-card:hover {
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

.status-working {
  border-left: 4px solid var(--el-color-primary);
}

.status-error {
  border-left: 4px solid var(--el-color-danger);
}
</style>
```

**Props**:
| 属性 | 类型 | 必填 | 说明 |
|------|------|------|------|
| agent | Agent | 是 | Agent数据 |

**Events**:
| 事件 | 参数 | 说明 |
|------|------|------|
| click | Agent | 点击卡片 |

---

### 2.2 CodeEditor.vue

**功能**: Monaco Editor封装，支持实时代码展示

```vue
<template>
  <div ref="editorContainer" class="code-editor"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import * as monaco from 'monaco-editor'

const props = defineProps<{
  modelValue: string
  language: string
  readOnly?: boolean
  theme?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  change: [value: string]
}>()

const editorContainer = ref<HTMLElement>()
let editor: monaco.editor.IStandaloneCodeEditor | null = null

onMounted(() => {
  if (!editorContainer.value) return
  
  editor = monaco.editor.create(editorContainer.value, {
    value: props.modelValue,
    language: props.language,
    theme: props.theme || 'vs-dark',
    readOnly: props.readOnly ?? true,
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
      horizontal: 'auto'
    }
  })
  
  editor.onDidChangeModelContent(() => {
    const value = editor?.getValue() || ''
    emit('update:modelValue', value)
    emit('change', value)
  })
})

// 响应外部内容变化
watch(() => props.modelValue, (newValue) => {
  if (editor && newValue !== editor.getValue()) {
    editor.setValue(newValue)
  }
})

onBeforeUnmount(() => {
  editor?.dispose()
})
</script>

<style scoped>
.code-editor {
  width: 100%;
  height: 100%;
  min-height: 300px;
}
</style>
```

**Props**:
| 属性 | 类型 | 默认 | 说明 |
|------|------|------|------|
| modelValue | string | '' | 代码内容 |
| language | string | - | 语言(go/typescript等) |
| readOnly | boolean | true | 是否只读 |
| theme | string | 'vs-dark' | 主题 |

---

### 2.3 Terminal.vue

**功能**: xterm.js终端封装

```vue
<template>
  <div ref="terminalContainer" class="terminal-container"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import 'xterm/css/xterm.css'

const props = defineProps<{
  agentId: string
}>()

const terminalContainer = ref<HTMLElement>()
const terminal = new Terminal({
  cursorBlink: true,
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
    white: '#e5e5e5'
  },
  fontFamily: 'Consolas, "Courier New", monospace',
  fontSize: 14,
  lineHeight: 1.2,
  scrollback: 10000
})

const fitAddon = new FitAddon()
terminal.loadAddon(fitAddon)

onMounted(() => {
  if (!terminalContainer.value) return
  
  terminal.open(terminalContainer.value)
  fitAddon.fit()
  
  terminal.writeln('\x1b[1;32mWelcome to AgentHive Terminal\x1b[0m')
  terminal.writeln(`Connected to agent: ${props.agentId}`)
  terminal.writeln('─'.repeat(50))
})

// 外部调用：写入日志
const writeLog = (data: string, isError = false) => {
  const color = isError ? '\x1b[31m' : '\x1b[0m'
  terminal.writeln(`${color}${data}\x1b[0m`)
}

// 暴露方法
defineExpose({
  writeLog,
  clear: () => terminal.clear()
})

onBeforeUnmount(() => {
  terminal.dispose()
})
</script>

<style scoped>
.terminal-container {
  width: 100%;
  height: 100%;
  min-height: 200px;
  padding: 8px;
  background: #1e1e1e;
  border-radius: 4px;
}
</style>
```

---

## 3. 状态管理 (Pinia)

### 3.1 agent.ts

```typescript
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Agent, AgentStatus } from '@/types'
import { fetchAgents, fetchAgentDetail, sendCommand } from '@/api/agents'

export const useAgentStore = defineStore('agent', () => {
  // State
  const agents = ref<Agent[]>([])
  const currentAgent = ref<Agent | null>(null)
  const loading = ref(false)
  
  // Getters
  const activeAgents = computed(() => 
    agents.value.filter(a => a.status === 'working')
  )
  
  const idleAgents = computed(() => 
    agents.value.filter(a => a.status === 'idle')
  )
  
  const agentById = computed(() => (id: string) =>
    agents.value.find(a => a.id === id)
  )
  
  // Actions
  const loadAgents = async (teamId?: string) => {
    loading.value = true
    try {
      const data = await fetchAgents(teamId)
      agents.value = data.agents
    } finally {
      loading.value = false
    }
  }
  
  const selectAgent = async (id: string) => {
    const agent = await fetchAgentDetail(id)
    currentAgent.value = agent
    return agent
  }
  
  const updateAgentStatus = (agentId: string, status: AgentStatus) => {
    const agent = agents.value.find(a => a.id === agentId)
    if (agent) {
      agent.status = status
    }
  }
  
  const commandAgent = async (agentId: string, command: object) => {
    await sendCommand(agentId, command)
  }
  
  return {
    agents,
    currentAgent,
    loading,
    activeAgents,
    idleAgents,
    agentById,
    loadAgents,
    selectAgent,
    updateAgentStatus,
    commandAgent
  }
})
```

---

## 4. 类型定义

```typescript
// types/index.ts

export type AgentRole = 
  | 'director' 
  | 'scrum_master' 
  | 'tech_lead'
  | 'backend_dev'
  | 'frontend_dev'
  | 'qa_engineer'
  | 'devops_engineer'

export type AgentStatus = 
  | 'idle'
  | 'starting'
  | 'working'
  | 'paused'
  | 'error'
  | 'completed'

export interface Agent {
  id: string
  name: string
  role: AgentRole
  status: AgentStatus
  currentTask?: {
    id: string
    title: string
    progress: number
  }
  podIp?: string
  lastHeartbeatAt: string
  createdAt: string
}

export interface Task {
  id: string
  type: string
  status: string
  title: string
  description?: string
  input: object
  output?: object
  progress: number
  createdAt: string
  startedAt?: string
  completedAt?: string
}

export interface Message {
  id: string
  senderType: 'user' | 'agent' | 'system'
  senderId?: string
  senderName?: string
  content: string
  contentType: 'text' | 'code' | 'image' | 'file'
  metadata?: object
  createdAt: string
}
```

---

## 5. 样式规范

### 5.1 CSS变量

```css
:root {
  /* 颜色 */
  --agent-idle: #909399;
  --agent-working: #409eff;
  --agent-error: #f56c6c;
  --agent-completed: #67c23a;
  
  /* 布局 */
  --sidebar-width: 260px;
  --header-height: 60px;
  --panel-gap: 16px;
  
  /* 字体 */
  --font-mono: 'Consolas', 'Monaco', monospace;
}
```

### 5.2 响应式断点

| 断点 | 宽度 | 布局调整 |
|------|------|---------|
| xs | < 768px | 单栏，侧边栏收起 |
| sm | 768px - 992px | 双栏 |
| md | 992px - 1200px | 三栏 |
| lg | > 1200px | 完整布局 |

---

## 6. 性能优化

### 6.1 虚拟列表

Agent列表使用虚拟滚动：
```vue
<template>
  <RecycleScroller
    class="agent-list"
    :items="agents"
    :item-size="80"
    key-field="id"
  >
    <template #default="{ item }">
      <AgentCard :agent="item" />
    </template>
  </RecycleScroller>
</template>
```

### 6.2 代码分割

```typescript
// 路由懒加载
const AgentDetail = () => import('@/views/AgentDetail.vue')
const CodeEditor = () => import('@/components/code/CodeEditor.vue')
```

### 6.3 WebSocket优化

- 心跳机制：30秒一次
- 重连机制：指数退避
- 消息压缩：启用permessage-deflate

---

**组件设计完成！** 下一步：实现具体组件

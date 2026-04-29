# Reflection: TICKET-FEAT-006b — Monaco 编辑器多 Tab 集成

## 任务概述
在 Workspace 页面集成 Monaco Editor，实现多 Tab 打开、语法高亮、编辑器状态管理。

## 关键决策回顾

### 1. Monaco 引入方式
**选择**: 直接安装 `monaco-editor` npm 包，组件内 `await import('monaco-editor')` 动态导入。

**拒绝的方案**: `@monaco-editor/vue` — 该包在 npm registry 中不存在（404）。

**实现**:
```typescript
// MonacoEditor.vue
const monaco = await import('monaco-editor')
editor = monaco.editor.create(container, {
  value: props.modelValue,
  language: props.language,
  theme: props.theme === 'dark' ? 'vs-dark' : 'vs',
  // ...
})
```

**优点**:
- 无第三方 Vue 包装器的依赖风险
- 完全控制 Monaco 实例生命周期
- 按需加载，不影响首屏性能

### 2. Tab 状态管理
**选择**: 在 `workspace.ts` store 中管理 `openedFiles` 和 `activeFilePath`。

**数据结构**:
```typescript
interface OpenedFile {
  path: string
  name: string
  content: string
  originalContent: string
  language: string
  isDirty: boolean
}
```

**核心流程**:
```
点击文件 → openFile(path)
  → 已打开？ → setActiveFile(path)
  → 未打开？ → API 获取内容 → push to openedFiles → setActiveFile(path)

编辑器输入 → updateFileContent(path, content)
  → content !== originalContent → isDirty = true

关闭 Tab → closeFile(path)
  → splice from openedFiles
  → 如果关闭的是 activeFile → 切换到相邻 Tab
```

### 3. 大文件只读保护
```typescript
const isLargeFile = computed(() => {
  return new Blob([props.modelValue]).size > 1024 * 1024 // 1MB
})
```

当文件 > 1MB 时:
- 自动设置 `readOnly: true`
- 显示 ElAlert 警告栏
- 防止 Monaco 卡顿

### 4. 语言检测映射
```typescript
function detectLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript', js: 'javascript',
    vue: 'html', html: 'html', css: 'css', scss: 'scss',
    json: 'json', yaml: 'yaml', md: 'markdown',
    java: 'java', go: 'go', py: 'python', rs: 'rust', sql: 'sql',
    // ...
  }
  return map[ext] || 'plaintext'
}
```

覆盖了 Ticket 要求的所有类型：ts/js/vue/html/css/json/yaml/md/java/go/python/rust/sql。

## 遇到的挑战

### npm 包 `@monaco-editor/vue` 不存在
Build 前尝试安装 `@monaco-editor/vue`，pnpm 返回 404。

**解决**: 改为直接安装 `monaco-editor`（~40MB，但按需加载），组件内动态导入。

### Nuxt catch-all 路由的相对路径
创建 `server/api/code/files/[...path].get.ts` 时，import `apiProxy` 的路径写错为 `../../../../utils/apiProxy`（实际应为 `../../../utils/apiProxy`）。

**解决**: 修正相对路径上溯层数。

### Monaco 与 v-model 的双向绑定循环
初始实现中，`watch(() => props.modelValue)` 调用 `editor.setValue()`，而 `setValue` 会触发 `onDidChangeModelContent`，导致循环更新。

**解决**: 在 watcher 中先比较 `editor.getValue() !== newVal`，仅在有差异时才 `setValue`。

## 技术细节

### SSR 安全
- MonacoEditor 组件在 `onMounted` 中初始化 ✓
- 动态导入确保 SSR 时不加载 monaco-editor ✓
- 服务端渲染时显示 skeleton 占位 ✓

### 内存管理
```typescript
onUnmounted(() => {
  if (editor) {
    editor.dispose()
    editor = null
  }
})
```

Tab 关闭时（workspace 页面中 `closeFile`）会销毁对应的 MonacoEditor 组件实例，从而触发 `dispose()`。

### 主题适配
```typescript
const systemTheme = computed<'light' | 'dark'>(() => {
  if (!import.meta.client) return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
})
```

将 `systemTheme` 作为 prop 传递给 MonacoEditor，组件内部监听 theme 变化并调用 `monaco.editor.setTheme()`。

## 可复用模式

### 运行时动态导入大型库
```typescript
// 组件内
const lib = await import('heavy-library')
// 配合 onMounted 确保客户端执行
// 配合骨架屏提升体验
```

此模式适用于任何大型客户端库（ECharts、Three.js、PDF.js 等）。

### Tab 管理状态模式
```typescript
// Store
openedFiles: OpenedFile[]
activeFilePath: string | null

// Actions
openFile(path) -> fetch + push | switch
closeFile(path) -> splice + switch adjacent
setActiveFile(path) -> activeFilePath = path
```

## 后续衔接
- **FEAT-006c**: 启用文件右键菜单（rename/delete/contextmenu），实现自动保存（debounce 1s 调用 save API）
- **FEAT-007**: 底部工具栏（Git 面板、终端、预览、搜索）
- **优化**: Tab 状态持久化（刷新后恢复已打开文件）、Vue 语法高亮（集成 @volar/monaco）

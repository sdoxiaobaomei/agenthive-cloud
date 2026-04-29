# Reflection: TICKET-FEAT-006c — 文件操作菜单与自动保存

## 任务概述
为 Workspace 文件树增加右键上下文菜单（新建/重命名/删除/复制路径），集成自动保存和手动保存快捷键。

## 关键决策回顾

### 1. 右键菜单实现
**选择**: 自定义 Vue 组件 + Teleport to body + overlay 点击关闭。

**拒绝的方案**: 浏览器原生 contextmenu（Ticket 约束明确要求不用原生）。

**实现**:
```vue
<Teleport to="body">
  <div class="context-menu-overlay" @click="close">
    <div class="context-menu" :style="{ left: x + 'px', top: y + 'px' }">
      <div v-for="item in items" class="menu-item" @click="handleClick(item)">
        <el-icon><component :is="item.icon" /></el-icon>
        <span>{{ item.label }}</span>
      </div>
    </div>
  </div>
</Teleport>
```

**优点**:
- Teleport 避免被父容器 overflow 裁剪
- Overlay 处理点击外部关闭
- 动画（scale + opacity）提供流畅体验

### 2. 自动保存策略
**选择**: VueUse `useDebounceFn` 1s 延迟 + 手动 Ctrl+S 快捷键并存。

**实现**:
```typescript
const debouncedSave = useDebounceFn(async () => {
  const active = workspaceStore.activeFile
  if (!active || !active.isDirty) return
  await workspaceStore.saveFile(active.path)
}, 1000)

const handleEditorChange = () => {
  workspaceStore.updateFileContent(active.path, active.content)
  debouncedSave()
}

// 手动保存
window.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault()
    workspaceStore.saveFile(active.path)
  }
})
```

### 3. 文件操作同步 Tab 状态
**重命名时**: 更新 openedFiles 中对应文件的 path 和 name，同步 activeFilePath/selectedFile。

**删除时**: 调用 `workspaceStore.closeFile(path)` 关闭对应 Tab，然后刷新文件树。

## 遇到的挑战

### BFF 路由相对路径重复出错
`server/api/code/files/save.post.ts` 中 import `apiProxy` 时再次写错为 `../../../../`（应为 `../../../`）。

**教训**: 已在两次 Ticket 中犯同样错误，需要建立规则记忆：
- `server/api/` → `server/utils/` = `../../`
- `server/api/x/` → `server/utils/` = `../../../`
- `server/api/x/y/` → `server/utils/` = `../../../../`

## 技术细节

### dirty 状态计算
```typescript
updateFileContent(path: string, content: string): void {
  const file = this.openedFiles.find(f => f.path === path)
  if (!file) return
  file.content = content
  file.isDirty = content !== file.originalContent
}
```

比较 `content` 与 `originalContent`（上次保存/加载时的内容），精确判断是否未保存。

### 保存 API
BFF: `POST /api/code/files/save`
```typescript
const response = await post('/api/code/files/save', {
  path: file.path,
  content: file.content,
})
```

后端未就绪时返回 mock 成功，前端逻辑不受影响。

## 可复用模式

### ContextMenu 组件
通用右键菜单组件，props: `visible`, `x`, `y`, `items: MenuItem[]`。

可复用于任何需要右键菜单的场景（如 Chat 消息、Project 卡片等）。

### 自动保存模式
```typescript
const debouncedSave = useDebounceFn(() => save(), delay)
onChange = () => {
  updateState()
  debouncedSave()
}
```

适用于任何表单/编辑器自动保存场景。

## 后续衔接
- **FEAT-002a**: 后端文件系统 API 完善后，BFF 路由自动生效
- **FEAT-006b/007**: Monaco 编辑器的更多功能（diff、格式化等）
- **优化**: 拖拽移动文件/文件夹的完整实现（当前 FileTreeNode 有 drag/drop 事件，workspace 页面待对接）

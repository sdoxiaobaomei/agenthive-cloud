# Reflection: TICKET-FEAT-006a — Workspace 页面骨架 /workspace/:id

## 任务概述
实现 `/workspace/:projectId` 路由页面，作为云端 IDE 的入口。包含左侧文件树面板、右侧主内容区骨架、面包屑导航。

## 关键决策回顾

### 1. 独立 Workspace Store
**选择**: 新建 `stores/workspace.ts`，不复用 `chat.ts`。

**理由**:
- Workspace 和 Chat 是不同的业务域，状态不应混杂
- Chat store 包含大量消息/会话状态，与文件系统无关
- 独立 store 便于后续 Monaco 编辑器、Git 面板、终端等功能的迭代

**Store 设计**:
```
state: fileTree, selectedFile, expandedPaths, sidebarCollapsed, currentPath, loading, error
getters: hasSelectedFile, selectedFileNode, breadcrumbSegments
actions: fetchFiles, toggleFolder, selectFile, setSidebarCollapsed, refreshFiles
persist: sidebarCollapsed → localStorage
```

### 2. 文件树懒加载策略
**选择**: 先加载根目录，展开文件夹时按需加载子目录。

**实现模式**:
```
handleFolderToggle(node)
  → toggleFolder(path)  // 切换展开状态
  → if (展开 && 无 children)
      → fetchFiles(projectId, node.path)  // 加载子目录
      → updateNodeChildren(fileTree, path, newChildren)  // 递归更新
```

**优点**: 兼容后端返回单层列表的情况，也支持后端返回递归树。

### 3. SSR 安全处理
- `fetchFiles` 在 `onMounted` 中调用 ✓
- 文件树用 `<ClientOnly>` 包裹 ✓
- `localStorage` 通过 Pinia persist 插件的 `typeof window !== 'undefined'` 保护 ✓

### 4. 主内容区分阶段实现
- **006a**: 欢迎页 + 文件预览占位
- **006b**: Monaco 编辑器多 Tab
- **006c**: 文件操作菜单 + 自动保存

这样每个 Ticket 职责单一，降低复杂度。

## 遇到的挑战

### Element Plus Icons 缺失 `Code` 图标
Build 报错：`"Code" is not exported by @element-plus/icons-vue`

**解决**: 用 `Document` 图标替代。后续应维护项目内可用图标参考列表。

### 文件树组件的 props/emits 契约
`FileTreeNode.vue` 已定义好 props（`node`, `selected-path`, `expanded-paths`）和 emits（`select`, `toggle`, `rename`, `delete`, `contextmenu`）。

006a 只用了 `select` 和 `toggle`，其他 emits 在 006c 中启用。

## 技术细节

### BFF 查询参数透传
```typescript
const query = getQuery(event)
const result = await proxyToApi(event, '/api/code/files', { query })
```

`?path=src/components` 会自动透传到后端 Gateway。

### 面包屑实现
```typescript
breadcrumbSegments: (state): string[] => {
  if (!state.currentPath) return []
  return state.currentPath.split('/').filter(Boolean)
}
```

当前在 UI 中直接展示 `workspace > projectName > path` 字符串，未拆分为可点击段。后续可扩展为点击跳转。

### 404 处理
```typescript
onMounted(async () => {
  try {
    await projectStore.selectProject(projectId.value)
    projectNotFound.value = false
  } catch {
    projectNotFound.value = true
    return
  }
  // ...fetch files
})
```

## 可复用模式

### 懒加载树形组件模式
```typescript
// store action
async fetchFiles(projectId: string, path: string = '') {
  const files = await api.get(`/api/code/files?path=${path}`)
  if (!path) {
    this.fileTree = files  // 根目录：替换整棵树
  } else {
    this.updateNodeChildren(this.fileTree, path, files)  // 子目录：递归更新
  }
}

// 递归更新 helper
updateNodeChildren(nodes, path, children) {
  for (const node of nodes) {
    if (node.path === path && node.type === 'folder') {
      node.children = children
      return true
    }
    if (node.children?.length) {
      if (this.updateNodeChildren(node.children, path, children)) return true
    }
  }
  return false
}
```

### Workspace 布局模式
```
flex row
├── sidebar (固定宽度，可折叠)
│   ├── toolbar
│   ├── breadcrumb
│   └── content (scrollable)
└── main (flex-1, scrollable)
```

此布局可直接复用于任何需要侧边栏+主区域的页面。

## 后续衔接
- **FEAT-006b**: 主内容区集成 Monaco Editor，替换当前的 file-preview placeholder
- **FEAT-006c**: 启用 FileTreeNode 的右键菜单（rename/delete/contextmenu），实现自动保存
- **FEAT-007**: 底部工具栏（Git/终端/预览/搜索）

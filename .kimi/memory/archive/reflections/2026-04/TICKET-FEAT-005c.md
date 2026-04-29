# Reflection: TICKET-FEAT-005c — Project Dashboard /projects/:id

## 任务概述
实现项目详情 Dashboard 页面，作为用户进入项目后的第一个落地页。

## 关键决策回顾

### 1. 左右分栏布局
**选择**: 左侧 320px 信息卡片（sticky）+ 右侧 Tab 内容区。

**理由**:
- 项目信息是高频参考内容，sticky 确保始终可见
- Tab 组织大量信息，避免页面过长
- 响应式：1024px 以下自动变为单列

### 2. 数据获取策略
**真实数据**: 项目信息、成员列表、文件树
**Mock 数据**: Agent 任务、活动日志

**理由**: 后端 Agent 任务 API（FEAT-003）和活动日志尚未完成，先用 mock 保证 UI 完整。

### 3. 最近文件实现
```typescript
const allFiles: any[] = []
const collect = (nodes: any[]) => {
  for (const node of nodes) {
    if (node.type === 'file') allFiles.push(node)
    if (node.children) collect(node.children)
  }
}
collect(files)
recentFiles.value = allFiles
  .sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime())
  .slice(0, 5)
```

**局限**: 前端递归遍历性能在大项目时可能下降。后续应使用后端专用 API。

## 技术细节

### Sticky Sidebar
```css
.project-info-card {
  position: sticky;
  top: 24px;
  height: fit-content;
}
```

需要父容器没有 `overflow: hidden` 才能生效。

### 成员头像重叠
```css
.member-avatar {
  margin-left: -8px;
  border: 2px solid white;
}
.member-avatar:first-child { margin-left: 0; }
```

经典的设计模式，节省横向空间。

## 可复用模式

### Dashboard 布局模式
```
grid (320px + 1fr)
├── sidebar (sticky, info card)
└── main (tabs + content)
```

适用于任何需要展示实体详情+相关内容的页面（用户资料、设置页等）。

## 后续衔接
- **FEAT-005d**: Settings 页面链接已预留 (`/projects/:id/settings`)
- **FEAT-003**: 后端 Agent 任务 API 就绪后替换 recentTasks mock
- **FEAT-001b**: 后端 activity_log 补充后替换 activityLog mock

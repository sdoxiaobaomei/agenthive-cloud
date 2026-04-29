# Reflection: TICKET-FEAT-005a — Project 列表页 /projects

## 任务概述
实现 `/projects` 路由页面，作为 Project 功能的入口页面。包含双视图切换、搜索、状态过滤、分页。

## 关键决策回顾

### 1. Store 状态设计 — 页面级 vs Store 级
**选择**: 视图模式(`viewMode`)和状态过滤(`statusFilter`)放 Store，搜索词(`searchQuery`)放页面。

**理由**: 
- 视图偏好是跨页面的一致偏好，应持久化
- 搜索词通常是页面级别的临时状态，不需要持久化
- 分页状态放 Store 便于与持久化的视图模式一起管理

### 2. 过滤逻辑放 Store Getter 还是页面 Computed
**选择**: Store 保留基础过滤（status），页面 `computed` 做组合过滤（status + search + pagination）。

**理由**:
- Options API 风格的 Pinia getters 之间引用容易冗余
- 页面 computed 更灵活，可以随意组合 store state 和 local state
- 性能上 Vue 3 computed 已足够优化

### 3. BFF 查询参数透传
```typescript
const query = getQuery(event)
const result = await proxyToApi(event, '/api/projects', { query })
```

**收益**: 后端支持分页/过滤后，前端无需修改任何代码即可切换为后端过滤。

## 遇到的挑战

### 项目已有类型错误
`nuxt typecheck` 报出 4 个历史错误，均非本 Ticket 引入：
- `pages/chat.vue` — Project 类型不匹配
- `plugins/vite-cjs-guard.ts` — 缺少 vite 类型声明
- `server/api/auth/register.post.ts` — 响应字段类型不完整
- `vite-plugins/dayjs-esm.ts` — 同上

**处理**: 确认本 Ticket 修改文件无新增错误，build 通过即可。

## 技术细节

### SSR 安全
- `fetchProjects` 在 `onMounted` 中调用 ✓
- `localStorage` 仅在 `typeof window !== 'undefined'` 中访问（Pinia persist 插件已处理）✓

### 性能优化
- 使用 `computed` 做过滤和分页，依赖追踪精确 ✓
- 卡片列表使用 `key="project.id"` 保证 diff 效率 ✓
- Skeleton 加载占位避免布局抖动 ✓

### 视觉一致性
- 颜色/圆角/阴影与现有 Chat 页面保持一致
- 使用 Element Plus 组件（ElCard/ElTable/ElPagination/ElTag/ElTabs）
- 响应式：1280px+ 桌面端 3-4 列网格

## 可复用模式

### 页面级列表页模板
```
page-header (标题 + 操作)
toolbar (搜索 + 过滤)
content-area (loading / empty / list)
pagination
```

此模式可直接复用于 FE-MKT-001（市场页面）、FEAT-005c（Dashboard 中的列表）等场景。

### stringToColor 工具函数
基于字符串哈希生成固定颜色，适用于无头像时的默认色块。可提取为 `composables/useStringColor.ts`。

## 后续衔接
- FEAT-005b (`/projects/create`): 本页"New Project"按钮的跳转目标
- FEAT-005c (`/projects/:id`): 本页卡片点击的跳转目标
- FEAT-001a/001b 完成后: 移除 memberCount mock，切换后端分页

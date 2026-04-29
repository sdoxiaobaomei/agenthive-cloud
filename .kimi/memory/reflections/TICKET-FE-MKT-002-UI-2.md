# Reflection: TICKET-FE-MKT-002-UI-2

## 创作者中心商品管理 + 发布商品

### 完成情况
- /creator/products 页面：DataTable 商品列表、状态筛选、操作按钮（编辑/下架/删除）+ ConfirmDialog ✅
- /creator/products/new 页面：完整表单、Markdown 预览、技术栈标签、图片上传、来源选择 ✅
- 表单校验、发布跳转 ✅

### 发现的问题与修复
1. **路由冲突**：同时存在 `pages/creator/products.vue` 和 `pages/creator/products/index.vue`，Nuxt 文件路由冲突导致 index.vue 内容无法渲染。删除了 `index.vue`，保留功能更完整的 `products.vue`（DataTable 实现更符合 ticket 要求）。

2. **calculateFiatPrice 重复导出**：`useMockRecharge.ts` 和 `useMockWithdraw.ts` 均导出同名函数。由于 `useMockWithdraw.ts` 中的该函数仅内部使用，移除其 `export` 关键字消除冲突。

### 可复用模式
- **本地图片上传 + 拖拽排序**：Element Plus Upload（auto-upload=false）+ FileReader 预览 + HTML5 Drag API 排序，无需后端接口。
- **Markdown 预览面板**：textarea 输入 + 实时预览切换，渲染逻辑封装在 `useMarkdownRender` composable。

### 安全
- Markdown 渲染使用白名单标签（h1-h4, p, ul/ol, code, pre, a, blockquote, table），无 `v-html` 渲染用户输入的风险（描述内容来自当前登录用户自己）。
- 图片仅本地预览，不上传服务器。

### 性能
- 商品列表使用 `shallowRef` + `computed` 过滤
- 图片预览使用 FileReader DataURL，不占用网络请求

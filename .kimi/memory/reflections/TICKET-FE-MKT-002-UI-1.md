# Reflection: TICKET-FE-MKT-002-UI-1

## 创作者中心首页 + 收益明细

### 完成情况
- /creator 页面：数据概览卡片、收益趋势图、最近销售记录 ✅
- /creator/earnings 页面：销售流水列表、日期筛选、CSV导出 ✅
- 非卖家引导页、暗色模式、响应式 ✅

### 发现的问题与修复
1. **useMockCredits 重复导出警告**：`useMockApi.ts` 和 `useMockCredits.ts` 同时导出同名函数，导致 Nuxt auto-import 冲突。修复方案：将 `useMockApi.ts` 中的实现重命名为 `_useMockCreditsImpl`，`useMockCredits.ts` 以别名重新导出。所有引用文件同步更新。

2. **useMockTransactions 导入路径**：原从 `./useMockApi` 直接导入 `useMockCredits`，改为从 `./useMockCredits` 导入，避免依赖内部重命名后的函数。

### 可复用模式
- **Interface + Composable Mock 模式**：`useMockApi.ts` 集中定义 mock 实现和类型契约（`ICreditsApi`/`ICreatorApi`），后端就绪时只需替换此文件。
- **Dual-State 页面**：同一路由根据权限状态渲染完全不同的 UI（仪表盘 vs 引导页），通过 `v-if="creator.isSeller.value"` 控制。

### SSR 安全
- 所有 `window`/`document` 调用都在 `onMounted` 中或 `import.meta.client` 保护下
- CSV 导出检查 `typeof document === 'undefined'`

### 性能
- 销售记录使用 `shallowRef` 存储大数组
- 趋势图数据通过 `computed` 从原始收益数据派生

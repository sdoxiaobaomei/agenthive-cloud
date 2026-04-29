# Reflection: TICKET-FE-MKT-003-UI-1

## Credits 中心首页 + 流水明细

### 完成情况
- /credits 页面：余额动画展示、快捷操作、收益饼图、最近 5 笔流水 ✅
- /credits/transactions 页面：完整流水列表、类型筛选、分页 ✅
- 顶部导航栏余额轮询、Chat 预估消费提示 ✅

### 发现的问题与修复
1. **economy-preview.vue 导入路径**：该文件直接从 `useMockApi` 导入 `useMockCredits`，重命名后同步更新为从 `useMockCredits` 文件导入。

2. **useMockApi.spec.ts 测试导入**：测试文件同样直接导入 `useMockCredits`，同步更新为导入重命名后的 `_useMockCreditsImpl as useMockCredits`。

### 可复用模式
- **余额计数器动画**：requestAnimationFrame + easeOutCubic，800ms 从 0 滚动到目标值。组件卸载时 cancelAnimationFrame。
- **导航栏余额轮询**：`setInterval(() => mockCredits.refresh(), 5000)`，页面卸载时 clearInterval。

### SSR 安全
- `matchMedia` 暗色检测在 `onMounted` 中进行
- `requestAnimationFrame` 仅在客户端执行（由 onMounted 保证）
- `setInterval` 清理在 `onUnmounted` 中进行

### 性能
- 流水数据使用 `shallowRef`
- PieChart 按需加载 echarts（动态 import）
- 仅最近 5 笔流水渲染在首页，完整列表在独立页面分页加载

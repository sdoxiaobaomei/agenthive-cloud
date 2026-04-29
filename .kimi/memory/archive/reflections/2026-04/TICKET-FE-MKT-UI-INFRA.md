# TICKET-FE-MKT-UI-INFRA Reflection

## 任务概述
构建经济系统（Credits 中心 & 创作者中心）共享的 UI 基础设施层，包括 TypeScript 接口、Mock API Composables 和 6 个通用 Vue 组件。

## 架构决策

### 1. Interface-Implementation 分离模式
- `types/economy.ts` 定义纯数据结构（`I` 前缀接口）
- `composables/useMockApi.ts` 提供 Mock 实现，同时暴露 `ICreditsApi`/`ICreatorApi` 契约接口
- 后端 API 就绪时，只需替换 composable 实现，组件零改动

### 2. shallowRef 性能优化
- 交易记录、商品列表等大数组使用 `shallowRef` 避免深层响应式开销
- 计算属性（`totalIncome`, `stats`）按需计算，不冗余存储

### 3. ECharts SSR 安全
- 所有图表组件在 `onMounted` 中 lazy import `echarts`
- 通过 `import.meta.client` 守卫确保 SSR 环境下不执行
- 组件销毁时调用 `dispose()` 防止内存泄漏

## 踩坑记录

### 并发文件覆盖
开发过程中发现 `components/economy/` 下的多个文件被并发进程覆盖（时间戳 22:11-22:13 之间），导致组件 API 与 preview 页面不匹配。最终通过：
1. 快速重写文件
2. 使用 `StrReplaceFile` 做最小化增量修改
3. 频繁验证文件内容

### Element Plus 类型陷阱
- `el-table` 的 `@sort-change` 事件在 TypeScript 中不能直接写 `@sort-change="emit('sortChange', $event)"`，会报 overload 不匹配。需要本地 handler 中转：
  ```ts
  const handleSortChange = (e: { column: unknown; prop: string; order: string }) => {
    emit('sortChange', e.column, e.prop, e.order)
  }
  ```
- `ElDialog` 的 `v-model` 与自定义组件的 `v-model` 存在 prop 透传冲突，使用 `:model-value` + `@update:model-value` 显式绑定解决

### 类型转换
- 强类型接口数组（如 `ICreditsTransaction[]`）不能直接传给期望 `Record<string, unknown>[]` 的 prop，需要 `as unknown as Record<string, unknown>[]` 双重转换

## 测试策略
- 专注 composable 单元测试（不依赖 `@vue/test-utils`，因为项目未安装）
- 15 个测试覆盖 Mock 数据完整性、计算属性正确性、异步刷新行为
- 浮点数比较使用 `toBeCloseTo` 避免精度问题

## Skill 候选
- **Mock API 可替换模式**：interface + composable 封装，适合前端原型阶段快速迭代
- **ECharts Vue3 封装模式**：lazy import + client guard + dispose 生命周期管理

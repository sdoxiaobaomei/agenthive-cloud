# SSR 安全开发指南

## 问题背景

Nuxt 3 使用服务端渲染 (SSR) 来提升首屏加载速度和 SEO，但这会导致一些浏览器特有的 API 在服务端不可用。

## 常见 SSR 错误

```
❌ window is not defined
❌ document is not defined  
❌ localStorage is not defined
❌ [IdInjection] Looks like you are using server rendering...
❌ Hydration completed but contains mismatches
```

## 解决方案

### 1. 使用 `ClientRender` 组件（推荐）

包装任何需要在客户端运行的组件：

```vue
<template>
  <!-- Element Plus 下拉菜单 -->
  <ClientRender>
    <el-dropdown>
      <span>更多</span>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item>选项1</el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
  </ClientRender>

  <!-- 图表组件 -->
  <ClientRender placeholder-height="400px" show-loading loading-text="加载图表中...">
    <ChartComponent />
  </ClientRender>
</template>
```

#### Props

| Prop | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| showPlaceholder | boolean | true | 是否显示占位容器 |
| placeholderWidth | string | '100%' | 占位容器宽度 |
| placeholderHeight | string | 'auto' | 占位容器高度 |
| placeholderClass | string | '' | 占位容器 CSS 类 |
| showLoading | boolean | false | 是否显示加载动画 |
| loadingText | string | '' | 加载提示文字 |

#### Slots

| Slot | 说明 |
|------|------|
| default | 客户端渲染的内容 |
| fallback | SSR 时显示的替代内容 |
| loading | 加载状态内容（覆盖默认加载动画） |

### 2. 使用组合式函数

#### useClientOnly - 获取客户端值

```ts
// 获取 localStorage 值（SSR 安全）
const token = useClientOnly(() => localStorage.getItem('token'), '')

// 获取窗口宽度（SSR 安全）
const screenWidth = useClientOnly(() => window.innerWidth, 1024)
```

#### useClientEffect - 客户端副作用

```ts
useClientEffect(() => {
  const handler = () => console.log('window resized')
  window.addEventListener('resize', handler)
  
  // 返回清理函数
  return () => window.removeEventListener('resize', handler)
})
```

#### useBrowserStorage - 浏览器存储

```ts
// localStorage（自动 JSON 序列化）
const user = useBrowserStorage('user', { name: '', id: '' }, 'local')

// sessionStorage
const tempData = useBrowserStorage('temp', [], 'session')

// 使用
user.value.name = '张三'  // 自动保存到 localStorage
```

#### useWindowEvent / useDocumentEvent - 事件监听

```ts
// SSR 安全的事件监听
useWindowEvent('scroll', handleScroll, { passive: true })
useDocumentEvent('click', handleClick)

// 自动在组件卸载时移除监听
```

### 3. 预置的安全组件

#### SafeElementDropdown - SSR 安全的下拉菜单

```vue
<SafeElementDropdown label="更多" trigger="hover">
  <template #dropdown>
    <el-dropdown-menu>
      <el-dropdown-item>选项1</el-dropdown-item>
      <el-dropdown-item>选项2</el-dropdown-item>
    </el-dropdown-menu>
  </template>
</SafeElementDropdown>
```

## 快速决策表

| 场景 | 解决方案 |
|------|----------|
| Element Plus 下拉/弹窗/对话框 | `<ClientRender>` 或 `SafeElementDropdown` |
| 使用 `window` / `document` | `<ClientRender>` 或 `useClientOnly` |
| 使用 `localStorage` | `useBrowserStorage` |
| 添加事件监听 | `useWindowEvent` / `useDocumentEvent` |
| 动态日期/随机数 | `<ClientRender>` |
| 第三方图表库 | `<ClientRender placeholder-height="400px">` |
| 获取元素尺寸 | `useClientEffect` + `ResizeObserver` |

## 注意事项

### ❌ 避免这样写

```vue
<script setup>
// ❌ SSR 会报错！
const token = localStorage.getItem('token')
const width = window.innerWidth

// ❌ SSR 可能报错！
const id = Math.random().toString()
</script>
```

### ✅ 正确写法

```vue
<script setup>
// ✅ 使用组合式函数
const token = useBrowserStorage('token', '')
const width = useClientOnly(() => window.innerWidth, 1024)

// ✅ 使用 ClientRender 包裹
</script>

<template>
  <ClientRender>
    <div :id="'random-' + Math.random()">内容</div>
  </ClientRender>
</template>
```

## 调试技巧

1. **开发时检测 SSR 问题**：
   ```bash
   npm run build
   npm run preview
   ```

2. **查看服务端渲染错误**：
   - 构建日志中的 `[500] Server Error`
   - 浏览器控制台 hydration mismatch 警告

3. **快速修复**：
   - 不确定时，先用 `<ClientRender>` 包裹
   - 逐步放开，测试哪些组件可以 SSR

## 性能建议

1. **尽量少用 `<ClientRender>`**：只有真正需要浏览器 API 的部分才用
2. **提供合适的 placeholder**：避免布局跳动 (CLS)
3. **优先使用 Nuxt 提供的 SSR 安全函数**：如 `useWindowSize`, `useLocalStorage`

## 相关文件

- `components/ClientRender.vue` - 客户端渲染包装组件
- `components/SafeElementDropdown.vue` - 安全下拉菜单
- `composables/useClientOnly.ts` - SSR 安全组合式函数

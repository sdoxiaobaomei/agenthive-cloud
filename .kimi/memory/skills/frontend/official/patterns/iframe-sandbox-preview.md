# [Draft] iframe sandbox 安全预览模式

> 来源: TICKET-FE-MKT-001, TICKET-FEAT-007
> 创建日期: 2026-04-28
> 考察期截止: 2026-05-28

## 场景
在 Marketplace 商品详情页或 Workspace 工具栏中展示第三方项目/商品演示时，需防止恶意脚本影响父页面（XSS、点击劫持、Cookie 窃取）。

## 代码

### 基础用法
```vue
<template>
  <iframe
    :src="demoUrl"
    sandbox="allow-scripts allow-same-origin"
    class="preview-iframe"
  />
</template>
```

### 带加载状态和错误处理
```vue
<script setup>
const props = defineProps({ demoUrl: String })
const loading = ref(true)
const error = ref(false)

function onLoad() { loading.value = false }
function onError() { error.value = true; loading.value = false }
</script>

<template>
  <div class="preview-container">
    <ElSkeleton v-if="loading" :rows="10" animated />
    <ElAlert v-if="error" title="预览加载失败" type="error" />
    <iframe
      v-show="!loading && !error"
      :src="demoUrl"
      sandbox="allow-scripts allow-same-origin"
      @load="onLoad"
      @error="onError"
    />
  </div>
</template>
```

## 踩坑经过
TICKET-FE-MKT-001 中最初考虑直接使用 `<iframe :src="demoUrl" />`，发现未限制 sandbox 时第三方页面可通过 `window.parent` 访问父页面。添加 `sandbox="allow-scripts allow-same-origin"` 后既允许演示脚本执行，又隔离对父页面的 DOM/Storage 访问。

## 注意事项
- `sandbox="allow-scripts allow-same-origin"` 是最小可用权限集：允许 JS 执行 + 同域 Cookie，但禁止弹窗、表单提交、指针锁定等
- 若演示需要全屏 API，需追加 `allow-fullscreen`
- 若演示需要下载文件，需追加 `allow-downloads`
- **绝不**使用 `sandbox="allow-same-origin allow-scripts allow-popups allow-forms"` 等过度宽松配置
- 对于用户上传的 HTML 演示，建议配合 CSP `Content-Security-Policy: default-src 'self'`

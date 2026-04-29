# AgentHive 快速参考卡片

## 🚨 遇到问题？先看这里！

### VS Code 卡顿/内存高

```powershell
# 1. 检查 node_modules 数量
Get-ChildItem -Filter "node_modules" -Recurse -Directory | Measure-Object

# 2. 如果 > 5，立即清理
node scripts/cleanup-workspaces.js

# 3. 重启 VS Code
```

### 启动前端报错

| 错误 | 解决 |
|------|------|
| `Failed to resolve import "pinia"` | `cd agenthive-cloud/apps/landing && npm install` |
| `window is not defined` | 检查 SSR，使用 `if (import.meta.client)` |
| `Cannot find module '@/stores/xxx'` | 确认 store 文件存在且已导出 |
| `500 Server Error` | 查看终端日志，检查类型错误 |

### 新建 Ticket 工作区

```bash
# ✅ 推荐：使用符号链接（节省空间）
node scripts/init-workspace.js T-999

# ❌ 不推荐：直接复制（会爆炸）
# cp -r agenthive-cloud AGENTS/workspace/T-999/repo
```

---

## 📂 常用路径

```
主仓库:      agenthive-cloud/
Landing:     agenthive-cloud/apps/landing  (包含 Web App)
API:         agenthive-cloud/apps/api
Agent:       agenthive-cloud/apps/agent-runtime
共享类型:    packages/types/src/
工具脚本:    scripts/
工作区:      AGENTS/workspace/
```

---

## 🔧 常用命令

```bash
# 启动开发服务器
cd agenthive-cloud/apps/landing && npm run dev    # http://localhost:3000/
cd agenthive-cloud/apps/api && npm run dev        # http://localhost:3001/

# 类型检查
cd agenthive-cloud/apps/landing && npx nuxt typecheck
cd agenthive-cloud/apps/api && npm run type-check

# 清理
node scripts/cleanup-workspaces.js

# 检查导入问题
node scripts/check-imports.js
```

---

## 🐛 调试技巧

### 1. 查看正在运行的前端服务

```powershell
Get-NetTCPConnection -LocalPort 3000,5173 | Select-Object LocalPort, @{N="Process";E={(Get-Process -Id $_.OwningProcess).ProcessName}}, @{N="PID";E={$_.OwningProcess}}
```

### 2. 杀死占用端口的进程

```powershell
# 端口 3000
$proc = Get-NetTCPConnection -LocalPort 3000 | Select-Object -First 1
Stop-Process -Id $proc.OwningProcess -Force
```

### 3. 查看文件监听数量

```powershell
# Windows
Get-Process | Where-Object {$_.ProcessName -like "*Code*"} | Select-Object ProcessName, @{N="Handles";E={$_.Handles}}

# 如果 Handles > 10000，说明文件监听过多
```

---

## 🎨 代码片段

### 创建新 Store

```typescript
// stores/example.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useExampleStore = defineStore('example', () => {
  // State
  const items = ref<any[]>([])
  const loading = ref(false)
  
  // Getters
  const count = computed(() => items.value.length)
  
  // Actions
  const fetchItems = async () => {
    loading.value = true
    // ... API call
    loading.value = false
  }
  
  return { items, loading, count, fetchItems }
})
```

### SSR-Safe 代码

```vue
<script setup>
const isClient = ref(false)

onMounted(() => {
  isClient.value = true
  // 客户端代码在这里执行
  localStorage.setItem('key', 'value')
})
</script>

<template>
  <ClientOnly>
    <!-- 只在客户端渲染 -->
    <BrowserOnlyComponent />
  </ClientOnly>
</template>
```

### 错误边界

```vue
<script setup>
const error = ref<Error | null>(null)

onErrorCaptured((err) => {
  error.value = err
  return false  // 阻止错误传播
})
</script>
```

---

## 📊 性能指标

### 健康检查清单

- [ ] `node_modules` 数量 < 5
- [ ] 工作区数量 < 10
- [ ] VS Code 内存 < 1.5GB
- [ ] 文件搜索响应 < 1秒
- [ ] 类型检查 < 10秒

### 警告信号

⚠️ **黄色警告**
- VS Code 内存 > 1GB
- 工作区数量 > 8
- 启动时间 > 30秒

🚨 **红色警报**
- VS Code 内存 > 2GB
- 工作区数量 > 15
- TypeScript 服务崩溃

---

## 🔗 相关文档

- [工作区管理](./workspace-management.md)
- [架构知识库](./architecture/)
- [Architecture Decision Records](./architecture/)

---

## 💡 小技巧

1. **快速切换项目**: `Ctrl+R` (VS Code) 打开最近项目
2. **查找文件**: `Ctrl+P` 文件名
3. **查找符号**: `Ctrl+Shift+O` 函数/变量名
4. **全局搜索**: `Ctrl+Shift+F`（排除 node_modules 后很快）
5. **终端分屏**: `Ctrl+Shift+5` 垂直分屏

---

*打印出来贴在显示器旁边！*

# AgentHive Cloud - 前端项目

AgentHive Cloud 的前端应用程序，基于 Vue 3 + TypeScript + Element Plus 构建。

## 技术栈

- **Vue 3** - 渐进式 JavaScript 框架
- **TypeScript** - 类型安全的 JavaScript 超集
- **Element Plus** - Vue 3 的 UI 组件库
- **Pinia** - Vue 的状态管理方案
- **Vue Router** - Vue 的官方路由管理器
- **Monaco Editor** - 代码编辑器（VS Code 同款）
- **xterm.js** - 终端模拟器
- **Socket.io Client** - WebSocket 实时通信
- **Axios** - HTTP 客户端

## 项目结构

```
src/
├── api/              # API 接口封装
│   ├── client.ts     # Axios 实例配置
│   ├── agents.ts     # Agent API
│   ├── tasks.ts      # 任务 API
│   ├── code.ts       # 代码文件 API
│   └── auth.ts       # 认证 API
├── components/       # 公共组件
│   ├── agent/        # Agent 相关组件
│   ├── code/         # 代码编辑器组件
│   ├── layout/       # 布局组件
│   └── terminal/     # 终端组件
├── stores/           # Pinia 状态管理
│   ├── agent.ts      # Agent Store
│   ├── task.ts       # Task Store
│   ├── websocket.ts  # WebSocket Store
│   └── code.ts       # Code Store
├── views/            # 页面视图
│   ├── Dashboard.vue      # 仪表板
│   ├── AgentDetail.vue    # Agent 详情
│   ├── TaskBoard.vue      # 任务看板
│   ├── CodeViewer.vue     # 代码查看
│   ├── TerminalView.vue   # 终端
│   ├── ChatView.vue       # 对话
│   ├── SprintBoard.vue    # Sprint 管理
│   ├── Settings.vue       # 设置
│   └── Login.vue          # 登录
├── router/           # 路由配置
├── types/            # TypeScript 类型定义
├── utils/            # 工具函数
└── styles/           # 全局样式
```

## 功能特性

### ✅ 已完成功能

1. **完善的 API 对接**
   - RESTful API 封装（agents, tasks, code, auth）
   - WebSocket 实时通信
   - 请求/响应拦截器
   - 错误处理和自动重试

2. **Monaco Editor 代码编辑器**
   - 完整的语言支持（TypeScript, JavaScript, Go, Python 等）
   - Worker 配置优化
   - 自动语言检测
   - 代码格式化支持

3. **xterm.js 终端**
   - 命令历史功能（↑↓ 键浏览）
   - Tab 自动补全
   - 暂停/继续输出
   - 本地存储历史记录

4. **Dashboard 数据展示**
   - 实时统计卡片
   - Agent 概览列表
   - 最近任务展示
   - 系统状态监控
   - 活动日志
   - 自动刷新功能

5. **Agent 创建表单验证**
   - 完整的表单验证规则
   - 角色自动配置资源
   - 环境变量管理
   - 高级配置选项

6. **代码编辑器文件切换**
   - 树形文件浏览器
   - 多标签页支持
   - 文件搜索功能
   - 文件下载

7. **响应式布局优化**
   - 移动端适配
   - 侧边栏折叠
   - 触摸优化
   - 断点适配

## 快速开始

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

### 构建生产版本

```bash
npm run build
```

### 类型检查

```bash
npm run type-check
```

## 环境变量

在项目根目录创建 `.env` 文件：

```env
# API 基础 URL
VITE_API_BASE_URL=/api

# WebSocket URL
VITE_WS_URL=/ws
```

## 开发指南

### 添加新页面

1. 在 `src/views/` 下创建 Vue 组件
2. 在 `src/router/index.ts` 中添加路由
3. 在 `src/components/layout/Sidebar.vue` 中添加菜单项（如需）

### 添加新 API

1. 在 `src/api/` 下创建 API 文件
2. 在 `src/api/index.ts` 中导出
3. 创建对应的 Store（如需）

### 使用组件

```vue
<template>
  <CodeEditor
    v-model="code"
    :file-name="'example.ts'"
    :language="'typescript'"
  />
</template>

<script setup lang="ts">
import { CodeEditor } from '@/components/code'
</script>
```

## 浏览器兼容性

- Chrome >= 88
- Firefox >= 78
- Safari >= 14
- Edge >= 88

## 许可证

MIT License

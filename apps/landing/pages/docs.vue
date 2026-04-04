<template>
  <div class="pt-24 pb-20">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="text-center max-w-3xl mx-auto mb-16">
        <h1 class="text-4xl font-bold text-gray-900 mb-4">文档</h1>
        <p class="text-xl text-gray-600">
          快速上手 AgentHive Cloud，构建您的 AI 开发团队
        </p>
      </div>
      
      <!-- 文档卡片 -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        <DocCard
          v-for="doc in docs"
          :key="doc.title"
          :doc="doc"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
useSeoMeta({
  title: '文档',
  description: 'AgentHive Cloud 官方文档和教程',
})

const docs = [
  {
    title: 'Vue3 Agent 构建指南',
    description: 'Vue3 前端开发中 AI Agent 的选型、构建流程与最佳实践',
    icon: 'Book',
    link: '/docs/vue3-agent-guide'
  },
  {
    title: '快速开始',
    description: '5 分钟上手 AgentHive Cloud',
    icon: 'Rocket',
    link: '/docs/quickstart'
  },
  {
    title: '核心概念',
    description: '了解 Agent、Task、Workflow 等核心概念',
    icon: 'Book',
    link: '/docs/concepts'
  },
  {
    title: 'Agent 管理',
    description: '学习如何创建和管理 AI Agent',
    icon: 'Users',
    link: '/docs/agents'
  },
  {
    title: '任务调度',
    description: '掌握任务分配和调度策略',
    icon: 'Task',
    link: '/docs/tasks'
  },
  {
    title: '代码查看',
    description: '使用代码编辑器查看和管理代码',
    icon: 'Code',
    link: '/docs/code'
  },
  {
    title: 'API 参考',
    description: '完整的 API 文档',
    icon: 'API',
    link: '/docs/api'
  }
]
</script>

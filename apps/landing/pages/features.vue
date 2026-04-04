<template>
  <div class="pt-24 pb-20">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="text-center max-w-3xl mx-auto mb-16">
        <h1 class="text-4xl font-bold text-gray-900 mb-4">功能特性</h1>
        <p class="text-xl text-gray-600">
          全方位的 AI 团队管理功能，让软件开发更智能
        </p>
      </div>
      
      <!-- 详细功能列表 -->
      <div class="space-y-20">
        <FeatureDetail
          v-for="(feature, index) in featureDetails"
          :key="feature.title"
          :feature="feature"
          :reversed="index % 2 === 1"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
useSeoMeta({
  title: '功能特性',
  description: '了解 AgentHive Cloud 的全方位 AI 团队管理功能',
})

const featureDetails = [
  {
    title: '多 Agent 协作',
    description: '支持多种专业角色的 AI Agent，包括 Director、Tech Lead、Frontend Dev、Backend Dev、QA Engineer 等。每个 Agent 都有明确的职责和专业领域。',
    features: ['角色专业化', '协作工作流', '任务自动分配', '进度实时同步']
  },
  {
    title: '可视化看板',
    description: '直观的任务管理界面，支持看板视图、列表视图，实时掌握项目进展。支持 Sprint 规划和敏捷开发流程。',
    features: ['看板视图', 'Sprint 管理', '燃尽图', 'Velocity 追踪']
  },
  {
    title: '实时代码编辑',
    description: '集成 Monaco Editor，实时查看和编辑 Agent 生成的代码。支持语法高亮、代码对比、版本历史等功能。',
    features: ['Monaco Editor', '代码对比', '语法高亮', '版本历史']
  },
  {
    title: '终端监控',
    description: '每个 Agent 拥有独立的终端会话，实时监控执行日志和输出。支持命令执行和交互式调试。',
    features: ['多终端会话', '实时日志', '命令执行', '交互式调试']
  }
]
</script>

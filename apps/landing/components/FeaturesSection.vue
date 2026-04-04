<template>
  <section class="py-20 bg-gray-50">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <!-- 标题 -->
      <div class="text-center max-w-3xl mx-auto mb-16">
        <h2 class="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
          全方位 AI 团队管理
        </h2>
        <p class="text-xl text-gray-600">
          从需求分析到代码交付，全程可视化管理
        </p>
      </div>
      
      <!-- 功能卡片 -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        <FeatureCard
          v-for="feature in features"
          :key="feature.title"
          :icon="feature.icon"
          :title="feature.title"
          :description="feature.description"
        />
      </div>
    </div>
  </section>
</template>

<script setup>
const features = [
  {
    icon: 'Users',
    title: '多 Agent 协作',
    description: '支持 Director、Tech Lead、Frontend Dev、Backend Dev、QA 等多种角色，像管理真实团队一样管理 AI Agent。'
  },
  {
    icon: 'Task',
    title: '任务看板',
    description: '可视化的任务管理，支持 Sprint 规划、任务分配、进度跟踪，实时掌握项目进展。'
  },
  {
    icon: 'Code',
    title: '实时代码查看',
    description: '集成 Monaco Editor，实时查看 Agent 编写的代码，支持语法高亮和代码对比。'
  },
  {
    icon: 'Terminal',
    title: '终端监控',
    description: '每个 Agent 拥有独立的终端会话，实时监控执行日志和输出。'
  },
  {
    icon: 'Chat',
    title: '团队对话',
    description: '内置聊天系统，支持与 Agent 团队实时沟通，协调开发任务。'
  },
  {
    icon: 'Sprint',
    title: 'Sprint 管理',
    description: '支持敏捷开发流程，Sprint 规划、燃尽图、 velocity 追踪一应俱全。'
  }
]
</script>

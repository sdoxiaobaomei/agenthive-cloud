<template>
  <section class="py-24" style="background: var(--ah-bg-page);">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <!-- 标题 -->
      <div class="text-center max-w-3xl mx-auto mb-16">
        <h2 class="text-3xl sm:text-4xl font-semibold text-[var(--ah-text-primary)] mb-4" style="font-family: 'IBM Plex Sans', sans-serif;">
          构建、发布、盈利，一站式完成
        </h2>
        <p class="text-lg sm:text-xl text-[var(--ah-grey-500)]">
          从 idea 到上线产品，AgentHive 团队帮你全程搞定
        </p>
      </div>

      <!-- 功能卡片 -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div
          v-for="feature in features"
          :key="feature.title"
          class="feature-card p-6 rounded-2xl transition-all duration-200 hover:-translate-y-0.5"
        >
          <div class="w-11 h-11 rounded-xl flex items-center justify-center text-xl mb-5" :style="{ background: feature.bg, color: feature.color }">
            {{ feature.emoji }}
          </div>
          <h3 class="text-lg font-semibold text-[var(--ah-text-primary)] mb-2" style="font-family: 'IBM Plex Sans', sans-serif;">{{ feature.title }}</h3>
          <p class="text-[var(--ah-grey-500)] text-sm leading-relaxed">{{ feature.description }}</p>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
const features = [
  {
    emoji: '🎨',
    title: '可视化 Studio',
    description: '拖拽式界面，实时预览 Agent 工作成果，像 Figma 一样管理你的 AI 团队。',
    bg: 'rgba(255, 138, 61, 0.08)',
    color: '#ff8a3d'
  },
  {
    emoji: '⚡',
    title: '极速上线',
    description: '几分钟内获得可运行的页面和功能，不再等待数周的开发周期。',
    bg: 'rgba(66, 103, 255, 0.08)',
    color: '#4267ff'
  },
  {
    emoji: '🤖',
    title: '多 Agent 协作',
    description: '架构师、前端、后端、QA 多角色并行工作，讨论后输出可靠代码。',
    bg: 'rgba(232, 142, 255, 0.08)',
    color: '#c068d2'
  },
  {
    emoji: '🔌',
    title: '即插即用后端',
    description: '内置用户认证、数据库、API 托管，无需手动配置基础设施。',
    bg: 'rgba(62, 211, 185, 0.08)',
    color: '#3ed3b9'
  },
  {
    emoji: '🏁',
    title: '竞速模式',
    description: '同一个任务交给多个模型竞赛，自动选择最佳实现方案。',
    bg: 'rgba(244, 221, 114, 0.15)',
    color: '#d4ac0d'
  },
  {
    emoji: '🔒',
    title: '完全可控',
    description: '随时导出代码、同步到 GitHub，产品所有权始终在你手中。',
    bg: 'rgba(106, 106, 108, 0.08)',
    color: '#6a6a6c'
  }
]
</script>

<style scoped>
.feature-card {
  background: var(--ah-beige-50);
  border: 1px solid var(--ah-beige-200);
}
.feature-card:hover {
  border-color: var(--ah-beige-300);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
}
</style>

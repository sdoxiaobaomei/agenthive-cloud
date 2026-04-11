<template>
  <section class="py-24" style="background: var(--ah-beige-200);">
    <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="text-center max-w-3xl mx-auto mb-16">
        <h2 class="text-3xl sm:text-4xl font-semibold text-[var(--ah-text-primary)] mb-4" style="font-family: 'IBM Plex Sans', sans-serif;">
          SOP 驱动的工作流程
        </h2>
        <p class="text-lg text-[var(--ah-grey-500)]">
          借鉴 MetaGPT 的多智能体协作模式，标准化开发流程
        </p>
      </div>

      <div class="relative">
        <!-- 流程线 -->
        <div class="hidden md:block absolute top-8 left-0 right-0 h-0.5" style="background: var(--ah-beige-300);" />

        <!-- 流程步骤 -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-8 relative">
          <div
            v-for="(step, index) in steps"
            :key="step.title"
            class="relative flex flex-col items-center text-center"
          >
            <div class="w-16 h-16 rounded-full flex items-center justify-center text-white font-semibold text-lg relative z-10 mb-4 shadow-sm" style="background: var(--ah-primary-500); font-family: 'IBM Plex Sans', sans-serif;">
              {{ index + 1 }}
            </div>
            <h3 class="text-lg font-semibold text-[var(--ah-text-primary)] mb-2">{{ step.title }}</h3>
            <p class="text-sm text-[var(--ah-grey-500)]">{{ step.description }}</p>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
const steps = [
  {
    title: '需求分析',
    description: 'Director Agent 分析需求，产出 PRD 文档'
  },
  {
    title: '架构设计',
    description: 'Tech Lead Agent 设计系统架构和 API'
  },
  {
    title: '代码开发',
    description: 'Frontend/Backend Agent 并行开发'
  },
  {
    title: '测试评审',
    description: 'QA Agent 执行测试，确保代码质量'
  }
]
</script>

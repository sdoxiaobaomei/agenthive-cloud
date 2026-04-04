<template>
  <section class="py-20">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="text-center max-w-3xl mx-auto mb-16">
        <h2 class="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
          SOP 驱动的工作流程
        </h2>
        <p class="text-xl text-gray-600">
          借鉴 MetaGPT 的多智能体协作模式，标准化开发流程
        </p>
      </div>
      
      <div class="relative">
        <!-- 流程线 -->
        <div class="hidden md:block absolute top-1/2 left-0 right-0 h-1 bg-gray-200 -translate-y-1/2" />
        
        <!-- 流程步骤 -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-8 relative">
          <WorkflowStep
            v-for="(step, index) in steps"
            :key="step.title"
            :step="step"
            :index="index"
          />
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
const steps = [
  {
    title: '需求分析',
    description: 'Director Agent 分析需求，产出 PRD 文档',
    icon: 'Document'
  },
  {
    title: '架构设计',
    description: 'Tech Lead Agent 设计系统架构和 API',
    icon: 'Architecture'
  },
  {
    title: '代码开发',
    description: 'Frontend/Backend Agent 并行开发',
    icon: 'Code'
  },
  {
    title: '测试评审',
    description: 'QA Agent 执行测试，确保代码质量',
    icon: 'Check'
  }
]
</script>

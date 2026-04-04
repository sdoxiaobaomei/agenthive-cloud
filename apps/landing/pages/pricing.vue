<template>
  <div class="pt-24 pb-20">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="text-center max-w-3xl mx-auto mb-16">
        <h1 class="text-4xl font-bold text-gray-900 mb-4">定价方案</h1>
        <p class="text-xl text-gray-600">
          选择适合您的方案，开始构建 AI 开发团队
        </p>
      </div>
      
      <!-- 定价卡片 -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
        <PricingCard
          v-for="plan in plans"
          :key="plan.name"
          :plan="plan"
        />
      </div>
      
      <!-- FAQ -->
      <div class="mt-20 max-w-3xl mx-auto">
        <h2 class="text-2xl font-bold text-gray-900 text-center mb-8">常见问题</h2>
        <div class="space-y-4">
          <div v-for="faq in faqs" :key="faq.q" class="bg-gray-50 rounded-lg p-6">
            <h3 class="font-semibold text-gray-900 mb-2">{{ faq.q }}</h3>
            <p class="text-gray-600">{{ faq.a }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
useSeoMeta({
  title: '定价',
  description: '选择适合您的 AgentHive Cloud 定价方案',
})

const plans = [
  {
    name: '免费版',
    price: '¥0',
    period: '/月',
    description: '适合个人开发者和小型项目',
    features: ['3 个 AI Agent', '5 个并发任务', '基础代码编辑', '社区支持'],
    cta: '免费开始',
    popular: false
  },
  {
    name: '专业版',
    price: '¥299',
    period: '/月',
    description: '适合中小型团队',
    features: ['10 个 AI Agent', '20 个并发任务', '高级代码编辑', '团队协作', '优先支持'],
    cta: '开始试用',
    popular: true
  },
  {
    name: '企业版',
    price: '定制',
    period: '',
    description: '适合大型企业',
    features: ['无限 AI Agent', '无限并发任务', '私有化部署', '专属客服', 'SLA 保障'],
    cta: '联系销售',
    popular: false
  }
]

const faqs = [
  {
    q: '免费版有什么限制？',
    a: '免费版支持最多 3 个 AI Agent 和 5 个并发任务，适合个人开发者和小型项目试用。'
  },
  {
    q: '可以随时升级或降级吗？',
    a: '是的，您可以随时升级或降级您的方案，费用会按比例计算。'
  },
  {
    q: '企业版支持私有化部署吗？',
    a: '是的，企业版支持私有化部署，满足企业的安全和合规要求。'
  }
]
</script>

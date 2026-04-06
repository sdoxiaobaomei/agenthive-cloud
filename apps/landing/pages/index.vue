<template>
  <div class="landing-page" style="background: var(--ah-bg-page);">
    <!-- Hero -->
    <OrganismsHeroSection />

    <!-- Feature Highlights -->
    <FeaturesSection />

    <!-- Workflow -->
    <WorkflowSection />

    <!-- CTA -->
    <CTASection />
  </div>
</template>

<script setup>
useSeoMeta({
  title: 'AgentHive Cloud - AI驱动的智能开发团队管理平台',
  description: 'AgentHive Cloud 帮助您管理和协调多个 AI Agent，像管理真实团队一样管理 AI 开发者，实现自动化软件开发。',
  ogTitle: 'AgentHive Cloud - AI驱动的智能开发团队管理平台',
  ogDescription: '管理和协调多个AI Agent，实现自动化软件开发',
  ogImage: '/og-image.png',
  twitterCard: 'summary_large_image',
})
</script>

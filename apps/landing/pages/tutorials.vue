<template>
  <div class="min-h-screen pt-20 pb-12">
    <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
      <h1 class="text-4xl font-bold text-gray-900 mb-8">教程</h1>
      <div class="grid gap-6">
        <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 class="text-xl font-semibold text-gray-900 mb-3">快速入门指南</h2>
          <p class="text-gray-600 mb-4">5 分钟了解如何创建您的第一个 AI 团队。</p>
          <NuxtLink to="/docs" class="text-primary-600 font-medium hover:text-primary-700">
            查看文档 →
          </NuxtLink>
        </div>
        <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 class="text-xl font-semibold text-gray-900 mb-3">Agent 角色配置教程</h2>
          <p class="text-gray-600 mb-4">深入了解不同 Agent 角色的职责和配置方法。</p>
          <NuxtLink to="/docs" class="text-primary-600 font-medium hover:text-primary-700">
            查看文档 →
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
useHead({
  title: '教程 - AgentHive Cloud'
})
</script>

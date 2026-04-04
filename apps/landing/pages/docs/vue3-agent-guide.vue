<template>
  <div class="pt-20 pb-0 min-h-screen flex flex-col">
    <!-- Page header -->
    <div class="bg-white border-b border-gray-200">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div class="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <NuxtLink to="/docs" class="hover:text-primary-600 transition-colors">文档</NuxtLink>
          <span>/</span>
          <span class="text-gray-900">Vue3 前端 Agent 构建指南</span>
        </div>
        <h1 class="text-2xl sm:text-3xl font-bold text-gray-900">
          Vue3 前端 Agent 构建与使用完整指南
        </h1>
        <p class="mt-2 text-gray-600 max-w-3xl">
          一份涵盖 Vue3 前端开发中 AI Agent 选型、构建流程、最佳实践与常见问题解决的完整参考手册。
        </p>
      </div>
    </div>

    <!-- iframe container -->
    <div class="flex-1 bg-gray-50">
      <iframe
        src="/guides/vue3-agent-build.html"
        class="w-full h-full min-h-[calc(100vh-12rem)] block"
        title="Vue3 前端 Agent 构建与使用完整指南"
        loading="lazy"
      />
    </div>
  </div>
</template>

<script setup>
useSeoMeta({
  title: 'Vue3 前端 Agent 构建与使用完整指南',
  description: '涵盖 Vue3 前端开发中 AI Agent 选型、构建流程、最佳实践与常见问题解决的完整参考手册。',
  ogTitle: 'Vue3 前端 Agent 构建与使用完整指南',
  ogDescription: '涵盖 Vue3 前端开发中 AI Agent 选型、构建流程、最佳实践与常见问题解决的完整参考手册。',
})
</script>

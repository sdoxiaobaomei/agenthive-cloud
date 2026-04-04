<template>
  <section class="relative pt-32 pb-20 lg:pt-40 lg:pb-32 overflow-hidden">
    <!-- 背景装饰 -->
    <div class="absolute inset-0 -z-10">
      <div class="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-gradient-to-b from-primary-100/50 to-transparent rounded-full blur-3xl" />
    </div>
    
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="text-center max-w-4xl mx-auto">
        <!-- 标签 -->
        <div class="inline-flex items-center gap-2 px-4 py-2 bg-primary-50 text-primary-700 rounded-full text-sm font-medium mb-8">
          <span class="flex h-2 w-2 rounded-full bg-primary-500 animate-pulse" />
          现已开放注册
        </div>
        
        <!-- 标题 -->
        <h1 class="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight mb-6">
          构建您的
          <span class="text-transparent bg-clip-text bg-gradient-to-r from-primary-500 to-primary-700">
            AI 开发团队
          </span>
        </h1>
        
        <!-- 副标题 -->
        <p class="text-xl text-gray-600 mb-10 max-w-2xl mx-auto">
          AgentHive Cloud 帮助您管理和协调多个 AI Agent，像管理真实团队一样管理 AI 开发者，实现自动化软件开发。
        </p>
        
        <!-- CTA 按钮 -->
        <div class="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a 
            href="/app/dashboard"
            class="w-full sm:w-auto bg-primary-500 text-white px-8 py-4 rounded-xl font-semibold text-lg hover:bg-primary-600 transition-all hover:shadow-lg hover:shadow-primary-500/25"
          >
            免费开始使用
          </a>
          <NuxtLink 
            to="/studio"
            class="w-full sm:w-auto bg-white text-gray-700 border border-gray-200 px-8 py-4 rounded-xl font-semibold text-lg hover:bg-gray-50 transition-all"
          >
            进入 AI Studio
          </NuxtLink>
        </div>
        
        <!-- 统计数据 -->
        <div class="grid grid-cols-3 gap-8 mt-16 pt-16 border-t border-gray-100">
          <div>
            <div class="text-3xl sm:text-4xl font-bold text-gray-900">10x</div>
            <div class="text-gray-600 mt-1">开发效率提升</div>
          </div>
          <div>
            <div class="text-3xl sm:text-4xl font-bold text-gray-900">50+</div>
            <div class="text-gray-600 mt-1">企业用户</div>
          </div>
          <div>
            <div class="text-3xl sm:text-4xl font-bold text-gray-900">99.9%</div>
            <div class="text-gray-600 mt-1">服务可用性</div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
// Hero 区域
</script>

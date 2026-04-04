<template>
  <header class="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between h-16">
        <!-- Logo -->
        <NuxtLink to="/" class="flex items-center gap-2">
          <div class="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center">
            <span class="text-white font-bold text-lg">A</span>
          </div>
          <span class="text-xl font-bold text-gray-900">AgentHive</span>
        </NuxtLink>
        
        <!-- 桌面端导航 -->
        <nav class="hidden md:flex items-center gap-8">
          <NuxtLink to="/studio" class="text-primary-600 font-medium hover:text-primary-700 transition-colors">
            🎨 AI Studio
          </NuxtLink>
          <NuxtLink to="/features" class="text-gray-600 hover:text-primary-600 transition-colors">
            功能特性
          </NuxtLink>
          <NuxtLink to="/docs" class="text-gray-600 hover:text-primary-600 transition-colors">
            文档
          </NuxtLink>
          <NuxtLink to="/pricing" class="text-gray-600 hover:text-primary-600 transition-colors">
            定价
          </NuxtLink>
        </nav>
        
        <!-- CTA 按钮 -->
        <div class="hidden md:flex items-center gap-4">
          <a 
            href="/app/dashboard" 
            class="text-gray-600 hover:text-primary-600 transition-colors"
          >
            登录
          </a>
          <a 
            href="/app/dashboard"
            class="bg-primary-500 text-white px-4 py-2 rounded-lg hover:bg-primary-600 transition-colors"
          >
            开始使用
          </a>
        </div>
        
        <!-- 移动端菜单按钮 -->
        <button 
          class="md:hidden p-2"
          @click="mobileMenuOpen = !mobileMenuOpen"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path v-if="!mobileMenuOpen" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
            <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
    
    <!-- 移动端菜单 -->
    <div v-if="mobileMenuOpen" class="md:hidden bg-white border-t border-gray-100">
      <div class="px-4 py-4 space-y-3">
        <NuxtLink to="/studio" class="block text-primary-600 font-medium hover:text-primary-700">
          🎨 AI Studio
        </NuxtLink>
        <NuxtLink to="/features" class="block text-gray-600 hover:text-primary-600">
          功能特性
        </NuxtLink>
        <NuxtLink to="/docs" class="block text-gray-600 hover:text-primary-600">
          文档
        </NuxtLink>
        <NuxtLink to="/pricing" class="block text-gray-600 hover:text-primary-600">
          定价
        </NuxtLink>
        <div class="pt-3 border-t border-gray-100 space-y-2">
          <a href="/app/dashboard" class="block text-gray-600">
            登录
          </a>
          <a 
            href="/app/dashboard"
            class="block bg-primary-500 text-white px-4 py-2 rounded-lg text-center"
          >
            开始使用
          </a>
        </div>
      </div>
    </div>
  </header>
</template>

<script setup>
const mobileMenuOpen = ref(false)
</script>

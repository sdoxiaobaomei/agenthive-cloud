<template>
  <div class="min-h-screen bg-white">
    <!-- 导航栏 -->
    <AppHeader />
    
    <!-- 主要内容 -->
    <main>
      <slot />
    </main>
    
    <!-- 页脚 -->
    <AppFooter />
  </div>
</template>

<script setup>
// 默认布局
</script>

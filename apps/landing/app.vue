<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
  
  <!-- 全局 Loading 遮罩层 -->
  <GlobalLoading />
</template>

<script setup>
import '~/assets/css/tailwind.css'
// SEO 元数据
useHead({
  htmlAttrs: {
    lang: 'zh-CN',
  },
  link: [
    {
      rel: 'preconnect',
      href: 'https://fonts.googleapis.com',
    },
    {
      rel: 'preconnect',
      href: 'https://fonts.gstatic.com',
      crossorigin: '',
    },
    {
      rel: 'stylesheet',
      href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
    },
  ],
})
</script>

<style>
html {
  scroll-behavior: smooth;
}

body {
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
}

/* 页面过渡动画 - 左右滑动 */
.page-enter-active,
.page-leave-active {
  transition: all 0.3s ease;
}

.page-enter-from {
  opacity: 0;
  transform: translateX(20px);
}

.page-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}

/* 布局过渡动画 */
.layout-enter-active,
.layout-leave-active {
  transition: all 0.3s ease;
}

.layout-enter-from {
  opacity: 0;
  transform: translateX(20px);
}

.layout-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}
</style>

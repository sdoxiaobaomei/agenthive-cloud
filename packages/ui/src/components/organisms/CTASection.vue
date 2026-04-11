<template>
  <section class="py-24" style="background: var(--ah-grey-900);">
    <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
      <h2 class="text-3xl sm:text-4xl font-semibold text-white mb-4" style="font-family: 'IBM Plex Sans', sans-serif;">
        准备好构建你的 AI 团队了吗？
      </h2>
      <p class="text-lg text-[var(--ah-grey-300)] mb-10">
        立即开始使用 AgentHive，体验 AI 驱动的软件开发
      </p>
      <div class="flex flex-col sm:flex-row items-center justify-center gap-4">
        <NuxtLink
          to="/chat"
          class="w-full sm:w-auto px-8 py-3.5 rounded-full font-medium text-base text-[var(--ah-grey-900)] hover:opacity-90 transition-opacity"
          style="background: white; font-family: 'IBM Plex Sans', sans-serif;"
        >
          免费开始
        </NuxtLink>
        <NuxtLink
          to="/studio"
          class="w-full sm:w-auto px-8 py-3.5 rounded-full font-medium text-base text-white border border-[var(--ah-grey-600)] hover:bg-[var(--ah-grey-800)] transition-colors"
          style="font-family: 'IBM Plex Sans', sans-serif;"
        >
          进入 Studio
        </NuxtLink>
      </div>
    </div>
  </section>
</template>

<script setup>
</script>

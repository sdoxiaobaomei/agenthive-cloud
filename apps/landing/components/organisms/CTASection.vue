<template>
  <section class="py-24" style="background: var(--ah-bg-page);">
    <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="text-center p-12 rounded-3xl" style="background: linear-gradient(135deg, #4267ff 0%, #3151cc 100%);">
        <h2 class="text-3xl sm:text-4xl font-bold text-white mb-4" style="font-family: 'IBM Plex Sans', sans-serif;">
          准备好开始了吗？
        </h2>
        <p class="text-lg text-white/80 mb-8 max-w-xl mx-auto">
          加入数千名开发者，用 AgentHive 加速你的创意落地
        </p>
        <div class="flex flex-col sm:flex-row items-center justify-center gap-4">
          <NuxtLink
            to="/login"
            class="px-8 py-4 rounded-xl font-semibold transition-all duration-200 hover:scale-105"
            style="background: white; color: #4267ff;"
          >
            免费开始使用
          </NuxtLink>
          <NuxtLink
            to="/studio"
            class="px-8 py-4 rounded-xl font-semibold border-2 border-white/30 text-white transition-all duration-200 hover:bg-white/10"
          >
            访客模式体验
          </NuxtLink>
        </div>
      </div>
    </div>
  </section>
</template>

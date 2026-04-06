<template>
  <section class="py-24" style="background: var(--ah-beige-50);">
    <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="text-center max-w-3xl mx-auto mb-16">
        <h2 class="text-3xl sm:text-4xl font-semibold mb-4" style="font-family: 'IBM Plex Sans', sans-serif; color: var(--ah-text-primary);">
          简单三步，从想法到应用
        </h2>
        <p class="text-lg" style="color: var(--ah-grey-500);">
          只需描述需求，剩下的交给柴犬装修队
        </p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
        <!-- 连接线 -->
        <div class="hidden md:block absolute top-16 left-[20%] right-[20%] h-0.5" style="background: linear-gradient(90deg, var(--ah-beige-200) 0%, var(--ah-beige-300) 50%, var(--ah-beige-200) 100%);" />

        <div class="relative text-center">
          <div class="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold mx-auto mb-6 relative z-10" style="background: #4267ff; color: white;">
            1
          </div>
          <h3 class="text-xl font-semibold mb-3" style="color: var(--ah-text-primary);">描述需求</h3>
          <p class="leading-relaxed" style="color: var(--ah-grey-500);">
            用自然语言描述你想构建的应用，越详细越好
          </p>
        </div>

        <div class="relative text-center">
          <div class="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold mx-auto mb-6 relative z-10" style="background: #ff8a3d; color: white;">
            2
          </div>
          <h3 class="text-xl font-semibold mb-3" style="color: var(--ah-text-primary);">AI 团队协作</h3>
          <p class="leading-relaxed" style="color: var(--ah-grey-500);">
            Agent 团队自动分工，并行完成设计、开发、测试
          </p>
        </div>

        <div class="relative text-center">
          <div class="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold mx-auto mb-6 relative z-10" style="background: #22c55e; color: white;">
            3
          </div>
          <h3 class="text-xl font-semibold mb-3" style="color: var(--ah-text-primary);">获取应用</h3>
          <p class="leading-relaxed" style="color: var(--ah-grey-500);">
            审核代码，一键部署上线，或导出到本地
          </p>
        </div>
      </div>
    </div>
  </section>
</template>

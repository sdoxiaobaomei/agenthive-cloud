<template>
  <section class="py-24" style="background: var(--ah-bg-page);">
    <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="text-center max-w-3xl mx-auto mb-16">
        <h2 class="text-3xl sm:text-4xl font-semibold mb-4" style="font-family: 'IBM Plex Sans', sans-serif; color: var(--ah-text-primary);">
          为什么选择 AgentHive
        </h2>
        <p class="text-lg" style="color: var(--ah-grey-500);">
          像管理真实团队一样管理 AI Agent，实现真正的自动化软件开发
        </p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div class="feature-item p-8 rounded-2xl transition-all duration-300" style="background: var(--ah-beige-50); border: 1px solid var(--ah-beige-200);">
          <div class="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl mb-6" style="background: var(--ah-beige-100);">
            🐕
          </div>
          <h3 class="text-xl font-semibold mb-3" style="color: var(--ah-text-primary);">专业 AI 团队</h3>
          <p class="leading-relaxed" style="color: var(--ah-grey-500);">
            每个项目配备专属 AI Agent 团队：技术负责人、前后端开发、测试工程师，协作完成开发任务
          </p>
        </div>

        <div class="feature-item p-8 rounded-2xl transition-all duration-300" style="background: var(--ah-beige-50); border: 1px solid var(--ah-beige-200);">
          <div class="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl mb-6" style="background: var(--ah-beige-100);">
            ⚡
          </div>
          <h3 class="text-xl font-semibold mb-3" style="color: var(--ah-text-primary);">自动化工作流</h3>
          <p class="leading-relaxed" style="color: var(--ah-grey-500);">
            基于 MetaGPT SOP 标准化流程，自动完成需求分析、架构设计、代码编写、测试部署全流程
          </p>
        </div>

        <div class="feature-item p-8 rounded-2xl transition-all duration-300" style="background: var(--ah-beige-50); border: 1px solid var(--ah-beige-200);">
          <div class="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl mb-6" style="background: var(--ah-beige-100);">
            🎨
          </div>
          <h3 class="text-xl font-semibold mb-3" style="color: var(--ah-text-primary);">可视化 Studio</h3>
          <p class="leading-relaxed" style="color: var(--ah-grey-500);">
            实时监控 AI Agent 工作状态，可视化查看代码产出、执行日志和项目进度
          </p>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.feature-item:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.08);
  border-color: var(--ah-beige-300);
}
</style>

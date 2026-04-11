<template>
  <section class="relative min-h-[85vh] flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 overflow-hidden" style="background: var(--ah-bg-page);">
    <!-- Background subtle gradient orbs -->
    <div class="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
      <div class="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full opacity-30" style="background: radial-gradient(ellipse, #ff8a3d 0%, transparent 70%); filter: blur(80px);" />
      <div class="absolute top-1/3 left-1/3 w-[600px] h-[300px] rounded-full opacity-20" style="background: radial-gradient(ellipse, #7d8fff 0%, transparent 70%); filter: blur(80px);" />
    </div>

    <div class="max-w-4xl mx-auto text-center w-full">
      <!-- Shiba Team Avatars above headline -->
      <div class="flex items-center justify-center mb-8">
        <div class="flex items-center -space-x-3">
          <div
            v-for="(role, idx) in shibaRoles"
            :key="role"
            class="w-14 h-14 rounded-full border-2 border-white shadow-sm overflow-hidden bg-[var(--ah-beige-200)]"
            :style="{ zIndex: shibaRoles.length - idx }"
          >
            <ShibaAvatar :role="role" :size="56" />
          </div>
        </div>
      </div>

      <!-- Headline single line -->
      <h1 class="text-4xl sm:text-5xl lg:text-6xl font-semibold leading-tight mb-6" style="font-family: 'IBM Plex Sans', sans-serif; color: var(--ah-text-primary);">
        用 AI 构建产品，无需组建团队
      </h1>

      <!-- Subheadline -->
      <p class="text-lg sm:text-xl text-[var(--ah-grey-500)] mb-10 max-w-2xl mx-auto" style="font-family: 'IBM Plex Sans', sans-serif;">
        告诉 AgentHive 你的想法，让 AI 团队帮你规划、设计、开发并部署上线。
      </p>

      <!-- Chat Input Box with Glow -->
      <div class="relative w-full max-w-[750px] mx-auto mb-12">
        <!-- Glow orbs behind chat box -->
        <div class="absolute top-12 -left-16 -z-10 w-[500px] h-[120px] rounded-full opacity-60 pointer-events-none" style="background: #fe9021; filter: blur(60px);" />
        <div class="absolute top-16 left-1/3 -z-10 w-[500px] h-[120px] rounded-full opacity-50 pointer-events-none" style="background: #1f66ff; filter: blur(80px);" />
        <div class="absolute top-12 -right-24 -z-10 w-[480px] h-[110px] rounded-full opacity-50 pointer-events-none" style="background: #bf00c6; filter: blur(80px);" />

        <div class="chat-box rounded-2xl p-4 sm:p-5 w-full">
          <div class="input-wrap w-full flex flex-col gap-4">
            <textarea
              v-model="prompt"
              rows="3"
              class="w-full bg-transparent text-base sm:text-lg text-[var(--ah-text-primary)] placeholder-[var(--ah-grey-400)] resize-none outline-none"
              style="font-family: 'IBM Plex Sans', sans-serif; min-height: 72px;"
              placeholder="描述你想要构建的产品，例如：帮我做一个会员管理系统..."
            />
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="text-xs text-[var(--ah-grey-400)] px-2 py-1 rounded-md bg-[var(--ah-beige-200)]">Shift + Enter 换行</span>
              </div>
              <NuxtLink
                to="/chat"
                class="send-btn flex items-center justify-center w-10 h-10 rounded-full transition-all"
                :class="prompt.trim() ? 'bg-[var(--ah-grey-900)] text-white' : 'bg-[var(--ah-beige-300)] text-[var(--ah-grey-500)]'"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </NuxtLink>
            </div>
          </div>
        </div>
      </div>

      <!-- Social proof / Quick links -->
      <div class="flex flex-wrap items-center justify-center gap-6 text-sm text-[var(--ah-grey-500)]">
        <div class="flex items-center gap-2">
          <span class="flex h-2 w-2 rounded-full bg-green-500" />
          <span>AI 团队在线</span>
        </div>
        <span>·</span>
        <span>免费开始</span>
        <span>·</span>
        <span>无需信用卡</span>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref } from 'vue'
import ShibaAvatar from '../atoms/ShibaAvatar.vue'

const prompt = ref('')
const shibaRoles = ['orchestrator', 'frontend_dev', 'backend_dev', 'qa_engineer']
</script>

<style scoped>
.chat-box {
  background-color: var(--ah-beige-50);
  border: 1px solid var(--ah-beige-300);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.04);
}

.send-btn {
  transition: all 0.2s ease;
}
</style>

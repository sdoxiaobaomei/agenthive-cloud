<template>
  <header
    class="fixed top-0 left-0 right-0 z-50"
    :class="mode === 'landing' ? 'bg-transparent' : 'bg-[var(--ah-bg-surface)]/95 backdrop-blur-md border-b border-[var(--ah-border-default)]'"
  >
    <div :class="mode === 'landing' ? 'w-full px-6 sm:px-10 lg:px-16' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'">
      <div class="flex items-center justify-between h-16">
        <!-- Logo -->
        <NuxtLink to="/" class="flex items-center gap-2">
          <div class="w-8 h-8 bg-[var(--ah-primary-500)] rounded-lg flex items-center justify-center">
            <span class="text-white font-bold text-lg" style="font-family: 'IBM Plex Sans', sans-serif;">A</span>
          </div>
          <span class="text-xl font-semibold text-[var(--ah-text-primary)]" style="font-family: 'IBM Plex Sans', sans-serif;">AgentHive</span>
        </NuxtLink>

        <!-- Capsule Nav - Landing only -->
        <nav v-if="mode === 'landing'" class="hidden md:flex items-center h-8 rounded-full px-4 gap-2" style="background: rgba(0,0,0,0.04); backdrop-filter: blur(8px);">
          <NuxtLink to="/pricing" class="text-sm font-medium text-[var(--ah-grey-600)] hover:text-[var(--ah-grey-900)] transition-colors px-2 py-1">定价</NuxtLink>
          
          <!-- More Dropdown -->
          <div class="relative more-dropdown">
            <button
              class="text-sm font-medium text-[var(--ah-grey-600)] hover:text-[var(--ah-grey-900)] transition-colors px-2 py-1 flex items-center gap-1"
              @mouseenter="moreOpen = true"
              @mouseleave="moreOpen = false"
            >
              更多
              <svg class="w-3.5 h-3.5 transition-transform" :class="{ 'rotate-180': moreOpen }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <div
              v-show="moreOpen"
              class="absolute right-0 top-full mt-2 w-36 rounded-xl border border-[var(--ah-beige-300)] bg-[var(--ah-beige-50)] shadow-lg py-1.5"
              @mouseenter="moreOpen = true"
              @mouseleave="moreOpen = false"
            >
              <NuxtLink to="/studio" class="block px-4 py-2 text-sm text-[var(--ah-grey-600)] hover:text-[var(--ah-grey-900)] hover:bg-[var(--ah-beige-200)] transition-colors">AI Studio</NuxtLink>
              <NuxtLink to="/features" class="block px-4 py-2 text-sm text-[var(--ah-grey-600)] hover:text-[var(--ah-grey-900)] hover:bg-[var(--ah-beige-200)] transition-colors">功能特性</NuxtLink>
              <NuxtLink to="/docs" class="block px-4 py-2 text-sm text-[var(--ah-grey-600)] hover:text-[var(--ah-grey-900)] hover:bg-[var(--ah-beige-200)] transition-colors">文档</NuxtLink>
            </div>
          </div>
        </nav>
        <nav v-else class="hidden md:flex items-center gap-6">
          <NuxtLink to="/app/dashboard" class="text-sm font-medium text-[var(--ah-grey-600)] hover:text-[var(--ah-grey-900)]">Dashboard</NuxtLink>
          <NuxtLink to="/studio" class="text-sm font-medium text-[var(--ah-primary-500)]">Studio</NuxtLink>
          <NuxtLink to="/app/tasks" class="text-sm font-medium text-[var(--ah-grey-600)] hover:text-[var(--ah-grey-900)]">Tasks</NuxtLink>
        </nav>

        <!-- Right side -->
        <div class="flex items-center gap-3">
          <div v-if="showShibaTeam" class="hidden md:flex items-center -space-x-2">
            <ShibaAvatar
              v-for="role in shibaRoles"
              :key="role"
              :role="role"
              :size="28"
              class="border-2 border-white"
            />
          </div>

          <template v-if="mode === 'landing'">
            <NuxtLink to="/login" class="text-sm font-medium text-[var(--ah-grey-600)] hover:text-[var(--ah-grey-900)] px-3 py-1.5">登录</NuxtLink>
            <NuxtLink to="/login" class="text-sm font-medium text-white px-4 py-2 rounded-lg hover:opacity-90 transition-opacity" style="background: var(--ah-primary-500);">注册</NuxtLink>
          </template>
          <template v-else>
            <button v-if="!isAuth" class="text-sm font-medium text-[var(--ah-grey-600)] hover:text-[var(--ah-grey-900)] px-3 py-1.5" @click="$emit('login')">登录</button>
            <div v-else class="w-8 h-8 rounded-full bg-[var(--ah-beige-300)]" />
          </template>
        </div>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import ShibaAvatar from '../atoms/ShibaAvatar.vue'

defineProps<{
  mode: 'landing' | 'studio' | 'app'
  projectName?: string
  isAuth?: boolean
  showShibaTeam?: boolean
}>()

defineEmits<{
  (e: 'login'): void
}>()

const shibaRoles = ['orchestrator', 'frontend_dev', 'backend_dev', 'qa_engineer'] as const
const moreOpen = ref(false)
</script>

<style scoped>
.more-dropdown .rotate-180 {
  transform: rotate(180deg);
}
</style>

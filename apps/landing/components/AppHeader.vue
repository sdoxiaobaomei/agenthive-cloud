<template>
  <header class="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
    :class="isScrolled ? 'bg-white/90 backdrop-blur-md shadow-sm' : 'bg-transparent'"
  >
    <div class="flex items-center h-16">
      <!-- 左侧: Logo (紧贴左边) -->
      <NuxtLink to="/" class="flex items-center gap-2 flex-shrink-0 pl-4 sm:pl-6 lg:pl-8">
        <div class="w-8 h-8 rounded-lg flex items-center justify-center" style="background: #4267ff;">
          <span class="text-white font-bold text-lg">A</span>
        </div>
        <span class="text-lg font-bold" style="font-family: 'IBM Plex Sans', sans-serif; color: var(--ah-text-primary);">
          AgentHive
        </span>
      </NuxtLink>

      <!-- 中间: 导航 (占据中间空间并居中) -->
      <div class="flex-1 flex justify-center items-center">
        <nav v-if="mode === 'landing'" class="hidden md:flex items-center gap-6">
          <!-- 定价: 直接显示 -->
          <NuxtLink to="/pricing" class="text-sm font-medium transition-colors hover:text-[#4267ff]" style="color: var(--ah-grey-500);">
            定价
          </NuxtLink>
          
          <!-- 更多: 下拉菜单 (SSR 安全) -->
          <SafeElementDropdown label="更多" class="inline-flex items-center">
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item>
                  <NuxtLink to="/features" class="text-sm" style="color: var(--ah-grey-600);">功能</NuxtLink>
                </el-dropdown-item>
                <el-dropdown-item>
                  <NuxtLink to="/docs" class="text-sm" style="color: var(--ah-grey-600);">文档</NuxtLink>
                </el-dropdown-item>
                <el-dropdown-item>
                  <NuxtLink to="/blog" class="text-sm" style="color: var(--ah-grey-600);">博客</NuxtLink>
                </el-dropdown-item>
                <el-dropdown-item>
                  <NuxtLink to="/about" class="text-sm" style="color: var(--ah-grey-600);">关于</NuxtLink>
                </el-dropdown-item>
                <el-dropdown-item>
                  <NuxtLink to="/contact" class="text-sm" style="color: var(--ah-grey-600);">联系我们</NuxtLink>
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </SafeElementDropdown>
        </nav>
      </div>

      <!-- 右侧: 操作按钮 (紧贴右边) -->
      <div class="flex items-center gap-3 flex-shrink-0 pr-4 sm:pr-6 lg:pr-8">
        <template v-if="!authenticated">
          <!-- 注册按钮 (登录左侧) -->
          <NuxtLink
            v-if="mode === 'landing'"
            to="/login?tab=register"
            class="hidden sm:block px-4 py-2 rounded-lg text-sm font-medium border transition-all hover:shadow-md"
            style="border-color: #4267ff; color: #4267ff;"
          >
            注册
          </NuxtLink>
          <!-- 登录按钮 (最右侧) -->
          <NuxtLink
            v-if="mode === 'landing'"
            to="/login"
            class="px-4 py-2 rounded-lg text-sm font-medium text-white transition-all hover:shadow-lg"
            style="background: #4267ff;"
          >
            登录
          </NuxtLink>
          <button
            v-if="mode !== 'landing'"
            class="text-sm font-medium transition-colors hover:text-[#4267ff]"
            style="color: var(--ah-grey-500);"
            @click="$emit('login')"
          >
            登录
          </button>
        </template>
        <template v-else>
          <div class="flex items-center gap-2">
            <img
              v-if="user?.avatar"
              :src="user.avatar"
              class="w-8 h-8 rounded-full"
              alt="avatar"
            />
            <div
              v-else
              class="w-8 h-8 rounded-full bg-[#4267ff] flex items-center justify-center text-white text-sm font-medium"
            >
              {{ userInitial }}
            </div>
            <span v-if="user?.name" class="text-sm hidden sm:block" style="color: var(--ah-grey-600);">
              {{ user.name }}
            </span>
            <button
              class="ml-2 text-xs text-gray-400 hover:text-gray-600"
              @click="logout"
            >
              退出
            </button>
          </div>
        </template>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'


withDefaults(defineProps<{
  mode?: 'landing' | 'app' | 'studio'
}>(), {
  mode: 'landing',
})

defineEmits<{
  login: []
}>()

const { isAuthenticated, user, userInitial, logout } = useAuth()

const authenticated = computed(() => isAuthenticated())

const isScrolled = ref(false)

function handleScroll() {
  isScrolled.value = window.scrollY > 20
}

onMounted(() => {
  window.addEventListener('scroll', handleScroll)
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll)
})
</script>

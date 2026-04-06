<template>
  <section class="relative min-h-screen flex items-center justify-center overflow-hidden" style="background: linear-gradient(180deg, #f9f8f6 0%, #f0eeea 100%);">
    <!-- 背景装饰 - 更大气 -->
    <div class="absolute inset-0 pointer-events-none">
      <div class="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full opacity-30" style="background: radial-gradient(circle, rgba(66,103,255,0.15) 0%, transparent 60%); filter: blur(80px);" />
      <div class="absolute bottom-0 right-1/4 w-[800px] h-[800px] rounded-full opacity-30" style="background: radial-gradient(circle, rgba(255,138,61,0.12) 0%, transparent 60%); filter: blur(100px);" />
      <!-- 网格装饰 -->
      <div class="absolute inset-0 opacity-[0.03]" style="background-image: linear-gradient(rgba(66,103,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(66,103,255,0.5) 1px, transparent 1px); background-size: 60px 60px;" />
    </div>

    <div class="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center pt-20">
      <!-- 标签 - 更精致 -->
      <div class="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium mb-10" style="background: rgba(66,103,255,0.08); color: #4267ff; border: 1px solid rgba(66,103,255,0.15);">
        <span class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
        柴犬装修队已就绪
        <span class="ml-1 opacity-60">·</span>
        <span class="opacity-80">AI Agent 团队协作平台</span>
      </div>

      <!-- 标题 - 更大更震撼 -->
      <h1 class="text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-bold mb-8 leading-[1.1] tracking-tight" style="font-family: 'IBM Plex Sans', sans-serif; color: var(--ah-text-primary);">
        <span class="block mb-2">用自然语言</span>
        <span class="block" style="background: linear-gradient(135deg, #4267ff 0%, #6b8cff 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">构建你的应用</span>
      </h1>

      <!-- 描述 - 更大 -->
      <p class="text-xl sm:text-2xl mb-16 max-w-3xl mx-auto leading-relaxed" style="color: var(--ah-grey-500);">
        描述你的需求，让 AI Agent 团队帮你完成从设计到部署的全流程开发
      </p>

      <!-- 聊天输入框 - 更大更醒目 -->
      <div class="max-w-3xl mx-auto">
        <div class="relative p-2 rounded-3xl border-2 transition-all duration-300 shadow-xl"
          :class="isFocused ? 'border-[#4267ff] shadow-2xl shadow-[#4267ff]/15' : 'border-[var(--ah-beige-300)] shadow-xl'"
          style="background: white;"
        >
          <div class="flex items-end gap-3">
            <div class="flex-1 flex items-center gap-3 px-5 py-4">
              <el-icon class="text-2xl" style="color: var(--ah-grey-400);"><EditPen /></el-icon>
              <textarea
                v-model="inputText"
                rows="1"
                placeholder="描述你想构建的应用，例如：帮我做一个任务管理系统..."
                class="flex-1 resize-none outline-none text-lg bg-transparent w-full"
                style="color: var(--ah-text-primary); min-height: 32px; max-height: 160px;"
                @focus="isFocused = true"
                @blur="isFocused = false"
                @keydown.enter.prevent="handleSubmit"
                @input="autoResize"
              />
            </div>
            <button
              @click="handleSubmit"
              :disabled="!inputText.trim() || isLoading"
              class="flex-shrink-0 h-14 px-8 rounded-2xl font-semibold text-white text-lg transition-all duration-200 flex items-center gap-2 m-1"
              :class="inputText.trim() && !isLoading ? 'bg-[#4267ff] hover:bg-[#3151cc] shadow-lg shadow-[#4267ff]/30' : 'bg-gray-300 cursor-not-allowed'"
            >
              <el-icon v-if="isLoading" class="animate-spin"><Loading /></el-icon>
              <template v-else>
                <span>开始构建</span>
                <el-icon><ArrowRight /></el-icon>
              </template>
            </button>
          </div>
        </div>
        
        <!-- 快捷提示 - 更大 -->
        <div class="flex flex-wrap items-center justify-center gap-4 mt-6">
          <span class="text-base" style="color: var(--ah-grey-400);">试试：</span>
          <button
            v-for="prompt in quickPrompts"
            :key="prompt"
            @click="inputText = prompt"
            class="text-base px-4 py-2 rounded-full transition-all duration-200 hover:scale-105"
            style="color: var(--ah-grey-600); background: var(--ah-beige-100); border: 1px solid var(--ah-beige-200);"
          >
            {{ prompt }}
          </button>
        </div>
      </div>

      <!-- 统计数据 - 更大更突出 -->
      <div class="grid grid-cols-3 gap-12 mt-24 max-w-2xl mx-auto">
        <div class="text-center group">
          <div class="text-4xl sm:text-5xl font-bold mb-2 group-hover:scale-110 transition-transform" style="color: var(--ah-primary);">10k+</div>
          <div class="text-base" style="color: var(--ah-grey-500);">项目构建</div>
        </div>
        <div class="text-center group">
          <div class="text-4xl sm:text-5xl font-bold mb-2 group-hover:scale-110 transition-transform" style="color: var(--ah-primary);">50k+</div>
          <div class="text-base" style="color: var(--ah-grey-500);">代码生成</div>
        </div>
        <div class="text-center group">
          <div class="text-4xl sm:text-5xl font-bold mb-2 group-hover:scale-110 transition-transform" style="color: var(--ah-primary);">99%</div>
          <div class="text-base" style="color: var(--ah-grey-500);">成功率</div>
        </div>
      </div>

      <!-- 底部信任标识 -->
      <div class="mt-20 pt-10 border-t" style="border-color: var(--ah-beige-200);">
        <p class="text-sm mb-6" style="color: var(--ah-grey-400);">支持的技术栈</p>
        <div class="flex flex-wrap items-center justify-center gap-8">
          <span class="text-lg font-medium" style="color: var(--ah-grey-600);">Vue.js</span>
          <span class="text-lg font-medium" style="color: var(--ah-grey-600);">React</span>
          <span class="text-lg font-medium" style="color: var(--ah-grey-600);">Node.js</span>
          <span class="text-lg font-medium" style="color: var(--ah-grey-600);">Python</span>
          <span class="text-lg font-medium" style="color: var(--ah-grey-600);">TypeScript</span>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowRight, Loading, EditPen } from '@element-plus/icons-vue'
import { useAuth } from '~/composables/useAuth'

const router = useRouter()
const { isAuthenticated } = useAuth()

const inputText = ref('')
const isFocused = ref(false)
const isLoading = ref(false)

const quickPrompts = [
  '博客系统',
  '电商后台',
  '个人主页',
  '数据看板',
]

function autoResize(e: Event) {
  const target = e.target as HTMLTextAreaElement
  target.style.height = 'auto'
  target.style.height = Math.min(target.scrollHeight, 160) + 'px'
}

async function handleSubmit() {
  const text = inputText.value.trim()
  if (!text || isLoading.value) return

  // 检查登录状态
  if (!isAuthenticated()) {
    sessionStorage.setItem('chat:pending-message', text)
    router.push(`/login?redirect=${encodeURIComponent('/')}`)
    return
  }

  isLoading.value = true
  
  try {
    await new Promise(resolve => setTimeout(resolve, 1000))
    router.push('/studio')
  } catch (error) {
    console.error('Failed to start project:', error)
  } finally {
    isLoading.value = false
  }
}
</script>

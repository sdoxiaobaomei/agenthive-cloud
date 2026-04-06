<template>
  <section class="relative min-h-screen flex items-center justify-center overflow-hidden" style="background: linear-gradient(180deg, #f9f8f6 0%, #f0eeea 100%);">
    <!-- 背景装饰 -->
    <div class="absolute inset-0 pointer-events-none">
      <div class="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full opacity-30" style="background: radial-gradient(circle, rgba(66,103,255,0.15) 0%, transparent 60%); filter: blur(80px);" />
      <div class="absolute bottom-0 right-1/4 w-[800px] h-[800px] rounded-full opacity-30" style="background: radial-gradient(circle, rgba(255,138,61,0.12) 0%, transparent 60%); filter: blur(100px);" />
      <div class="absolute inset-0 opacity-[0.03]" style="background-image: linear-gradient(rgba(66,103,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(66,103,255,0.5) 1px, transparent 1px); background-size: 60px 60px;" />
    </div>

    <div class="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center pt-20">
      <!-- 标签 -->
      <div class="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium mb-8" style="background: rgba(66,103,255,0.08); color: #4267ff; border: 1px solid rgba(66,103,255,0.15);">
        <span class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
        柴犬装修队已就绪
        <span class="ml-1 opacity-60">·</span>
        <span class="opacity-80">AI Agent 团队协作平台</span>
      </div>

      <!-- 柴犬头像组 - 标题上方 -->
      <div class="flex items-center justify-center mb-8">
        <div class="flex items-center -space-x-3">
          <!-- 柴犬头像 -->
          <div 
            v-for="(avatar, index) in avatars" 
            :key="index"
            class="relative w-14 h-14 rounded-full border-3 border-white shadow-lg overflow-hidden cursor-pointer hover:scale-110 hover:z-10 transition-all duration-300"
            :title="avatar.role"
          >
            <img 
              :src="avatar.src" 
              :alt="avatar.role"
              class="w-full h-full object-cover object-center scale-110"
            />
          </div>
          <!-- 添加更多按钮 -->
          <div 
            class="w-14 h-14 rounded-full border-3 border-white shadow-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center cursor-pointer hover:scale-110 hover:z-10 transition-all duration-300 -ml-3"
            title="更多 Agent 即将加入"
          >
            <el-icon class="text-white text-xl font-bold"><Plus /></el-icon>
          </div>
        </div>
      </div>

      <!-- 标题 - 缩小到一行 -->
      <h1 class="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6 leading-tight tracking-tight" style="font-family: 'IBM Plex Sans', sans-serif; color: var(--ah-text-primary);">
        <span style="background: linear-gradient(135deg, #4267ff 0%, #6b8cff 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">用自然语言构建</span>
        <span>你的应用</span>
      </h1>

      <!-- 描述 -->
      <p class="text-lg sm:text-xl mb-12 max-w-2xl mx-auto leading-relaxed" style="color: var(--ah-grey-500);">
        描述你的需求，让 AI Agent 团队帮你完成从设计到部署的全流程开发
      </p>

      <!-- 聊天输入框 - 更大的多行文本区 -->
      <div class="max-w-4xl mx-auto">
        <div class="relative p-5 rounded-[20px] border-2 transition-all duration-300 shadow-xl"
          :class="isFocused ? 'border-[#4267ff] shadow-2xl shadow-[#4267ff]/15' : 'border-[var(--ah-beige-300)] shadow-xl'"
          style="background: white;"
        >
          <!-- 文本输入区 -->
          <div class="flex items-start gap-3 mb-2">
            <div class="flex-1">
              <textarea
                v-model="inputText"
                rows="4"
                placeholder="帮我做一个任务管理系统，支持拖拽排序、标签分类和团队协作，风格要简洁现代。"
                class="w-full resize-none outline-none text-base bg-transparent leading-relaxed"
                style="color: var(--ah-text-primary); min-height: 100px;"
                @focus="isFocused = true"
                @blur="isFocused = false"
                @keydown.enter.ctrl.prevent="handleSubmit"
              />
            </div>
          </div>

          <!-- 底部工具栏：主题选择 + 模型选择 -->
          <div class="flex items-center justify-between pt-2">
            <div class="flex items-center gap-2">
              <!-- 主题选择 -->
              <ClientRender>
                <el-select v-model="selectedTheme" size="small" class="w-20 theme-select">
                  <template #prefix>
                    <span class="w-2 h-2 rounded-full" :style="{ background: themes.find(t => t.value === selectedTheme)?.color }"></span>
                  </template>
                  <el-option
                    v-for="theme in themes"
                    :key="theme.value"
                    :label="theme.label"
                    :value="theme.value"
                  >
                    <div class="flex items-center gap-2">
                      <span class="w-2 h-2 rounded-full" :style="{ background: theme.color }"></span>
                      <span class="text-xs">{{ theme.label }}</span>
                    </div>
                  </el-option>
                </el-select>
              </ClientRender>
              
              <!-- 模型选择 -->
              <ClientRender>
                <el-select v-model="selectedModel" size="small" class="w-24 model-select">
                  <el-option
                    v-for="model in models"
                    :key="model.value"
                    :label="model.label"
                    :value="model.value"
                  >
                    <div class="flex items-center gap-2">
                      <el-icon class="text-xs"><Cpu /></el-icon>
                      <span class="text-xs">{{ model.label }}</span>
                    </div>
                  </el-option>
                </el-select>
              </ClientRender>
            </div>

            <!-- 免费开始按钮 -->
            <button
              @click="handleSubmit"
              :disabled="!inputText.trim() || isLoading"
              class="flex items-center gap-1.5 px-4 py-1.5 rounded-xl font-medium text-xs text-white transition-all duration-200"
              :class="inputText.trim() && !isLoading 
                ? 'bg-gradient-to-r from-[#4267ff] to-[#5a7fff] hover:shadow-lg hover:shadow-blue-500/25 hover:-translate-y-0.5' 
                : 'bg-gray-300 cursor-not-allowed'"
            >
              <el-icon v-if="isLoading" class="animate-spin text-sm"><Loading /></el-icon>
              <span>免费开始</span>
              <el-icon v-if="!isLoading" class="text-sm"><ArrowRight /></el-icon>
            </button>
          </div>
        </div>
        
        <!-- 快捷提示 -->
        <div class="flex flex-wrap items-center justify-center gap-3 mt-5">
          <span class="text-sm" style="color: var(--ah-grey-400);">试试：</span>
          <button
            v-for="prompt in quickPrompts"
            :key="prompt"
            @click="inputText = prompt"
            class="text-sm px-3 py-1.5 rounded-full transition-all duration-200 hover:scale-105"
            style="color: var(--ah-grey-600); background: var(--ah-beige-100); border: 1px solid var(--ah-beige-200);"
          >
            {{ prompt }}
          </button>
        </div>
      </div>

      <!-- 统计数据 -->
      <div class="grid grid-cols-3 gap-12 mt-20 max-w-2xl mx-auto">
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
      <div class="mt-16 pt-8 border-t" style="border-color: var(--ah-beige-200);">
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
import { Plus, Cpu, ArrowRight, Loading } from '@element-plus/icons-vue'
import { useAuth } from '~/composables/useAuth'

const router = useRouter()
const { isAuthenticated } = useAuth()

const inputText = ref('')
const isFocused = ref(false)
const isLoading = ref(false)

// 柴犬头像
const avatars = [
  { src: '/avatars/shiba_tl.png', role: 'Tech Lead - 阿黄' },
  { src: '/avatars/shiba_fe.png', role: 'Frontend Dev - 小花' },
  { src: '/avatars/shiba_be.png', role: 'Backend Dev - 阿铁' },
  { src: '/avatars/shiba_qa.png', role: 'QA Engineer - 阿镜' },
]

// 主题选择
const selectedTheme = ref('modern')
const themes = [
  { value: 'modern', label: '现代', color: '#4267ff' },
  { value: 'minimal', label: '极简', color: '#1a1a1a' },
  { value: 'warm', label: '温暖', color: '#ff8a3d' },
  { value: 'fresh', label: '清新', color: '#10b981' },
]

// 模型选择
const selectedModel = ref('gpt-4o')
const models = [
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
  { value: 'claude-3-5', label: 'Claude 3.5' },
  { value: 'deepseek', label: 'DeepSeek' },
]

const quickPrompts = [
  '博客系统',
  '电商后台',
  '个人主页',
  '数据看板',
]

async function handleSubmit() {
  const text = inputText.value.trim()
  if (!text || isLoading.value) return

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

<style scoped>
/* 头像悬停效果 */
.border-3 {
  border-width: 3px;
}

/* Element Plus Select 样式覆盖 */
:deep(.theme-select .el-input__wrapper),
:deep(.model-select .el-input__wrapper) {
  border-radius: 10px;
  padding: 0 8px;
  min-height: 28px;
}

:deep(.theme-select .el-input__inner),
:deep(.model-select .el-input__inner) {
  font-size: 12px;
}

:deep(.theme-select .el-input__prefix) {
  margin-right: 4px;
}
</style>

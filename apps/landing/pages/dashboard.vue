<template>
  <div class="dashboard-page" style="background: linear-gradient(180deg, #f9f8f6 0%, #f0eeea 100%);">
    <!-- 背景装饰 -->
    <div class="absolute inset-0 pointer-events-none">
      <div class="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full opacity-30" style="background: radial-gradient(circle, rgba(66,103,255,0.15) 0%, transparent 60%); filter: blur(80px);" />
      <div class="absolute bottom-0 right-1/4 w-[800px] h-[800px] rounded-full opacity-30" style="background: radial-gradient(circle, rgba(255,138,61,0.12) 0%, transparent 60%); filter: blur(100px);" />
      <div class="absolute inset-0 opacity-[0.03]" style="background-image: linear-gradient(rgba(66,103,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(66,103,255,0.5) 1px, transparent 1px); background-size: 60px 60px;" />
    </div>

    <div class="relative z-10 flex items-center w-full h-full px-4 sm:px-6 lg:px-8 gap-8">
      <!-- 左侧：聊天输入区 -->
      <div class="flex-1 flex flex-col items-center justify-center">
        <!-- 柴犬头像组 -->
        <div class="flex items-center justify-center mb-8">
          <div class="flex items-center -space-x-3">
            <ClientRender>
              <el-tooltip
                v-for="(avatar, index) in avatars"
                :key="index"
                :content="avatar.tooltip"
                effect="dark"
                :show-arrow="false"
                popper-class="avatar-tooltip"
                placement="top"
              >
                <div
                  class="relative w-14 h-14 rounded-full border-3 border-white shadow-lg overflow-hidden cursor-pointer hover:scale-110 hover:z-10 transition-all duration-300"
                >
                  <img
                    :src="avatar.src"
                    :alt="avatar.tooltip"
                    class="w-full h-full object-cover object-center scale-110"
                  />
                </div>
              </el-tooltip>
            </ClientRender>
            <ClientRender>
              <el-tooltip
                content="更多角色学习中..."
                effect="dark"
                :show-arrow="false"
                popper-class="avatar-tooltip"
                placement="top"
              >
                <div
                  class="w-14 h-14 rounded-full border-3 border-white shadow-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center cursor-pointer hover:scale-110 hover:z-10 transition-all duration-300 -ml-3"
                >
                  <el-icon class="text-white text-xl font-bold"><Plus /></el-icon>
                </div>
              </el-tooltip>
            </ClientRender>
          </div>
        </div>

        <!-- 大聊天输入框 -->
        <div class="max-w-4xl w-full mx-auto">
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
                  :placeholder="typewriterText"
                  class="w-full resize-none outline-none text-base bg-transparent leading-relaxed"
                  style="color: var(--ah-text-primary); min-height: 100px;"
                  @focus="handleFocus"
                  @blur="handleBlur"
                  @keydown.enter.ctrl.prevent="handleSubmit"
                />
              </div>
            </div>

            <!-- 底部工具栏 -->
            <div class="flex items-center justify-between pt-2">
              <div class="flex items-center gap-2">
                <!-- 主题选择 -->
                <ClientRender>
                  <div class="relative">
                    <button
                      @click="showThemeDropdown = !showThemeDropdown"
                      class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs transition-all hover:border-[#4267ff]"
                      :class="selectedTheme ? 'border-[#4267ff]/30 bg-[#4267ff]/5' : 'border-gray-200 bg-white'"
                    >
                      <el-icon class="text-xs text-[#4267ff]"><Brush /></el-icon>
                      <span style="color: var(--ah-grey-700);">
                        {{ selectedTheme ? currentTheme?.label : '主题' }}
                      </span>
                      <el-icon class="text-[10px] ml-0.5 text-gray-400"><ArrowDown /></el-icon>
                    </button>
                    <div v-if="showThemeDropdown" class="absolute top-full left-0 mt-1 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50 min-w-[100px]">
                      <button
                        v-for="theme in themes"
                        :key="theme.value"
                        @click="selectedTheme = theme.value; showThemeDropdown = false"
                        class="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-gray-50 transition-colors text-left"
                      >
                        <span class="w-2 h-2 rounded-full" :style="{ background: theme.color }"></span>
                        <span>{{ theme.label }}</span>
                      </button>
                    </div>
                  </div>
                </ClientRender>

                <!-- 模型选择 -->
                <ClientRender>
                  <div class="relative">
                    <button
                      @click="showModelDropdown = !showModelDropdown"
                      class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 bg-white text-xs transition-all hover:border-[#4267ff]"
                    >
                      <el-icon class="text-xs text-[#4267ff]"><Cpu /></el-icon>
                      <span style="color: var(--ah-grey-700);">{{ currentModel?.label }}</span>
                      <el-icon class="text-[10px] ml-0.5 text-gray-400"><ArrowDown /></el-icon>
                    </button>
                    <div v-if="showModelDropdown" class="absolute top-full left-0 mt-1 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50 min-w-[140px]">
                      <button
                        v-for="model in models"
                        :key="model.value"
                        @click="selectedModel = model.value; showModelDropdown = false"
                        class="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-gray-50 transition-colors text-left"
                      >
                        <el-icon class="text-xs"><Cpu /></el-icon>
                        <span>{{ model.label }}</span>
                      </button>
                    </div>
                  </div>
                </ClientRender>
              </div>

              <!-- 开始构建按钮 -->
              <button
                @click="handleSubmit"
                :disabled="!inputText.trim() || isLoading"
                class="flex items-center gap-1.5 px-4 py-1.5 rounded-xl font-medium text-xs text-white transition-all duration-200"
                :class="inputText.trim() && !isLoading
                  ? 'bg-gradient-to-r from-[#4267ff] to-[#5a7fff] hover:shadow-lg hover:shadow-blue-500/25 hover:-translate-y-0.5'
                  : 'bg-gray-300 cursor-not-allowed'"
              >
                <el-icon v-if="isLoading" class="animate-spin text-sm"><Loading /></el-icon>
                <span>开始构建</span>
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
      </div>

      <!-- 右侧：最近项目 -->
      <div v-if="recentProjects.length > 0" class="w-[240px] flex-shrink-0">
        <div class="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <h3 class="text-sm font-semibold text-gray-900 mb-4">最近项目</h3>
          <div class="flex flex-col gap-2">
            <div
              v-for="project in recentProjects"
              :key="project.id"
              class="px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-50 transition-all"
              @click="goToProject(project)"
            >
              {{ project.name }}
            </div>
          </div>
          <NuxtLink to="/projects" class="block mt-4 text-xs text-blue-600 hover:text-blue-700 font-medium">
            查看全部 →
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'app'
})

import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Plus, Cpu, ArrowRight, Loading, Brush, ArrowDown } from '@element-plus/icons-vue'
import { useProjectStore } from '~/stores/project'
import { useChatStore } from '~/stores/chat'

const router = useRouter()
const projectStore = useProjectStore()
const chatStore = useChatStore()

const recentProjects = computed(() => projectStore.activeProjects.slice(0, 5))

const goToProject = async (project: any) => {
  await chatStore.loadConversations(project.id)
  if (chatStore.conversations.length > 0) {
    router.push('/chat/' + chatStore.conversations[0].id)
  } else {
    const conv = await chatStore.createConversation(project.name, project.id)
    router.push('/chat/' + conv.id)
  }
}

const inputText = ref('')
const isFocused = ref(false)
const isLoading = ref(false)
const showThemeDropdown = ref(false)
const showModelDropdown = ref(false)

// 柴犬头像
const avatars = [
  { src: '/avatars/shiba_tl.png', tooltip: '阿黄 - 技术负责人' },
  { src: '/avatars/shiba_fe.png', tooltip: '小花 - 前端开发' },
  { src: '/avatars/shiba_be.png', tooltip: '阿铁 - 后端开发' },
  { src: '/avatars/shiba_qa.png', tooltip: '阿镜 - 测试工程师' },
]

// 打字机效果
const typewriterTexts = [
  '帮我做一个任务管理系统，支持拖拽排序、标签分类和团队协作，风格要简洁现代。',
  '创建一个个人博客网站，要有深色模式、Markdown 支持和评论功能。',
  '设计一个电商数据看板，包含销售趋势图、库存预警和用户行为分析。'
]
const typewriterText = ref('')
const currentTextIndex = ref(0)
const charIndex = ref(0)
const isDeleting = ref(false)
const typewriterTimer = ref<number | null>(null)
const isTypingActive = ref(true)

const typeWriter = () => {
  if (!isTypingActive.value) return
  const currentText = typewriterTexts[currentTextIndex.value]
  if (isDeleting.value) {
    typewriterText.value = currentText.substring(0, charIndex.value - 1)
    charIndex.value--
  } else {
    typewriterText.value = currentText.substring(0, charIndex.value + 1)
    charIndex.value++
  }
  let nextDelay = isDeleting.value ? 30 : 50
  if (!isDeleting.value && charIndex.value === currentText.length) {
    nextDelay = 2000
    isDeleting.value = true
  } else if (isDeleting.value && charIndex.value === 0) {
    isDeleting.value = false
    currentTextIndex.value = (currentTextIndex.value + 1) % typewriterTexts.length
    nextDelay = 500
  }
  typewriterTimer.value = window.setTimeout(typeWriter, nextDelay)
}

const startTypewriter = () => {
  isTypingActive.value = true
  typeWriter()
}

const stopTypewriter = () => {
  isTypingActive.value = false
  if (typewriterTimer.value) {
    clearTimeout(typewriterTimer.value)
    typewriterTimer.value = null
  }
}

const handleFocus = () => {
  isFocused.value = true
  stopTypewriter()
  typewriterText.value = ''
}

const handleBlur = () => {
  isFocused.value = false
  if (!inputText.value) {
    charIndex.value = 0
    isDeleting.value = false
    startTypewriter()
  }
}

onMounted(() => {
  startTypewriter()
})

onUnmounted(() => {
  stopTypewriter()
})

// 主题选择
const selectedTheme = ref('')
const themes = [
  { value: 'modern', label: '现代', color: '#4267ff' },
  { value: 'minimal', label: '极简', color: '#1a1a1a' },
  { value: 'warm', label: '温暖', color: '#ff8a3d' },
  { value: 'fresh', label: '清新', color: '#10b981' },
]

const currentTheme = computed(() => themes.find(t => t.value === selectedTheme.value))
const currentModel = computed(() => models.find(m => m.value === selectedModel.value))

// 模型选择
const selectedModel = ref('claude-sonnet-4.6')
const models = [
  { value: 'claude-sonnet-4.6', label: 'Claude Sonnet 4.6' },
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
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

  isLoading.value = true
  try {
    // 1. 创建项目
    const autoName = text.slice(0, 20) + (text.length > 20 ? '...' : '')
    const project = await projectStore.createProject({
      name: autoName,
      description: text,
      type: 'blank',
      techStack: 'react',
    })

    // 2. 创建 Chat Session
    const conversation = await chatStore.createConversation(project.name, project.id)

    // 3. 发送第一条消息
    await chatStore.sendMessage(text, 'user')

    // 4. 跳转到 Chat 页面
    ElMessage.success('项目创建成功，AI 团队开始工作')
    router.push('/chat/' + conversation.id)
  } catch (error: any) {
    ElMessage.error(error.message || '创建项目失败')
  } finally {
    isLoading.value = false
  }
}

useSeoMeta({
  title: 'Dashboard - AgentHive Cloud',
  description: '描述你的需求，让 AI Agent 团队帮你完成开发',
})
</script>

<style scoped>
.dashboard-page {
  position: relative;
  width: 100%;
  min-height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

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

/* Tooltip 样式 */
:deep(.avatar-tooltip) {
  padding: 6px 10px !important;
  font-size: 12px !important;
  border-radius: 6px !important;
}
</style>

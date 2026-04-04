<template>
  <NuxtLayout name="studio">
    <StudioLayout>
      <template #header>
        <AppHeader
          mode="studio"
          :project-name="currentProject"
          :is-auth="isAuthenticated"
          :show-shiba-team="true"
          @login="showLogin = true"
        />
      </template>

      <template #toolbox>
        <StudioToolbox :active-tool="activeTool" @activate="onToolActivate" />
      </template>

      <template #canvas>
        <div class="relative w-full h-full flex flex-col items-center justify-center p-6">
          <PromptInput
            v-if="!hasPrompt"
            class="z-10"
            @submit="onPromptSubmit"
          />
          <div
            v-else
            class="w-full max-w-4xl h-full bg-white rounded-2xl border border-gray-200 shadow-sm p-6 overflow-y-auto"
          >
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-lg font-semibold text-gray-900">项目: {{ promptText }}</h2>
              <button
                class="text-sm text-primary-600 hover:underline"
                @click="resetPrompt"
              >
                新建需求
              </button>
            </div>
            <StudioCanvas v-if="showCanvas" />
            <div
              v-else
              class="flex flex-col items-center justify-center h-64 text-gray-400"
            >
              <div class="w-12 h-12 border-4 border-gray-200 border-t-primary-500 rounded-full animate-spin mb-4" />
              <p>柴犬装修队正在分析需求...</p>
            </div>
          </div>
        </div>
      </template>

      <template #dock>
        <AgentDock @select="onAgentSelect" />
      </template>

      <template #drawer>
        <StudioDrawer
          v-model="drawerOpen"
          :default-tab="activeTool"
        >
          <template #default="{ activeTab }">
            <div class="h-full p-4">
              <div v-if="activeTab === 'execution'">
                <StudioExecutionPanel :readonly="!isAuthenticated" />
              </div>
              <div v-else-if="activeTab === 'chat'">
                <ChatView :embedded="true" :readonly="!isAuthenticated" />
              </div>
              <div v-else-if="activeTab === 'code'">
                <CodeViewer :embedded="true" :readonly="!isAuthenticated" />
              </div>
              <div v-else-if="activeTab === 'terminal'">
                <FeatureGate feature="terminal" :tier="userTier" @cta="showLogin = true">
                  <TerminalView :embedded="true" :readonly="true" />
                </FeatureGate>
              </div>
            </div>
          </template>
        </StudioDrawer>
      </template>
    </StudioLayout>

    <LoginOverlay v-model="showLogin" @login="navigateTo('/login')" />
  </NuxtLayout>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import AppHeader from '@agenthive/ui/components/AppHeader.vue'
import StudioLayout from '@agenthive/ui/components/StudioLayout.vue'
import StudioToolbox from '@agenthive/ui/components/StudioToolbox.vue'
import StudioDrawer from '@agenthive/ui/components/StudioDrawer.vue'
import AgentDock from '@agenthive/ui/components/AgentDock.vue'
import PromptInput from '@agenthive/ui/components/PromptInput.vue'
import LoginOverlay from '@agenthive/ui/components/LoginOverlay.vue'
import FeatureGate from '@agenthive/ui/components/FeatureGate.vue'
import StudioExecutionPanel from '~/components/StudioExecutionPanel.vue'
import { useAuth } from '@agenthive/ui/composables/useAuth'
import { useVisitorSession } from '@agenthive/ui/composables/useVisitorSession'

// SEO
useSeoMeta({
  title: 'AI Studio - AgentHive',
  description: '在 AgentHive Studio 中与 AI Agent 团队协作开发',
})

definePageMeta({
  layout: 'studio',
})

const { isAuthenticated } = useAuth()
const { session, addPrompt } = useVisitorSession()

const activeTool = ref('execution')
const drawerOpen = ref(false)
const showLogin = ref(false)
const hasPrompt = ref(false)
const promptText = ref('')
const showCanvas = ref(false)
const currentProject = ref('')

const userTier = computed(() => {
  if (isAuthenticated()) return 'pro'
  return 'visitor'
})

function onToolActivate(toolId: string) {
  activeTool.value = toolId
  drawerOpen.value = true
}

function onAgentSelect(role: string) {
  activeTool.value = 'execution'
  drawerOpen.value = true
  // eslint-disable-next-line no-console
  console.log('Selected agent:', role)
}

function onPromptSubmit(text: string) {
  promptText.value = text
  hasPrompt.value = true
  addPrompt(text)
  showCanvas.value = false
  setTimeout(() => {
    showCanvas.value = true
  }, 1500)
}

function resetPrompt() {
  hasPrompt.value = false
  promptText.value = ''
  showCanvas.value = false
}
</script>

<style scoped>
.text-primary-600 { color: #2563eb; }
.border-t-primary-500 { border-top-color: #3b82f6; }
</style>

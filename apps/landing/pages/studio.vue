<template>
  <StudioLayout>
    <template #header>
      <AppHeader
        mode="studio"
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
        <div v-else class="p-6">
          <h2>项目: {{ promptText }}</h2>
          <p>Canvas placeholder</p>
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
              <StudioExecutionPanel :readonly="!isAuthenticated()" />
            </div>
            <div v-else>
              Other tab: {{ activeTab }}
            </div>
          </div>
        </template>
      </StudioDrawer>
    </template>
  </StudioLayout>

  <LoginOverlay v-model="showLogin" @login="navigateTo('/login')" />
</template>

<script setup lang="ts">
import { ref } from 'vue'

definePageMeta({
  layout: 'studio',
})

const { isAuthenticated } = useAuth()

const activeTool = ref('execution')
const drawerOpen = ref(false)
const showLogin = ref(false)
const currentProject = ref('')

function onToolActivate(toolId: string) {
  activeTool.value = toolId
  drawerOpen.value = true
}

function onAgentSelect(role: string) {
  activeTool.value = 'execution'
  drawerOpen.value = true
  console.log('Selected agent:', role)
}

const hasPrompt = ref(false)
const promptText = ref('')

function onPromptSubmit(text: string) {
  promptText.value = text
  hasPrompt.value = true
}
</script>

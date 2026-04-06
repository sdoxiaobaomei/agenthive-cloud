<template>
  <div class="shiba-avatar" :style="{ width: size + 'px', height: size + 'px' }">
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- 背景圆 -->
      <circle cx="50" cy="50" r="48" :fill="bgColor" />
      
      <!-- 柴犬脸 -->
      <circle cx="50" cy="55" r="35" :fill="faceColor" />
      
      <!-- 耳朵 -->
      <path d="M25 35 L20 15 L40 25 Z" :fill="earColor" />
      <path d="M75 35 L80 15 L60 25 Z" :fill="earColor" />
      
      <!-- 眼睛 -->
      <circle cx="38" cy="50" r="4" fill="#1a1a1a" />
      <circle cx="62" cy="50" r="4" fill="#1a1a1a" />
      
      <!-- 鼻子 -->
      <ellipse cx="50" cy="58" rx="6" ry="4" fill="#1a1a1a" />
      
      <!-- 嘴巴 -->
      <path d="M45 65 Q50 70 55 65" stroke="#1a1a1a" stroke-width="2" fill="none" stroke-linecap="round" />
      
      <!-- 眉毛（根据角色变化） -->
      <path v-if="role === 'orchestrator'" d="M32 40 L44 42 M56 42 L68 40" stroke="#8B4513" stroke-width="2" stroke-linecap="round" />
      <path v-else-if="role === 'frontend_dev'" d="M33 38 Q38 35 43 38 M57 38 Q62 35 67 38" stroke="#8B4513" stroke-width="2" stroke-linecap="round" fill="none" />
      <path v-else-if="role === 'backend_dev'" d="M32 40 L40 38 M60 38 L68 40" stroke="#8B4513" stroke-width="2" stroke-linecap="round" />
      
      <!-- 角色标识 -->
      <circle v-if="role === 'orchestrator'" cx="75" cy="25" r="8" fill="#4267ff" />
      <text v-if="role === 'orchestrator'" x="75" y="28" text-anchor="middle" fill="white" font-size="10" font-weight="bold">★</text>
      
      <circle v-if="role === 'frontend_dev'" cx="75" cy="25" r="8" fill="#ff8a3d" />
      <text v-if="role === 'frontend_dev'" x="75" y="28" text-anchor="middle" fill="white" font-size="8">UI</text>
      
      <circle v-if="role === 'backend_dev'" cx="75" cy="25" r="8" fill="#22c55e" />
      <text v-if="role === 'backend_dev'" x="75" y="28" text-anchor="middle" fill="white" font-size="8">DB</text>
      
      <circle v-if="role === 'qa_engineer'" cx="75" cy="25" r="8" fill="#a855f7" />
      <text v-if="role === 'qa_engineer'" x="75" y="28" text-anchor="middle" fill="white" font-size="8">QA</text>
    </svg>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  role?: 'orchestrator' | 'frontend_dev' | 'backend_dev' | 'qa_engineer'
  size?: number
}>(), {
  role: 'orchestrator',
  size: 64,
})

const bgColor = '#f5e6d3'
const faceColor = '#d4a574'
const earColor = '#c49a6c'
</script>

<style scoped>
.shiba-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.shiba-avatar svg {
  width: 100%;
  height: 100%;
}
</style>

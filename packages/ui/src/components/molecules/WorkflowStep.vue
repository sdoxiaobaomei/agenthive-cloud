<template>
  <div class="relative flex flex-col items-center text-center">
    <!-- 步骤圆圈 -->
    <div class="w-16 h-16 bg-primary-500 rounded-full flex items-center justify-center text-white font-bold text-xl relative z-10 mb-4 shadow-lg shadow-primary-500/30">
      {{ index + 1 }}
    </div>
    
    <!-- 内容 -->
    <h3 class="text-lg font-semibold text-gray-900 mb-2">{{ step.title }}</h3>
    <p class="text-gray-600 text-sm">{{ step.description }}</p>
  </div>
</template>

<script setup>
defineProps({
  step: Object,
  index: Number
})
</script>

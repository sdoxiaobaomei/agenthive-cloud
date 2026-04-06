<template>
  <div class="relative text-center">
    <!-- Step Number Circle -->
    <div 
      class="w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4"
      style="background-color: #4267ff20;"
    >
      <el-icon :size="28" style="color: #4267ff;">
        <component :is="icon" />
      </el-icon>
    </div>
    
    <!-- Step Number Badge -->
    <div class="absolute top-0 right-1/3 w-6 h-6 rounded-full bg-[#4267ff] text-white text-sm font-semibold flex items-center justify-center">
      {{ number }}
    </div>
    
    <h3 class="text-lg font-semibold mb-2">{{ title }}</h3>
    <p class="text-gray-600 text-sm">{{ description }}</p>
  </div>
</template>

<script setup lang="ts">
import type { Component } from 'vue'

interface Props {
  number: number
  icon: Component
  title: string
  description: string
}

defineProps<Props>()
</script>

<template>
  <div class="p-6 rounded-2xl bg-white border border-gray-100 hover:shadow-lg transition-shadow">
    <div 
      class="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
      :style="{ backgroundColor: color + '20' }"
    >
      <el-icon :size="24" :style="{ color: color }">
        <component :is="icon" />
      </el-icon>
    </div>
    <h3 class="text-xl font-semibold mb-2">{{ title }}</h3>
    <p class="text-gray-600">{{ description }}</p>
  </div>
</template>

<script setup lang="ts">
import type { Component } from 'vue'

interface Props {
  icon: Component
  title: string
  description: string
  color: string
}

defineProps<Props>()
</script>

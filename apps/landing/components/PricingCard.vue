<template>
  <div 
    class="rounded-2xl p-8 transition-all duration-300"
    :class="[
      plan.popular 
        ? 'bg-gradient-to-b from-blue-50 to-white border-2 border-blue-500 shadow-lg scale-105' 
        : 'bg-white border border-gray-200 hover:shadow-md'
    ]"
  >
    <!-- Popular Badge -->
    <div v-if="plan.popular" class="mb-4">
      <span class="inline-block px-3 py-1 text-xs font-semibold text-white bg-blue-500 rounded-full">
        最受欢迎
      </span>
    </div>
    
    <!-- Plan Name -->
    <h3 class="text-xl font-bold text-gray-900 mb-2">{{ plan.name }}</h3>
    
    <!-- Description -->
    <p class="text-gray-600 text-sm mb-6">{{ plan.description }}</p>
    
    <!-- Price -->
    <div class="mb-6">
      <span class="text-4xl font-bold text-gray-900">{{ plan.price }}</span>
      <span class="text-gray-500">{{ plan.period }}</span>
    </div>
    
    <!-- CTA Button -->
    <button 
      class="w-full py-3 px-4 rounded-xl font-semibold transition-all duration-200 mb-8"
      :class="[
        plan.popular
          ? 'bg-blue-500 text-white hover:bg-blue-600 shadow-md hover:shadow-lg'
          : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
      ]"
    >
      {{ plan.cta }}
    </button>
    
    <!-- Features -->
    <ul class="space-y-3">
      <li 
        v-for="feature in plan.features" 
        :key="feature"
        class="flex items-center gap-3 text-gray-700"
      >
        <el-icon class="text-green-500 flex-shrink-0"><Check /></el-icon>
        <span>{{ feature }}</span>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { Check } from '@element-plus/icons-vue'

defineProps({
  plan: {
    type: Object,
    required: true
  }
})
</script>

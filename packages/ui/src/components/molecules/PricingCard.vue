<template>
  <div 
    class="rounded-2xl p-8 relative"
    :class="plan.popular ? 'bg-primary-600 text-white scale-105 shadow-xl' : 'bg-white border border-gray-200'"
  >
    <!-- 热门标签 -->
    <div v-if="plan.popular" class="absolute -top-4 left-1/2 -translate-x-1/2">
      <span class="bg-yellow-400 text-yellow-900 px-4 py-1 rounded-full text-sm font-semibold">
        最受欢迎
      </span>
    </div>
    
    <div class="text-center mb-8">
      <h3 class="text-xl font-semibold mb-2" :class="plan.popular ? 'text-white' : 'text-gray-900'">
        {{ plan.name }}
      </h3>
      <div class="flex items-baseline justify-center gap-1">
        <span class="text-4xl font-bold">{{ plan.price }}</span>
        <span :class="plan.popular ? 'text-primary-100' : 'text-gray-500'">{{ plan.period }}</span>
      </div>
      <p :class="plan.popular ? 'text-primary-100' : 'text-gray-500'" class="mt-2">
        {{ plan.description }}
      </p>
    </div>
    
    <ul class="space-y-4 mb-8">
      <li v-for="feature in plan.features" :key="feature" class="flex items-center gap-3">
        <svg 
          class="w-5 h-5 flex-shrink-0" 
          :class="plan.popular ? 'text-primary-200' : 'text-primary-500'"
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
        </svg>
        <span :class="plan.popular ? 'text-white' : 'text-gray-700'">{{ feature }}</span>
      </li>
    </ul>
    
    <NuxtLink 
      to="https://app.agenthive.cloud"
      class="block w-full text-center py-3 rounded-xl font-semibold transition-colors"
      :class="plan.popular 
        ? 'bg-white text-primary-600 hover:bg-gray-100' 
        : 'bg-primary-500 text-white hover:bg-primary-600'"
    >
      {{ plan.cta }}
    </NuxtLink>
  </div>
</template>

<script setup>
defineProps({
  plan: Object
})
</script>

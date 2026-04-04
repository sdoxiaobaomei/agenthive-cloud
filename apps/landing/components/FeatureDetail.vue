<template>
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center" :class="{ 'lg:flex-row-reverse': reversed }">
    <div :class="{ 'lg:order-2': reversed }">
      <h2 class="text-3xl font-bold text-gray-900 mb-4">{{ feature.title }}</h2>
      <p class="text-lg text-gray-600 mb-8">{{ feature.description }}</p>
      <ul class="space-y-3">
        <li v-for="item in feature.features" :key="item" class="flex items-center gap-3">
          <svg class="w-5 h-5 text-primary-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
          <span class="text-gray-700">{{ item }}</span>
        </li>
      </ul>
    </div>
    <div :class="{ 'lg:order-1': reversed }" class="bg-gray-100 rounded-2xl aspect-video flex items-center justify-center">
      <div class="text-gray-400 text-center">
        <svg class="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <p>功能截图</p>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  feature: Object,
  reversed: Boolean
})
</script>

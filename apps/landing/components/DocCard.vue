<template>
  <NuxtLink 
    :to="doc.link"
    class="block bg-white rounded-xl p-6 border border-gray-200 hover:border-blue-300 hover:shadow-lg transition-all duration-300 group"
  >
    <!-- Icon -->
    <div class="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center mb-4 group-hover:bg-blue-100 transition-colors">
      <el-icon class="text-2xl text-blue-500"><component :is="iconComponent" /></el-icon>
    </div>
    
    <!-- Title -->
    <h3 class="text-lg font-semibold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
      {{ doc.title }}
    </h3>
    
    <!-- Description -->
    <p class="text-gray-600 text-sm leading-relaxed">{{ doc.description }}</p>
    
    <!-- Arrow -->
    <div class="mt-4 flex items-center text-blue-500 text-sm font-medium">
      <span>了解更多</span>
      <el-icon class="ml-1 group-hover:translate-x-1 transition-transform"><ArrowRight /></el-icon>
    </div>
  </NuxtLink>
</template>

<script setup>
import { computed } from 'vue'
import { Notebook, Promotion, UserFilled, Timer, EditPen, Document, ArrowRight, Collection } from '@element-plus/icons-vue'

const props = defineProps({
  doc: {
    type: Object,
    required: true
  }
})

const iconComponent = computed(() => {
  const iconMap = {
    'Book': Notebook,
    'Rocket': Promotion,
    'Users': UserFilled,
    'Timer': Timer,
    'Task': Timer,
    'Edit': EditPen,
    'Code': EditPen,
    'API': Document,
    'Reading': Collection
  }
  return iconMap[props.doc.icon] || Notebook
})
</script>

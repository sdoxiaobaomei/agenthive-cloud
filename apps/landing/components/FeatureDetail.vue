<template>
  <div 
    class="flex flex-col lg:flex-row gap-12 items-center"
    :class="reversed ? 'lg:flex-row-reverse' : ''"
  >
    <!-- Content -->
    <div class="flex-1 space-y-6">
      <h2 class="text-3xl font-bold text-gray-900">{{ feature.title }}</h2>
      <p class="text-lg text-gray-600 leading-relaxed">{{ feature.description }}</p>
      
      <!-- Feature List -->
      <ul class="grid grid-cols-2 gap-4">
        <li 
          v-for="item in feature.features" 
          :key="item"
          class="flex items-center gap-2 text-gray-700"
        >
          <el-icon class="text-blue-500"><CircleCheck /></el-icon>
          <span>{{ item }}</span>
        </li>
      </ul>
    </div>
    
    <!-- Visual -->
    <div class="flex-1">
      <div class="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-8 aspect-video flex items-center justify-center">
        <div class="text-center">
          <el-icon class="text-6xl text-blue-500 mb-4"><component :is="iconName" v-if="iconName" /></el-icon>
          <p class="text-gray-500">{{ feature.title }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { CircleCheck, UserFilled, DataLine, EditPen, Monitor } from '@element-plus/icons-vue'

const props = defineProps({
  feature: {
    type: Object,
    required: true
  },
  reversed: {
    type: Boolean,
    default: false
  }
})

const iconName = computed(() => {
  const iconMap = {
    '多 Agent 协作': UserFilled,
    '可视化看板': DataLine,
    '实时代码编辑': EditPen,
    '终端监控': Monitor
  }
  return iconMap[props.feature.title] || UserFilled
})
</script>

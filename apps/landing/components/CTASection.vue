<template>
  <section class="py-24 bg-white">
    <div class="max-w-4xl mx-auto px-4 text-center">
      <div class="p-12 rounded-3xl" style="background: linear-gradient(135deg, #4267ff 0%, #3656d8 100%);">
        <h2 class="text-3xl sm:text-4xl font-bold text-white mb-4">
          准备好开始构建了吗？
        </h2>
        <p class="text-lg text-white/80 mb-8 max-w-xl mx-auto">
          立即体验 AgentHive，让 AI 团队帮你将想法变为现实。无需编程经验，快速构建专业应用。
        </p>
        
        <div class="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button 
            @click="startBuilding"
            class="px-8 py-4 bg-white text-[#4267ff] rounded-xl font-semibold hover:bg-gray-100 transition-colors flex items-center gap-2"
          >
            <span>免费开始</span>
            <el-icon><ArrowRight /></el-icon>
          </button>
          
          <button 
            @click="viewDemo"
            class="px-8 py-4 bg-transparent border-2 border-white text-white rounded-xl font-semibold hover:bg-white/10 transition-colors"
          >
            观看演示
          </button>
        </div>
        
        <p class="text-sm text-white/60 mt-6">
          无需信用卡 · 免费试用 · 随时取消
        </p>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ArrowRight } from '@element-plus/icons-vue'
import { navigateTo } from '#app'

const startBuilding = () => {
  navigateTo('http://localhost:3001/')
}

const viewDemo = () => {
  // Scroll to top or show demo video
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
</script>

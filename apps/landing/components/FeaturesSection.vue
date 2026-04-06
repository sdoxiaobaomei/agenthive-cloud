<template>
  <section class="py-24 bg-white">
    <div class="max-w-6xl mx-auto px-4">
      <!-- Section Header -->
      <div class="text-center mb-16">
        <h2 class="text-3xl sm:text-4xl font-bold mb-4">强大的 AI 能力</h2>
        <p class="text-lg text-gray-600 max-w-2xl mx-auto">
          AgentHive 集成了最先进的 AI 技术，让应用开发变得简单高效
        </p>
      </div>
      
      <!-- Features Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        <FeatureCard 
          v-for="feature in features" 
          :key="feature.title"
          :icon="feature.icon"
          :title="feature.title"
          :description="feature.description"
          :color="feature.color"
        />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ChatDotRound, Brush, Collection, Cpu, Connection, Aim } from '@element-plus/icons-vue'

const features = [
  {
    icon: ChatDotRound,
    title: '自然语言开发',
    description: '用中文描述需求，AI 自动理解并生成专业代码',
    color: '#4267ff'
  },
  {
    icon: Brush,
    title: '智能 UI 设计',
    description: 'AI 根据你的描述自动生成美观的界面设计',
    color: '#10b981'
  },
  {
    icon: Collection,
    title: '代码生成',
    description: '自动生成高质量的前后端代码，支持多种框架',
    color: '#f59e0b'
  },
  {
    icon: Cpu,
    title: '多 Agent 协作',
    description: '前端、后端、设计等多个 AI Agent 协同工作',
    color: '#8b5cf6'
  },
  {
    icon: Connection,
    title: '实时预览',
    description: '边开发边预览，实时查看应用效果',
    color: '#ec4899'
  },
  {
    icon: Aim,
    title: '一键部署',
    description: '开发完成后一键部署上线，快速发布应用',
    color: '#06b6d4'
  }
]
</script>

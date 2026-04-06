<template>
  <section class="py-24" style="background: var(--ah-bg-page);">
    <div class="max-w-6xl mx-auto px-4">
      <!-- Section Header -->
      <div class="text-center mb-16">
        <h2 class="text-3xl sm:text-4xl font-bold mb-4">简单四步，从想法到应用</h2>
        <p class="text-lg text-gray-600 max-w-2xl mx-auto">
          无需编程经验，让 AI Agent 团队帮你完成开发全流程
        </p>
      </div>
      
      <!-- Workflow Steps -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        <WorkflowStep 
          v-for="(step, index) in steps" 
          :key="step.title"
          :number="index + 1"
          :icon="step.icon"
          :title="step.title"
          :description="step.description"
        />
      </div>
      
      <!-- Workflow Visualization -->
      <div class="mt-16 p-8 bg-white rounded-2xl shadow-sm">
        <div class="flex flex-col lg:flex-row items-center gap-8">
          <div class="flex-1">
            <h3 class="text-2xl font-bold mb-4">可视化开发流程</h3>
            <p class="text-gray-600 mb-6">
              在 Studio 中实时查看每个 Agent 的工作状态，代码生成、文件修改、部署进度一目了然。
              你可以随时介入调整，与 AI 协作打造完美应用。
            </p>
            <ul class="space-y-3">
              <li class="flex items-center gap-3">
                <el-icon class="text-[#4267ff]"><Check /></el-icon>
                <span>实时查看 Agent 工作状态</span>
              </li>
              <li class="flex items-center gap-3">
                <el-icon class="text-[#4267ff]"><Check /></el-icon>
                <span>代码修改实时同步</span>
              </li>
              <li class="flex items-center gap-3">
                <el-icon class="text-[#4267ff]"><Check /></el-icon>
                <span>一键预览和部署</span>
              </li>
            </ul>
          </div>
          <div class="flex-1">
            <div class="bg-gray-900 rounded-xl p-4 font-mono text-sm text-gray-300">
              <div class="flex items-center gap-2 mb-3">
                <div class="w-3 h-3 rounded-full bg-red-500"></div>
                <div class="w-3 h-3 rounded-full bg-yellow-500"></div>
                <div class="w-3 h-3 rounded-full bg-green-500"></div>
                <span class="ml-2 text-xs text-gray-500">Agent Studio</span>
              </div>
              <div class="space-y-2">
                <div class="flex items-center gap-2">
                  <span class="text-green-400">✓</span>
                  <span class="text-gray-400">[Product Manager]</span>
                  <span>需求分析完成</span>
                </div>
                <div class="flex items-center gap-2">
                  <span class="text-yellow-400">⟳</span>
                  <span class="text-gray-400">[Frontend Dev]</span>
                  <span>正在生成登录页面...</span>
                </div>
                <div class="flex items-center gap-2">
                  <span class="text-blue-400">●</span>
                  <span class="text-gray-400">[Backend Dev]</span>
                  <span>等待设计稿确认</span>
                </div>
                <div class="flex items-center gap-2">
                  <span class="text-gray-500">○</span>
                  <span class="text-gray-400">[DevOps]</span>
                  <span>待开始</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { EditPen, Cpu, DocumentCopy, Promotion, Check } from '@element-plus/icons-vue'

const steps = [
  {
    icon: EditPen,
    title: '描述需求',
    description: '用自然语言描述你想构建的应用功能和特点'
  },
  {
    icon: Cpu,
    title: 'AI 分析',
    description: 'AI 团队分析需求，制定开发计划和架构设计'
  },
  {
    icon: DocumentCopy,
    title: '自动开发',
    description: '多个 Agent 协作编写代码，实时生成可运行应用'
  },
  {
    icon: Promotion,
    title: '预览部署',
    description: '一键预览应用效果，确认后直接部署上线'
  }
]
</script>

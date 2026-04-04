<template>
  <div class="pt-24 pb-20">
    <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
      <h1 class="text-4xl font-bold text-gray-900 mb-8">任务管理</h1>
      
      <div class="prose prose-gray max-w-none">
        <h2 class="text-xl font-semibold mb-4">任务状态</h2>
        <ul class="list-disc list-inside text-gray-600 space-y-2">
          <li>待办 - 等待处理</li>
          <li>进行中 - Agent 正在处理</li>
          <li>审核中 - 等待人工审核</li>
          <li>已完成 - 已验收</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup>
useSeoMeta({
  title: '任务管理',
})
</script>

<template>
  <div class="min-h-screen pt-20 pb-12">
    <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
      <h1 class="text-4xl font-bold text-gray-900 mb-8">联系我们</h1>
      <div class="grid md:grid-cols-2 gap-8">
        <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 class="text-xl font-semibold text-gray-900 mb-4">商务合作</h2>
          <p class="text-gray-600 mb-2">邮箱: business@agenthive.cloud</p>
          <p class="text-gray-600">电话: +86 400-888-8888</p>
        </div>
        <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 class="text-xl font-semibold text-gray-900 mb-4">技术支持</h2>
          <p class="text-gray-600 mb-2">邮箱: support@agenthive.cloud</p>
          <p class="text-gray-600">GitHub Issues: github.com/agenthive/issues</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
useHead({
  title: '联系我们 - AgentHive Cloud'
})
</script>

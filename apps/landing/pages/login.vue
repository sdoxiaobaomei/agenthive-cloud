<script setup>
useSeoMeta({
  title: '登录 - AgentHive',
  description: '登录 AgentHive 开始与 AI Agent 团队协作',
})
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50">
    <div class="w-full max-w-md p-8 bg-white rounded-2xl shadow-lg">
      <h1 class="text-2xl font-bold text-center text-gray-900 mb-6">登录 AgentHive</h1>
      <form class="space-y-4">
        <input type="email" placeholder="邮箱" class="w-full px-4 py-3 rounded-xl border border-gray-200" />
        <input type="password" placeholder="密码" class="w-full px-4 py-3 rounded-xl border border-gray-200" />
        <button type="submit" class="w-full py-3 bg-primary-500 text-white rounded-xl font-medium">登录</button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.bg-primary-500 { background-color: #3b82f6; }
</style>

<template>
  <div class="pt-24 pb-20">
    <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
      <h1 class="text-4xl font-bold text-gray-900 mb-8">API 参考</h1>
      
      <div class="prose prose-gray max-w-none">
        <h2 class="text-xl font-semibold mb-4">认证</h2>
        <pre class="bg-gray-100 p-4 rounded"><code>POST /api/v1/auth/login</code></pre>
        
        <h2 class="text-xl font-semibold mt-8 mb-4">Agent</h2>
        <pre class="bg-gray-100 p-4 rounded"><code>GET    /api/v1/agents
POST   /api/v1/agents
GET    /api/v1/agents/:id
PATCH  /api/v1/agents/:id
DELETE /api/v1/agents/:id</code></pre>
      </div>
    </div>
  </div>
</template>

<script setup>
useSeoMeta({
  title: 'API 参考',
})
</script>

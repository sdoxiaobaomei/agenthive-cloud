<template>
  <router-view />
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useWebSocketStore } from '@/stores/websocket'

const wsStore = useWebSocketStore()

onMounted(() => {
  // 自动连接 WebSocket
  if (!wsStore.isConnected) {
    wsStore.connect()
  }
})
</script>

<style>
/* 全局样式已在 styles/index.css 中定义 */
</style>

<template>
  <div class="system-event-block">
    <el-icon class="event-icon"><InfoFilled /></el-icon>
    <span class="event-text">{{ displayText }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { InfoFilled } from '@element-plus/icons-vue'
import type { ChatMessage } from '~/stores/chat'

interface Props {
  message: ChatMessage
}

const props = defineProps<Props>()

const displayText = computed(() => {
  const content = props.message.content
  const intent = props.message.metadata?.intent
  if (intent && content.includes('意图')) {
    return content
  }
  return content || '系统事件'
})
</script>

<style scoped>
.system-event-block {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 12px;
  background: #f3f4f6;
  color: #6b7280;
  font-size: 11px;
  line-height: 1.4;
  margin: 4px 0;
  align-self: center;
}

.event-icon {
  font-size: 12px;
  color: #9ca3af;
}

.event-text {
  font-weight: 500;
}
</style>

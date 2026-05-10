<template>
  <div class="message-bubble" :class="message.role">
    <div v-if="isLoading" class="typing-indicator">
      <span></span>
      <span></span>
      <span></span>
    </div>
    <div v-else class="message-body" v-html="renderedContent"></div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { renderMarkdown } from '~/utils/renderMarkdown'
import type { ChatMessage } from '~/stores/chat'

interface Props {
  message: ChatMessage
  isLoading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isLoading: false,
})

const renderedContent = computed(() => {
  if (typeof props.message.content !== 'string') {
    // 如果是 MessageContent[]，提取文本内容
    return (props.message.content as any[])
      .map((c) => c.content)
      .join('\n')
  }
  return renderMarkdown(props.message.content)
})
</script>

<style scoped>
.message-bubble {
  padding: 10px 14px;
  border-radius: 12px;
  font-size: 13px;
  line-height: 1.6;
  color: #374151;
  background: #f3f4f6;
  word-break: break-word;
}

.message-bubble.user {
  background: #4f46e5;
  color: white;
  border-bottom-right-radius: 4px;
}

.message-bubble.assistant {
  background: #f3f4f6;
  color: #374151;
  border-bottom-left-radius: 4px;
}

.message-bubble.system {
  background: #fef3c7;
  color: #92400e;
  border-bottom-left-radius: 4px;
  font-size: 12px;
}

/* Typing Indicator */
.typing-indicator {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 4px;
}

.typing-indicator span {
  width: 6px;
  height: 6px;
  background: #9ca3af;
  border-radius: 50%;
  animation: typing 1.4s infinite ease-in-out both;
}

.typing-indicator span:nth-child(1) {
  animation-delay: -0.32s;
}

.typing-indicator span:nth-child(2) {
  animation-delay: -0.16s;
}

@keyframes typing {
  0%, 80%, 100% {
    transform: scale(0.6);
    opacity: 0.5;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
}

:deep(.message-body strong) {
  font-weight: 600;
  color: inherit;
}

:deep(.message-body em) {
  font-style: italic;
}

:deep(.message-body code.inline-code) {
  background: rgba(0, 0, 0, 0.05);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Fira Code', monospace;
  font-size: 12px;
}

:deep(.message-bubble.user code.inline-code) {
  background: rgba(255, 255, 255, 0.2);
}

:deep(.message-body pre.code-block) {
  background: #1e1e1e;
  padding: 12px;
  border-radius: 8px;
  overflow-x: auto;
  margin: 8px 0;
}

:deep(.message-body pre.code-block code) {
  color: #d4d4d4;
  font-family: 'Fira Code', monospace;
  font-size: 12px;
  line-height: 1.5;
}
</style>

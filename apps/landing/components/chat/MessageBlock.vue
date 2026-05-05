<template>
  <div class="message-bubble" :class="message.role">
    <div v-if="isLoading" class="typing-indicator">
      <span></span>
      <span></span>
      <span></span>
    </div>
    <div v-else class="message-body">
      <!-- Array content (MessageContent[]) -->
      <template v-if="isArrayContent">
        <div
          v-for="(block, idx) in contentBlocks"
          :key="idx"
          class="content-block"
          :class="block.type"
        >
          <!-- Text block -->
          <div v-if="block.type === 'text'" v-html="renderMarkdown(block.content)" />

          <!-- Code block -->
          <div v-else-if="block.type === 'code'" class="code-wrapper">
            <div class="code-header">
              <span class="code-lang">{{ block.language || 'code' }}</span>
              <button class="copy-btn" @click="copyCode(block.content)">
                <el-icon><DocumentCopy /></el-icon>
                <span>{{ copiedId === idx ? 'Copied' : 'Copy' }}</span>
              </button>
            </div>
            <pre class="code-block"><code>{{ block.content }}</code></pre>
          </div>

          <!-- Thinking block -->
          <div v-else-if="block.type === 'thinking'" class="thinking-snippet">
            <el-icon><Cpu /></el-icon>
            <span>{{ block.content }}</span>
          </div>

          <!-- Image / File placeholders -->
          <div v-else-if="block.type === 'image'" class="media-placeholder">
            <el-icon><Picture /></el-icon>
            <span>[Image: {{ block.fileName || 'attachment' }}]</span>
          </div>
          <div v-else-if="block.type === 'file'" class="media-placeholder">
            <el-icon><Document /></el-icon>
            <span>[File: {{ block.fileName || 'attachment' }}]</span>
          </div>
        </div>
      </template>

      <!-- Plain string content -->
      <template v-else>
        <div v-html="renderedContent" />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { DocumentCopy, Cpu, Picture, Document } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { renderMarkdown } from '~/utils/renderMarkdown'
import type { ChatMessage, MessageContent } from '~/stores/chat'

interface Props {
  message: ChatMessage
  isLoading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isLoading: false,
})

const copiedId = ref<number | null>(null)

const isArrayContent = computed(() => {
  return Array.isArray(props.message.content)
})

const contentBlocks = computed((): MessageContent[] => {
  if (Array.isArray(props.message.content)) {
    return props.message.content as MessageContent[]
  }
  return []
})

const renderedContent = computed(() => {
  if (typeof props.message.content !== 'string') {
    return (props.message.content as any[])
      .map((c) => c.content)
      .join('\n')
  }
  return renderMarkdown(props.message.content)
})

async function copyCode(code: string) {
  try {
    await navigator.clipboard.writeText(code)
    ElMessage.success('代码已复制到剪贴板')
  } catch {
    // Fallback for older browsers
    const textarea = document.createElement('textarea')
    textarea.value = code
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
    ElMessage.success('代码已复制到剪贴板')
  }
}
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

/* Content blocks */
.content-block {
  margin: 4px 0;
}

.content-block:first-child {
  margin-top: 0;
}

.content-block:last-child {
  margin-bottom: 0;
}

/* Code block */
.code-wrapper {
  margin: 8px 0;
  border-radius: 8px;
  overflow: hidden;
  background: #1e1e1e;
}

.code-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  background: #2d2d2d;
  border-bottom: 1px solid #3d3d3d;
}

.code-lang {
  font-size: 11px;
  color: #9ca3af;
  font-family: 'Fira Code', monospace;
  text-transform: uppercase;
}

.copy-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 4px;
  border: none;
  background: transparent;
  color: #9ca3af;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.copy-btn:hover {
  background: #3d3d3d;
  color: #e5e7eb;
}

.code-block {
  padding: 12px;
  margin: 0;
  overflow-x: auto;
}

.code-block code {
  color: #d4d4d4;
  font-family: 'Fira Code', 'Consolas', monospace;
  font-size: 12px;
  line-height: 1.5;
}

/* Thinking snippet */
.thinking-snippet {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 6px;
  background: #eff6ff;
  color: #1e40af;
  font-size: 12px;
  font-style: italic;
}

.thinking-snippet .el-icon {
  font-size: 14px;
}

/* Media placeholder */
.media-placeholder {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  border-radius: 8px;
  background: #f9fafb;
  border: 1px dashed #d1d5db;
  color: #6b7280;
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

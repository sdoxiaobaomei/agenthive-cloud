<template>
  <div class="think-block" :class="{ expanded, 'has-content': hasContent }">
    <div class="think-header" @click="toggleExpand">
      <div class="think-badge">
        <el-icon class="brain-icon"><Cpu /></el-icon>
        <span class="think-label">思考</span>
      </div>
      <span class="think-summary">{{ summaryText }}</span>
      <el-icon class="expand-icon" :class="{ expanded }">
        <ArrowDown />
      </el-icon>
    </div>
    <transition name="expand">
      <div v-if="expanded && hasContent" class="think-content">
        <div class="think-body" v-html="renderedContent"></div>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ArrowDown, Cpu } from '@element-plus/icons-vue'
import { renderMarkdown } from '~/utils/renderMarkdown'
import type { ChatMessage } from '~/stores/chat'

interface Props {
  message: ChatMessage
}

const props = defineProps<Props>()

const expanded = ref(false)

const toggleExpand = () => {
  expanded.value = !expanded.value
}

const summaryText = computed(() => {
  return props.message.thinkSummary
    || props.message.metadata?.thinkSummary
    || 'Agent 正在思考...'
})

const hasContent = computed(() => {
  const content = props.message.thinkContent
    || props.message.metadata?.thinkContent
    || props.message.content
  return !!content && content !== '分析中...' && content !== '分析完成'
})

const renderedContent = computed(() => {
  const content = props.message.thinkContent
    || props.message.metadata?.thinkContent
    || props.message.content
    || ''
  return renderMarkdown(content)
})
</script>

<style scoped>
.think-block {
  padding: 8px 12px;
  border-radius: 10px;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  border: 1px solid #e2e8f0;
  font-size: 13px;
  line-height: 1.6;
  color: #475569;
  transition: all 0.2s ease;
}

.think-block.has-content {
  border-color: #cbd5e1;
}

.think-block.has-content:hover {
  border-color: #94a3b8;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.think-header {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
}

.think-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 6px;
  background: #e0e7ff;
  color: #4338ca;
  font-size: 11px;
  font-weight: 600;
  flex-shrink: 0;
}

.brain-icon {
  font-size: 13px;
  animation: pulse 2s infinite ease-in-out;
}

@keyframes pulse {
  0%, 100% {
    opacity: 0.7;
    transform: scale(1);
  }
  50% {
    opacity: 1;
    transform: scale(1.1);
  }
}

.think-label {
  font-size: 11px;
}

.think-summary {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #64748b;
  font-size: 12px;
}

.expand-icon {
  flex-shrink: 0;
  transition: transform 0.2s ease;
  color: #94a3b8;
  font-size: 14px;
}

.expand-icon.expanded {
  transform: rotate(180deg);
}

.think-content {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #e2e8f0;
}

.think-body {
  word-break: break-word;
  color: #475569;
  font-size: 12px;
  line-height: 1.7;
}

/* Expand transition */
.expand-enter-active,
.expand-leave-active {
  transition: all 0.25s ease;
  overflow: hidden;
}

.expand-enter-from,
.expand-leave-to {
  max-height: 0;
  opacity: 0;
  margin-top: 0;
  padding-top: 0;
}

.expand-enter-to,
.expand-leave-from {
  max-height: 600px;
  opacity: 1;
}

:deep(.think-body strong) {
  font-weight: 600;
  color: #334155;
}

:deep(.think-body code.inline-code) {
  background: rgba(0, 0, 0, 0.05);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Fira Code', monospace;
  font-size: 11px;
}

:deep(.think-body pre.code-block) {
  background: #1e1e1e;
  padding: 10px;
  border-radius: 6px;
  overflow-x: auto;
  margin: 6px 0;
}

:deep(.think-body pre.code-block code) {
  color: #d4d4d4;
  font-family: 'Fira Code', monospace;
  font-size: 11px;
  line-height: 1.5;
}
</style>

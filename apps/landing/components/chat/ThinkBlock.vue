<template>
  <div class="think-block" :class="{ expanded }">
    <div class="think-header" @click="toggleExpand">
      <el-tag size="small" type="info" class="think-tag">思考</el-tag>
      <span class="think-summary">{{ message.thinkSummary || 'Agent 正在思考...' }}</span>
      <el-icon class="expand-icon" :class="{ expanded }">
        <ArrowDown />
      </el-icon>
    </div>
    <transition name="expand">
      <div v-if="expanded" class="think-content">
        <div class="think-body" v-html="renderedContent"></div>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ArrowDown } from '@element-plus/icons-vue'
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

const renderedContent = computed(() => {
  const content = props.message.thinkContent || ''
  return renderMarkdown(content)
})
</script>

<style scoped>
.think-block {
  padding: 10px 14px;
  border-radius: 12px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  font-size: 13px;
  line-height: 1.6;
  color: #374151;
}

.think-header {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
}

.think-tag {
  flex-shrink: 0;
}

.think-summary {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #6b7280;
  font-size: 12px;
}

.expand-icon {
  flex-shrink: 0;
  transition: transform 0.2s ease;
  color: #9ca3af;
}

.expand-icon.expanded {
  transform: rotate(180deg);
}

.think-content {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid #e5e7eb;
}

.think-body {
  word-break: break-word;
}

/* Expand transition */
.expand-enter-active,
.expand-leave-active {
  transition: all 0.2s ease;
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
  max-height: 500px;
  opacity: 1;
}

:deep(.think-body strong) {
  font-weight: 600;
}

:deep(.think-body code.inline-code) {
  background: rgba(0, 0, 0, 0.05);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Fira Code', monospace;
  font-size: 12px;
}

:deep(.think-body pre.code-block) {
  background: #1e1e1e;
  padding: 12px;
  border-radius: 8px;
  overflow-x: auto;
  margin: 8px 0;
}

:deep(.think-body pre.code-block code) {
  color: #d4d4d4;
  font-family: 'Fira Code', monospace;
  font-size: 12px;
  line-height: 1.5;
}
</style>

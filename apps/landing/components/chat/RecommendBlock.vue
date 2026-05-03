<template>
  <div class="recommend-block">
    <div class="recommend-header">
      <el-icon><InfoFilled /></el-icon>
      <span>请选择一个选项</span>
      <button class="dismiss-btn" @click="$emit('dismiss')">
        <el-icon><Close /></el-icon>
      </button>
    </div>
    <div class="recommend-options">
      <div
        v-for="option in message.options"
        :key="option.id"
        class="option-card"
        @click="$emit('select', option.id)"
      >
        <el-icon v-if="option.icon" class="option-icon">
          <component :is="resolveIcon(option.icon)" />
        </el-icon>
        <div class="option-content">
          <span class="option-label">{{ option.label }}</span>
          <span class="option-prompt">{{ option.prompt }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { InfoFilled, Close } from '@element-plus/icons-vue'
import type { ChatMessage } from '~/stores/chat'

interface Props {
  message: ChatMessage
}

defineProps<Props>()

defineEmits<{
  select: [optionId: string]
  dismiss: []
}>()

function resolveIcon(iconName: string) {
  // 动态解析 Element Plus 图标
  // 实际使用时可以通过映射表返回对应图标组件
  return InfoFilled
}
</script>

<style scoped>
.recommend-block {
  padding: 14px 16px;
  border-radius: 12px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  font-size: 13px;
}

.recommend-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  color: #374151;
  font-weight: 500;
}

.dismiss-btn {
  margin-left: auto;
  width: 24px;
  height: 24px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: #9ca3af;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.dismiss-btn:hover {
  background: #f3f4f6;
  color: #6b7280;
}

.recommend-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.option-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 10px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  cursor: pointer;
  transition: all 0.15s ease;
}

.option-card:hover {
  background: #eff6ff;
  border-color: #bfdbfe;
  transform: translateY(-1px);
}

.option-icon {
  flex-shrink: 0;
  color: #4f46e5;
  font-size: 18px;
}

.option-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.option-label {
  font-weight: 600;
  color: #111827;
  font-size: 13px;
}

.option-prompt {
  font-size: 12px;
  color: #6b7280;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>

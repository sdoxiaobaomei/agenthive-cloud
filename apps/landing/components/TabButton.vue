<template>
  <div class="tab-container">
    <div class="tab-list">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="tab-button"
        :class="{ active: modelValue === tab.id }"
        @click="handleTabClick(tab.id)"
      >
        <span class="tab-icon">
          <el-icon v-if="tab.icon"><component :is="tab.icon" /></el-icon>
        </span>
        <span class="tab-label">{{ tab.label }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Tab {
  id: string
  label: string
  icon?: any
}

const props = defineProps<{
  modelValue: string
  tabs: Tab[]
}>()

const emit = defineEmits<{
  'update:modelValue': [id: string]
}>()

const handleTabClick = (id: string) => {
  emit('update:modelValue', id)
}
</script>

<style scoped>
.tab-container {
  display: flex;
  align-items: center;
  flex: 1;
  justify-content: center;
}

.tab-list {
  display: flex;
  align-items: center;
  gap: 4px;
  background: #f0f0f0;
  padding: 4px;
  border-radius: 8px;
}

.tab-button {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  height: 32px;
  border-radius: 6px;
  border: none;
  background: transparent;
  cursor: pointer;
  transition: all 0.15s ease;
  font-size: 13px;
  font-weight: 500;
  color: #666;
}

.tab-button:hover {
  background: rgba(0, 0, 0, 0.05);
  color: #333;
}

.tab-button.active {
  background: #ffffff;
  color: #1a1a1a;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.tab-icon {
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.tab-icon .el-icon {
  font-size: 14px;
}

.tab-label {
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
}
</style>

<template>
  <div class="progress-bar" :class="[status, progressClass]">
    <div 
      class="progress-bar-inner" 
      :style="{ width: percentage + '%' }"
    ></div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  percentage: number
  showText?: boolean
  strokeWidth?: number
  status?: string
  progressClass?: string
}>()
</script>

<style scoped>
.progress-bar {
  width: 100%;
  height: 4px;
  background-color: var(--el-border-color-lighter);
  border-radius: 2px;
  overflow: hidden;
}

.progress-bar-inner {
  height: 100%;
  background-color: var(--el-color-primary);
  border-radius: 2px;
  transition: width 0.3s ease;
}

.progress-bar.success .progress-bar-inner {
  background-color: var(--el-color-success);
}

.progress-bar.warning .progress-bar-inner {
  background-color: var(--el-color-warning);
}

.progress-bar.exception .progress-bar-inner {
  background-color: var(--el-color-danger);
}
</style>

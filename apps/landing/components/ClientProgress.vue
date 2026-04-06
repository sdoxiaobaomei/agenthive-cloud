<template>
  <ClientOnly>
    <el-progress
      :percentage="percentage"
      :status="status"
      :stroke-width="strokeWidth"
      :show-text="showText"
      :class="progressClass"
    />
  </ClientOnly>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  percentage?: number
  status?: '' | 'success' | 'exception' | 'warning'
  strokeWidth?: number
  showText?: boolean
  progressClass?: string
}>(), {
  percentage: 0,
  status: '',
  strokeWidth: 6,
  showText: true,
  progressClass: '',
})
</script>

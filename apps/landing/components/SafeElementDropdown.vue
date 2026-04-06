<template>
  <ClientRender :show-loading="false">
    <el-dropdown v-bind="$attrs" :trigger="trigger">
      <slot name="default">
        <span class="dropdown-trigger">
          {{ label }}
          <el-icon><ArrowDown /></el-icon>
        </span>
      </slot>
      <template #dropdown>
        <slot name="dropdown" />
      </template>
    </el-dropdown>
  </ClientRender>
</template>

<script setup lang="ts">
/**
 * SafeElementDropdown - SSR 安全的 Element Plus 下拉菜单
 * 
 * 使用示例:
 * <SafeElementDropdown label="更多">
 *   <template #dropdown>
 *     <el-dropdown-menu>
 *       <el-dropdown-item>选项1</el-dropdown-item>
 *     </el-dropdown-menu>
 *   </template>
 * </SafeElementDropdown>
 */
import { ArrowDown } from '@element-plus/icons-vue'

defineProps<{
  label?: string
  trigger?: 'hover' | 'click' | 'contextmenu'
}>()

defineOptions({
  inheritAttrs: false
})
</script>

<style scoped>
.dropdown-trigger {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
}
</style>

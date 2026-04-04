<template>
  <div class="sprint-board-page">
    <div class="page-header">
      <div>
        <h1 class="page-title">Sprint 管理</h1>
        <p class="page-subtitle">规划和管理迭代周期</p>
      </div>
      <el-button type="primary" :icon="Plus" @click="ElMessage.info('功能开发中')">
        新建 Sprint
      </el-button>
    </div>
    
    <el-empty description="功能开发中，敬请期待">
      <template #image>
        <el-icon :size="64" color="var(--el-text-color-secondary)"><Calendar /></el-icon>
      </template>
    </el-empty>
  </div>
</template>

<script setup lang="ts">
import { Plus, Calendar } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
</script>

<style scoped>
.sprint-board-page {
  padding: 8px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
}

.page-title {
  margin: 0 0 8px 0;
  font-size: 24px;
  font-weight: 600;
}

.page-subtitle {
  margin: 0;
  color: var(--el-text-color-secondary);
}
</style>

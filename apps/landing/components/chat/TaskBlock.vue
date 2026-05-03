<template>
  <div class="task-block">
    <el-tag size="small" type="warning" class="task-tag">任务</el-tag>
    <div class="task-list">
      <div
        v-for="task in message.tasks"
        :key="task.id"
        class="task-card"
        :class="task.status"
      >
        <div class="task-info">
          <span class="task-title">{{ task.title }}</span>
          <span v-if="task.description" class="task-desc">{{ task.description }}</span>
          <div class="task-meta">
            <el-tag v-if="task.workerRole" size="small">{{ task.workerRole }}</el-tag>
            <span class="task-status" :class="task.status">{{ statusLabel(task.status) }}</span>
          </div>
        </div>
        <div v-if="task.status === 'pending'" class="task-actions">
          <el-button size="small" type="primary" @click="$emit('approve', task.id)">
            确认
          </el-button>
          <el-button size="small" type="danger" plain @click="$emit('decline', task.id)">
            拒绝
          </el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ChatMessage } from '~/stores/chat'

interface Props {
  message: ChatMessage
}

defineProps<Props>()

defineEmits<{
  approve: [taskId: string]
  decline: [taskId: string]
}>()

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: '待处理',
    approved: '已确认',
    declined: '已拒绝',
    running: '执行中',
    completed: '已完成',
    failed: '失败',
  }
  return labels[status] || status
}
</script>

<style scoped>
.task-block {
  padding: 10px 14px;
  border-radius: 12px;
  background: #fffbeb;
  border: 1px solid #fde68a;
  font-size: 13px;
}

.task-tag {
  margin-bottom: 8px;
}

.task-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.task-card {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
}

.task-card.running {
  background: #eff6ff;
  border-color: #bfdbfe;
}

.task-card.completed {
  background: #f0fdf4;
  border-color: #bbf7d0;
}

.task-card.failed {
  background: #fef2f2;
  border-color: #fecaca;
}

.task-card.approved {
  background: #f0fdf4;
  border-color: #bbf7d0;
}

.task-card.declined {
  background: #f3f4f6;
  border-color: #d1d5db;
}

.task-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.task-title {
  font-weight: 600;
  color: #111827;
  font-size: 13px;
}

.task-desc {
  font-size: 12px;
  color: #6b7280;
}

.task-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
}

.task-status {
  font-size: 11px;
  font-weight: 500;
  padding: 2px 6px;
  border-radius: 4px;
}

.task-status.pending {
  background: #fef3c7;
  color: #92400e;
}

.task-status.approved {
  background: #dcfce7;
  color: #166534;
}

.task-status.declined {
  background: #f3f4f6;
  color: #4b5563;
}

.task-status.running {
  background: #dbeafe;
  color: #1e40af;
}

.task-status.completed {
  background: #dcfce7;
  color: #166534;
}

.task-status.failed {
  background: #fee2e2;
  color: #991b1b;
}

.task-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}
</style>

<template>
  <div class="ticket-card" :class="[`status-${ticket.status}`, { active: isActive }]" @click="$emit('click', ticket.id)">
    <div class="ticket-header">
      <AgentAvatar :role="avatarRole" :size="28" />
      <span class="ticket-id">{{ ticket.id }}</span>
      <el-tag :type="statusTagType" size="small" class="ticket-status">{{ statusLabel }}</el-tag>
    </div>
    <div class="ticket-body">
      <p class="ticket-task">{{ ticket.task }}</p>
      <div v-if="ticket.fileConflicts?.length" class="ticket-conflict">
        <el-icon><Warning /></el-icon>
        <span>文件冲突: {{ ticket.fileConflicts.length }}</span>
      </div>
      <div v-if="ticket.retryCount" class="ticket-retry">
        <span>重试 {{ ticket.retryCount }}/3</span>
      </div>
    </div>
    <div v-if="ticket.changedFiles?.length" class="ticket-footer">
      <el-icon><Document /></el-icon>
      <span>{{ ticket.changedFiles.length }} 个文件</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ExecutionTicket, WorkerRole } from '@/types/execution'
import AgentAvatar from '@/components/agent/AgentAvatar.vue'
import { Warning, Document } from '@element-plus/icons-vue'

const props = defineProps<{
  ticket: ExecutionTicket
  isActive?: boolean
}>()

defineEmits<{
  click: [ticketId: string]
}>()

const avatarRole = computed(() => {
  const map: Record<WorkerRole, any> = {
    frontend_dev: 'frontend_dev',
    backend_dev: 'backend_dev',
    qa_engineer: 'qa_engineer',
    orchestrator: 'tech_lead',
  }
  return map[props.ticket.role]
})

const statusLabel = computed(() => {
  const map: Record<string, string> = {
    pending: '待执行',
    doing: '进行中',
    review: '待审查',
    done: '已完成',
    failed: '失败',
  }
  return map[props.ticket.status] || props.ticket.status
})

const statusTagType = computed(() => {
  const map: Record<string, any> = {
    pending: 'info',
    doing: 'warning',
    review: '',
    done: 'success',
    failed: 'danger',
  }
  return map[props.ticket.status] || 'info'
})
</script>

<style scoped>
.ticket-card {
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  padding: 12px;
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 10px;
}
.ticket-card:hover {
  border-color: var(--el-color-primary);
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}
.ticket-card.active {
  border-color: var(--el-color-primary);
  box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.2);
}
.ticket-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.ticket-id {
  font-weight: 600;
  font-size: 13px;
  color: var(--el-text-color-regular);
  flex: 1;
}
.ticket-status {
  font-size: 11px;
}
.ticket-body {
  font-size: 13px;
  color: var(--el-text-color-primary);
}
.ticket-task {
  margin: 0 0 6px;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.ticket-conflict {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--el-color-danger);
  margin-top: 4px;
}
.ticket-retry {
  font-size: 11px;
  color: var(--el-color-warning);
  margin-top: 4px;
}
.ticket-footer {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--el-text-color-secondary);
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--el-border-color-lighter);
}
</style>

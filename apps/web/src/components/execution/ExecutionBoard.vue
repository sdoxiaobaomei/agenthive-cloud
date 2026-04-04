<template>
  <div class="execution-board">
    <div class="board-header">
      <h3>Way A 执行控制台</h3>
      <div class="board-actions">
        <el-button size="small" @click="loadDemo">加载示例 Plan</el-button>
        <el-button size="small" type="primary" @click="exportLog" :disabled="!store.currentSession">导出日志</el-button>
      </div>
    </div>

    <div v-if="!store.currentSession" class="board-empty">
      <el-empty description="暂无执行会话">
        <el-button type="primary" @click="loadDemo">加载示例 Plan</el-button>
      </el-empty>
    </div>

    <div v-else class="board-kanban">
      <div class="kanban-col">
        <div class="col-header">
          <span class="col-dot dot-pending" />
          <span>待执行</span>
          <el-tag size="small" type="info">{{ store.ticketsByStatus.pending.length }}</el-tag>
        </div>
        <div class="col-body">
          <TicketCard
            v-for="t in store.ticketsByStatus.pending"
            :key="t.id"
            :ticket="t"
            :is-active="store.activeTicket?.id === t.id"
            @click="selectTicket"
          />
        </div>
      </div>

      <div class="kanban-col">
        <div class="col-header">
          <span class="col-dot dot-doing" />
          <span>进行中</span>
          <el-tag size="small" type="warning">{{ store.ticketsByStatus.doing.length }}</el-tag>
        </div>
        <div class="col-body">
          <TicketCard
            v-for="t in store.ticketsByStatus.doing"
            :key="t.id"
            :ticket="t"
            :is-active="store.activeTicket?.id === t.id"
            @click="selectTicket"
          />
        </div>
      </div>

      <div class="kanban-col">
        <div class="col-header">
          <span class="col-dot dot-review" />
          <span>待审查</span>
          <el-tag size="small">{{ store.ticketsByStatus.review.length }}</el-tag>
        </div>
        <div class="col-body">
          <TicketCard
            v-for="t in store.ticketsByStatus.review"
            :key="t.id"
            :ticket="t"
            :is-active="store.activeTicket?.id === t.id"
            @click="selectTicket"
          />
        </div>
      </div>

      <div class="kanban-col">
        <div class="col-header">
          <span class="col-dot dot-done" />
          <span>已完成</span>
          <el-tag size="small" type="success">{{ store.ticketsByStatus.done.length }}</el-tag>
        </div>
        <div class="col-body">
          <TicketCard
            v-for="t in store.ticketsByStatus.done"
            :key="t.id"
            :ticket="t"
            :is-active="store.activeTicket?.id === t.id"
            @click="selectTicket"
          />
        </div>
      </div>
    </div>

    <!-- 底部失败列 -->
    <div v-if="store.ticketsByStatus.failed.length" class="board-failed">
      <div class="col-header">
        <span class="col-dot dot-failed" />
        <span>失败</span>
        <el-tag size="small" type="danger">{{ store.ticketsByStatus.failed.length }}</el-tag>
      </div>
      <div class="failed-list">
        <TicketCard
          v-for="t in store.ticketsByStatus.failed"
          :key="t.id"
          :ticket="t"
          :is-active="store.activeTicket?.id === t.id"
          @click="selectTicket"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useExecutionStore } from '@/stores/execution'
import { demoPlan } from '@/utils/execution-demo'
import TicketCard from './TicketCard.vue'
import { ElMessage } from 'element-plus'

const store = useExecutionStore()

onMounted(() => {
  // 如果 localStorage 里有会话，默认选中第一个
  if (store.sessions.length && !store.currentSessionId) {
    store.currentSessionId = store.sessions[0].id
  }
})

function loadDemo() {
  store.createSession(demoPlan)
  ElMessage.success('已加载示例 Plan')
}

function selectTicket(id: string) {
  store.setActiveTicket(id)
}

function exportLog() {
  const md = store.exportSessionMarkdown()
  const blob = new Blob([md], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `way-a-session-${store.currentSession!.id}.md`
  a.click()
  URL.revokeObjectURL(url)
  ElMessage.success('日志已导出')
}
</script>

<style scoped>
.execution-board {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 16px;
}
.board-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.board-header h3 {
  margin: 0;
  font-size: 18px;
}
.board-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}
.board-kanban {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  min-height: 0;
}
.kanban-col {
  background: var(--el-fill-color-lighter);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.col-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  font-weight: 600;
  font-size: 14px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.col-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.dot-pending { background: var(--el-color-info); }
.dot-doing { background: var(--el-color-warning); }
.dot-review { background: var(--el-color-primary); }
.dot-done { background: var(--el-color-success); }
.dot-failed { background: var(--el-color-danger); }
.col-body {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
  min-height: 0;
}
.board-failed {
  margin-top: 12px;
  background: rgba(245, 108, 108, 0.06);
  border: 1px solid var(--el-color-danger-light-9);
  border-radius: 8px;
  padding: 10px 12px;
}
.failed-list {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 8px;
}
.failed-list .ticket-card {
  width: 240px;
  margin-bottom: 0;
}
</style>
